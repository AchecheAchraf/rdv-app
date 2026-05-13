import { Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { FhirService } from '../../services/fhir.service';
import { Appointment, AppointmentParticipant, statusLabel, participantStatusLabel } from '../../models/fhir.model';

@Component({
  selector: 'app-appointment-detail',
  imports: [CommonModule, RouterLink],
  templateUrl: './appointment-detail.component.html',
  styleUrl: './appointment-detail.component.scss',
})
export class AppointmentDetailComponent {
  private fhir = inject(FhirService);
  private router = inject(Router);

  /** Bound depuis l'URL via withComponentInputBinding(). */
  readonly id = input.required<string>();

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly appointment = signal<Appointment | null>(null);

  // Suppression : modal de confirmation + état
  readonly confirmDelete = signal(false);
  readonly deleting = signal(false);
  readonly deleteError = signal<string | null>(null);

  // Helpers de libellés FR
  statusLabel = statusLabel;
  participantStatusLabel = participantStatusLabel;

  readonly patient      = computed(() => this.findActor('Patient'));
  readonly practitioner = computed(() => this.findActor('Practitioner'));
  readonly location     = computed(() => this.findActor('Location'));
  readonly otherActors  = computed(() => {
    const a = this.appointment();
    if (!a) return [];
    const known = ['patient', 'practitioner', 'location'];
    return (a.participant ?? []).filter((p) => {
      const ref = (p.actor?.reference ?? '').toLowerCase();
      return !known.some((k) => ref.startsWith(k));
    });
  });

  readonly typeCode = computed(() => {
    const coding = this.appointment()?.appointmentType?.coding;
    return coding && coding.length > 0 ? coding[0].code : null;
  });

  readonly typeDisplay = computed(() => {
    const a = this.appointment();
    const coding = a?.appointmentType?.coding;
    if (coding && coding.length > 0 && coding[0].display) return coding[0].display;
    return a?.appointmentType?.text ?? null;
  });

  readonly duration = computed(() => {
    const a = this.appointment();
    if (!a?.start || !a?.end) return null;
    const ms = new Date(a.end).getTime() - new Date(a.start).getTime();
    if (Number.isNaN(ms) || ms <= 0) return null;
    const min = Math.round(ms / 60000);
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
  });

  ngOnInit(): void {
    const id = this.id();
    if (!id) return;
    this.loading.set(true);
    this.error.set(null);
    this.fhir.getById(id).subscribe({
      next: (a) => {
        this.appointment.set(a);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Rendez-vous introuvable.');
        this.loading.set(false);
      },
    });
  }

  private findActor(type: 'Patient' | 'Practitioner' | 'Location'): AppointmentParticipant | null {
    const a = this.appointment();
    if (!a) return null;
    return (
      (a.participant ?? []).find((p) =>
        (p.actor?.reference ?? '').toLowerCase().startsWith(type.toLowerCase()),
      ) ?? null
    );
  }

  formatDateTime(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }

  formatTime(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(d);
  }

  formatDateOnly(iso?: string): { day: string; month: string; weekday: string } {
    if (!iso) return { day: '—', month: '', weekday: '' };
    const d = new Date(iso);
    return {
      day: new Intl.DateTimeFormat('fr-FR', { day: '2-digit' }).format(d),
      month: new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(d).replace('.', ''),
      weekday: new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(d),
    };
  }

  // ---------- Suppression ----------

  /** Ouvre le modal de confirmation. */
  askDelete(): void {
    this.deleteError.set(null);
    this.confirmDelete.set(true);
  }

  /** Ferme le modal de confirmation. */
  cancelDelete(): void {
    if (this.deleting()) return;
    this.confirmDelete.set(false);
  }

  /** Lance la suppression effective et redirige vers la liste. */
  confirmAndDelete(): void {
    const id = this.id();
    if (!id) return;
    this.deleting.set(true);
    this.deleteError.set(null);
    this.fhir.delete(id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.confirmDelete.set(false);
        this.router.navigate(['/rdv']);
      },
      error: (err) => {
        this.deleting.set(false);
        const detail =
          err?.error?.issue?.[0]?.diagnostics ??
          err?.message ??
          'Impossible de supprimer ce rendez-vous.';
        this.deleteError.set(detail);
      },
    });
  }
}
