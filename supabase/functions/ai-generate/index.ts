// Supabase Edge Function: secure AI gateway for Georgia Teacher Planner.
// Teachers submit a task only. The admin's task routing and provider-model mapping are enforced here.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const taskKey:Record<string,string>={learningTargets:'learningTargetsModel',activities:'activitiesModel',assessments:'assessmentsModel',differentiation:'differentiationModel',weeklyDraft:'weeklyDraftModel'}
const featureKey:Record<string,string>={learningTargets:'learningTargets',activities:'activities',assessments:'assessments',differentiation:'differentiation',weeklyDraft:'weeklyDraft'}

function textFromResponse(json:any){
  if(typeof json?.output_text==='string') return json.output_text
  return (json?.output||[]).flatMap((x:any)=>x?.content||[]).map((x:any)=>x?.text||'').join('').trim()
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors})
  const jsonHeaders={...cors,'Content-Type':'application/json'}
  try{
    const auth=req.headers.get('Authorization')||''
    const userClient=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}}})
    const adminClient=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const {data:{user}}=await userClient.auth.getUser(); if(!user) return new Response(JSON.stringify({error:'Unauthorized'}),{status:401,headers:jsonHeaders})
    const body=await req.json(); const task=String(body.task||''); if(!taskKey[task]) return new Response(JSON.stringify({error:'Unsupported AI task.'}),{status:400,headers:jsonHeaders})

    const [{data:profile},{data:setting}]=await Promise.all([
      adminClient.from('profiles').select('ai_enabled,ai_monthly_limit').eq('id',user.id).single(),
      adminClient.from('site_settings').select('value').eq('key','ai_admin').maybeSingle()
    ])
    if(!profile?.ai_enabled) return new Response(JSON.stringify({error:'AI is disabled for this account.'}),{status:403,headers:jsonHeaders})
    const cfg:any=setting?.value||{}
    const start=new Date();start.setUTCDate(1);start.setUTCHours(0,0,0,0)
    const {count:userCount}=await adminClient.from('ai_usage').select('*',{count:'exact',head:true}).eq('user_id',user.id).gte('created_at',start.toISOString())
    if((userCount||0)>=Number(profile.ai_monthly_limit||0)) return new Response(JSON.stringify({error:'Your monthly AI generation limit has been reached.'}),{status:429,headers:jsonHeaders})
    const {data:costRows}=await adminClient.from('ai_usage').select('estimated_cost').gte('created_at',start.toISOString())
    const monthCost=(costRows||[]).reduce((n:number,r:any)=>n+Number(r.estimated_cost||0),0)
    if(cfg.disableAtBudget&&monthCost>=Number(cfg.monthlyBudget||0)) return new Response(JSON.stringify({error:'The site AI budget has been reached.'}),{status:429,headers:jsonHeaders})

    const alias=cfg[taskKey[task]]||cfg.defaultModel||'economy'
    const model=alias==='premium'?cfg.premiumProviderModel:alias==='balanced'?cfg.balancedProviderModel:cfg.economyProviderModel
    if(!model) return new Response(JSON.stringify({error:`No provider model is configured for ${alias}.`}),{status:503,headers:jsonHeaders})
    const apiKey=Deno.env.get('OPENAI_API_KEY'); if(!apiKey) return new Response(JSON.stringify({error:'OPENAI_API_KEY is not configured on the Edge Function.'}),{status:503,headers:jsonHeaders})

    const context=body.context||{}
    const taskGuidance:Record<string,string>={
      learningTargets:'Write student-friendly, measurable I-can learning targets aligned only to the supplied standard and topic.',
      activities:'Suggest practical classroom activities with enough detail for a teacher to recognize how each would work.',
      assessments:'Suggest quick checks for understanding or assessments aligned to the supplied learning targets and standard.',
      differentiation:'Suggest concrete supports, scaffolds, access strategies, and extensions that fit the supplied lesson context without inventing student diagnoses or IEP requirements.',
      weeklyDraft:'Suggest a logical multi-day content progression for the week, including introduction, guided/application work, checks for understanding, review/reteach opportunities, and assessment.'
    }
    const instruction=`You support a Georgia teacher lesson-planning application. ${taskGuidance[task]} Return concise, practical teacher suggestions. Return ONLY valid JSON with this shape: {"items":["..."]}. Provide 4-6 distinct selectable items. Do not claim a standard says anything beyond the standard text supplied by the application. Do not include model names or AI system details.`
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model,instructions:instruction,input:JSON.stringify(context),max_output_tokens:1200})})
    const out=await r.json(); if(!r.ok) return new Response(JSON.stringify({error:out?.error?.message||'AI provider error'}),{status:r.status,headers:jsonHeaders})
    const text=textFromResponse(out); let parsed:any; try{parsed=JSON.parse(text)}catch{parsed={items:[text].filter(Boolean)}}
    const inputTokens=Number(out?.usage?.input_tokens||0), outputTokens=Number(out?.usage?.output_tokens||0)
    const inputRate=alias==='premium'?Number(cfg.premiumInputPrice||0):alias==='balanced'?Number(cfg.balancedInputPrice||0):Number(cfg.economyInputPrice||0)
    const outputRate=alias==='premium'?Number(cfg.premiumOutputPrice||0):alias==='balanced'?Number(cfg.balancedOutputPrice||0):Number(cfg.economyOutputPrice||0)
    const estimatedCost=(inputTokens/1_000_000)*inputRate+(outputTokens/1_000_000)*outputRate
    await adminClient.from('ai_usage').insert({user_id:user.id,task,model_alias:alias,provider_model:model,input_tokens:inputTokens,output_tokens:outputTokens,estimated_cost:estimatedCost})
    return new Response(JSON.stringify({items:Array.isArray(parsed.items)?parsed.items:[],modelAlias:alias}),{headers:jsonHeaders})
  }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:'Unknown error'}),{status:500,headers:jsonHeaders})}
})
