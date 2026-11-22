const voicesFor = (lang) => {
  const voices = window.speechSynthesis.getVoices();
  return voices.find(v => v.lang.toLowerCase() === lang.toLowerCase()) ||
    voices.find(v => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
};
export function stopSpeech() { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }
export function speakParts(parts, speed, onStart, onDone, onError) {
  if (!('speechSynthesis' in window)) { onError?.('المتصفح لا يدعم تحويل النص إلى صوت.'); return; }
  stopSpeech();
  const queue = parts.filter(p => p.text?.trim());
  if (!queue.length) { onError?.('لا يوجد نص صوتي لهذا المقطع.'); return; }
  let index = 0; let cancelled = false;
  const run = () => {
    if (cancelled || index >= queue.length) { if (!cancelled) onDone?.(); return; }
    const { text, lang } = queue[index++];
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang; utterance.rate = speed;
    const voice = voicesFor(lang); if (voice) utterance.voice = voice;
    utterance.onstart = () => onStart?.();
    utterance.onend = run;
    utterance.onerror = event => { if (event.error !== 'canceled' && event.error !== 'interrupted') onError?.('تعذّر النطق عبر محرك المتصفح.'); };
    window.speechSynthesis.speak(utterance);
  };
  run();
  return () => { cancelled = true; stopSpeech(); };
}
export function speechParts(section, track) {
  if (!section) return [];
  if (track === 'en') return [{ lang: 'en-US', text: section.speech_en || section.content_en }];
  if (track === 'ar') return [{ lang: 'ar-SA', text: section.speech_ar || section.explanation_ar || section.content_ar }];
  return [
    { lang: 'en-US', text: section.content_en },
    { lang: 'ar-SA', text: section.explanation_mixed || section.explanation_ar || section.content_ar },
  ];
}
