-- Invalidate obsolete prerecorded audio when a teacher corrects the narrated text.
-- This happens server-side, AFTER verifying the teacher did not forge any audio path.
create or replace function app_private.teacher_academic_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
 r text;
 allowed text[]:=array[
 'content_en','content_ar','explanation_ar','explanation_en','explanation_mixed',
 'speech_ar','speech_en','translated_at','translation_reviewed_at','processed_at','reviewed_at'
 ];
begin
 select role into r from public.app_roles where user_id=auth.uid();
 if r='admin' then return new; end if;
 if r<>'teacher' or (to_jsonb(new)-allowed) is distinct from (to_jsonb(old)-allowed) then
  raise exception 'Teaching members may only edit academic paragraphs and translations'
   using errcode='42501';
 end if;
 if (new.explanation_ar,new.speech_ar,new.content_ar)
   is distinct from (old.explanation_ar,old.speech_ar,old.content_ar) then
  new.audio_ar_path:=null;
 end if;
 if (new.explanation_en,new.speech_en,new.content_en)
   is distinct from (old.explanation_en,old.speech_en,old.content_en) then
  new.audio_en_path:=null;
 end if;
 if (new.explanation_mixed,new.explanation_ar,new.explanation_en)
   is distinct from (old.explanation_mixed,old.explanation_ar,old.explanation_en) then
  new.audio_mixed_path:=null;
 end if;
 return new;
end
$$;
revoke all on function app_private.teacher_academic_guard() from public,anon,authenticated;