# 🏥 RDV-App — Gestion des Rendez-vous Hospitaliers

> Application web de planification des rendez-vous médicaux, conforme au standard **HL7 FHIR R4**, développée pour le **Service Secrétariat** d'un établissement hospitalier.

[![Angular](https://img.shields.io/badge/Angular-19-DD0031?logo=angular&logoColor=white)](https://angular.dev/)
[![FHIR](https://img.shields.io/badge/HL7%20FHIR-R4-FF6F61)](https://hl7.org/fhir/R4/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SCSS](https://img.shields.io/badge/SCSS-CC6699?logo=sass&logoColor=white)](https://sass-lang.com/)

---

## 📋 Sommaire

1. [Présentation](#-présentation)
2. [Cahier des charges](#-cahier-des-charges)
3. [Fonctionnalités & usage FHIR](#-fonctionnalités--usage-fhir)
4. [Architecture technique](#-architecture-technique)
5. [Profil FHIR utilisé](#-profil-fhir-utilisé)
6. [Installation & lancement](#-installation--lancement)
7. [Structure du projet](#-structure-du-projet)
8. [Design system](#-design-system)
9. [Auteurs](#-auteurs)

---

## 🎯 Présentation

**RDV-App** est une application Angular 19 qui permet à un secrétariat hospitalier de gérer le cycle de vie complet des rendez-vous médicaux : **création**, **consultation**, **modification** et **suppression**. Chaque rendez-vous lie trois acteurs :

- 👤 un **patient** (`Patient`)
- 🩺 un **soignant** (`Practitioner`) — identifié par son **RPPS**
- 🏥 une **salle** (`Location`)

L'application communique directement avec un serveur FHIR public via une API REST conforme HL7 :

```
https://fhir.chl.connected-health.fr/fhir
```

Toutes les données échangées respectent le profil **`AppointmentSecretariat`** publié dans notre IG commun.

---

## 📐 Cahier des charges

### Contexte fonctionnel

Le **Service Secrétariat** d'un hôpital doit pouvoir planifier des rendez-vous entre un patient, un soignant et une salle, et tenir à jour le statut de chaque rendez-vous (confirmé, annulé, réalisé, etc.). Les données doivent être interopérables avec les autres applications du SI hospitalier — d'où l'usage de **HL7 FHIR R4**.

### Acteurs

| Acteur | Rôle |
|--------|------|
| 🧑‍💼 **Secrétaire** | Crée, consulte, modifie et supprime les rendez-vous. |
| 👤 **Patient** | Référencé via la ressource FHIR `Patient`. |
| 🩺 **Soignant** | Référencé via `Practitioner`, identifié par son RPPS national. |
| 🏥 **Salle** | Référencée via `Location`. |

### Exigences fonctionnelles

| ID | Exigence | Priorité |
|----|----------|----------|
| **F1** | Lister tous les rendez-vous du SI hospitalier, triés du plus récent au plus ancien. | 🔴 Critique |
| **F2** | Filtrer la liste par **statut** et par **recherche textuelle libre** (patient, soignant, RPPS, motif). | 🟠 Forte |
| **F3** | Afficher la fiche détaillée d'un rendez-vous (date, statut, type, acteurs). | 🔴 Critique |
| **F4** | Créer un nouveau rendez-vous via un formulaire en 5 sections (date, patient, soignant, salle, type & motif). | 🔴 Critique |
| **F5** | Pré-remplir automatiquement le **RPPS** quand un soignant est sélectionné. | 🟢 Confort |
| **F6** | Modifier un rendez-vous existant via le même formulaire en mode édition. | 🔴 Critique |
| **F7** | Supprimer un rendez-vous avec **modal de confirmation**. | 🔴 Critique |
| **F8** | Charger dynamiquement les listes de patients, soignants et salles depuis le serveur FHIR. | 🟠 Forte |
| **F9** | Valider côté client tous les champs obligatoires (RPPS sur 11 chiffres, dates, références). | 🟠 Forte |

### Exigences non-fonctionnelles

| ID | Exigence |
|----|----------|
| **NF1** | Respect strict du profil FHIR `AppointmentSecretariat` (slicing par `actor.type`, RPPS obligatoire sur le soignant). |
| **NF2** | UI responsive (≤ 720 px), accessible (rôles ARIA, contraste AA). |
| **NF3** | Charte graphique « Editorial Medical » — sobre, sérieuse, professionnelle. |
| **NF4** | Aucune dépendance backend propriétaire — tout passe par l'API REST FHIR publique. |
| **NF5** | Bundle initial < 1,5 Mo, lazy-loading des routes. |

---

## ⚙️ Fonctionnalités & usage FHIR

Chaque fonctionnalité de l'application correspond à un appel précis sur le serveur FHIR. Voici le détail de la correspondance UI ↔ FHIR :

### 1️⃣ Lister les rendez-vous — `/rdv`

> Page d'accueil avec vidéo hero 360° de l'hôpital + grille des cartes RDV.

| Élément UI | Appel FHIR | Ressource | Détail |
|------------|------------|-----------|--------|
| Liste des RDV | `GET /Appointment?_count=50&_sort=-_lastUpdated` | `Bundle<Appointment>` | Trie par date de dernière mise à jour décroissante. |
| Compteur, filtres | (côté client) | — | Filtrage en mémoire sur le bundle reçu. |
| Carte RDV | Champs `Appointment.status`, `description`, `start`, `participant[]` | `Appointment` | Affichage de chaque rendez-vous avec ses 3 acteurs. |
| RPPS du soignant | `participant[practitioner].actor.identifier.value` | `Identifier` | Système `urn:oid:1.2.250.1.71.4.2.1`. |

### 2️⃣ Consulter un rendez-vous — `/rdv/:id`

> Hero éditorial (jour/mois géant), 3 cartes acteurs (patient/soignant/salle), bloc détails, modal de suppression.

| Élément UI | Appel FHIR | Détail |
|------------|------------|--------|
| Chargement de la fiche | `GET /Appointment/{id}` | Récupération de la ressource complète. |
| Hero — date | `Appointment.start` | Formaté en français (`Intl.DateTimeFormat('fr-FR')`). |
| Badge statut | `Appointment.status` | Mapping vers une palette colorée (`booked`, `pending`, `cancelled`…). |
| Carte Patient | `participant[].actor` avec `type = "Patient"` | Slice patient du profil. |
| Carte Soignant | `participant[].actor` avec `type = "Practitioner"` + `identifier` | Le RPPS est extrait du slice practitioner. |
| Carte Salle | `participant[].actor` avec `type = "Location"` | Slice location. |
| Type de RDV | `Appointment.appointmentType.coding[0]` | Système HL7 v2-0276. |

### 3️⃣ Créer un rendez-vous — `/rdv/nouveau`

> Formulaire en 5 sections numérotées avec listes déroulantes alimentées par le SI.

| Section formulaire | Appel FHIR | Détail |
|--------------------|------------|--------|
| Chargement référentiel patients | `GET /Patient?_count=100&_sort=family` | Bundle, mis dans le `<select>` patient. |
| Chargement référentiel soignants | `GET /Practitioner?_count=100&_sort=family` | Bundle, RPPS extrait pour autoremplir. |
| Chargement référentiel salles | `GET /Location?_count=100&_sort=name` | Bundle, mis dans le `<select>` salle. |
| Soumission | `POST /Appointment` | Body conforme au profil `AppointmentSecretariat`. |

**Body envoyé** (extrait) :
```json
{
  "resourceType": "Appointment",
  "status": "booked",
  "start": "2026-06-15T10:00:00.000Z",
  "end":   "2026-06-15T10:30:00.000Z",
  "appointmentType": { "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/v2-0276", "code": "ROUTINE" }] },
  "participant": [
    { "actor": { "reference": "Patient/123",      "type": "Patient" },      "status": "accepted" },
    { "actor": { "reference": "Practitioner/456", "type": "Practitioner",
                 "identifier": { "system": "urn:oid:1.2.250.1.71.4.2.1", "value": "10003557123" } },
      "status": "accepted" },
    { "actor": { "reference": "Location/789",    "type": "Location" },     "status": "accepted" }
  ]
}
```

### 4️⃣ Modifier un rendez-vous — `/rdv/:id/modifier`

> Le composant `appointment-create` est réutilisé en **mode édition** grâce à `input.required<string>('id')` et un `computed` `mode()`.

| Étape | Appel FHIR | Détail |
|-------|------------|--------|
| Chargement du RDV existant | `GET /Appointment/{id}` | Pré-remplissage du formulaire via `patchFormFromAppointment()`. |
| Soumission | `PUT /Appointment/{id}` | Body identique à la création, avec `id` ajouté. |

### 5️⃣ Supprimer un rendez-vous

> Bouton **✕ Supprimer** sur la page détail → modal de confirmation accessible (`role="dialog"`, `aria-modal`).

| Étape | Appel FHIR | Détail |
|-------|------------|--------|
| Confirmation utilisateur | (côté client) | Signal `confirmDelete()` ouvre la modal. |
| Suppression effective | `DELETE /Appointment/{id}` | En cas d'erreur, le `OperationOutcome.issue[0].diagnostics` est affiché. |
| Redirection | `router.navigate(['/rdv'])` | Retour à la liste. |

---

## 🏗️ Architecture technique

```
┌─────────────────────────────────────────────────┐
│         Navigateur (Angular 19 + signals)       │
│                                                 │
│   ┌──────────────┐   ┌──────────────────────┐   │
│   │ Components   │──▶│   FhirService        │   │
│   │ (standalone) │   │  (HttpClient + RxJS) │   │
│   └──────────────┘   └──────────┬───────────┘   │
└──────────────────────────────────┼──────────────┘
                                   │  REST FHIR R4
                                   │  application/fhir+json
                                   ▼
                  ┌──────────────────────────────┐
                  │  HAPI FHIR Server (public)   │
                  │  fhir.chl.connected-health   │
                  │  /Appointment /Patient ...   │
                  └──────────────────────────────┘
```

### Stack

| Couche | Technologie |
|--------|-------------|
| Framework | **Angular 19** (standalone components, signals, `input.required()`, `computed()`, `effect()`) |
| HTTP | `HttpClient` + `HttpHeaders` (FHIR `application/fhir+json`) |
| State | **Angular Signals** (pas de NgRx, pas de RxJS Store) |
| Forms | **Reactive Forms** typés (`fb.nonNullable.group`) |
| Routing | `provideRouter` + `withComponentInputBinding()` (route params → inputs) |
| Async | RxJS (`Observable`, `forkJoin`, `map`) |
| Styles | **SCSS** + variables CSS — design system maison |
| Build | Angular CLI 19 |

### Patterns

- **Composants standalone** — pas de `NgModule`, lazy-loading par route (`loadComponent`).
- **Signals pour l'état UI** — `loading`, `error`, `appointment`, `confirmDelete`, etc.
- **`computed()`** pour les valeurs dérivées (`patient`, `practitioner`, `location`, `mode`, `duration`).
- **`effect()`** pour les side-effects (chargement du RDV en mode édition, auto-remplissage du RPPS).
- **`forkJoin`** pour charger les 3 référentiels en parallèle (patients, soignants, salles).

---

## 📜 Profil FHIR utilisé

L'application consomme et produit des ressources `Appointment` conformes au profil **`AppointmentSecretariat`** publié dans notre IG commun.

> 📎 Repo IG : [`atelier-fhir-ig`](https://github.com/...) — branche `Secretariat`

### Règles principales du profil

| Contrainte | Définition |
|------------|------------|
| `participant` cardinalité | `3..*` |
| Slicing | `discriminator: #value` sur `actor.type` |
| Slice `patient` | `1..1`, `actor.type = "Patient"`, référence à `Patient` |
| Slice `practitioner` | `1..1`, `actor.type = "Practitioner"`, **`identifier.system = "urn:oid:1.2.250.1.71.4.2.1"` (RPPS) obligatoire** |
| Slice `location` | `1..1`, `actor.type = "Location"`, référence à `Location` |
| `start`, `end` | `1..1` Must Support |
| Invariant `fin-apres-debut` | `end > start` |

---

## 🚀 Installation & lancement

### Pré-requis

- **Node.js** ≥ 18
- **npm** ≥ 9

### Installation

```bash
git clone <repo>
cd rdv-app
npm install
```

### Lancement en mode développement

```bash
npm start
# ou
npx ng serve -o
```

L'application est servie sur **`http://localhost:4200/`** avec hot reload.

### Build de production

```bash
npm run build
```

Les artefacts sont générés dans `dist/rdv-app/`.

---

## 📁 Structure du projet

```
rdv-app/
├── public/
│   ├── favicon.ico
│   └── loop-hospital.mp4          ← vidéo hero 360° de l'hôpital
├── src/
│   ├── app/
│   │   ├── app.component.{ts,html,scss}     ← shell (header, footer, router-outlet)
│   │   ├── app.config.ts                     ← providers (router, http, animations)
│   │   ├── app.routes.ts                     ← routes lazy-loaded
│   │   ├── models/
│   │   │   └── fhir.model.ts                 ← types TS des ressources FHIR
│   │   ├── services/
│   │   │   └── fhir.service.ts               ← appels REST FHIR (CRUD + référentiels)
│   │   └── pages/
│   │       ├── appointment-list/             ← /rdv (liste + hero vidéo)
│   │       ├── appointment-detail/           ← /rdv/:id (détail + suppression)
│   │       └── appointment-create/           ← /rdv/nouveau & /rdv/:id/modifier
│   ├── styles.scss                ← design system global (variables CSS, btn, badge…)
│   ├── index.html
│   └── main.ts
├── angular.json
├── package.json
└── README.md                       ← ce fichier
```

### Routes

| Route | Composant | Action |
|-------|-----------|--------|
| `/` | (redirect) | → `/rdv` |
| `/rdv` | `AppointmentListComponent` | Liste + hero vidéo |
| `/rdv/nouveau` | `AppointmentCreateComponent` (mode `create`) | Formulaire de création |
| `/rdv/:id` | `AppointmentDetailComponent` | Détail + suppression |
| `/rdv/:id/modifier` | `AppointmentCreateComponent` (mode `edit`) | Formulaire d'édition |
| `**` | (redirect) | → `/rdv` |

---

## 🎨 Design system

Charte **« Editorial Medical »** — inspirée de la presse santé haut de gamme.

| Élément | Valeur |
|---------|--------|
| Police titres | [**Fraunces**](https://fonts.google.com/specimen/Fraunces) (sérif variable, axes `opsz`) |
| Police corps | [**Manrope**](https://fonts.google.com/specimen/Manrope) (sans-serif) |
| Police mono | [**JetBrains Mono**](https://www.jetbrains.com/lp/mono/) (RPPS, IDs FHIR) |
| Palette | Ivoire `#FAF7F2` · Encre `#0A1F33` · Vert sage `#3A7A5C` · Terracotta `#A23A2D` |
| Composants | `.btn`, `.btn--ghost`, `.btn--danger`, `.badge--{status}`, `.field`, `.modal` |
| Animations | `animate-up` (fade + slide), `heroRing` (anneau 360°), `modalFade` |

L'hero de la page d'accueil intègre une **vidéo 360° de l'hôpital** en boucle, fusionnée avec le fond ivoire via `mix-blend-mode: multiply` et entourée d'un anneau pointillé animé.

---

## 👥 Auteurs

Projet réalisé dans le cadre du module **ISIS 2026 S2** — Atelier FHIR IG commun.

- **Achraf Acheche**
- **Sinda Ben Yahmed**
- **Rahma Ben Younes**

### Groupe : **Secrétariat**

> Profil FHIR : `AppointmentSecretariat` — relie un patient, un soignant identifié par son RPPS, et une salle.

---

## 📄 Licence

Projet pédagogique — usage libre dans un cadre académique.

---

<p align="center">
  <em>Construit avec ❤️ pour le SI hospitalier · HL7 FHIR R4 · Angular 19</em>
</p>
