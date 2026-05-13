import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { FhirService } from '../../services/fhir.service';
import {
  Appointment,
  APPOINTMENT_STATUSES,
  APPOINTMENT_TYPES,
  APPOINTMENT_TYPE_SYSTEM,
  HumanName,
  Location as FhirLocation,
  Patient,
  Practitioner,
  RPPS_SYSTEM,
} from '../../models/fhir.model';

@Component({
  selector: 'app-appointment-create',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './appointment-create.component.html',
  styleUrl: './appointment-create.component.scss',
})
export class AppointmentCreateComponent {
  private fb = inject(FormBuilder);
  private fhir = inject(FhirService);
  private router = inject(Router);

  /** ID du RDV à éditer. Si absent, on est en mode création. */
  readonly id = input<string | undefined>();

  readonly mode = computed<'create' | 'edit'>(() => (this.id() ? 'edit' : 'create'));

  readonly types = APPOINTMENT_TYPES;
  readonly statuses = APPOINTMENT_STATUSES;

  readonly submitting = signal(false);
  readonly serverError = signal<string | null>(null);

  // Listes chargées depuis le serveur FHIR
  readonly patients = signal<Patient[]>([]);
  readonly practitioners = signal<Practitioner[]>([]);
  readonly locations = signal<FhirLocation[]>([]);
  readonly loadingRefs = signal(true);
  readonly loadError = signal<string | null>(null);

  /** Origine du RPPS affiché : 'real' = trouvé dans Practitioner.identifier
   *  (système OID RPPS), 'synthetic' = généré par l'app car le serveur
   *  ne livre pas ce champ. */
  readonly rppsSource = signal<'real' | 'synthetic' | null>(null);

  /** Valeur par défaut : prochaine heure pleine. */
  private nextHour(): { startIso: string; endIso: string } {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    const start = new Date(now);
    const end = new Date(now);
    end.setMinutes(end.getMinutes() + 30);
    return { startIso: this.toLocalIso(start), endIso: this.toLocalIso(end) };
  }

  private toLocalIso(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  readonly form = this.fb.nonNullable.group({
    description: ['', [Validators.required, Validators.minLength(3)]],
    appointmentType: ['ROUTINE', Validators.required],
    status: ['booked', Validators.required],
    start: [this.nextHour().startIso, Validators.required],
    end:   [this.nextHour().endIso,   Validators.required],

    patientId:      ['', Validators.required],
    practitionerId: ['', Validators.required],
    rpps:           ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],
    locationId:     ['', Validators.required],
  });

  constructor() {
    this.loadReferenceData();

    // En mode édition, on charge le RDV et on pré-remplit le formulaire
    // dès que la donnée et l'ID sont disponibles.
    effect(() => {
      const editId = this.id();
      if (!editId) return;
      if (this.loadingRefs()) return;
      this.loadExistingAppointment(editId);
    });

    // Quand on choisit un soignant : on remplit TOUJOURS le RPPS.
    //  - Si le Practitioner a un identifier RPPS officiel → on l'utilise
    //  - Sinon → on génère un RPPS déterministe (même soignant → même RPPS)
    // On s'abonne à valueChanges (RxJS) car FormControl.value n'est pas un
    // signal réactif — un effect() ne se redéclenche pas dessus.
    this.form.controls.practitionerId.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((id) => {
        if (!id) {
          this.rppsSource.set(null);
          return;
        }
        const p = this.practitioners().find((x) => x.id === id);
        if (!p) return;
        this.form.patchValue({ rpps: this.rppsFor(p) });
        this.rppsSource.set(this.hasRealRpps(p) ? 'real' : 'synthetic');
      });
  }

  /** Génère un RPPS déterministe à 11 chiffres à partir d'une seed.
   *  Hash djb2 → string de chiffres → préfixe "1" pour ressembler à un vrai RPPS.
   *  Garantit que le même soignant aura toujours le même RPPS entre les sessions. */
  private generateSyntheticRpps(seed: string): string {
    let h = 5381;
    for (let i = 0; i < seed.length; i++) {
      h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
    }
    // 10 chiffres dérivés du hash + préfixe "1" → toujours 11 chiffres.
    const digits = h.toString().padStart(10, '0').slice(0, 10);
    return '1' + digits;
  }

  private loadReferenceData(): void {
    this.loadingRefs.set(true);
    this.loadError.set(null);
    forkJoin({
      patients: this.fhir.listPatients(100),
      practitioners: this.fhir.listPractitioners(100),
      locations: this.fhir.listLocations(100),
    }).subscribe({
      next: ({ patients, practitioners, locations }) => {
        this.patients.set(patients);
        this.practitioners.set(practitioners);
        this.locations.set(locations);
        this.loadingRefs.set(false);
      },
      error: (err) => {
        this.loadError.set(err?.message ?? 'Impossible de charger les ressources.');
        this.loadingRefs.set(false);
      },
    });
  }

  /** Charge un RDV existant et pré-remplit le formulaire. */
  private loadExistingAppointment(id: string): void {
    this.fhir.getById(id).subscribe({
      next: (a) => this.patchFormFromAppointment(a),
      error: (err) =>
        this.loadError.set(
          err?.error?.issue?.[0]?.diagnostics ??
          err?.message ??
          'Impossible de charger le rendez-vous à modifier.',
        ),
    });
  }

  /** Extrait l'ID d'une référence type "Patient/123". */
  private idFromReference(ref?: string, expectedType?: string): string {
    if (!ref) return '';
    const slash = ref.indexOf('/');
    if (slash < 0) return ref;
    const type = ref.substring(0, slash);
    const idPart = ref.substring(slash + 1);
    if (expectedType && type.toLowerCase() !== expectedType.toLowerCase()) return '';
    return idPart;
  }

  private patchFormFromAppointment(a: Appointment): void {
    const patient = (a.participant ?? []).find((p) =>
      (p.actor?.reference ?? '').toLowerCase().startsWith('patient'),
    );
    const practitioner = (a.participant ?? []).find((p) =>
      (p.actor?.reference ?? '').toLowerCase().startsWith('practitioner'),
    );
    const location = (a.participant ?? []).find((p) =>
      (p.actor?.reference ?? '').toLowerCase().startsWith('location'),
    );

    this.form.patchValue({
      description: a.description ?? '',
      status: a.status,
      appointmentType: a.appointmentType?.coding?.[0]?.code ?? 'ROUTINE',
      start: a.start ? this.toLocalIso(new Date(a.start)) : this.nextHour().startIso,
      end:   a.end   ? this.toLocalIso(new Date(a.end))   : this.nextHour().endIso,
      patientId:      this.idFromReference(patient?.actor?.reference, 'Patient'),
      practitionerId: this.idFromReference(practitioner?.actor?.reference, 'Practitioner'),
      rpps:           practitioner?.actor?.identifier?.value ?? '',
      locationId:     this.idFromReference(location?.actor?.reference, 'Location'),
    });
  }

  hasError(control: keyof typeof this.form.controls, error?: string): boolean {
    const c = this.form.controls[control];
    if (!c.touched && !c.dirty) return false;
    return error ? !!c.errors?.[error] : c.invalid;
  }

  /** Formate un nom humain pour affichage. */
  formatName(name?: HumanName[]): string {
    if (!name || name.length === 0) return '(sans nom)';
    const n = name[0];
    if (n.text) return n.text;
    const parts: string[] = [];
    if (n.given?.length) parts.push(n.given.join(' '));
    if (n.family) parts.push(n.family);
    return parts.join(' ').trim() || '(sans nom)';
  }

  /** Retourne le RPPS d'un soignant si trouvé dans son identifier[]. */
  private extractRpps(p: Practitioner): string | null {
    return (p.identifier ?? []).find((id) => id.system === RPPS_SYSTEM)?.value ?? null;
  }

  /** RPPS final pour un soignant : valeur du serveur si disponible,
   *  sinon valeur synthétique déterministe. Utilisé partout (label
   *  de la dropdown + champ du formulaire). */
  rppsFor(p: Practitioner): string {
    return this.extractRpps(p) ?? this.generateSyntheticRpps(p.id ?? '');
  }

  /** Indique si le RPPS du soignant vient du serveur FHIR (true)
   *  ou s'il est généré côté client pour la démo (false). */
  hasRealRpps(p: Practitioner): boolean {
    return this.extractRpps(p) !== null;
  }

  /** Format affiché dans la dropdown des soignants :
   *  Nom · #id · RPPS xxxxxxxxxxx
   *  Un marqueur ⚙ indique un RPPS auto-généré (sinon ✓). */
  practitionerLabel(p: Practitioner): string {
    const name = this.formatName(p.name);
    const id = p.id ?? '?';
    const rpps = this.rppsFor(p);
    const mark = this.hasRealRpps(p) ? '✓' : '⚙';
    return `${name} · #${id} · ${mark} RPPS ${rpps}`;
  }

  /** Construit la ressource FHIR à partir des valeurs du formulaire. */
  private buildAppointment(): Appointment {
    const v = this.form.getRawValue();
    const toIso = (local: string) => new Date(local).toISOString();

    const patient = this.patients().find((p) => p.id === v.patientId);
    const practitioner = this.practitioners().find((p) => p.id === v.practitionerId);
    const location = this.locations().find((l) => l.id === v.locationId);

    return {
      resourceType: 'Appointment',
      status: v.status as Appointment['status'],
      description: v.description,
      start: toIso(v.start),
      end:   toIso(v.end),
      appointmentType: {
        coding: [
          {
            system: APPOINTMENT_TYPE_SYSTEM,
            code: v.appointmentType,
            display: this.types.find((t) => t.code === v.appointmentType)?.display,
          },
        ],
      },
      participant: [
        {
          actor: {
            reference: `Patient/${v.patientId}`,
            type: 'Patient',
            display: patient ? this.formatName(patient.name) : v.patientId,
          },
          status: 'accepted',
          required: 'required',
        },
        {
          actor: {
            reference: `Practitioner/${v.practitionerId}`,
            type: 'Practitioner',
            display: practitioner ? this.formatName(practitioner.name) : v.practitionerId,
            identifier: { system: RPPS_SYSTEM, value: v.rpps },
          },
          status: 'accepted',
          required: 'required',
        },
        {
          actor: {
            reference: `Location/${v.locationId}`,
            type: 'Location',
            display: location?.name ?? v.locationId,
          },
          status: 'accepted',
          required: 'required',
        },
      ],
    };
  }

  submit(): void {
    this.serverError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const appointment = this.buildAppointment();
    this.submitting.set(true);

    const editId = this.id();
    const request$ = editId
      ? this.fhir.update(editId, appointment)
      : this.fhir.create(appointment);

    request$.subscribe({
      next: (saved) => {
        this.submitting.set(false);
        const targetId = saved.id ?? editId;
        if (targetId) {
          this.router.navigate(['/rdv', targetId]);
        } else {
          this.router.navigate(['/rdv']);
        }
      },
      error: (err) => {
        this.submitting.set(false);
        const detail =
          err?.error?.issue?.[0]?.diagnostics ??
          err?.message ??
          (editId
            ? 'Erreur lors de la mise à jour du rendez-vous.'
            : 'Erreur lors de la création du rendez-vous.');
        this.serverError.set(detail);
      },
    });
  }
}
