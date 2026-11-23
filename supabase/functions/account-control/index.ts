import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// Load the maintained ESM/JSR client lazily: OPTIONS must work even if the Auth client fails to initialize.

// No privileged key is sent to the browser. Supabase injects service credentials server-side.
const allowedOrigins = new Set([
  "https://kaada-pro.netlify.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
function headers(req: Request) {
  const origin=req.headers.get("origin")||"";
  const allowed=allowedOrigins.has(origin)||/^https:\/\/[a-z0-9-]+--kaada-pro\.netlify\.app$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed?origin:"https://kaada-pro.netlify.app",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary":"Origin",
    "Cache-Control":"no-store",
  };
}
const respond=(req:Request, data:unknown,status=200)=>Response.json(data,{status,headers:headers(req)});
const problem=(req:Request,message:string,status=400,code="INVALID_REQUEST")=>respond(req,{message,code},status);
const USERNAME=/^[a-z0-9][a-z0-9._-]{2,23}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const normalized=(value:unknown)=>String(value||"").trim().toLowerCase();
const displayName=(value:unknown, fallback:string)=>String(value||"").trim().slice(0,100)||fallback;
const mail=(username:string)=>username+"@accounts.kaada.invalid";
const goodPassword=(value:unknown)=>typeof value==="string"&&value.length>=8&&value.length<=128;
const allowedRole=(value:unknown)=>value==="admin"||value==="teacher";
const noSensitive=(err:unknown)=>{
  const code=String((err as {code?:string})?.code||"");
  if(code==="email_exists"||code==="user_already_exists")return "اسم المستخدم مستخدم مسبقًا.";
  return "تعذّر إكمال العملية. راجع البيانات أو حاول مرة أخرى.";
};

async function adminClient(){
  const { createClient } = await import("jsr:@supabase/supabase-js@2");
  const url=Deno.env.get("SUPABASE_URL")||"";
  let secrets:Record<string,string>={};
  try{secrets=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}")}catch{}
  const key=secrets.default||Deno.env.get("SUPABASE_SECRET_KEY")||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!url||!key)throw Error("MISSING_SUPABASE_SERVER_SETTINGS");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

type AdminDb = Awaited<ReturnType<typeof adminClient>>;
async function checkAdmin(db:AdminDb,req:Request){
  const token=req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if(!token||token.startsWith("sb_publishable_"))return null;
  const {data,error}=await db.auth.getUser(token);
  if(error||!data?.user)return null;
  const {data:role,error:roleError}=await db.from("app_roles").select("role").eq("user_id",data.user.id).maybeSingle();
  if(roleError||role?.role!=="admin")return null;
  return data.user;
}
async function throttle(db:AdminDb,req:Request) {
  const ip=(req.headers.get("x-forwarded-for")||req.headers.get("cf-connecting-ip")||"unknown").split(",")[0].trim().slice(0,100);
  const seed=new TextEncoder().encode("kaada-accounts:"+ip);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",seed))).map(x=>x.toString(16).padStart(2,"0")).join("");
  const windowStart=new Date(Date.now()-60*60*1000).toISOString();
  const {count,error}=await db.from("account_signup_attempts").select("id",{count:"exact",head:true}).eq("ip_hash",hash).gte("attempted_at",windowStart);
  if(error)throw error;
  if((count||0)>=6)return false;
  const {error:insertError}=await db.from("account_signup_attempts").insert({ip_hash:hash});
  if(insertError)throw insertError;
  return true;
}
const teamAvatarRegex=/^team\/[a-f0-9-]{36}[.]webp$/i;
const staffAvatarRegex=/^staff\/([a-f0-9-]{36})\/[a-f0-9-]{36}[.]webp$/i;
async function allowAvatar(db:AdminDb,path:string,userId:string|null){
  if(!path)return true;
  const staff=path.match(staffAvatarRegex);
  if(staff)return Boolean(userId)&&staff[1]===userId;
  if(!teamAvatarRegex.test(path))return false;
  // Only team pictures actually published by the owner may be reused.
  const {data,error}=await db.from("site_settings").select("content").eq("id",1).single();
  if(error)return false;
  const team=(data?.content as {team?:Array<{avatarPath?:string}>})?.team||[];
  return team.some(member=>member.avatarPath===path);
}

async function register(db:AdminDb,req:Request,input:Record<string,unknown>,canAssignAdmin:boolean){
  const username=normalized(input.username);
  const password=input.password;
  const fullName=displayName(input.display_name,username);
  if(!USERNAME.test(username))return problem(req,"اسم المستخدم يجب أن يكون 3–24 حرفًا إنجليزيًا أو رقمًا، ويمكن استخدام . أو _ أو -.",422);
  if(!goodPassword(password))return problem(req,"كلمة المرور من 8 إلى 128 حرفًا.",422);
  if(!canAssignAdmin){
    if(input.website) return problem(req,"تعذر إكمال التسجيل.",400);
    if(!await throttle(db,req))return problem(req,"تم تجاوز عدد محاولات إنشاء الحسابات. أعد المحاولة بعد ساعة.",429);
  }
  if(!canAssignAdmin)return problem(req,"إنشاء الحسابات من لوحة المشرفين فقط.",403,"STAFF_ONLY");
  const role=canAssignAdmin && allowedRole(input.role)?String(input.role):"teacher";
  const avatarPath=typeof input.avatar_path==="string"?input.avatar_path:"";
  if(avatarPath&&!teamAvatarRegex.test(avatarPath))return problem(req,"اختر صورة منشورة من فريق العمل أو أضف الأفتار بعد إنشاء الحساب.",422);
  if(!await allowAvatar(db,avatarPath,null))return problem(req,"صورة فريق العمل المحددة غير متاحة.",422);
  const {data:created,error:createError}=await db.auth.admin.createUser({
    email:mail(username),password:password as string,email_confirm:true,
    user_metadata:{display_name:fullName},
  });
  if(createError||!created.user)return problem(req,noSensitive(createError),createError?.status===422?409:400);
  const id=created.user.id;
  const {error:profileError}=await db.from("user_profiles").insert({user_id:id,username,display_name:fullName,avatar_path:avatarPath});
  const {error:roleError}=profileError?{error:null}:await db.from("app_roles").insert({user_id:id,role});
  if(profileError||roleError){
    await db.auth.admin.deleteUser(id);
    return problem(req,"تعذّر إنشاء الحساب بالكامل. لم يُحفظ حساب غير مكتمل.",500);
  }
  return respond(req,{ok:true,username,role,display_name:fullName},201);
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:headers(req)});
  if(req.method!=="POST")return problem(req,"طريقة الطلب غير صحيحة.",405);
  if(Number(req.headers.get("content-length")||0)>4096)return problem(req,"الطلب كبير جدًا.",413);
  const origin=req.headers.get("origin");
  if(origin&&!allowedOrigins.has(origin)&&!/^https:\/\/[a-z0-9-]+--kaada-pro\.netlify\.app$/.test(origin))
    return problem(req,"مصدر الطلب غير مسموح.",403);
  let input:Record<string,unknown>;
  try{input=await req.json()}catch{return problem(req,"بيانات الطلب غير صحيحة.",400)}
  if(!input||typeof input!=="object"||Array.isArray(input))return problem(req,"بيانات الطلب غير صحيحة.",400);
  let db:AdminDb;
  try{db=await adminClient()}catch(e){console.error("account-client-init",{reason:(e as Error)?.message});return problem(req,"خدمة الحسابات غير مهيأة.",503)}
  const action=String(input.action||"");
  try {
    if(action==="register")return problem(req,"إنشاء الحسابات من لوحة المشرفين فقط.",403,"STAFF_ONLY");
    const actor=await checkAdmin(db,req);
    if(!actor)return problem(req,"إدارة المستخدمين تتطلب حساب مشرف مسجّلًا.",403,"ADMIN_ONLY");
    // Resolve owner by immutable Supabase Auth id; never trust username supplied by a client.
    const {data:owner,error:ownerError}=await db.from("site_owners").select("user_id").eq("id",1).single();
    if(ownerError||!owner?.user_id)return problem(req,"تعذّر التحقق من مطور المنصة.",503,"OWNER_NOT_CONFIGURED");
    const isOwner=actor.id===owner.user_id;
    if(action==="list"){
      const {data:profiles,error:e}=await db.from("user_profiles").select("user_id,username,display_name,avatar_path,created_at").order("created_at",{ascending:false}).limit(300);
      if(e)throw e;
      const {data:roles,error:re}=await db.from("app_roles").select("user_id,role");
      if(re)throw re;
      const roleMap=new Map((roles||[]).map(x=>[x.user_id,x.role]));
      return respond(req,{accounts:(profiles||[]).map(p=>({
        ...p,role:roleMap.get(p.user_id)==="admin"?"admin":roleMap.get(p.user_id)==="teacher"?"teacher":"user",
        is_owner:p.user_id===owner.user_id,
      }))});
    }
    if(action==="create")return await register(db,req,input,true);
    const userId=String(input.user_id||"");
    if(!UUID.test(userId))return problem(req,"الحساب المحدد غير صالح.",400);
    const {data:target,error:targetError}=await db.from("user_profiles").select("user_id,username,display_name,avatar_path").eq("user_id",userId).maybeSingle();
    if(targetError||!target)return problem(req,"الحساب غير موجود.",404);
    if(userId===owner.user_id&&!isOwner)
      return problem(req,"لا يمكن تعديل حساب مطور المنصة أو كلمة مروره إلا من حسابه.",403,"OWNER_ONLY");
    if(action==="update"){
      const nextName=input.username===undefined?target.username:normalized(input.username);
      const nextDisplay=input.display_name===undefined?target.display_name:displayName(input.display_name,nextName);
      if(!USERNAME.test(nextName))return problem(req,"اسم المستخدم يجب أن يكون 3–24 حرفًا إنجليزيًا أو رقمًا.",422);
      if(input.role!==undefined&&!allowedRole(input.role))return problem(req,"الصلاحية غير صحيحة.",422);
      if(input.password!==undefined&&input.password!==""&&!goodPassword(input.password))
        return problem(req,"كلمة المرور الجديدة لا تقل عن 8 أحرف.",422);
      const {data:oldRole}=await db.from("app_roles").select("role").eq("user_id",userId).maybeSingle();
      const nextRole=input.role===undefined?(oldRole?.role||"teacher"):String(input.role);
      const selectedAvatar=input.avatar_path===undefined?target.avatar_path:String(input.avatar_path);
      if(!await allowAvatar(db,selectedAvatar,userId))
        return problem(req,"الأفتار المحدد غير صالح أو غير متاح لهذا الحساب.",422);
      if(oldRole?.role==="admin"&&nextRole!=="admin"){
        const {count}=await db.from("app_roles").select("user_id",{count:"exact",head:true}).eq("role","admin");
        if((count||0)<=1)return problem(req,"لا يمكن إزالة صلاحية آخر مشرف.",409);
        if(actor.id===userId)return problem(req,"لا يمكنك إزالة صلاحية المشرف من حسابك الحالي.",409);
      }
      const changes:Record<string,unknown>={};
      if(nextName!==target.username){changes.email=mail(nextName);changes.email_confirm=true;}
      if(typeof input.password==="string"&&input.password)changes.password=input.password;
      if(Object.keys(changes).length){
        const {error}=await db.auth.admin.updateUserById(userId,changes);
        if(error)return problem(req,noSensitive(error),409);
      }
      const {error:profileError}=await db.from("user_profiles").update({username:nextName,display_name:nextDisplay,avatar_path:selectedAvatar,updated_at:new Date().toISOString()}).eq("user_id",userId);
      if(profileError){
        if(nextName!==target.username)await db.auth.admin.updateUserById(userId,{email:mail(target.username),email_confirm:true});
        return problem(req,"تعذر تعديل بيانات الحساب.",409);
      }
      if(oldRole?.role!==nextRole){
        const {error:roleError}=await db.from("app_roles").upsert({user_id:userId,role:nextRole},{onConflict:"user_id"});
        if(roleError)return problem(req,"تعذر تعديل الصلاحية.",500);
      }
      return respond(req,{ok:true,username:nextName,role:nextRole});
    }
    if(action==="delete"){
      if(userId===actor.id)return problem(req,"لا يمكن حذف حسابك الحالي من لوحة الإدارة.",409);
      const {data:allAdmins,error:adminsError}=await db.from("app_roles").select("user_id").eq("role","admin");
      if(adminsError)throw adminsError;
      const otherAdmin=(allAdmins||[]).find(a=>a.user_id!==userId)?.user_id;
      const {data:oldRole}=await db.from("app_roles").select("role").eq("user_id",userId).maybeSingle();
      if(oldRole?.role==="admin"&&!otherAdmin)return problem(req,"لا يمكن حذف آخر مشرف.",409);
      // Important: subjects/lessons/sections reference auth.users ON DELETE CASCADE.
      // Transfer authored shared material to another supervisor before deleting an account.
      const destination=otherAdmin||(actor.id!==userId?actor.id:null);
      if(!destination)return problem(req,"لا يوجد مشرف لتسليم المواد إليه.",409);
      for(const table of ["subjects","lessons","sections"]){
        const {error}=await db.from(table).update({user_id:destination}).eq("user_id",userId);
        if(error)throw error;
      }
      const {error:deleteError}=await db.auth.admin.deleteUser(userId);
      if(deleteError)return problem(req,"تعذر حذف الحساب من نظام المصادقة.",500);
      return respond(req,{ok:true});
    }
    return problem(req,"الإجراء غير معروف.",404);
  }catch(e){
    console.error("accounts-edge-error",{name:(e as Error)?.name,action});
    return problem(req,"تعذر الاتصال بخدمة الحسابات. حاول مرة أخرى.",500);
  }
});
