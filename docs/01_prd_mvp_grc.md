# PRD - MVP GRC / Risk Management App

## 1. Vision

Créer une application légère de gouvernance, risque et conformité qui remplace les fichiers dispersés et donne une vue centrale sur les risques, contrôles, actions, preuves et référentiels.

## 2. Problème

Les équipes gèrent souvent les risques dans Excel, Notion ou des documents isolés. Résultat:

- données non centralisées
- versions contradictoires
- faible traçabilité
- suivi d'actions incomplet
- difficulté à préparer audits et comités
- pas de vue consolidée sur l'exposition au risque

## 3. Utilisateurs cibles

### Admin
- configure les référentiels de base
- gère les rôles
- voit tout

### Risk Manager
- crée et suit les risques
- assigne les actions
- suit les contrôles
- prépare le reporting

### Contributor
- met à jour risques, contrôles, actions, preuves selon droits

### Viewer
- consulte les tableaux de bord et fiches

## 4. Jobs to be done

- Enregistrer un risque de façon propre et comparable
- Relier un risque à des contrôles et à des actions
- Stocker des preuves liées à des contrôles
- Mapper les contrôles à des frameworks
- Produire rapidement une vue de synthèse pour management / audit

## 5. Périmètre MVP

### Inclus
- authentification
- rôles simples
- registre des risques
- scoring simple
- catalogue de contrôles
- plans d'actions
- upload de preuves
- mapping de frameworks
- dashboard résumé
- audit log minimal

### Exclus du MVP
- questionnaires avancés
- moteur d'approbation configurable
- API publique complète
- notifications multicanal avancées
- multi-entité complexe
- scoring probabiliste avancé
- gestion des tiers poussée

## 6. User stories principales

### Risques
- En tant que manager, je peux créer un risque avec titre, description, impact, likelihood, propriétaire, échéance et statut.
- En tant que manager, je peux filtrer les risques par statut, propriétaire, catégorie et niveau.
- En tant que viewer, je peux voir une fiche risque avec ses contrôles, actions et preuves associées.

### Contrôles
- En tant que manager, je peux créer un contrôle avec type, objectif, fréquence, propriétaire et efficacité.
- En tant que manager, je peux relier un contrôle à plusieurs risques.

### Actions
- En tant que contributor, je peux mettre à jour le statut d'une action.
- En tant que manager, je peux voir les actions en retard.

### Evidence
- En tant que contributor, je peux déposer une preuve liée à un contrôle ou à un risque.
- En tant que viewer, je peux voir l'historique et les métadonnées d'une preuve.

### Frameworks
- En tant qu'admin, je peux rattacher un contrôle à un ou plusieurs référentiels.

### Dashboard
- En tant que manager, je veux voir les risques ouverts, les risques élevés, les actions en retard et la distribution par statut.

## 7. Mesures de succès MVP

- création d'un risque en moins de 2 minutes
- préparation d'une vue comité en moins de 10 minutes
- visibilité complète des actions en retard
- adoption par une première équipe pilote

## 8. Règles métier simples

- `risk_score = impact * likelihood`
- impact et likelihood sur une échelle 1 à 5
- niveau dérivé: low, medium, high, critical
- un risque peut avoir 0..n contrôles
- un contrôle peut couvrir 0..n risques
- une action peut être liée à un risque, un contrôle, ou les deux
- une preuve doit avoir au moins une entité cible

## 9. Priorités produit

P0:
- auth
- risks CRUD
- controls CRUD
- action plans CRUD
- dashboard simple

P1:
- evidence
- framework mapping
- audit log

P2:
- exports
- notifications
- commentaires

## 10. Risques projet

- sur-architecture trop tôt
- modèle métier trop riche dès le départ
- permissions trop complexes
- dette UI si le CRUD est bricolé sans standards
- absence de seed/demo rendant les tests difficiles
