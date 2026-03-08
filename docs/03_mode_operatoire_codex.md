# Mode operatoire avec Codex

## Objectif

Faire produire beaucoup a Codex sans perdre le controle du code, du perimetre et de la qualite.

## Regle numero 1

Ne jamais demander:

> "Reconstruis toute l'application"

Toujours demander:

> un lot fonctionnel limite, avec criteres d'acceptation, fichiers attendus, migrations et tests.

## Workflow recommande

### Etape 1 - Partir de la base existante

Le repo contient deja:

- une base produit livree
- les modules coeur du GRC interne
- des migrations et un seed de demo
- des tests E2E de base

La bonne approche n'est plus d'initialiser le produit, mais de faire avancer des slices precises.

### Etape 2 - Donner le prompt maitre

Commencer par `00_master_prompt_codex.md` puis demander a Codex de:

- lire les docs
- verifier le scope courant
- choisir le lot le plus rentable
- modifier seulement ce qui est utile
- mettre a jour docs et README si le scope change

### Etape 3 - Travailler par vertical slices

Exemples de slices de phase courante:

1. admin settings + user lifecycle
2. control libraries + imports
3. exports et reporting
4. comments et notifications simples
5. incidents ou periodic reviews

Chaque slice doit etre livree avec:

- code
- migration si necessaire
- seed si necessaire
- tests minimaux
- README mis a jour
- message de commit

### Etape 4 - Faire relire a Codex ce qu'il a produit

Apres chaque slice, relancer Codex avec:

- revue du diff
- simplification du code
- detection dette technique
- amelioration UX
- corrections type safety

### Etape 5 - Garder un rythme de commits court

Un commit par sous-module utile:

- `feat(settings): add admin user lifecycle tools`
- `feat(libraries): add reusable control packs`
- `feat(exports): add audit reporting flows`

## Prompt type pour une tache

```text
Lis d'abord docs/00_master_prompt_codex.md, docs/01_prd_mvp_grc.md et docs/02_architecture_technique.md.

Implmente maintenant uniquement le module Admin Settings.

Attendus:
- page settings admin
- liste des utilisateurs/profils
- changement de role
- garde-fous serveur et RLS si necessaire
- tests utiles
- README mis a jour

Contraintes:
- reste simple
- pas de sur-abstraction
- composants lisibles
- types stricts

A la fin, donne:
1. resume
2. fichiers modifies
3. commandes a lancer
4. TODO restants
5. message de commit
```

## Ce qu'il faut demander systematiquement a Codex

A chaque lot, ajoute:

- "n'ajoute rien hors perimetre"
- "si une decision est ambigue, choisis l'option la plus simple"
- "ajoute migration et seed si necessaire"
- "ajoute au moins un test utile"
- "propose un message de commit"

## Ce qu'il faut eviter

- prompts trop larges
- 15 objectifs dans le meme message
- refactor + nouvelle feature + redesign + perf en meme temps
- laisser Codex deviner le metier sans docs

## Boucle ideale

1. demander une slice
2. executer localement
3. corriger erreurs
4. demander revue/refactor cible
5. commit
6. passer a la slice suivante

## Ordre pratique reel

### Session 1
- admin settings
- user lifecycle

### Session 2
- libraries / bundles
- import simple

### Session 3
- exports / reporting

### Session 4
- comments / reminders

### Session 5
- incident register ou periodic reviews

## Checklist operateur

Avant d'envoyer un prompt a Codex:

- ai-je limite le perimetre ?
- ai-je defini les livrables ?
- ai-je demande migration + seed + tests si necessaire ?
- ai-je dit explicitement ce qu'il ne faut pas faire ?

Si oui, le prompt est probablement assez bon.
