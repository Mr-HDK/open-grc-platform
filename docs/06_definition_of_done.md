# Definition of Done

## Done global d'un lot

Un lot est considere termine seulement si:

- le code compile
- le lint passe
- la migration est presente si necessaire
- le seed est present ou mis a jour si necessaire
- la feature est visible dans l'UI
- la securite minimale est en place
- les validations client et serveur existent
- au moins un test utile existe
- le README est mis a jour
- un message de commit est propose

## DoD par feature CRUD

Pour chaque module CRUD:

- page liste
- page creation
- page edition ou modal d'edition
- page detail
- gestion etat vide
- gestion erreurs minimales
- filtres de base
- validation des champs
- protection selon role

## DoD securite minimale

- routes protegees
- verification du role cote serveur
- inputs valides cote serveur
- pas de secrets en dur
- fichiers uploades avec regles minimales

## DoD UX minimale

- labels clairs
- feedback de succes/erreur
- navigation coherente
- tableaux lisibles
- details accessibles sans confusion

## DoD donnees

- types coherents entre DB, validation et UI
- pas de champ orphelin sans usage
- seeds realistes pour demo

## DoD dashboard

- chaque widget s'appuie sur vraies donnees
- aucun chiffre mocke en prod
- etats vides et erreurs geres

## DoD expansion features

Pour une feature d'extension, verifier en plus:

- qu'elle s'appuie sur les roles et les entites existantes
- qu'elle ne contourne pas RLS ou les validations serveur
- qu'elle ne force pas un redesign global inutile
- qu'elle ajoute une valeur metier concrete

## DoD refactor

Un refactor n'est acceptable que s'il:

- simplifie vraiment le code
- ne casse pas le perimetre fonctionnel
- ne reecrit pas tout inutilement
- ameliore la lisibilite

## Ce qu'il faut systematiquement refuser dans la phase courante

- moteur de workflow generique
- permissions ultra-granulaires
- architecture distribuee
- abstraction repository/service inutile partout
- IA sans valeur immediate
