// Public liveness only: never expose environment, logs, or credentials.
export default async function handler(request){
 if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET','Cache-Control':'no-store'}});
 return Response.json({service:'hsa-hosting'},{headers:{'Cache-Control':'no-store'}});
}
