# Pack Codex - GRC / Risk Management App

Ce pack est conçu pour construire rapidement un MVP GRC avec Codex en mode "vibe coding", sans perdre le contrôle du périmètre.

## Contenu

- `00_master_prompt_codex.md` : prompt maître à donner à Codex pour cadrer le projet
- `01_prd_mvp_grc.md` : PRD du MVP
- `02_architecture_technique.md` : architecture cible optimisée pour aller vite
- `03_mode_operatoire_codex.md` : comment piloter Codex étape par étape
- `04_backlog_prompts_codex.md` : prompts prêts à l'emploi, par lot de travail
- `05_schema_metier.md` : modèle métier et schéma de données logique
- `06_definition_of_done.md` : critères d'acceptation et garde-fous

## Recommandation principale

Pour aller vite **et** garder la maîtrise:

- **monorepo simple**
- **Next.js + TypeScript**
- **Supabase** pour auth, Postgres, storage et RLS
- **shadcn/ui + Tailwind** pour l'UI
- **Zod** pour la validation
- **Recharts** pour les dashboards
- **Playwright** pour les tests E2E critiques

## Périmètre MVP recommandé

Inclure seulement:

1. Authentification
2. Organisations / rôles simples
3. Registre des risques
4. Contrôles
5. Plans d'actions
6. Pièces jointes / preuves
7. Framework mappings (COBIT, ISO 27001, NIST, NIS2)
8. Dashboards basiques
9. Journal d'audit minimal

Ne pas inclure au départ:

- moteur de workflow avancé
- multi-tenant SaaS complet
- questionnaires tiers complexes
- moteur de scoring ultra configurable
- IA partout
- intégrations lourdes

## Ordre d'exécution recommandé

1. Initialiser le repo et y déposer ces fichiers
2. Donner à Codex `00_master_prompt_codex.md`
3. Ensuite exécuter **un prompt du backlog à la fois**
4. À chaque étape: demander tests, migrations, seed et README mis à jour
5. Ne jamais demander "construis toute l'application" en un seul shot

## Objectif réaliste

Avec un bon pilotage Codex:

- **Proto crédible**: 3 à 7 jours
- **MVP interne utile**: 3 à 6 semaines
- **Version solide**: 2 à 4 mois

## Démarrage ultra-court

Commence par ceci dans Codex:

1. Lire `00_master_prompt_codex.md`
2. Créer le squelette du projet
3. Implémenter seulement Auth + Risk Register CRUD + dashboard simple
4. Committer
5. Continuer avec Contrôles, puis Plans d'actions, puis Evidence
