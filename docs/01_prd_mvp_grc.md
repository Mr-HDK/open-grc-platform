# PRD - Internal GRC Platform

Note: the filename is kept for continuity, but the product is no longer framed as a greenfield initial build.

## 1. Vision

Creer une application legere de gouvernance, risque et conformite qui remplace les fichiers disperses et donne une vue centrale sur les risques, controles, actions, preuves et referentiels.

## 2. Probleme

Les equipes gerent souvent les risques dans Excel, Notion ou des documents isoles. Resultat:

- donnees non centralisees
- versions contradictoires
- faible tracabilite
- suivi d'actions incomplet
- difficulte a preparer audits et comites
- pas de vue consolidee sur l'exposition au risque

## 3. Utilisateurs cibles

### Admin
- configure les referentiels de base
- gere les roles
- gere le cycle de vie simple des utilisateurs
- voit tout

### Risk Manager
- cree et suit les risques
- assigne les actions
- suit les controles
- prepare le reporting

### Contributor
- met a jour risques, controles, actions, preuves selon droits

### Viewer
- consulte les tableaux de bord et fiches

## 4. Jobs to be done

- Enregistrer un risque de facon propre et comparable
- Relier un risque a des controles et a des actions
- Stocker des preuves liees a des controles
- Mapper les controles a des frameworks
- Produire rapidement une vue de synthese pour management / audit
- Demarrer plus vite grace a des bibliotheques ou imports reutilisables
- Extraire les donnees utiles pour pilotage et audit

## 5. Base deja livree

La base actuelle couvre:

- authentification
- roles simples
- registre des risques
- scoring simple
- catalogue de controles
- plans d'actions
- upload de preuves
- mapping de frameworks
- dashboard resume
- audit log minimal
- admin settings (roles, invite, deactivate, transfer ownership)
- imports/exports simples (risques/controles) + reporting packs imprimables
- collaboration legere (commentaires, activity trail)
- notifications utiles (actions en retard, controles a revoir) avec sync planifiable
- registre incidents (statuts simples, liens vers risques/actions)
- revues periodiques des controles (statut + date cible)
- campagnes de test des controles + constats (findings)
- acceptations de risque (justification, approbateur, expiration, revocation)

## 6. Phase actuelle

La phase courante vise a etendre la base avec les chantiers suivants:

### Priorite 1
- admin settings
- gestion des roles et du cycle de vie utilisateur
- feedback UX plus clair
- couverture E2E complementaire sur les parcours critiques

### Priorite 2
- bibliotheques de risques et de controles
- imports simples
- exports de reporting et packs management / audit

### Priorite 3
- commentaires et activity trail plus riche
- notifications utiles et proportionnees avec mecanisme simple de sync
- revues periodiques de controles

### Priorite 4
- modules additionnels a forte valeur, par exemple incidents

## 7. Hors phase courante

- moteur d'approbation configurable generique
- architecture distribuee
- multi-entite complexe de type SaaS enterprise
- scoring probabiliste avance
- API publique complete
- automatisation lourde sans besoin valide

## 8. Regles metier simples

- `risk_score = impact * likelihood`
- impact et likelihood sur une echelle 1 a 5
- niveau derive: low, medium, high, critical
- un risque peut avoir 0..n controles
- un controle peut couvrir 0..n risques
- une action peut etre liee a un risque, un controle, ou les deux
- une preuve doit avoir au moins une entite cible

## 9. Mesures de succes de la phase courante

- reduction du temps de mise en place d'un registre exploitable
- preparation plus rapide d'un reporting management ou audit
- meilleure administrabilite de l'application
- meilleure reutilisation via packs ou imports
- adoption par une equipe pilote sur un usage reel

## 10. Risques projet

- sur-architecture trop tot
- modele metier trop riche d'un coup
- permissions trop complexes
- dette UI si les nouvelles features sont ajoutees sans standard
- ajout de modules avant d'avoir fiabilise l'existant
