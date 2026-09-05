import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const cloudConfigured = Boolean(url && anonKey)
export const supabase: SupabaseClient | null = cloudConfigured ? createClient(url!, anonKey!, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null

export type CloudIdentity = { user: User; session: Session; role: 'admin'|'teacher'; aiEnabled:boolean }

export async function getIdentity():Promise<CloudIdentity|null>{
  if(!supabase) return null
  const {data:{session}}=await supabase.auth.getSession()
  if(!session?.user) return null
  const {data}=await supabase.from('profiles').select('role,ai_enabled').eq('id',session.user.id).maybeSingle()
  return {user:session.user,session,role:data?.role==='admin'?'admin':'teacher',aiEnabled:Boolean(data?.ai_enabled)}
}

export async function signIn(email:string,password:string){
  if(!supabase) throw new Error('Supabase is not configured.')
  const {error}=await supabase.auth.signInWithPassword({email,password})
  if(error) throw error
}

export async function signUp(email:string,password:string,displayName:string){
  if(!supabase) throw new Error('Supabase is not configured.')
  const {error}=await supabase.auth.signUp({email,password,options:{data:{display_name:displayName}}})
  if(error) throw error
}

export async function signOut(){if(supabase) await supabase.auth.signOut()}
