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

---

## Prompt 19 - Control Testing + Findings

```text
Lis les docs du projet puis implemente uniquement un module de test des controles et de gestion des constats.

Attendus:
- table control_tests pour tracer les campagnes de test (periode, testeur, resultat, notes)
- lien obligatoire avec un controle existant
- creation automatique ou guidee d'un finding quand un test echoue
- module findings minimal (statut, severite, root cause, remediation, due date, owner)
- retest simple pour cloturer un finding
- UI minimale lisible pour managers et contributeurs
- validations serveur strictes + permissions coherentes
- tests minimaux
- README mis a jour

Contraintes:
- reste simple, pas de moteur de workflow complexe
- ne change pas l'architecture globale
```

---

## Prompt 20 - Risk Acceptance & Exceptions

```text
Lis les docs du projet puis implemente uniquement la gestion des acceptations de risque et exceptions.

Attendus:
- entite risk_acceptances ou equivalent avec justification, approbateur, date d'expiration
- lien vers risque existant (et controle/action optionnels si utile)
- statuts de base (active, expired, revoked)
- rappel visuel clair quand une acceptance arrive a expiration
- garde-fous serveur sur les transitions et permissions (manager/admin)
- validations strictes (motif obligatoire, dates valides)
- tests minimaux
- README mis a jour

Contraintes:
- pas de workflow d'approbation generique configurable
- reste pragmatique
```

---

## Prompt 21 - Compliance Assessments at Requirement Level

```text
Lis les docs du projet puis implemente uniquement l'evaluation de conformite au niveau des exigences framework.

Attendus:
- evaluation requirement-level (compliant, partial, gap, not_applicable)
- justification obligatoire pour partial/gap/not_applicable
- possibilite de lier des preuves existantes a chaque evaluation
- vue consolidee par framework (taux de couverture, taux de gap)
- permissions coherentes avec roles existants
- validations serveur strictes
- tests minimaux
- README mis a jour

Contraintes:
- ne pas modifier l'architecture de base
```

---

## Prompt 22 - Asset Register + Risk/Control Linking

```text
Lis les docs du projet puis implemente uniquement un registre d'actifs simple relie aux risques et controles.

Attendus:
- entite assets (nom, type, criticite, owner, statut)
- liens n-n assets<->risks et assets<->controls
- filtres utiles dans les listes (type, criticite, owner)
- affichage des actifs lies sur les fiches risque/controle
- validations serveur strictes + permissions coherentes
- tests minimaux
- README mis a jour

Contraintes:
- reste propre
```

---

## Prompt 23 - Third-Party Risk Lite

```text
Lis les docs du projet puis implemente uniquement une version legere de gestion du risque tiers.

Attendus:
- registre fournisseurs (nom, service, criticite, owner)
- evaluation simple de risque tiers (statut, score simple, prochaine revue)
- lien possible vers risques/controles/actions existants
- suivi des revues periodiques fournisseurs
- validations serveur strictes + permissions
- tests minimaux
- README mis a jour

Contraintes:
- pas de questionnaire fournisseur complexe
- pas d'integration externe obligatoire
```

---

## Prompt 24 - Policy & Attestation

```text
Lis les docs du projet puis implemente uniquement la gestion de policies et attestations.

Attendus:
- registre de policies (titre, version, statut, date d'effet, owner)
- publication simple d'une version active
- attestation utilisateur minimale (acknowledged_at)
- suivi de couverture des attestations (qui a confirme / qui manque)
- permissions coherentes (admin/manager)
- validations serveur strictes
- tests minimaux
- README mis a jour

Contraintes:
- pas de moteur documentaire avance
- pas de signature electronique complexe
- reste pragmatique et ne change pas l'architecture globale
```

---

## Prompt 25 - Auditable Entity Model & Org Scoping

```text
Lis les docs du projet puis implemente uniquement un modele d'entites auditables simple et reutilisable.

Attendus:
- entite `auditable_entities` ou equivalent avec au minimum: nom, type, owner, statut, parent optionnel, description
- types simples tels que: business_unit, process, application, product, vendor, legal_entity, other
- possibilite de relier une entite auditable aux risques, controles, actifs et tiers existants sans table generique trop abstraite
- pages liste / creation / detail / edition
- filtres utiles: type, owner, statut, parent
- affichage des entites auditables liees sur les fiches risque / controle / actif / tiers quand pertinent
- permissions coherentes avec les roles existants
- validations serveur strictes + RLS coherente
- seed minimal pour demo si utile
- tests minimaux
- README et docs mis a jour

Contraintes:
- pas de multi-entite enterprise complexe
- pas de moteur de taxonomie configurable illimite
- reste lisible et compatible avec les modules existants
```

---

## Prompt 26 - Audit Management Core

```text
Lis les docs du projet puis implemente uniquement un premier module d'audit interne exploitable.

Attendus:
- tables simples pour `audit_plans`, `audit_plan_items`, `audit_engagements` et `audit_workpapers` ou equivalent proche
- plan annuel ou semestriel avec items relies a une entite auditable, un risque, ou un sujet libre si necessaire
- engagement d'audit avec scope, objectifs, lead auditor, dates planifiees, dates reelles, statut
- workpapers simples avec titre, procedure, conclusion, reviewer optionnel, lien vers preuves existantes
- detail d'engagement avec sections: scope, workpapers, constats/finding lies, actions de remediation
- reutilisation des `findings`, `actions` et `evidence` existants plutot que duplication d'un sous-systeme parallele
- vue liste pour managers et auditeurs internes avec filtres par statut, owner, periode
- permissions coherentes (manager/admin pour pilotage, contributor pour execution si pertinent, viewer en lecture)
- validations serveur strictes
- tests minimaux
- README et docs mis a jour

Contraintes:
- pas de GED avancee
- pas de signature electronique
- pas de workflow QA trop riche au premier lot
- reste monolithique et pragmatique
```

---

## Prompt 27 - Unified Issues, Exceptions & Remediation

```text
Lis les docs du projet puis implemente uniquement un registre unifie des issues et exceptions.

Attendus:
- entite `issues` ou equivalent couvrant au minimum: type, severite, statut, owner, due date, root cause, management response, resolution notes
- support explicite de plusieurs types utiles: audit_finding, control_failure, policy_exception, vendor_issue, risk_exception, incident_follow_up
- possibilite de relier une issue a un risque, controle, action, incident, policy, third_party, audit engagement ou autre entite existante sans casser les modules actuels
- vue liste avec filtres: type, statut, severite, overdue, owner
- page detail lisible avec historique, liens contextuels et remediation
- aging simple et indicateurs de retard
- compatibilite progressive avec les modules `findings` et `risk_acceptances` existants sans migration massive obligatoire au premier lot
- permissions et validations serveur coherentes
- tests minimaux
- README et docs mis a jour

Contraintes:
- ne reecris pas tout le projet pour unifier l'existant en une seule fois
- pas de moteur de workflow configurable generique
- prefere une couche de convergence simple et progressive
```

---

## Prompt 28 - Policy Governance v2

```text
Lis les docs du projet puis implemente uniquement une version 2 de gouvernance documentaire pour les policies.

Attendus:
- enrichissement du module policies avec cycle simple: draft, in_review, active, archived
- approbations simples par manager/admin avant publication
- ciblage d'audience simple pour les attestations: par role, profils explicites, ou groupe minimal seed-driven
- campagnes d'attestation avec due date, statut pending/acknowledged/overdue, et suivi global
- rappels visuels clairs pour policies a revoir et attestations en retard
- comparaison simple entre version courante et version precedente sur les metadonnees et le contenu
- gestion minimale des exceptions / waivers de policy avec justification, expiration, approbateur
- detail policy enrichi avec couverture, exceptions ouvertes, prochaines revues
- validations serveur strictes + permissions coherentes
- tests minimaux
- README et docs mis a jour

Contraintes:
- pas de moteur documentaire avance
- pas de signature electronique complexe
- pas de constructeur de workflow configurable
- reste simple et exploitable par une petite equipe
```

---

## Prompt 29 - Third-Party Risk Management v2

```text
Lis les docs du projet puis implemente uniquement une version 2 plus operationnelle du module third-party.

Attendus:
- enrichissement du registre fournisseurs avec tiering / inherent risk, contract owner, renewal date, onboarding status
- questionnaires simples de revue fournisseur avec questions seed-driven, reponses, score et conclusion
- checklist de demandes documentaires ou preuves pour un fournisseur avec statuts et due dates
- periodic reassessment planifiee avec prochaine revue calculee ou guidee
- liens vers risques, controles, actions et issues existants
- detail fournisseur montrant clairement: posture actuelle, historique des reviews, docs demandes, renouvellement, issues ouvertes
- filtres utiles: tier, review status, renewal horizon, criticality, owner
- validations serveur strictes + permissions coherentes
- tests minimaux
- README et docs mis a jour

Contraintes:
- pas de portail fournisseur externe complexe au premier lot
- pas de monitoring externe automatise au premier lot
- pas de questionnaire builder ultra configurable
```

---

## Prompt 30 - Control Assurance & Evidence Orchestration

```text
Lis les docs du projet puis implemente uniquement une couche plus operationnelle d'assurance des controles.

Attendus:
- campagnes ou cycles simples d'attestation de controle pour les owners
- demandes de preuves liees aux controles avec due date, statut, owner, commentaire de revue
- possibilite de lier une preuve uploadee existante ou nouvelle a une demande de preuve
- historique d'assurance par controle: attestations, tests, preuves demandees, constats lies
- vue liste pour managers: controles en retard, attestations manquantes, preuves manquantes, controles sains vs a risque
- lien fort avec les modules existants `control_reviews`, `control_tests`, `findings` et `evidence`
- validations serveur strictes + permissions coherentes
- tests minimaux
- README et docs mis a jour

Contraintes:
- pas de moteur de workflow generique
- pas de collecte automatique depuis integrations externes au premier lot
- reste centre sur l'operating model des controle owners
```

---

## Prompt 31 - Executive & Committee Reporting Packs

```text
Lis les docs du projet puis implemente uniquement des reporting packs management / audit committee utiles.

Attendus:
- une page reporting enrichie avec vues sauvegardables ou presets pour management, audit committee, compliance review
- sections cles basees sur les vraies donnees: top risks, issues ouvertes, actions overdue, health des controles, gaps framework, vendors critiques, couverture des attestations policy
- si le module audit existe, ajouter aussi l'etat du plan d'audit et des engagements
- export lisible au minimum en HTML imprimable et CSV/JSON pour les jeux de donnees sous-jacents
- periode et filtres simples: owner, type, severite, statut, horizon de dates
- mise en page sobre et board-ready, sans chiffres mockes
- validations serveur strictes + permissions coherentes
- tests minimaux
- README et docs mis a jour

Contraintes:
- pas de moteur BI
- pas de slide builder complexe
- pas de PDF riche si cela ajoute trop de plomberie; prefere une vue imprimable propre
```

---

## Prompt 32 - RCSA (Risk Control Self-Assessment)

```text
Lis les docs du projet puis implemente uniquement une premiere version exploitable de RCSA.

Attendus:
- tables simples pour `rcsa_campaigns`, `rcsa_responses` et un jeu de questions seed-driven ou equivalent
- campagne RCSA liee a une entite auditable, un risque, un controle, ou un owner selon le modele existant
- questionnaire simple sur design adequacy, operating effectiveness, incidents recents, preuves disponibles, actions necessaires
- score de synthese simple avec resultat exploitable: satisfactory, needs_attention, critical ou equivalent
- possibilite de creer ou suggerer une action / issue a partir d'une reponse faible
- vue liste des campagnes, detail d'une campagne, soumission de reponses et revue manager
- filtres utiles: statut, owner, periode, score
- validations serveur strictes + permissions coherentes
- tests minimaux
- README et docs mis a jour

Contraintes:
- pas de survey builder illimite
- pas de logique conditionnelle complexe au premier lot
- garde un questionnaire simple, seed-driven et lisible
```
