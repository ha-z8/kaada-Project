// The student-facing narration always follows the approved/edited explanation.
// Old uploaded audio recordings are unlinked when their source script is edited.
const mapping={
  audio_ar_path:['explanation_ar','speech_ar','content_ar'],
  audio_en_path:['explanation_en','speech_en','content_en'],
  audio_mixed_path:['explanation_mixed','explanation_ar','explanation_en'],
};
export function synchronizedSectionUpdate(previous,edits){
  const update={...edits};
  for(const [path,fields] of Object.entries(mapping)){
    if(fields.some(k=>Object.hasOwn(edits,k)&&String(edits[k]??'')!==String(previous?.[k]??'')))update[path]=null;
  }
  return update;
}
