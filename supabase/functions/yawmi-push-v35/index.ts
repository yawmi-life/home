/* YAWMI Web Push V35 — authenticated subscriptions, server-only VAPID keys in Vault,
   scheduled due checks. Never ship secrets or personal reminder titles as push payloads. */
import {createClient} from "npm:@supabase/supabase-js@2.118.0";
import webpush from "npm:web-push@3.6.7";
const url=Deno.env.get("SUPABASE_URL")||"";
const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const origin="https://yawmi-life.github.io";
const common={"Content-Type":"application/json","Cache-Control":"no-store"};
const cors={"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization,apikey,content-type,x-yawmi-cron","Access-Control-Allow-Methods":"POST,OPTIONS","Vary":"Origin"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...common,...cors}});
const distinct=<T>(values:T[]):T[]=>[...new Set(values)];
type Body={action?:string;subscription?:{endpoint?:string;keys?:{p256dh?:string;auth?:string}};timezone?:string};
type Sub={id:number;user_id:string;endpoint:string;p256dh:string;auth:string;timezone:string};
type YawmiItem={id?:string;title?:string;date?:string;time?:string;end?:string;repeat?:string;remind?:string;lead?:number;day?:number;done?:boolean};
const pattern=/^\d{4}-\d{2}-\d{2}$/;
const timePattern=/^([01]\d|2[0-3]):[0-5]\d$/;
let cachedConfig:Record<string,string>|null=null;
async function secrets(){
 if(cachedConfig)return cachedConfig;
 const {data,error}=await admin.rpc("yawmi_push_internal_config");
 if(error||!data?.public_key||!data?.private_key||!data?.cron_key)throw Error("PUSH_CONFIG_MISSING");
 cachedConfig=data;return data as Record<string,string>;
}
function equalSafe(a:string,b:string){
 if(a.length!==b.length)return false;let diff=0;
 for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
 return diff===0;
}
async function viewer(req:Request){
 const bearer=(req.headers.get("authorization")||"").match(/^Bearer (.{20,})$/);
 if(!bearer)return null;
 const {data,error}=await admin.auth.getUser(bearer[1]);
 if(error||!data?.user?.id||data.user.is_anonymous)return null;
 return data.user;
}
function tzValid(tz:string){
 if(tz.length>80)return false;
 try{new Intl.DateTimeFormat("en-US",{timeZone:tz});return true}catch{return false}
}
function endpointValid(url:string){
 try{
  const value=new URL(url);
  if(value.protocol!=="https:"||url.length>1800||value.username||value.password)return false;
  return !/(^|\.)(localhost|127\.0\.0\.1)$/.test(value.hostname);
 }catch{return false}
}
function fromParts(ms:number,tz:string){
 const parts=new Intl.DateTimeFormat("en-GB",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(ms));
 const obj:Record<string,string>={};for(const p of parts)if(p.type!=="literal")obj[p.type]=p.value;
 return {date:obj.year+"-"+obj.month+"-"+obj.day,time:obj.hour+":"+obj.minute,year:Number(obj.year)};
}
function matchesSchedule(e:YawmiItem,p:{date:string;time:string;year:number}){
 if(!pattern.test(e.date||"")||!timePattern.test(e.time||"")||e.time!==p.time)return false;
 if(e.repeat==="yearly")return p.year>=Number(e.date!.slice(0,4))&&p.date.slice(5)===e.date!.slice(5);
 return e.date===p.date;
}
function candidateEvents(data:any,now:number,tz:string){
 if(!data?.lifeNotificationPrefs?.enabled)return [];
 const result:{key:string;label:string}[]=[];
 const records=[
  {items:data.lifeCalendar,kind:"calendar"},
  {items:data.lifeReminders,kind:"reminder"},
 ];
 for(const bucket of records){
  for(const item of (Array.isArray(bucket.items)?bucket.items:[]).slice(0,300) as YawmiItem[]){
   if(!item?.id||item.done||!timePattern.test(item.time||""))continue;
   if(bucket.kind==="calendar"&&(item.remind==="none"||item.remind==null))continue;
   const lead=bucket.kind==="calendar"?Number(item.remind)||0:Number(item.lead)||0;
   if(![0,10,60,1440].includes(lead))continue;
   for(let lag=0;lag<3;lag++){
    const p=fromParts(now+(lead-lag)*60000,tz);
    if(!matchesSchedule(item,p))continue;
    result.push({key:bucket.kind+":"+item.id+":"+p.date+":"+item.time+":"+lead,label:"تذكير مستحق"});
    break;
   }
  }
 }
 // A financial recurrence is a reminder, but only a generic notification may leave the server.
 for(const item of (Array.isArray(data.finance?.recurring)?data.finance.recurring:[]).slice(0,50) as YawmiItem[]){
  const n=Number(item.day);if(!item?.id||!Number.isInteger(n)||n<1||n>31)continue;
  for(let lag=0;lag<3;lag++){
   const p=fromParts(now-lag*60000,tz),days=new Date(Number(p.date.slice(0,4)),Number(p.date.slice(5,7)),0).getDate();
   if(Number(p.date.slice(8))!==Math.min(days,n)||p.time!=="09:00")continue;
   const logged=(Array.isArray(data.finance?.transactions)?data.finance.transactions:[])
    .some((x:any)=>x.recurringId===item.id&&String(x.date).slice(0,7)===p.date.slice(0,7));
   if(!logged)result.push({key:"bill:"+item.id+":"+p.date,label:"التزام مالي مستحق"});
   break;
  }
 }
 return distinct(result.map(x=>x.key)).map(key=>({key,label:"افتح يومي لمراجعة موعدك أو تذكيرك"})).slice(0,25);
}
async function sendTo(sub:Sub,payload:{title:string;body:string;url:string},keys:Record<string,string>){
 webpush.setVapidDetails(origin+"/home/",keys.public_key,keys.private_key);
 return await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},JSON.stringify(payload),{TTL:1800,urgency:"normal"});
}
async function register(userId:string,b:Body){
 const sub=b.subscription||{},endpoint=String(sub.endpoint||""),p256dh=String(sub.keys?.p256dh||""),auth=String(sub.keys?.auth||"");
 const timezone=String(b.timezone||"UTC");
 if(!endpointValid(endpoint)||p256dh.length<40||p256dh.length>200||auth.length<12||auth.length>100||!tzValid(timezone))
  return json({error:"INVALID_SUBSCRIPTION"},400);
 const {error}=await admin.from("yawmi_push_subscriptions").upsert({user_id:userId,endpoint,p256dh,auth,timezone,enabled:true,last_seen_at:new Date().toISOString()},{onConflict:"endpoint"});
 if(error)return json({error:"REGISTER_FAILED"},500);
 return json({ok:true,background:true});
}
async function unsubscribe(userId:string,b:Body){
 const endpoint=String(b.subscription?.endpoint||"");
 if(!endpointValid(endpoint))return json({error:"INVALID_SUBSCRIPTION"},400);
 const {error}=await admin.from("yawmi_push_subscriptions").delete().eq("user_id",userId).eq("endpoint",endpoint);
 return error?json({error:"UNREGISTER_FAILED"},500):json({ok:true});
}
async function sendTest(userId:string,keys:Record<string,string>){
 const {data,error}=await admin.from("yawmi_push_subscriptions").select("id,user_id,endpoint,p256dh,auth,timezone").eq("user_id",userId).eq("enabled",true).order("last_seen_at",{ascending:false}).limit(1);
 if(error||!data?.length)return json({error:"NO_ACTIVE_SUBSCRIPTION"},400);
 try{
  await sendTo(data[0],{title:"اختبار إشعارات يومي",body:"لو وصلك الإشعار ده، جهازك متصل بخدمة Web Push.",url:origin+"/home/"},keys);
  return json({ok:true,queued:true});
 }catch(error){
  return json({error:"TEST_PUSH_FAILED",reason:String((error as any)?.statusCode||"delivery")},502);
 }
}
async function runDue(keys:Record<string,string>){
 const {data:subscriptions,error:subError}=await admin.from("yawmi_push_subscriptions")
  .select("id,user_id,endpoint,p256dh,auth,timezone").eq("enabled",true).order("id").limit(300);
 if(subError)throw Error("SUBSCRIPTION_QUERY_FAILED");
 if(!subscriptions?.length)return {checked:0,queued:0,failed:0,subscriptions:0};
 const userIds=distinct(subscriptions.map(s=>s.user_id));
 const {data:documents,error:docError}=await admin.from("yawmi_documents").select("user_id,data").in("user_id",userIds);
 if(docError)throw Error("DOC_QUERY_FAILED");
 const docs=new Map((documents||[]).map(x=>[x.user_id,x.data]));
 const now=Date.now(),payload={title:"تذكير من يومي",body:"عندك موعد أو تذكير مستحق في التقويم.",url:origin+"/home/"};
 let checked=0,queued=0,failed=0;
 for(const row of subscriptions as Sub[]){
  const due=candidateEvents(docs.get(row.user_id),now,tzValid(row.timezone)?row.timezone:"UTC");
  checked+=due.length;
  for(const item of due){
   const {error:claimError}=await admin.from("yawmi_push_sent").insert({subscription_id:row.id,notification_key:item.key});
   if(claimError){
    if(claimError.code==="23505")continue;
    failed++;continue;
   }
   try{await sendTo(row,payload,keys);queued++}
   catch(err){
    failed++;
    if([404,410].includes(Number((err as any)?.statusCode))){
     await admin.from("yawmi_push_subscriptions").delete().eq("id",row.id);
    }else{
     await admin.from("yawmi_push_sent").delete().eq("subscription_id",row.id).eq("notification_key",item.key);
    }
   }
  }
 }
 return {checked,queued,failed,subscriptions:subscriptions.length};
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405);
 if(req.headers.get("origin")&&req.headers.get("origin")!==origin)return json({error:"ORIGIN_NOT_ALLOWED"},403);
 try{
  const body=await req.json() as Body;
  const keys=await secrets();
  if(body.action==="public-key")return json({publicKey:keys.public_key,serviceReady:true});
  if(body.action==="cron"){
   if(!equalSafe(req.headers.get("x-yawmi-cron")||"",keys.cron_key))return json({error:"FORBIDDEN"},403);
   const result=await runDue(keys);return json({ok:true,...result});
  }
  const user=await viewer(req);if(!user)return json({error:"LOGIN_REQUIRED"},401);
  if(body.action==="subscribe")return await register(user.id,body);
  if(body.action==="unsubscribe")return await unsubscribe(user.id,body);
  if(body.action==="test")return await sendTest(user.id,keys);
  if(body.action==="status"){
   const {count,error}=await admin.from("yawmi_push_subscriptions").select("id",{count:"exact",head:true}).eq("user_id",user.id).eq("enabled",true);
   return error?json({error:"STATUS_FAILED"},500):json({ok:true,devices:count||0});
  }
  return json({error:"UNKNOWN_ACTION"},400);
 }catch(error){
  console.error("YAWMI_PUSH_ERROR",String((error as Error)?.message||error).slice(0,150));
  return json({error:"SERVER_ERROR"},500);
 }
});
