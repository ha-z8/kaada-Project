-- Additional review marker for editable AI-generated course explanations.
-- Existing imported material and manually prepared explanations remain unchanged.
alter table public.sections add column if not exists reviewed_at timestamptz null;
comment on column public.sections.reviewed_at is
'Supervisor review time. AI generated content sets processed_at and leaves reviewed_at NULL until manually saved.';
