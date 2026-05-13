import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Appointment, FhirBundle, Patient, Practitioner, Location as FhirLocation } from '../models/fhir.model';

@Injectable({ providedIn: 'root' })
export class FhirService {
  private http = inject(HttpClient);
  private readonly baseUrl = 'https://fhir.chl.connected-health.fr/fhir';

  private headers = new HttpHeaders({
    'Accept': 'application/fhir+json',
    'Content-Type': 'application/fhir+json',
  });

  /** Liste les rendez-vous (les plus récents d'abord). */
  list(count: number = 50): Observable<Appointment[]> {
    const url = `${this.baseUrl}/Appointment?_count=${count}&_sort=-_lastUpdated`;
    return this.http.get<FhirBundle<Appointment>>(url, { headers: this.headers }).pipe(
      map((bundle) => (bundle.entry ?? []).map((e) => e.resource).filter((r) => !!r))
    );
  }

  /** Récupère un rendez-vous par son ID. */
  getById(id: string): Observable<Appointment> {
    const url = `${this.baseUrl}/Appointment/${encodeURIComponent(id)}`;
    return this.http.get<Appointment>(url, { headers: this.headers });
  }

  /** Crée un nouveau rendez-vous. */
  create(appointment: Appointment): Observable<Appointment> {
    const url = `${this.baseUrl}/Appointment`;
    return this.http.post<Appointment>(url, appointment, { headers: this.headers });
  }

  /** Met à jour un rendez-vous existant (PUT FHIR sur l'ID donné). */
  update(id: string, appointment: Appointment): Observable<Appointment> {
    const url = `${this.baseUrl}/Appointment/${encodeURIComponent(id)}`;
    // FHIR exige que le body contienne resourceType et id correspondant à l'URL
    const body: Appointment = { ...appointment, resourceType: 'Appointment', id };
    return this.http.put<Appointment>(url, body, { headers: this.headers });
  }

  /** Supprime un rendez-vous (DELETE FHIR). */
  delete(id: string): Observable<void> {
    const url = `${this.baseUrl}/Appointment/${encodeURIComponent(id)}`;
    return this.http.delete<void>(url, { headers: this.headers });
  }

  /** Liste les patients (pour les selects du formulaire). */
  listPatients(count: number = 100): Observable<Patient[]> {
    const url = `${this.baseUrl}/Patient?_count=${count}&_sort=family`;
    return this.http.get<FhirBundle<Patient>>(url, { headers: this.headers }).pipe(
      map((bundle) => (bundle.entry ?? []).map((e) => e.resource).filter((r) => !!r))
    );
  }

  /** Liste les soignants. */
  listPractitioners(count: number = 100): Observable<Practitioner[]> {
    const url = `${this.baseUrl}/Practitioner?_count=${count}&_sort=family`;
    return this.http.get<FhirBundle<Practitioner>>(url, { headers: this.headers }).pipe(
      map((bundle) => (bundle.entry ?? []).map((e) => e.resource).filter((r) => !!r))
    );
  }

  /** Liste les salles / lieux. */
  listLocations(count: number = 100): Observable<FhirLocation[]> {
    const url = `${this.baseUrl}/Location?_count=${count}&_sort=name`;
    return this.http.get<FhirBundle<FhirLocation>>(url, { headers: this.headers }).pipe(
      map((bundle) => (bundle.entry ?? []).map((e) => e.resource).filter((r) => !!r))
    );
  }
}
