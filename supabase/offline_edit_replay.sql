-- Offline-first optimistic and idempotent replay. Never accepts client-selected user_id.
-- All writes execute as the logged-in user, so existing RLS and teacher guards apply.
create table if not exists public.offline_edit_receipts(
 user_id uuid not null references auth.users(id) on delete cascade,
 operation_id uuid not null,
 entity text not null,
 record_id text not null,
 result jsonb not null,
 applied_at timestamptz not null default now(),
 primary key(user_id,operation_id)
);
alter table public.offline_edit_receipts enable row level security;
revoke all on public.offline_edit_receipts from public,anon,authenticated;
grant select,insert on public.offline_edit_receipts to authenticated;
drop policy if exists offline_receipt_own_select on public.offline_edit_receipts;
create policy offline_receipt_own_select on public.offline_edit_receipts
 for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists offline_receipt_own_insert on public.offline_edit_receipts;
create policy offline_receipt_own_insert on public.offline_edit_receipts
 for insert to authenticated with check(user_id=(select auth.uid()));

create or replace function public.apply_offline_edit(
 p_operation_id uuid,p_entity text,p_record_id text,p_patch jsonb,p_expected jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security invoker set search_path=''
as $$
declare
 uid uuid:=auth.uid();
 oldrow jsonb;
 newrow jsonb;
 prior jsonb;
 field_name text;
 allowed_fields text[];
 result jsonb;
 row_id uuid;
 begin_count integer;
begin
 if uid is null then raise exception 'Staff login is required for synchronization' using errcode='42501'; end if;
 if p_operation_id is null or p_record_id is null or p_record_id='' then
  raise exception 'Missing operation identifier' using errcode='22023';
 end if;
 if jsonb_typeof(p_patch)<>'object' or jsonb_typeof(p_expected)<>'object'
  or length(p_patch::text)>250000 or p_patch='{}'::jsonb then
  raise exception 'Invalid offline edit payload' using errcode='22023';
 end if;
 select r.result into prior from public.offline_edit_receipts r
 where r.user_id=uid and r.operation_id=p_operation_id;
 if found then return prior; end if;

 if p_entity='subjects' or p_entity='subjects:create' then
  allowed_fields:=array['title','description'];
 elsif p_entity='lessons' then
  allowed_fields:=array['title'];
 elsif p_entity='sections' then
  allowed_fields:=array[
   'content_en','content_ar','explanation_ar','explanation_en','explanation_mixed',
   'speech_ar','speech_en','translated_at','translation_reviewed_at',
   'processed_at','reviewed_at','audio_ar_path','audio_en_path','audio_mixed_path'
  ];
 elsif p_entity='site_settings' then
  allowed_fields:=array[
   'siteName','shortName','tagline','heroLead','heroAccent','footerText','footerNote',
   'team','teamKicker','teamTitle','teamIntro','teamEmpty',
   'aboutEyebrow','aboutTitle','aboutIntro','heroVisualLabel','heroVisualLanguages',
   'missionKicker','missionTitle','mission','highlights','featuresKicker','featuresTitle',
   'featuresIntro','features','stepsKicker','stepsTitle','stepsIntro','steps',
   'sampleTitle','sampleSubtitle','sampleEnglishLabel','sampleArabicLabel',
   'sampleEnglish','sampleArabic','sampleFoot','notesKicker','notesTitle','notes',
   'sectionOrder','hiddenSections','sidebarMenu','homePage','publicPages'
  ];
 else raise exception 'Unsupported offline data type' using errcode='22023';
 end if;

 for field_name in select jsonb_object_keys(p_patch) loop
  if not field_name=any(allowed_fields) then
   raise exception 'Field % cannot be changed offline',field_name using errcode='42501';
  end if;
  if p_entity<>'subjects:create' and not p_expected ? field_name then
   raise exception 'Expected value missing for %',field_name using errcode='22023';
  end if;
 end loop;

 if p_entity='subjects:create' then
  row_id:=p_record_id::uuid;
  if not (select exists(select 1 from public.app_roles where user_id=uid and role='admin')) then
   raise exception 'Only administrators can create subjects' using errcode='42501';
  end if;
  insert into public.subjects(id,user_id,title,description)
   values(row_id,uid,trim(p_patch->>'title'),coalesce(p_patch->>'description',''))
   returning to_jsonb(subjects.*) into newrow;
 else
  if p_entity='site_settings' then
   if p_record_id<>'1' then raise exception 'Invalid settings id' using errcode='22023'; end if;
   select s.content into oldrow from public.site_settings s where s.id=1 for update;
  else
   row_id:=p_record_id::uuid;
   if p_entity='subjects' then
    select to_jsonb(s) into oldrow from public.subjects s where s.id=row_id for update;
   elsif p_entity='lessons' then
    select to_jsonb(l) into oldrow from public.lessons l where l.id=row_id for update;
   elsif p_entity='sections' then
    select to_jsonb(s) into oldrow from public.sections s where s.id=row_id for update;
   end if;
  end if;
  if oldrow is null then return jsonb_build_object('status','missing'); end if;
  for field_name in select jsonb_object_keys(p_patch) loop
   if (oldrow->field_name) is distinct from (p_expected->field_name) then
    return jsonb_build_object('status','conflict','field',field_name,'server',oldrow);
   end if;
  end loop;

  if p_entity='subjects' then
   update public.subjects
   set title=case when p_patch?'title' then p_patch->>'title' else title end,
       description=case when p_patch?'description' then p_patch->>'description' else description end
   where id=row_id returning to_jsonb(subjects.*) into newrow;
  elsif p_entity='lessons' then
   update public.lessons
   set title=case when p_patch?'title' then p_patch->>'title' else title end
   where id=row_id returning to_jsonb(lessons.*) into newrow;
  elsif p_entity='sections' then
   update public.sections set
    content_en=case when p_patch?'content_en' then p_patch->>'content_en' else content_en end,
    content_ar=case when p_patch?'content_ar' then p_patch->>'content_ar' else content_ar end,
    explanation_ar=case when p_patch?'explanation_ar' then p_patch->>'explanation_ar' else explanation_ar end,
    explanation_en=case when p_patch?'explanation_en' then p_patch->>'explanation_en' else explanation_en end,
    explanation_mixed=case when p_patch?'explanation_mixed' then p_patch->>'explanation_mixed' else explanation_mixed end,
    speech_ar=case when p_patch?'speech_ar' then p_patch->>'speech_ar' else speech_ar end,
    speech_en=case when p_patch?'speech_en' then p_patch->>'speech_en' else speech_en end,
    translated_at=case when p_patch?'translated_at' then (p_patch->>'translated_at')::timestamptz else translated_at end,
    translation_reviewed_at=case when p_patch?'translation_reviewed_at' then (p_patch->>'translation_reviewed_at')::timestamptz else translation_reviewed_at end,
    processed_at=case when p_patch?'processed_at' then (p_patch->>'processed_at')::timestamptz else processed_at end,
    reviewed_at=case when p_patch?'reviewed_at' then (p_patch->>'reviewed_at')::timestamptz else reviewed_at end,
    audio_ar_path=case when p_patch?'audio_ar_path' then p_patch->>'audio_ar_path' else audio_ar_path end,
    audio_en_path=case when p_patch?'audio_en_path' then p_patch->>'audio_en_path' else audio_en_path end,
    audio_mixed_path=case when p_patch?'audio_mixed_path' then p_patch->>'audio_mixed_path' else audio_mixed_path end
   where id=row_id returning to_jsonb(sections.*) into newrow;
  elsif p_entity='site_settings' then
   update public.site_settings
   set content=content||p_patch,updated_at=now(),updated_by=uid
   where id=1 returning content into newrow;
  end if;
 end if;

 if newrow is null then return jsonb_build_object('status','denied'); end if;
 result=jsonb_build_object('status','applied','record',newrow);
 insert into public.offline_edit_receipts(user_id,operation_id,entity,record_id,result)
 values(uid,p_operation_id,p_entity,p_record_id,result);
 return result;
end;
$$;
revoke all on function public.apply_offline_edit(uuid,text,text,jsonb,jsonb) from public,anon;
grant execute on function public.apply_offline_edit(uuid,text,text,jsonb,jsonb) to authenticated;
