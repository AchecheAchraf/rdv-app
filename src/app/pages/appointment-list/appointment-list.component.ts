import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { FhirService } from '../../services/fhir.service';
import { Appointment, statusLabel, APPOINTMENT_STATUSES } from '../../models/fhir.model';

@Component({
  selector: 'app-appointment-list',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './appointment-list.component.html',
  styleUrl: './appointment-list.component.scss',
})
export class AppointmentListComponent {
  private fhir = inject(FhirService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly appointments = signal<Appointment[]>([]);

  // Filtres
  readonly query = signal('');
  readonly statusFilter = signal<string>('all');
  readonly patientFilter = signal<string>('all');
  readonly practitionerFilter = signal<string>('all');
  readonly locationFilter = signal<string>('all');
  readonly dateFilter = signal<string>('');   // YYYY-MM-DD ou vide

  readonly statuses = APPOINTMENT_STATUSES;

  /** Liste unique des acteurs (patients/soignants/salles) extraits
   *  des rendez-vous chargés. Sert à alimenter les dropdowns de filtre. */
  readonly uniqueActors = computed(() => {
    const patients = new Map<string, string>();
    const practitioners = new Map<string, string>();
    const locations = new Map<string, string>();
    for (const a of this.appointments()) {
      for (const p of (a.participant ?? [])) {
        const ref = p.actor?.reference;
        if (!ref) continue;
        const [type, id] = ref.split('/');
        if (!id) continue;
        const display = p.actor?.display || ref;
        if (type === 'Patient') patients.set(id, display);
        else if (type === 'Practitioner') practitioners.set(id, display);
        else if (type === 'Location') locations.set(id, display);
      }
    }
    const toList = (m: Map<string, string>) =>
      Array.from(m, ([id, display]) => ({ id, display }))
        .sort((a, b) => a.display.localeCompare(b.display, 'fr'));
    return {
      patients: toList(patients),
      practitioners: toList(practitioners),
      locations: toList(locations),
    };
  });

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const status = this.statusFilter();
    const patientId = this.patientFilter();
    const practitionerId = this.practitionerFilter();
    const locationId = this.locationFilter();
    const date = this.dateFilter();

    return this.appointments().filter((a) => {
      // Statut
      if (status !== 'all' && a.status !== status) return false;

      // Date (YYYY-MM-DD)
      if (date) {
        if (!a.start) return false;
        const startDay = new Date(a.start).toISOString().slice(0, 10);
        if (startDay !== date) return false;
      }

      // Acteurs (référence Type/id)
      const refs = (a.participant ?? []).map((p) => p.actor?.reference ?? '');
      if (patientId !== 'all'      && !refs.includes(`Patient/${patientId}`))           return false;
      if (practitionerId !== 'all' && !refs.includes(`Practitioner/${practitionerId}`)) return false;
      if (locationId !== 'all'     && !refs.includes(`Location/${locationId}`))         return false;

      // Recherche libre
      if (!q) return true;
      const haystack = [
        a.id,
        a.description,
        a.appointmentType?.coding?.[0]?.display,
        ...(a.participant ?? []).flatMap((p) => [
          p.actor?.display,
          p.actor?.reference,
          p.actor?.identifier?.value,
        ]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  });

  /** Nombre de filtres actifs hors recherche texte. */
  readonly activeFiltersCount = computed(() => {
    let n = 0;
    if (this.statusFilter() !== 'all')       n++;
    if (this.patientFilter() !== 'all')      n++;
    if (this.practitionerFilter() !== 'all') n++;
    if (this.locationFilter() !== 'all')     n++;
    if (this.dateFilter())                   n++;
    return n;
  });

  /** Reset tous les filtres. */
  resetFilters(): void {
    this.query.set('');
    this.statusFilter.set('all');
    this.patientFilter.set('all');
    this.practitionerFilter.set('all');
    this.locationFilter.set('all');
    this.dateFilter.set('');
  }

  statusLabel = statusLabel;

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.error.set(null);
    this.fhir.list(50).subscribe({
      next: (list) => {
        this.appointments.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Impossible de charger les rendez-vous.');
        this.loading.set(false);
      },
    });
  }

  /** Renvoie l'acteur d'un slice donné. */
  actor(a: Appointment, type: 'Patient' | 'Practitioner' | 'Location'): string {
    const p = (a.participant ?? []).find((x) =>
      (x.actor?.reference ?? '').toLowerCase().startsWith(type.toLowerCase()),
    );
    return p?.actor?.display ?? p?.actor?.reference ?? '—';
  }

  rpps(a: Appointment): string | null {
    const p = (a.participant ?? []).find((x) =>
      (x.actor?.reference ?? '').toLowerCase().startsWith('practitioner'),
    );
    return p?.actor?.identifier?.value ?? null;
  }

  formatDate(iso?: string): string {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat('fr-FR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch {
      return iso;
    }
  }

  badgeClass(status: string | undefined): string {
    return `badge badge--${status ?? 'proposed'}`;
  }

  /** Fallback : si l'autoplay est bloqué, on tente play() à la main
   *  dès que le navigateur a assez de données. La promesse silencieusement
   *  rejette si le navigateur refuse, et on retombe sur un freeze frame —
   *  pas grave, c'est juste un asset décoratif. */
  onVideoCanPlay(event: Event): void {
    const v = event.target as HTMLVideoElement;
    v.muted = true;
    const p = v.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {/* autoplay refusé, on ignore */});
    }
  }
}
