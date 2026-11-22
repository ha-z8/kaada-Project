const usernameRegex=/^[a-z0-9][a-z0-9._-]{2,23}$/;
export function normalizeUsername(value=''){return String(value).trim().toLowerCase();}
export function validUsername(value=''){return usernameRegex.test(normalizeUsername(value));}
export function usernameLoginEmail(value=''){
  const name=normalizeUsername(value);
  if(!validUsername(name))throw Error('اسم المستخدم يجب أن يكون من 3 إلى 24 حرفًا إنجليزيًا أو رقمًا.');
  return name+'@accounts.kaada.invalid';
}
