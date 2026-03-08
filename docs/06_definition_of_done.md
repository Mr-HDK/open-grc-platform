# Definition of Done

## Done global d'un module

Un module est considéré terminé seulement si:

- le code compile
- le lint passe
- la migration est présente
- le seed est présent ou mis à jour
- la feature est visible dans l'UI
- la sécurité minimale est en place
- les validations client et serveur existent
- au moins un test utile existe
- le README est mis à jour
- un message de commit est proposé

## DoD par feature CRUD

Pour chaque module CRUD:

- page liste
- page création
- page édition ou modal d'édition
- page détail
- gestion état vide
- gestion erreurs minimales
- filtres de base
- validation des champs
- protection selon rôle

## DoD sécurité minimale

- routes protégées
- vérification du rôle côté serveur
- inputs validés côté serveur
- pas de secrets en dur
- fichiers uploadés avec règles minimales

## DoD UX minimale

- labels clairs
- feedback de succès/erreur
- navigation cohérente
- tableaux lisibles
- détails accessibles sans confusion

## DoD données

- types cohérents entre DB, validation et UI
- pas de champ orphelin sans usage
- seeds réalistes pour démo

## DoD dashboard

- chaque widget s'appuie sur vraies données
- aucun chiffre mocké en prod
- états vides et erreurs gérés

## DoD refactor

Un refactor n'est acceptable que s'il:

- simplifie vraiment le code
- ne casse pas le périmètre fonctionnel
- ne réécrit pas tout inutilement
- améliore la lisibilité

## Ce qu'il faut systématiquement refuser au MVP

- moteur de workflow générique
- permissions ultra-granulaires
- architecture distribuée
- abstraction repository/service inutile partout
- IA sans valeur immédiate
