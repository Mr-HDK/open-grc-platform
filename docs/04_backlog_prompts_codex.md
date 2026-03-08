# Backlog de prompts Codex

Copie-colle ces prompts un par un.

---

## Prompt 1 - Bootstrap

```text
Lis docs/00_master_prompt_codex.md, docs/01_prd_mvp_grc.md et docs/02_architecture_technique.md.

Initialise le projet complet pour un MVP GRC avec:
- Next.js App Router
- TypeScript strict
- Tailwind
- shadcn/ui
- Supabase client setup
- ESLint + Prettier
- structure de dossiers claire
- layout dashboard protégé
- page d'accueil simple
- README initial
- .env.example

Ajoute les scripts npm utiles.

Ne construis aucun module métier complet pour l'instant.

À la fin, donne:
1. résumé
2. fichiers créés
3. commandes à lancer
4. points restants
5. message de commit
```

---

## Prompt 2 - Auth

```text
Lis les docs du projet puis implémente uniquement l'authentification et les permissions simples.

Attendus:
- login/logout avec Supabase Auth
- page login
- protection des routes
- gestion de rôles: admin, manager, contributor, viewer
- helpers de permissions simples
- seed ou mécanisme de bootstrap pour profils de test
- README mis à jour

Contraintes:
- simple
- lisible
- pas d'overengineering

À la fin, fournis aussi un message de commit.
```

---

## Prompt 3 - Risk Register

```text
Lis les docs du projet puis implémente uniquement le module Risk Register.

Attendus:
- migration SQL pour table risks
- seed de 12 risques réalistes
- liste avec recherche et filtres
- création / édition / détail
- score impact x likelihood
- niveau low/medium/high/critical
- statuts draft/open/mitigated/accepted/closed
- validation Zod
- composants UI lisibles
- test E2E minimal sur création d'un risque
- README mis à jour

Ne fais pas encore controls, evidence ou frameworks.

Donne aussi un message de commit.
```

---

## Prompt 4 - Controls

```text
Lis les docs puis implémente uniquement le module Controls.

Attendus:
- migration SQL pour controls et table pivot risk_controls
- CRUD de contrôles
- lien contrôle <-> plusieurs risques
- statut d'efficacité
- propriétaire
- fréquence de revue
- vue détail d'un contrôle avec risques liés
- seed réaliste
- tests minimaux
- README mis à jour

Ne touche pas encore à evidence et frameworks sauf si requis par types.
```

---

## Prompt 5 - Action Plans

```text
Lis les docs puis implémente uniquement Action Plans.

Attendus:
- migration SQL action_plans
- création / édition / liste
- rattachement à risque et/ou contrôle
- statut
- date cible
- indicateur overdue
- filtres utiles
- seed
- tests minimaux
- README mis à jour
```

---

## Prompt 6 - Evidence

```text
Lis les docs puis implémente uniquement Evidence.

Attendus:
- migration SQL evidence
- upload fichier via Supabase Storage
- métadonnées de preuve
- rattachement à risque, contrôle ou action
- liste des preuves sur pages détail
- suppression logique ou archivage simple
- seed si pertinent
- README mis à jour

Reste minimal mais propre.
```

---

## Prompt 7 - Framework Mappings

```text
Lis les docs puis implémente uniquement Framework Mappings.

Attendus:
- tables frameworks, framework_requirements, control_framework_mappings
- seed pour COBIT, ISO 27001, NIST et NIS2 avec quelques entrées d'exemple
- UI simple pour mapper un contrôle à plusieurs exigences
- affichage des mappings sur fiche contrôle
- README mis à jour

Pas besoin d'un moteur complexe d'import.
```

---

## Prompt 8 - Dashboard

```text
Lis les docs puis implémente uniquement le dashboard MVP.

Attendus:
- cartes KPI
- risques par statut
- risques par niveau
- heatmap simple impact x likelihood
- actions en retard
- contrôles à revoir bientôt
- composants simples et propres
- données reliées au vrai schéma
- README mis à jour
```

---

## Prompt 9 - Audit Log

```text
Lis les docs puis implémente uniquement un audit log minimal.

Attendus:
- table audit_log
- journalisation create/update/delete logique sur risks, controls, action_plans
- affichage simple d'historique sur fiche détail
- structure extensible mais simple
- README mis à jour
```

---

## Prompt 10 - Hardening

```text
Relis tout le projet et effectue seulement un hardening ciblé.

Attendus:
- corriger incohérences TypeScript
- simplifier composants trop gros
- améliorer messages d'erreur formulaires
- améliorer accessibilité basique
- vérifier permissions critiques
- vérifier validations serveur
- compléter README d'installation et d'exploitation
- proposer liste concise de TODO post-MVP

Ne change pas l'architecture globale.
```
