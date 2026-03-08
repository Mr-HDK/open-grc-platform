# Backlog de prompts Codex - Phase suivante

La base fonctionnelle initiale est deja livree. Utilise ces prompts pour faire evoluer l'application sans repartir de zero.

---

## Prompt 11 - Admin Settings

```text
Lis docs/00_master_prompt_codex.md, docs/01_prd_mvp_grc.md et docs/02_architecture_technique.md.

Implemente maintenant uniquement le module Admin Settings.

Attendus:
- page settings reservee admin
- liste des profils/utilisateurs
- changement de role simple
- garde-fous serveur et validation stricte
- seed ou bootstrap minimal si utile
- tests minimaux
- README mis a jour

Contraintes:
- ne reconstruis pas l'auth
- reste simple
- pas d'overengineering

A la fin, donne aussi un message de commit.
```

---

## Prompt 12 - Libraries and Bundles

```text
Lis les docs du projet puis implemente uniquement une premiere version des bibliotheques reutilisables.

Attendus:
- support de bundles de risques et/ou controles
- structure de donnees simple et lisible
- import applicatif ou seed-driven, pas de moteur complexe
- au moins un bundle d'exemple utile
- UI minimale pour appliquer un bundle
- tests minimaux
- README mis a jour

Ne touche pas aux modules non necessaires.

Donne aussi un message de commit.
```

---

## Prompt 13 - Imports and Exports

```text
Lis les docs du projet puis implemente uniquement les flux d'import/export les plus utiles.

Attendus:
- import simple CSV ou JSON pour risques/controles
- export simple pour reporting management ou audit
- validation serveur stricte
- messages d'erreur clairs
- tests minimaux
- README mis a jour

Reste pragmatique et n'ajoute pas de pipeline complexe.
```

---

## Prompt 14 - Collaboration

```text
Lis les docs du projet puis implemente uniquement une couche de collaboration legere.

Attendus:
- commentaires simples sur entites critiques
- activity trail lisible si pertinent
- permissions coherentes avec les roles existants
- UI sobre
- tests minimaux
- README mis a jour

Pas de chat temps reel ni de systeme complexe.
```

---

## Prompt 15 - Notifications and Reminders

```text
Lis les docs du projet puis implemente uniquement des notifications utiles et proportionnees.

Attendus:
- rappels pour actions en retard ou controles a revoir
- mecanisme simple, sans sur-architecture
- configuration minimale si necessaire
- tests utiles
- README mis a jour

Ne construis pas un moteur de workflow.
```

---

## Prompt 16 - Incident Register

```text
Lis les docs du projet puis implemente uniquement un module Incident Register coherent avec l'existant.

Attendus:
- migration SQL incidents
- CRUD simple
- lien possible avec risques et actions
- statuts de base
- tests minimaux
- README mis a jour

Ne change pas l'architecture globale.
```

---

## Prompt 17 - Periodic Control Reviews

```text
Lis les docs du projet puis implemente uniquement les revues periodiques de controles.

Attendus:
- suivi des revues planifiees
- statut de revue et date cible
- lien avec controles existants
- vue liste utile pour managers
- tests minimaux
- README mis a jour

Reste minimal mais propre.
```

---

## Prompt 18 - Targeted Hardening Round 2

```text
Relis tout le projet et effectue seulement un hardening cible sur la phase suivante.

Attendus:
- corriger incoherences TypeScript
- simplifier composants trop gros
- ameliorer messages d'erreur formulaires
- ameliorer accessibilite basique
- verifier permissions critiques
- verifier validations serveur
- completer README d'installation et d'exploitation
- proposer liste concise des prochains chantiers

Ne change pas l'architecture globale.
```
