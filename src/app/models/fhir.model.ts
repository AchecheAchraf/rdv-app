// Modèles FHIR simplifiés pour Appointment et ressources liées.
// On ne définit que les champs qu'on utilise dans l'app.

export interface FhirIdentifier {
  use?: string;
  system?: string;
  value?: string;
}

export interface HumanName {
  use?: string;
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
}

export interface FhirReference {
  reference?: string;
  /** Type FHIR de la ressource pointée (ex. "Patient", "Practitioner", "Location"). */
  type?: string;
  display?: string;
  identifier?: {
    system?: string;
    value?: string;
  };
}

export interface Patient {
  resourceType: 'Patient';
  id?: string;
  name?: HumanName[];
  identifier?: FhirIdentifier[];
  gender?: string;
  birthDate?: string;
}

export interface Practitioner {
  resourceType: 'Practitioner';
  id?: string;
  name?: HumanName[];
  identifier?: FhirIdentifier[];
  gender?: string;
  birthDate?: string;
}

export interface Location {
  resourceType: 'Location';
  id?: string;
  name?: string;
  description?: string;
  status?: string;
}

export interface AppointmentParticipant {
  actor?: FhirReference;
  status: 'accepted' | 'declined' | 'tentative' | 'needs-action';
  required?: 'required' | 'optional' | 'information-only';
}

export type AppointmentStatus =
  | 'proposed'
  | 'pending'
  | 'booked'
  | 'arrived'
  | 'fulfilled'
  | 'cancelled'
  | 'noshow'
  | 'entered-in-error'
  | 'checked-in'
  | 'waitlist';

export interface Appointment {
  resourceType: 'Appointment';
  id?: string;
  status: AppointmentStatus;
  description?: string;
  start?: string;
  end?: string;
  created?: string;
  appointmentType?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  participant: AppointmentParticipant[];
}

export interface FhirBundle<T> {
  resourceType: 'Bundle';
  type: string;
  total?: number;
  entry?: Array<{
    resource: T;
    fullUrl?: string;
  }>;
}

export interface OperationOutcome {
  resourceType: 'OperationOutcome';
  issue: Array<{
    severity: 'fatal' | 'error' | 'warning' | 'information';
    code: string;
    diagnostics?: string;
  }>;
}

// Types FHIR pour appointmentType (HL7 v2-0276)
export const APPOINTMENT_TYPES = [
  { code: 'ROUTINE', display: 'Consultation de routine' },
  { code: 'FOLLOWUP', display: 'Suivi' },
  { code: 'EMERGENCY', display: 'Urgence' },
  { code: 'CHECKUP', display: 'Bilan' },
  { code: 'WALKIN', display: 'Sans rendez-vous' },
] as const;

export const APPOINTMENT_STATUSES: Array<{ code: AppointmentStatus; label: string }> = [
  { code: 'proposed',         label: 'Proposé' },
  { code: 'pending',          label: 'En attente' },
  { code: 'booked',           label: 'Confirmé' },
  { code: 'arrived',          label: 'Patient arrivé' },
  { code: 'checked-in',       label: 'Présenté' },
  { code: 'fulfilled',        label: 'Réalisé' },
  { code: 'cancelled',        label: 'Annulé' },
  { code: 'noshow',           label: 'Absent' },
  { code: 'waitlist',         label: "Liste d'attente" },
  { code: 'entered-in-error', label: 'Erreur de saisie' },
];

/** Libellé français d'un statut FHIR Appointment. */
export function statusLabel(code: AppointmentStatus | string | undefined): string {
  return APPOINTMENT_STATUSES.find((s) => s.code === code)?.label ?? (code ?? '—');
}

/** Libellé français du statut d'un participant FHIR. */
export function participantStatusLabel(code: string | undefined): string {
  switch (code) {
    case 'accepted':     return 'Accepté';
    case 'declined':     return 'Décliné';
    case 'tentative':    return 'Provisoire';
    case 'needs-action': return 'Action requise';
    default:             return code ?? '—';
  }
}

export const RPPS_SYSTEM = 'urn:oid:1.2.250.1.71.4.2.1';
export const APPOINTMENT_TYPE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v2-0276';
