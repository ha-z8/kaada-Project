-- Academic Arabic translations are distinct from generated explanations.
-- Migration already applied on kaada Project, is safe to re-apply.
alter table public.sections add column if not exists translated_at timestamptz null;
alter table public.sections add column if not exists translation_reviewed_at timestamptz null;
comment on column public.sections.translated_at is
'Automatically translated to Arabic; do not treat as human reviewed.';
comment on column public.sections.translation_reviewed_at is
'Time supervisor verified technical translation and mathematical fidelity.';
