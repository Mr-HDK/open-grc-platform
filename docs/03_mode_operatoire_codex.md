# Mode opératoire avec Codex

## Objectif

Faire produire beaucoup à Codex sans perdre le contrôle du code, du périmètre et de la qualité.

## Règle numéro 1

Ne jamais demander:

> "Construis-moi toute l'application"

Toujours demander:

> un lot fonctionnel limité, avec critères d'acceptation, fichiers attendus, migrations et tests.

## Workflow recommandé

### Étape 1 - Préparer le repo

Créer un repo vide avec:

- ce dossier `docs/`
- un README minimal
- un `.env.example`

Dépose ensuite ce pack dans `docs/`.

### Étape 2 - Donner le prompt maître

Commencer par `00_master_prompt_codex.md` puis demander à Codex de:

- lire les docs
- proposer l'arborescence
- initialiser le projet
- installer les dépendances
- configurer lint, format, scripts, Supabase local si utilisé

### Étape 3 - Travailler par vertical slices

Exemple de slices:

1. bootstrap + auth + layout
2. risk register complet
3. controls
4. action plans
5. evidence
6. framework mapping
7. dashboard
8. audit log

Chaque slice doit être livrée avec:

- code
- migration
- seed
- tests minimaux
- README mis à jour
- message de commit

### Étape 4 - Faire relire à Codex ce qu'il a produit

Après chaque slice, relancer Codex avec:

- revue du diff
- simplification du code
- détection dette technique
- amélioration UX
- corrections type safety

### Étape 5 - Garder un rythme de commits court

Un commit par sous-module utile:

- `feat(auth): add Supabase auth and protected layout`
- `feat(risks): add risk register CRUD`
- `feat(controls): add controls catalog and mappings`

## Prompt type pour une tâche

```text
Lis d'abord docs/00_master_prompt_codex.md, docs/01_prd_mvp_grc.md et docs/02_architecture_technique.md.

Implémente maintenant uniquement le module Risk Register.

Attendus:
- table SQL risks avec migration
- seed de données
- pages liste + détail + création + édition
- scoring impact x likelihood
- filtres par statut, niveau, propriétaire
- validation Zod
- protection des pages selon rôles
- tests E2E minimaux
- README mis à jour

Contraintes:
- reste simple
- pas de sur-abstraction
- composants lisibles
- types stricts

À la fin, donne:
1. résumé
2. fichiers modifiés
3. commandes à lancer
4. TODO restants
5. message de commit
```

## Ce qu'il faut demander systématiquement à Codex

À chaque lot, ajoute:

- "n'ajoute rien hors périmètre"
- "si une décision est ambiguë, choisis l'option la plus simple"
- "ajoute migration et seed"
- "ajoute au moins un test utile"
- "propose un message de commit"

## Ce qu'il faut éviter

- prompts trop larges
- 15 objectifs dans le même message
- refactor + nouvelle feature + redesign + perf en même temps
- laisser Codex deviner le métier sans docs

## Boucle idéale

1. demander une slice
2. exécuter localement
3. corriger erreurs
4. demander revue/refactor ciblé
5. commit
6. passer à la slice suivante

## Quand utiliser Codex local vs cloud

D'après la documentation OpenAI, Codex peut être utilisé dans le terminal, l'IDE, l'app Codex ou délégué dans le cloud selon le client utilisé. Pour démarrer ce projet, le plus simple est le **CLI ou l'IDE** pour itérer vite sur un repo local, puis le cloud pour tâches plus longues ou parallèles. Codex navigue le dépôt, modifie les fichiers et peut exécuter des commandes/tests à partir d'un prompt ou d'une spec. citeturn0search1turn0search3turn0search7

## Ordre pratique réel

### Session 1
- bootstrap repo
- auth
- layout
- design tokens simples

### Session 2
- risk register CRUD
- scoring
- filtres

### Session 3
- controls
- relation risk-controls

### Session 4
- action plans
- overdue views

### Session 5
- evidence upload

### Session 6
- framework mappings

### Session 7
- dashboard
- polish

## Checklist opérateur

Avant d'envoyer un prompt à Codex:

- ai-je limité le périmètre ?
- ai-je défini les livrables ?
- ai-je demandé migration + seed + tests ?
- ai-je dit explicitement ce qu'il ne faut pas faire ?

Si oui, le prompt est probablement assez bon.
