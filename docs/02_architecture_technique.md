# Architecture technique recommandee

## Principe

Pour un projet Codex-friendly, il faut une architecture:

- monolithique
- lisible
- testable
- avec peu de services externes
- facile a deployer

## Stack retenue

### Frontend / App
- Next.js App Router
- TypeScript
- Tailwind
- shadcn/ui

### Backend simplifie
- Server Actions
- Route Handlers ponctuels si necessaire

### Data
- Supabase Postgres
- migrations SQL versionnees
- RLS simple

### Auth
- Supabase Auth

### Storage
- Supabase Storage pour les preuves / fichiers

### Validation
- Zod

### Charts
- Recharts

### Tests
- Vitest pour logique utilitaire
- Playwright pour E2E critiques

## Pourquoi cette stack est optimale pour vibe coding

1. Une seule codebase
2. Peu de plomberie backend
3. SQL explicite pour garder la maitrise du modele
4. Auth/Storage/DB deja integres
5. Codex comprend bien ce type de stack

## Structure dossier recommandee

```text
app/
  (auth)/
  dashboard/
  policies/
  risks/
  controls/
  actions/
  evidence/
  frameworks/
  settings/
components/
  ui/
  layout/
  policies/
  risks/
  controls/
  actions/
lib/
  auth/
  db/
  permissions/
  validators/
  scoring/
  audit/
supabase/
  migrations/
  seed/
tests/
  e2e/
```

## Modele de permissions simple

Roles:

- `admin`
- `manager`
- `contributor`
- `viewer`

Regles de base:

- `viewer` lit seulement
- `contributor` cree/edite certaines entites
- `manager` gere risques/controles/actions
- `admin` gere tout, y compris referentiels et utilisateurs

## Convention donnees

- UUID partout
- `created_at`, `updated_at` partout
- `created_by`, `updated_by` sur entites critiques
- `deleted_at` pour soft delete lorsque pertinent
- enums SQL pour statuts stables

## Modules de donnees cles

- organizations
- profiles
- risks
- controls
- risk_controls
- assets
- asset_risks
- asset_controls
- third_parties
- third_party_risks
- third_party_controls
- third_party_actions
- third_party_reviews
- policies
- policy_attestations
- action_plans
- evidence
- frameworks
- framework_requirements
- control_framework_mappings
- framework_requirement_assessments
- framework_requirement_assessment_evidence
- audit_log

## Scoring de base

Entrees:
- impact: 1..5
- likelihood: 1..5

Sorties:
- `score`
- `level`

Suggestion:
- 1-4: low
- 5-9: medium
- 10-16: high
- 17-25: critical

## Dashboard de base

Widgets:
- risques par statut
- risques par niveau
- heatmap impact x likelihood
- actions en retard
- controles a revoir dans 30 jours

## Deploiement

### Option la plus simple
- Vercel pour l'app
- Supabase heberge

### Option plus controlee
- Docker + VPS
- Supabase manage ou Postgres separe

## Garde-fous architecture

Ne pas ajouter dans la phase courante:

- queue system complexe
- event bus
- microservices
- websocket temps reel non essentiel
- moteur de workflow configurable
- recherche vectorielle
- multi-tenant SaaS complexe

## Extension future possible

Ensuite:
- notifications email
- commentaires
- exports PDF / Excel
- questionnaires tiers
- registre incidents
- revue periodique de controles
- assistant IA pour redaction
