# Architecture technique recommandée

## Principe

Pour un projet Codex-friendly, il faut une architecture:

- monolithique
- lisible
- testable
- avec peu de services externes
- facile à déployer

## Stack retenue

### Frontend / App
- Next.js App Router
- TypeScript
- Tailwind
- shadcn/ui

### Backend simplifié
- Server Actions
- Route Handlers ponctuels si nécessaire

### Data
- Supabase Postgres
- migrations SQL versionnées
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

1. **Une seule codebase**
2. **Peu de plomberie backend**
3. **SQL explicite** pour garder la maîtrise du modèle
4. **Auth/Storage/DB** déjà intégrés
5. **Codex comprend bien ce type de stack**

## Structure dossier recommandée

```text
app/
  (auth)/
  dashboard/
  risks/
  controls/
  actions/
  evidence/
  frameworks/
  settings/
components/
  ui/
  layout/
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

## Modèle de permissions simple

Rôles:

- `admin`
- `manager`
- `contributor`
- `viewer`

Règles MVP:

- `viewer` lit seulement
- `contributor` crée/édite certaines entités
- `manager` gère risques/contrôles/actions
- `admin` gère tout, y compris référentiels et utilisateurs

## Convention données

- UUID partout
- `created_at`, `updated_at` partout
- `created_by`, `updated_by` sur entités critiques
- `deleted_at` pour soft delete lorsque pertinent
- enums SQL pour statuts stables

## Modules de données clés

- organizations
- profiles
- risks
- controls
- risk_controls
- action_plans
- evidence
- frameworks
- framework_requirements
- control_framework_mappings
- audit_log

## Scoring MVP

Entrées:
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

## Dashboard MVP

Widgets:
- risques par statut
- risques par niveau
- heatmap impact x likelihood
- actions en retard
- contrôles à revoir dans 30 jours

## Déploiement

### Option la plus simple
- Vercel pour l'app
- Supabase hébergé

### Option plus contrôlée
- Docker + VPS
- Supabase managé ou Postgres séparé

## Garde-fous architecture

Ne pas ajouter au MVP:

- queue system complexe
- event bus
- microservices
- websocket temps réel non essentiel
- moteur de workflow configurable
- recherche vectorielle

## Extension future possible

Après MVP:
- notifications email
- commentaires
- exports PDF / Excel
- questionnaires tiers
- registre incidents
- revue périodique de contrôles
- assistant IA pour rédaction
