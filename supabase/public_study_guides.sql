-- Update only guide lines that explicitly referenced open registration.
update public.site_settings ss
set content=jsonb_set(
 jsonb_set(
  ss.content,
  '{steps}',
  coalesce((
   select jsonb_agg(
    case (step.value->>'id')
     when 'signup' then step.value||
      jsonb_build_object('title','افتح الموقع وابدأ مباشرة','text','تفتح المنصة مباشرة على صفحة الدراسة دون إنشاء حساب. اختر المادة والدرس، ويمكن للمشرفين وأعضاء التدريس فقط تسجيل الدخول من الزاوية المخصصة لذلك.')
     when 'continue' then step.value||
      jsonb_build_object('text','استخدم «السابقة» و«التالية» أو قائمة «مقاطع الدرس». عند العودة من الجهاز والمتصفح نفسيهما تقدر تكمل من موضعك المحفوظ محليًا.')
     else step.value
    end order by step.n)
   from jsonb_array_elements(ss.content->'steps') with ordinality step(value,n)
  ), '[]'::jsonb),
  true
 ),
 '{features}',
 coalesce((
  select jsonb_agg(
   case feature.value->>'id'
    when 'progress' then feature.value||jsonb_build_object('text','انتقل بين المقاطع باستخدام السابق والتالي؛ يحفظ جهازك آخر مقطع درستَه دون حساب.')
    when 'account' then feature.value||jsonb_build_object('title','الدراسة بدون حساب','text','ابدأ المذاكرة مباشرة من أي جهاز دون تسجيل. صفحة «حسابي» مخصّصة للمشرفين وأعضاء التدريس.')
    else feature.value
   end order by feature.n)
  from jsonb_array_elements(ss.content->'features') with ordinality feature(value,n)
 ),'[]'::jsonb),
 true
) || jsonb_build_object(
 'homePage',coalesce(ss.content->'homePage','"home"'::jsonb),
 'publicPages',coalesce(ss.content->'publicPages','["home","reader","about","subjects","help"]'::jsonb)
)
where id=1;