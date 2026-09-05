# Georgia Teacher Planner — Cloud Foundation Build

React + TypeScript + Vite teacher-planning application designed to deploy as a static GitHub Pages site while using Supabase for secure accounts, cloud data, Georgia standards caching, roles, and optional AI.

## What is implemented
The complete feature-catch-up planner remains in this build: selection banks, learning targets, accommodations/differentiation, weekly/daily planning, flexible schedules, time budgets, templates, completeness checks, close-out/carry-forward, unit planning, curriculum progress, plan/resource libraries, substitute/family outputs, print/PDF, and local autosave.

This build adds the production infrastructure:
- Supabase email/password authentication
- `admin` and `teacher` roles
- Cloud-sync of each teacher's complete planning state
- Local fallback when Supabase is not configured or the teacher is offline
- Real admin-only AI access enforcement and monthly teacher limits
- Admin-only AI task routing and exact provider-model mapping
- Admin-entered token prices for budget estimation
- Site-wide AI budget cutoff
- AI usage log (task, alias, provider model, input/output tokens, estimated cost)
- Secure Supabase Edge Function AI gateway; API keys never enter the GitHub Pages bundle
- Official Georgia SuitCASE / 1EdTech CASE framework discovery and sync
- Source/version/effective-date metadata on standards
- Official CASE `precedes` relationships cached in `standard_progressions`

## Georgia standards
The project no longer assumes a hand-maintained standards spreadsheet is the source of truth. Georgia publishes academic standards through SuitCASE using the 1EdTech CASE API at `case.georgiastandards.org`.

In **Settings → Admin • Georgia Standards Sync**, an administrator can:
1. Find the frameworks currently exposed by Georgia's CASE service.
2. Review framework title/version/dates.
3. Sync a chosen framework into Supabase.
4. Reload current standards into the planner.

The repository still contains four clearly marked demo records so the UI can run before Supabase is configured. It intentionally does **not** bundle a copied full Georgia standards dataset. Verify the applicable GaDOE/CASE framework license before commercial redistribution of standards text.

## Supabase setup
1. Create a Supabase project.
2. Open the SQL editor and run `supabase/schema.sql`.
3. Create your account through the app or Supabase Auth.
4. Promote your owner account once in the SQL editor (an example query is at the bottom of `schema.sql`).
5. Copy `.env.example` to `.env` for local development and add your project URL + anon key.
6. Deploy the two Edge Functions:
   - `ai-generate`
   - `sync-ga-standards`
7. Set the Edge Function secret `OPENAI_API_KEY` if AI is enabled.

The Supabase service-role key is supplied automatically to deployed Supabase Edge Functions and must never be placed in GitHub Pages/Vite environment variables.

## AI model control
Teachers never see or select models. Administrators map the three internal tiers to actual provider model IDs, for example:
- Economy → `gpt-5.6-luna`
- Balanced → `gpt-5.6-terra`
- Premium → `gpt-5.6-sol`

Administrators then choose which tier handles each task. Token prices are also editable in Admin Settings so estimated budgets stay accurate when provider pricing changes.

## Local development
```bash
npm install
cp .env.example .env
npm run dev
```

Without `.env`, the planner still runs in local-only mode.

## GitHub Pages
The included GitHub Actions workflow deploys `dist/` to Pages. In the repository:
1. **Settings → Pages → Source → GitHub Actions**.
2. Add repository Actions secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Push to `main`.

`vite.config.ts` uses a relative base (`./`), so project Pages URLs do not require hard-coding the repository name.

## Important security behavior
- Teachers can save only their own planner state.
- Teachers cannot grant themselves AI access, change monthly AI limits, change roles, alter site AI routing, or write state standards.
- Admin-only controls are protected by Supabase Row Level Security, not merely hidden in the interface.
- AI provider keys are server-side only.

## Progression + AI integration

This build adds two connected production features:

1. **Official Georgia progression relationships** — when current standards have been synced through the Georgia CASE importer, Curriculum Progress queries `standard_progressions` for both predecessor and next-standard relationships. Teachers can add a related standard to their own flexible sequence without altering the official record.
2. **Selectable AI helpers** — activities, assessments, differentiation, and weekly progression suggestions invoke the secure `ai-generate` Supabase Edge Function. The teacher selects a destination day and chooses which suggestion to add. Provider model names remain admin-only.

If you already ran `supabase/schema.sql` from the previous cloud-foundation build, no additional database migration is required for this pass; it uses the existing `standard_progressions` table.
