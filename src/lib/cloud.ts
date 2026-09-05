import { supabase } from './supabase'
import type { Standard } from '../data/catalog'

export async function loadCloudState<T>():Promise<T|null>{
  if(!supabase) return null
  const {data:{user}}=await supabase.auth.getUser(); if(!user) return null
  const {data,error}=await supabase.from('planner_states').select('state').eq('user_id',user.id).maybeSingle()
  if(error) throw error
  return (data?.state as T)||null
}

export async function saveCloudState(state:unknown){
  if(!supabase) return
  const {data:{user}}=await supabase.auth.getUser(); if(!user) return
  const {error}=await supabase.from('planner_states').upsert({user_id:user.id,state,updated_at:new Date().toISOString()},{onConflict:'user_id'})
  if(error) throw error
}

export async function loadCurrentStandards():Promise<Standard[]>{
  if(!supabase) return []
  const {data,error}=await supabase.from('standards').select('id,grade,subject,course,unit,code,description,topics,source,source_url,version,effective_year,is_current').eq('is_current',true).order('grade').order('subject').order('code')
  if(error) throw error
  return (data||[]).map((r:any)=>({id:r.id,grade:r.grade,subject:r.subject,course:r.course,unit:r.unit,code:r.code,description:r.description,topics:r.topics||[],source:r.source,sourceUrl:r.source_url,version:r.version,effectiveYear:r.effective_year,isCurrent:r.is_current}))
}

export type StandardRelation = {
  id:string; relation:string; sequenceNumber?:number|null; direction:'previous'|'next'; standard:Standard
}

export async function loadStandardRelations(standardId:string):Promise<StandardRelation[]>{
  if(!supabase || !standardId) return []
  const [{data:incoming,error:inErr},{data:outgoing,error:outErr}]=await Promise.all([
    supabase.from('standard_progressions').select('id,relation,sequence_number,from_standard_id,standards!standard_progressions_from_standard_id_fkey(id,grade,subject,course,unit,code,description,topics,source,source_url,version,effective_year,is_current)').eq('to_standard_id',standardId),
    supabase.from('standard_progressions').select('id,relation,sequence_number,to_standard_id,standards!standard_progressions_to_standard_id_fkey(id,grade,subject,course,unit,code,description,topics,source,source_url,version,effective_year,is_current)').eq('from_standard_id',standardId)
  ])
  if(inErr) throw inErr; if(outErr) throw outErr
  const mapStd=(r:any):Standard=>({id:r.id,grade:r.grade,subject:r.subject,course:r.course,unit:r.unit,code:r.code,description:r.description,topics:r.topics||[],source:r.source,sourceUrl:r.source_url,version:r.version,effectiveYear:r.effective_year,isCurrent:r.is_current})
  return [
    ...(incoming||[]).map((r:any)=>({id:r.id,relation:r.relation,sequenceNumber:r.sequence_number,direction:'previous' as const,standard:mapStd(Array.isArray(r.standards)?r.standards[0]:r.standards)})),
    ...(outgoing||[]).map((r:any)=>({id:r.id,relation:r.relation,sequenceNumber:r.sequence_number,direction:'next' as const,standard:mapStd(Array.isArray(r.standards)?r.standards[0]:r.standards)}))
  ].filter(x=>x.standard?.id)
}

export async function loadAiAdminSettings(){
  if(!supabase) return null
  const {data,error}=await supabase.from('site_settings').select('value').eq('key','ai_admin').maybeSingle()
  if(error) throw error
  return data?.value||null
}

export async function saveAiAdminSettings(value:unknown){
  if(!supabase) return
  const {error}=await supabase.from('site_settings').upsert({key:'ai_admin',value,updated_at:new Date().toISOString()},{onConflict:'key'})
  if(error) throw error
}

export async function loadTeacherAiAccess(){
  if(!supabase) return []
  const {data,error}=await supabase.from('profiles').select('id,display_name,ai_enabled,ai_monthly_limit').order('display_name')
  if(error) throw error
  return (data||[]).map((p:any)=>({id:p.id,name:p.display_name||'Teacher',enabled:p.ai_enabled,monthlyLimit:p.ai_monthly_limit}))
}

export async function updateTeacherAiAccess(id:string,patch:{enabled?:boolean;monthlyLimit?:number}){
  if(!supabase) return
  const values:any={updated_at:new Date().toISOString()}
  if(typeof patch.enabled==='boolean') values.ai_enabled=patch.enabled
  if(typeof patch.monthlyLimit==='number') values.ai_monthly_limit=patch.monthlyLimit
  const {error}=await supabase.from('profiles').update(values).eq('id',id)
  if(error) throw error
}

export async function generateAi(task:'learningTargets'|'activities'|'assessments'|'differentiation'|'weeklyDraft',context:unknown){
  if(!supabase) throw new Error('Cloud AI is not configured.')
  const {data,error}=await supabase.functions.invoke('ai-generate',{body:{task,context}})
  if(error) throw error
  if(data?.error) throw new Error(data.error)
  return Array.isArray(data?.items)?data.items as string[]:[]
}

export type GaFramework={id:string;title:string;version?:string;lastChangeDateTime?:string;statusStartDate?:string;subject?:string[];frameworkType?:string}
export async function listGeorgiaFrameworks():Promise<GaFramework[]>{
  if(!supabase) throw new Error('Supabase is not configured.')
  const {data,error}=await supabase.functions.invoke('sync-ga-standards',{body:{action:'list'}});if(error)throw error;if(data?.error)throw new Error(data.error);return data?.documents||[]
}
export async function syncGeorgiaFramework(frameworkId:string){
  if(!supabase) throw new Error('Supabase is not configured.')
  const {data,error}=await supabase.functions.invoke('sync-ga-standards',{body:{action:'sync',frameworkId}});if(error)throw error;if(data?.error)throw new Error(data.error);return data
}

export async function loadAiUsageSummary(){
  if(!supabase) return {generations:0,cost:0}
  const start=new Date();start.setUTCDate(1);start.setUTCHours(0,0,0,0)
  const {data,error}=await supabase.from('ai_usage').select('estimated_cost').gte('created_at',start.toISOString())
  if(error) throw error
  return {generations:(data||[]).length,cost:(data||[]).reduce((n:number,r:any)=>n+Number(r.estimated_cost||0),0)}
}
