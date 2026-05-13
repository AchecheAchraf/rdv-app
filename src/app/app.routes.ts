import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'rdv', pathMatch: 'full' },
  {
    path: 'rdv',
    loadComponent: () =>
      import('./pages/appointment-list/appointment-list.component').then(m => m.AppointmentListComponent),
  },
  {
    path: 'rdv/nouveau',
    loadComponent: () =>
      import('./pages/appointment-create/appointment-create.component').then(m => m.AppointmentCreateComponent),
  },
  {
    path: 'rdv/:id/modifier',
    loadComponent: () =>
      import('./pages/appointment-create/appointment-create.component').then(m => m.AppointmentCreateComponent),
  },
  {
    path: 'rdv/:id',
    loadComponent: () =>
      import('./pages/appointment-detail/appointment-detail.component').then(m => m.AppointmentDetailComponent),
  },
  { path: '**', redirectTo: 'rdv' },
];
