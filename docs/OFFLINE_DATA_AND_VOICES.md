# تشغيل HSA 4 Study دون إنترنت — البيانات والصوت

## ما يحفظه التطبيق

- ملفات الواجهة JavaScript/CSS/PWA والأيقونات تحفظها Service Worker بعد فتح الموقع متصلًا.
- المكتبة (المواد، الدروس، الفقرات، النص الأصلي، الترجمة، الشروح) تحفظها IndexedDB على الجهاز بعد تنزيلها.
- إعدادات الموقع العامة وبيانات الحسابات والملف الشخصي والصلاحيات المصرح بها تحفظ محليًا، مع فصل بيانات المستخدمين بمعرف تسجيل الدخول ومسح الخاص عند تسجيل الخروج.
- التقدم في القراءة يحفظ محليًا. التعديلات المدعومة على المواد والعناوين والفقرات والإعدادات تدخل قائمة انتظار المزامنة. لا تعد التغييرات متزامنة مع Supabase حتى يؤكدها الخادم.
- التسجيلات المرفوعة الخاصة بالمقاطع: من مركز العمل دون إنترنت، اضغط «تنزيل جميع التسجيلات» متصلًا بالإنترنت. يحفظ التطبيق الملف الصوتي في IndexedDB، ويستطيع مستخدمه المصرح إعادة تشغيله بعد الانقطاع. التسجيلات الكبيرة تستهلك مساحة تخزين كبيرة.
- صور أعضاء الفريق العامة تحفظها Service Worker عند تحميلها. لا تُخزن كلمات المرور أو مفاتيح الخدمة السرية ولا تُخزن طلبات المصادقة في ذاكرة HTTP.

**تنبيه:** لا يمكن حفظ «جميع ما في Supabase» بشكل مطلق: بعض البيانات خاصة بمستخدمين آخرين ولا يحق نسخها، وبعض الملفات ضخمة، وبعض العمليات (الحذف وإدارة كلمات المرور والصلاحيات) تتطلب خادمًا. تُحفظ البيانات التي أتاح الخادم قراءتها لحساب المستخدم والموارد التي اكتمل تحميلها فقط.

## الأصوات المحلية

- الصوت السحابي للنظام ليس ملفًا يمكن تنزيله من المتصفح. بدلاً من ذلك، نستخدم Piper مع ONNX Runtime WASM لتوليد الصوت على الجهاز.
- النماذج المتاحة فعليًا: `ar_JO-kareem-medium` للعربية، و`en_US-joe-medium`, `en_US-bryce-medium`, `en_US-kristin-medium`, `en_GB-alba-medium` للإنجليزية.
- يبدأ تنزيل جميع نماذج الأصوات الحقيقية المتاحة تباعًا عند فتح المنصة متصلًا بالإنترنت؛ النموذج لا يصبح متاحًا دون إنترنت حتى يكتمل تنزيله. إذا كانت مساحة الجهاز المتاحة قليلة أو منع المتصفح التنزيل، تُترك النماذج غير المكتملة مع خيار إعادة المحاولة يدويًا دون حذف المكتبة.
- ملفات محرك WASM محلية في `/tts-runtime/` وتُخزن في Cache Storage؛ ملفات ONNX تُنزَّل من الجهة الناشرة إلى Origin Private File System (OPFS). لا نضع عشرات أو مئات الميجابايت من أوزان النماذج ضمن Git history.
- الأسماء القديمة «فهد/سعود/راشد/نورة/ريم/سارة» ليست نماذج مستقلة مرخصة يمكن نسخها. لا يصح إعادة تسمية نموذج واحد بستة أسماء أو وعد المستخدم بوجود أصوات لم تُنشأ.
- نجاح تشغيل Piper في متصفح محدد يتوقف على دعم WASM وOPFS ومساحة التخزين وقدرة المعالج؛ يُحتاج اختبار Safari وChrome وFirefox على الأجهزة المستهدفة. عدم توفر الدعم يعرض رسالة واضحة ولا يستبدل الصوت المختار بصوت آلي مختلف.
- لا تستخدم الوضع الخاص/التصفح الخفي للعمل الدائم دون إنترنت؛ قد يحذف المتصفح الذاكرة المحلية بسبب سياسة الجهاز أو نقص المساحة.

## التراخيص والمصادر
- مكتبة `@mintplex-labs/piper-tts-web` وترخيصها: https://github.com/Mintplex-Labs/piper-tts-web
- espeak-ng ونظام phonemization ضمن ملفات Piper WASM يتطلب مراجعة التزامات GPL وتوفير الشيفرة/الإشعارات المناسبة لتوزيعه: https://github.com/espeak-ng/espeak-ng
- مصدر نماذج Piper ومعلومات كل نموذج: https://huggingface.co/rhasspy/piper-voices
- نموذج Alba: CC BY 4.0، يتطلب النسبة للمصدر. بقية النماذج بحسب بطاقات المصدر لكل منها.

## اختبار يدوي أساسي
1. شغّل التطبيق متصلًا ودع التنزيل يصل «محفوظ على الجهاز» لكل نموذج تريده، وافتح المكتبة والحسابات.
2. من مركز العمل دون إنترنت نزّل التسجيلات التي تحتاجها، وافحص المساحة المتاحة.
3. ضع المتصفح في وضع Offline من أدوات الشبكة أو افصل شبكة الجهاز.
4. أعد فتح رابط التطبيق بعد أن يُثبّت Service Worker، وجرّب فتح درس، قراءة وترجمة وشرح واختيار صوت محلي، والتنقل للحسابات بصلاحية المشرف الحالية.
5. أجْر تعديلًا مسموحًا محليًا، أعد الاتصال، وافتح مركز المزامنة لمراجعة النتيجة والتعارضات.
6. أعد تشغيل المتصفح والجهاز وكرر فحص حفظ المكتبة والنماذج والتقدم.

لا تعتبر مجرد نجاح الاختبارات الآلية بديلًا عن تجربة فعلية على كل متصفح وجهاز.

## Compatibility audio (current)
The original browser-provided online voices remain distinct. The automatic Arabic/English choices try a real voice in the correct language (including a device-local voice when needed); if unavailable, the independent voice can be explicitly prepared. No model download takes place just from opening the website. The two independent models are the Arabic Emirati female model (MIT as stated by its publisher) and the British English Alan medium model (see its dataset license in the model card); the UI does not imply that the Arabic model is Saudi-accented. Models are approximately 64 MB each, plus shared runtime files. Preparation uses local storage and a module worker. Safari, older/low-memory devices, private mode and browser media policies can still restrict playback. Generated waveform checks are not listening tests. The compatibility cache names are hsa-compat-voices-v1 and hsa-compat-runtime-v1, separate from retired assets. No new paid API or public TTS service is configured.
