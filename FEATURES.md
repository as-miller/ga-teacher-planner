# Feature Status

## Teacher planner — implemented
- Selection-driven weekly planner
- Grade, subject, standard, topic, duration, schedule, class profile, requirement profile
- Opening, strategy, assessment, closure, accommodation, and differentiation banks
- Suggested/editable learning targets and vocabulary
- 5-day, 4-day, A/B block, custom schedules
- Daily minute budgets
- Copy/duplicate day
- Weekly close-out and carry-forward
- Curriculum progression statuses
- Unit planner
- Completeness checker
- Saved plan reuse and resource library
- Multiple print templates, substitute plan, family/student overview
- Local autosave and print/PDF

## Cloud/security — implemented
- Supabase authentication scaffolding
- Admin/teacher database roles
- Per-user cloud planner state
- Row Level Security
- Admin-only teacher AI enable/disable and monthly limits
- Admin-only model/task routing and budget controls
- AI usage logging and estimated token cost
- Secure Edge Function boundary for OpenAI API calls
- GitHub Pages build secrets for Supabase public client configuration

## Georgia standards — implemented infrastructure
- Official GaDOE SuitCASE / 1EdTech CASE framework discovery
- Admin framework sync Edge Function
- Cached standards with source/version/effective metadata
- CASE `precedes` progression associations stored for future smart sequencing
- Demo records remain only as offline/no-backend fallback

## Next refinement work
- Surface official CASE predecessor/successor suggestions directly in Curriculum Progress
- Expand AI actions beyond learning-target generation to activity/assessment/differentiation option banks
- Add admin invite flow instead of waiting for teacher self-signup
- Add account password reset/profile UI
- Add automated tests once dependencies are installable in the build environment

## Progression + AI integration pass
- Curriculum Progress now loads official synced CASE `precedes` relationships in both directions for the selected Georgia standard.
- Teachers can add an official predecessor/next standard into their own flexible instructional sequence without changing the official source record.
- AI activities, assessments, differentiation, and weekly progression suggestions now run through the secure Edge Function and appear as selectable suggestions.
- Teachers never select or see provider model names; admin routing remains centralized.
