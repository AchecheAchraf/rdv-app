# 🏥 RDV-App — Gestion des Rendez-vous Hospitaliers

> Application web de planification des rendez-vous médicaux, développée pour le **Service Secrétariat** d'un établissement hospitalier.

[![Angular](https://img.shields.io/badge/Angular-19-DD0031?logo=angular&logoColor=white)](https://angular.dev/)
[![FHIR](https://img.shields.io/badge/HL7%20FHIR-R4-FF6F61)](https://hl7.org/fhir/R4/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

🌐 **Application hébergée :** [https://achecheachraf.github.io/rdv-app/](https://achecheachraf.github.io/rdv-app/)

---

## 📋 Sommaire

1. [Présentation](#-présentation)
2. [Fonctionnalités](#-fonctionnalités)
3. [Lancer le projet](#-lancer-le-projet)
4. [Auteurs](#-auteurs)

---

## 🎯 Présentation

**RDV-App** est une application Angular 19 qui permet à un secrétariat hospitalier de gérer le cycle de vie complet des rendez-vous médicaux : **création**, **consultation**, **modification** et **suppression**.

Chaque rendez-vous lie trois acteurs :

- 👤 un **patient**
- 🩺 un **soignant** — identifié par son **RPPS**
- 🏥 une **salle**

---

## ✅ Fonctionnalités

| # | Fonctionnalité |
|---|---------------|
| 1 | Lister tous les rendez-vous, triés du plus récent au plus ancien |
| 2 | Filtrer par **statut** et par **recherche libre** (patient, soignant, motif) |
| 3 | Consulter la fiche détaillée d'un rendez-vous |
| 4 | Créer un nouveau rendez-vous via un formulaire en 5 sections |
| 5 | Auto-remplissage du **RPPS** à la sélection du soignant |
| 6 | Modifier un rendez-vous existant |
| 7 | Supprimer un rendez-vous avec confirmation |
| 8 | Chargement dynamique des patients, soignants et salles depuis le serveur FHIR |

---

## 🚀 Lancer le projet

### Avec Docker _(recommandé, aucun Node.js requis)_

**1. Construire l'image**

```bash
docker build -t rdv-app .
```

**2. Lancer le conteneur**

```bash
docker run -p 8080:80 rdv-app
```

L'application est accessible sur **`http://localhost:8080`**

**3. Arrêter le conteneur**

```bash
docker ps                   # trouver le CONTAINER_ID
docker stop <CONTAINER_ID>
```

---

### Avec Node.js _(développement)_

```bash
git clone https://github.com/AchecheAchraf/rdv-app.git
cd rdv-app
npm install
npm start
```

L'application est servie sur **`http://localhost:4200`** avec hot reload.

---

## 👥 Auteurs

Projet réalisé dans le cadre du module **ISIS 2026 S2** — Atelier FHIR IG commun.

- **Achraf Acheche**
- **Sinda Ben Yahmed**
- **Rahma Ben Younes**

---

<p align="center">
  <em>Construit avec ❤️ pour le SI hospitalier · HL7 FHIR R4 · Angular 19</em>
</p>
