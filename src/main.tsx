import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  BookOpen, CalendarDays, Check, ChevronRight, ClipboardCheck, Clock3, Copy, FileDown,
  FolderOpen, GraduationCap, LayoutDashboard, Library, Map, Plus, Printer, Save, Search,
  Settings, Sparkles, Star, Target, Trash2, Users, WandSparkles
} from 'lucide-react'
import {
  accommodations, assessments, closures, differentiation, durations, grades, standards,
  openings, strategies, subjects, type BankItem, type Standard
} from './data/catalog'
import './styles.css'
import { cloudConfigured, getIdentity, signIn, signOut, signUp, supabase, type CloudIdentity } from './lib/supabase'
import { generateAi, listGeorgiaFrameworks, loadAiAdminSettings, loadAiUsageSummary, loadCloudState, loadCurrentStandards, loadStandardRelations, loadTeacherAiAccess, saveAiAdminSettings, saveCloudState, syncGeorgiaFramework, updateTeacherAiAccess, type GaFramework, type StandardRelation } from './lib/cloud'

type View = 'dashboard'|'planner'|'unit'|'progress'|'library'|'settings'
type ProgressStatus = 'Planned'|'In Progress'|'Taught'|'Needs Reteach'|'Mastered'
type CompletionStatus = 'Completed'|'Needs Review'|'Carry Forward'|'Not Taught'
type ScheduleType = '5-day'|'4-day'|'AB-block'|'custom'
type PrintTemplate = 'classic'|'daily'|'compact'|'elementary'|'secondary'|'special-ed'|'substitute'|'family'
type PrintOrientation = 'portrait'|'landscape'

type ProgressItem = { id:string; standardId?:string; label:string; unit:string; plannedWeek:string; status:ProgressStatus; notes:string; firstTaught?:string; lastReviewed?:string }
type DayPlan = {
  targetIds:string[]; openingIds:string[]; strategyIds:string[]; assessmentIds:string[]; closureIds:string[];
  notes:string; minutes:Record<string,number>; completion:CompletionStatus; resources:string[]
}
type AiPermissions = { enabled:boolean; learningTargets:boolean; activities:boolean; assessments:boolean; differentiation:boolean; weeklyDraft:boolean }
type AiModel = { id:string; label:string; note:string }
type AiAdminSettings = {
  defaultModel:string; learningTargetsModel:string; activitiesModel:string; assessmentsModel:string;
  differentiationModel:string; weeklyDraftModel:string; economyProviderModel:string; balancedProviderModel:string; premiumProviderModel:string; economyInputPrice:number; economyOutputPrice:number; balancedInputPrice:number; balancedOutputPrice:number; premiumInputPrice:number; premiumOutputPrice:number; monthlyBudget:number; perTeacherLimit:number; disableAtBudget:boolean
}
type UserAiAccess = { id:string; name:string; enabled:boolean; monthlyLimit:number }
type ClassProfile = { id:string; name:string; accommodationIds:string[]; differentiationIds:string[]; favoriteStrategyIds:string[] }
type RequirementProfile = { id:string; name:string; required:string[] }
type ResourceItem = { id:string; title:string; url:string; topic:string; standardId?:string; type:string }
type SavedPlan = { id:string; name:string; savedAt:string; grade:string; subject:string; topic:string; standardId:string; days:Record<string,DayPlan>; targets:string[]; essentialQuestion:string; vocabulary:string[] }
type UnitPlan = { title:string; enduringUnderstanding:string; essentialQuestions:string[]; assessmentPlan:string; startWeek:string; endWeek:string; standards:string[] }
type PrintSettings = { template:PrintTemplate; orientation:PrintOrientation; showFullStandard:boolean; showAccommodations:'weekly'|'daily'; includeTeacherNotes:boolean }

type PlannerState = {
  teacher:string; school:string; className:string; weekOf:string; grade:string; subject:string; standardId:string; topic:string; duration:string;
  scheduleType:ScheduleType; customDays:string[]; activeClassProfileId:string; activeRequirementProfileId:string;
  accommodationIds:string[]; differentiationIds:string[]; essentialQuestion:string; vocabulary:string[]; targets:string[]; days:Record<string,DayPlan>;
  favorites:{strategies:string[];assessments:string[];closures:string[]}; ai:AiPermissions; aiAdmin:AiAdminSettings; userAiAccess:UserAiAccess[];
  progression:ProgressItem[]; classProfiles:ClassProfile[]; requirementProfiles:RequirementProfile[]; resources:ResourceItem[]; savedPlans:SavedPlan[];
  unitPlan:UnitPlan; print:PrintSettings
}

const AI_MODELS:AiModel[] = [
  {id:'economy',label:'Economy',note:'Short structured suggestions and high-volume tasks.'},
  {id:'balanced',label:'Balanced',note:'Richer differentiation, activities, and weekly drafting.'},
  {id:'premium',label:'Premium',note:'Reserved for the most complex generation tasks.'}
]
const DEFAULT_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday']
const REQUIREMENT_FIELDS = [
  ['standard','Standards'],['targets','Learning targets'],['essential','Essential question'],['opening','Opening / bell ringer'],
  ['instruction','Instructional strategy'],['assessment','Assessment / CFU'],['closure','Closure'],['differentiation','Differentiation'],
  ['accommodations','Accommodations'],['resources','Resources / materials'],['notes','Teacher notes']
]
const PRINT_TEMPLATES:{id:PrintTemplate;label:string;description:string}[] = [
  {id:'classic',label:'Classic Weekly Grid',description:'Balanced Monday–Friday weekly view.'},
  {id:'daily',label:'Detailed Daily Blocks',description:'More room for each day and instructional notes.'},
  {id:'compact',label:'Compact Admin View',description:'Condensed submission-friendly plan.'},
  {id:'elementary',label:'Elementary',description:'Targets, instruction, small groups, and support emphasized.'},
  {id:'secondary',label:'Middle / High School',description:'Bell ringer, instruction, practice, assessment, closure.'},
  {id:'special-ed',label:'Special Education / GNETS',description:'Supports, differentiation, regulation, data, and notes emphasized.'},
  {id:'substitute',label:'Substitute Plan',description:'Turns the same week into clear directions for a substitute.'},
  {id:'family',label:'Family / Student Weekly Overview',description:'A simplified what-we-are-learning view without internal planning details.'}
]

const emptyDay = ():DayPlan => ({
  targetIds:[], openingIds:[], strategyIds:[], assessmentIds:[], closureIds:[], notes:'',
  minutes:{opening:5,instruction:15,practice:20,assessment:10,closure:5}, completion:'Completed', resources:[]
})
const makeDays=(days:string[])=>Object.fromEntries(days.map(d=>[d,emptyDay()]))
const initial:PlannerState = {
  teacher:'', school:'', className:'', weekOf:'', grade:'5', subject:'Science', standardId:'demo-5-sci-earth', topic:'Weathering', duration:'55 minutes',
  scheduleType:'5-day',customDays:DEFAULT_DAYS,activeClassProfileId:'default-profile',activeRequirementProfileId:'standard-profile',
  accommodationIds:[], differentiationIds:[], essentialQuestion:'How do processes change Earth’s surface over time?', vocabulary:['weathering','erosion'], targets:[], days:makeDays(DEFAULT_DAYS),
  favorites:{strategies:['model','gradual','retrieval'],assessments:['exit'],closures:['exit']},
  ai:{enabled:true,learningTargets:true,activities:true,assessments:true,differentiation:true,weeklyDraft:true},
  aiAdmin:{defaultModel:'economy',learningTargetsModel:'economy',activitiesModel:'economy',assessmentsModel:'economy',differentiationModel:'balanced',weeklyDraftModel:'balanced',economyProviderModel:'gpt-5.6-luna',balancedProviderModel:'gpt-5.6-terra',premiumProviderModel:'gpt-5.6-sol',economyInputPrice:0.20,economyOutputPrice:1.20,balancedInputPrice:2,balancedOutputPrice:12,premiumInputPrice:4,premiumOutputPrice:20,monthlyBudget:25,perTeacherLimit:50,disableAtBudget:true},
  userAiAccess:[{id:'demo-teacher',name:'Demo Teacher',enabled:true,monthlyLimit:50}],
  progression:[
    {id:'p1',standardId:'demo-5-sci-earth',label:'Foundational vocabulary & prior knowledge',unit:'Earth Systems',plannedWeek:'1',status:'Mastered',notes:''},
    {id:'p2',standardId:'demo-5-sci-earth',label:'Weathering',unit:'Earth Systems',plannedWeek:'2',status:'In Progress',notes:''},
    {id:'p3',standardId:'demo-5-sci-earth',label:'Erosion',unit:'Earth Systems',plannedWeek:'3',status:'Planned',notes:''},
    {id:'p4',standardId:'demo-5-sci-earth',label:'Deposition',unit:'Earth Systems',plannedWeek:'4',status:'Planned',notes:''},
    {id:'p5',standardId:'demo-5-sci-earth',label:'Constructive & destructive processes',unit:'Earth Systems',plannedWeek:'5',status:'Planned',notes:''}
  ],
  classProfiles:[{id:'default-profile',name:'My Default Class',accommodationIds:['checks','chunk'],differentiationIds:['flex-group'],favoriteStrategyIds:['model','pairs','retrieval']}],
  requirementProfiles:[
    {id:'standard-profile',name:'Standard Weekly Plan',required:['standard','targets','essential','instruction','assessment','closure','differentiation','accommodations']},
    {id:'admin-compact',name:'Compact Administrator Plan',required:['standard','targets','instruction','assessment','differentiation']}
  ],
  resources:[{id:'r1',title:'Example Earth Systems Slides',url:'https://example.com',topic:'Weathering',standardId:'demo-5-sci-earth',type:'Slides'}], savedPlans:[],
  unitPlan:{title:'Earth Systems',enduringUnderstanding:'Earth’s surface changes through interacting processes over time.',essentialQuestions:['How does Earth’s surface change?'],assessmentPlan:'Performance task + short standards-aligned checks',startWeek:'1',endWeek:'5',standards:['demo-5-sci-earth']},
  print:{template:'classic',orientation:'landscape',showFullStandard:true,showAccommodations:'weekly',includeTeacherNotes:true}
}

function activeDays(state:PlannerState){
  if(state.scheduleType==='4-day') return ['Monday','Tuesday','Wednesday','Thursday']
  if(state.scheduleType==='AB-block') return ['A Day 1','B Day 1','A Day 2','B Day 2']
  if(state.scheduleType==='custom') return state.customDays.length?state.customDays:DEFAULT_DAYS
  return DEFAULT_DAYS
}
function suggestTargets(std?:Standard, topic?:string){
  if(!std || !topic) return []
  const clean=topic.toLowerCase()
  return [
    `I can identify and describe key ideas related to ${clean}.`,
    `I can explain how ${clean} connects to ${std.code}.`,
    `I can use evidence, examples, or models to show my understanding of ${clean}.`,
    `I can compare or classify important features of ${clean}.`,
    `I can apply what I know about ${clean} to a new problem or situation.`
  ]
}
function grouped(items:BankItem[]){return items.reduce<Record<string,BankItem[]>>((a,i)=>{(a[i.category||'Options'] ||= []).push(i);return a},{})}
function labelFor(id:string,items:BankItem[]){return items.find(x=>x.id===id)?.label||id}
function cloneDay(d:DayPlan):DayPlan{return JSON.parse(JSON.stringify(d))}

function App(){
  const [view,setView]=useState<View>('planner')
  const [state,setState]=useState<PlannerState>(()=>{try{const saved=JSON.parse(localStorage.getItem('gaPlannerStateV3')||localStorage.getItem('gaPlannerState')||'null');return saved?hydrate(saved):initial}catch{return initial}})
  const [saved,setSaved]=useState(false)
  const [standardsData,setStandardsData]=useState<Standard[]>(standards)
  const [identity,setIdentity]=useState<CloudIdentity|null>(null)
  const [cloudStatus,setCloudStatus]=useState(cloudConfigured?'Checking cloud…':'Local-only mode')
  const [cloudReady,setCloudReady]=useState(false)
  const [targetSuggestions,setTargetSuggestions]=useState<string[]>([])
  const [standardRelations,setStandardRelations]=useState<StandardRelation[]>([])
  const [search,setSearch]=useState('')
  useEffect(()=>{localStorage.setItem('gaPlannerStateV3',JSON.stringify(state));setSaved(true);const t=setTimeout(()=>setSaved(false),800);return()=>clearTimeout(t)},[state])
  useEffect(()=>{
    if(!supabase){setCloudReady(true);return}
    let active=true
    const bootstrap=async()=>{
      try{
        const [id,official]=await Promise.all([getIdentity(),loadCurrentStandards()])
        if(!active)return
        setIdentity(id); if(official.length)setStandardsData(official); setCloudStatus(id?'Cloud connected':'Sign in to sync');
        if(id){
          const remote=await loadCloudState<PlannerState>(); if(remote&&active)setState(p=>({...hydrate(remote),ai:{...hydrate(remote).ai,enabled:id.aiEnabled}})); else if(active)setState(p=>({...p,ai:{...p.ai,enabled:id.aiEnabled}}))
          if(id.role==='admin'){
            const [admin,teachers]=await Promise.all([loadAiAdminSettings(),loadTeacherAiAccess()])
            if(active)setState(p=>({...p,aiAdmin:admin?{...p.aiAdmin,...admin}:p.aiAdmin,userAiAccess:teachers.length?teachers:p.userAiAccess}))
          }
        }
      }catch(e){if(active)setCloudStatus(`Cloud error: ${e instanceof Error?e.message:'Unknown error'}`)}finally{if(active)setCloudReady(true)}
    }
    bootstrap()
    const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{bootstrap()})
    return()=>{active=false;subscription.unsubscribe()}
  },[])
  useEffect(()=>{
    if(!identity||!cloudReady)return
    const t=setTimeout(()=>{saveCloudState(state).then(()=>setCloudStatus('Cloud saved')).catch(e=>setCloudStatus(`Cloud save failed: ${e.message}`))},1200)
    return()=>clearTimeout(t)
  },[state,identity?.user.id,cloudReady])
  useEffect(()=>{
    if(identity?.role!=='admin'||!cloudReady)return
    const t=setTimeout(()=>saveAiAdminSettings(state.aiAdmin).catch(e=>setCloudStatus(`Admin settings failed: ${e.message}`)),1400)
    return()=>clearTimeout(t)
  },[state.aiAdmin,identity?.role,cloudReady])

  const matchingStandards=useMemo(()=>standardsData.filter(s=>s.grade===state.grade&&s.subject===state.subject),[standardsData,state.grade,state.subject])
  const selectedStandard=standardsData.find(s=>s.id===state.standardId)||matchingStandards[0]
  const days=activeDays(state)
  useEffect(()=>{
    if(!cloudConfigured||!selectedStandard?.id||selectedStandard.demo){setStandardRelations([]);return}
    let active=true
    loadStandardRelations(selectedStandard.id).then(x=>{if(active)setStandardRelations(x)}).catch(()=>{if(active)setStandardRelations([])})
    return()=>{active=false}
  },[selectedStandard?.id])
  useEffect(()=>{
    if(matchingStandards.length&&!matchingStandards.some(s=>s.id===state.standardId)){
      const s=matchingStandards[0];setState(p=>({...p,standardId:s.id,topic:s.topics[0]||''}))
    }
  },[state.grade,state.subject])
  useEffect(()=>{
    setState(p=>{const next={...p.days};days.forEach(d=>{if(!next[d])next[d]=emptyDay()});return {...p,days:next}})
  },[state.scheduleType,state.customDays.join('|')])

  const refreshStandards=async()=>{try{const official=await loadCurrentStandards();if(official.length){setStandardsData(official);setCloudStatus(`Loaded ${official.length} current standards`)}}catch(e){setCloudStatus(`Standards reload failed: ${e instanceof Error?e.message:'Unknown error'}`)}}
  const update=<K extends keyof PlannerState>(key:K,val:PlannerState[K])=>setState(p=>({...p,[key]:val}))
  const updateDay=(day:string,patch:Partial<DayPlan>)=>setState(p=>({...p,days:{...p.days,[day]:{...p.days[day],...patch}}}))
  const toggleArray=(key:'accommodationIds'|'differentiationIds',id:string)=>update(key,state[key].includes(id)?state[key].filter(x=>x!==id):[...state[key],id])
  const toggleDay=(day:string,key:'targetIds'|'openingIds'|'strategyIds'|'assessmentIds'|'closureIds',id:string)=>{const arr=state.days[day][key];updateDay(day,{[key]:arr.includes(id)?arr.filter(x=>x!==id):[...arr,id]} as Partial<DayPlan>)}
  const addTarget=(t:string)=>{const v=t.trim();if(v&&!state.targets.includes(v))update('targets',[...state.targets,v])}
  const genTargets=async()=>{
    const fallback=suggestTargets(selectedStandard,state.topic).filter(x=>!state.targets.includes(x))
    if(!identity||!cloudConfigured){setTargetSuggestions(fallback);return}
    try{
      setCloudStatus('Generating learning targets…')
      const items=await generateAi('learningTargets',{grade:state.grade,subject:state.subject,course:selectedStandard?.course,standardCode:selectedStandard?.code,standardText:selectedStandard?.description,topic:state.topic,existingTargets:state.targets})
      setTargetSuggestions(items.filter(x=>!state.targets.includes(x)));setCloudStatus('AI suggestions ready')
    }catch(e){setTargetSuggestions(fallback);setCloudStatus(`AI unavailable — showing curated suggestions: ${e instanceof Error?e.message:'Unknown error'}`)}
  }
  const applyClassProfile=(id:string)=>{const p=state.classProfiles.find(x=>x.id===id);if(!p)return;setState(s=>({...s,activeClassProfileId:id,accommodationIds:[...p.accommodationIds],differentiationIds:[...p.differentiationIds],favorites:{...s.favorites,strategies:[...new Set([...s.favorites.strategies,...p.favoriteStrategyIds])]}}))}
  const draftWeek=()=>{
    const targets=state.targets.length?state.targets:suggestTargets(selectedStandard,state.topic).slice(0,4)
    setState(p=>({...p,targets,days:{...p.days,...Object.fromEntries(days.map((d,i)=>[d,{...emptyDay(),targetIds:targets.length?[String(i%targets.length)]:[],openingIds:i===0?['prior-knowledge']:['retrieval-open'],strategyIds:i===0?['model','gradual']:i===1?['collab','pairs']:i===2?['inquiry','cer']:i===3?['stations','spiral']:['retrieval'],assessmentIds:i===days.length-1?['quiz','exit']:['whiteboard','observe'],closureIds:['exit']}]))}}))
  }
  const closeAndNextWeek=()=>{
    const carry=days.filter(d=>['Carry Forward','Not Taught','Needs Review'].includes(state.days[d]?.completion)).map(d=>state.days[d])
    const nextProgress=state.progression.find(p=>p.status==='Planned')
    const nextDays=makeDays(days)
    carry.slice(0,days.length).forEach((d,i)=>{nextDays[days[i]]={...cloneDay(d),completion:'Completed'}})
    setState(p=>({...p,topic:nextProgress?.label||p.topic,days:{...p.days,...nextDays},progression:p.progression.map(x=>x.id===nextProgress?.id?{...x,status:'In Progress'}:x)}))
  }
  const savePlan=()=>{const rec:SavedPlan={id:crypto.randomUUID(),name:`${state.className||state.subject} • ${state.topic} • ${state.weekOf||'Week'}`,savedAt:new Date().toISOString(),grade:state.grade,subject:state.subject,topic:state.topic,standardId:state.standardId,days:Object.fromEntries(days.map(d=>[d,cloneDay(state.days[d])])),targets:[...state.targets],essentialQuestion:state.essentialQuestion,vocabulary:[...state.vocabulary]};update('savedPlans',[rec,...state.savedPlans])}
  const loadPlan=(p:SavedPlan)=>setState(s=>({...s,grade:p.grade,subject:p.subject,topic:p.topic,standardId:p.standardId,targets:[...p.targets],essentialQuestion:p.essentialQuestion,vocabulary:[...p.vocabulary],days:{...s.days,...Object.fromEntries(Object.entries(p.days).map(([k,v])=>[k,cloneDay(v)]))}}))
  const duplicateDay=(from:string,to:string)=>updateDay(to,cloneDay(state.days[from]))
  const completeness=computeCompleteness(state,days)

  return <div className="app-shell">
    <aside className="sidebar no-print">
      <div className="brand"><div className="brandmark"><GraduationCap size={22}/></div><div><b>Georgia Teacher Planner</b><span>Plan • Progress • Print</span></div></div>
      <nav>
        <Nav icon={<LayoutDashboard/>} label="Dashboard" active={view==='dashboard'} onClick={()=>setView('dashboard')}/>
        <Nav icon={<CalendarDays/>} label="Weekly Planner" active={view==='planner'} onClick={()=>setView('planner')}/>
        <Nav icon={<BookOpen/>} label="Unit Planner" active={view==='unit'} onClick={()=>setView('unit')}/>
        <Nav icon={<Map/>} label="Curriculum Progress" active={view==='progress'} onClick={()=>setView('progress')}/>
        <Nav icon={<Library/>} label="Plan Library" active={view==='library'} onClick={()=>setView('library')}/>
        <Nav icon={<Settings/>} label="Settings" active={view==='settings'} onClick={()=>setView('settings')}/>
      </nav>
      <div className="save-note"><Save size={15}/>{identity?(saved?'Saving…':cloudStatus):(saved?'Saved locally':'Local autosave')}</div>
    </aside>
    <main>
      {view==='dashboard'&&<Dashboard state={state} days={days} completeness={completeness} setView={setView}/>} 
      {view==='planner'&&<Planner state={state} update={update} days={days} matchingStandards={matchingStandards} selectedStandard={selectedStandard} toggleArray={toggleArray} addTarget={addTarget} targetSuggestions={targetSuggestions} genTargets={genTargets} updateDay={updateDay} toggleDay={toggleDay} draftWeek={draftWeek} applyClassProfile={applyClassProfile} duplicateDay={duplicateDay} savePlan={savePlan} closeAndNextWeek={closeAndNextWeek} completeness={completeness}/>} 
      {view==='unit'&&<UnitPlanner state={state} update={update}/>} 
      {view==='progress'&&<Progress state={state} update={update} selectedStandard={selectedStandard} relations={standardRelations}/>} 
      {view==='library'&&<LibraryView state={state} update={update} search={search} setSearch={setSearch} loadPlan={loadPlan}/>} 
      {view==='settings'&&<SettingsView state={state} update={update} identity={identity} cloudStatus={cloudStatus} setCloudStatus={setCloudStatus} refreshStandards={refreshStandards}/>} 
      {view==='planner'&&<PrintPlan state={state} days={days} selectedStandard={selectedStandard}/>} 
    </main>
  </div>
}

function hydrate(saved:any):PlannerState{
  const merged={...initial,...saved,ai:{...initial.ai,...saved.ai},aiAdmin:{...initial.aiAdmin,...saved.aiAdmin},favorites:{...initial.favorites,...saved.favorites},print:{...initial.print,...saved.print},unitPlan:{...initial.unitPlan,...saved.unitPlan}}
  merged.classProfiles=saved.classProfiles||initial.classProfiles;merged.requirementProfiles=saved.requirementProfiles||initial.requirementProfiles;merged.resources=saved.resources||initial.resources;merged.savedPlans=saved.savedPlans||[];merged.customDays=saved.customDays||DEFAULT_DAYS;merged.scheduleType=saved.scheduleType||'5-day';const rawDays={...initial.days,...saved.days};merged.days=Object.fromEntries(Object.entries(rawDays).map(([k,v]:any)=>[k,{...emptyDay(),...v,minutes:{...emptyDay().minutes,...v?.minutes},openingIds:v?.openingIds||[]}])) as Record<string,DayPlan>;return merged
}
function computeCompleteness(state:PlannerState,days:string[]){
  const profile=state.requirementProfiles.find(p=>p.id===state.activeRequirementProfileId)||state.requirementProfiles[0]
  const misses:string[]=[]
  const has=(k:string)=>{
    if(k==='standard')return !!state.standardId;if(k==='targets')return state.targets.length>0;if(k==='essential')return !!state.essentialQuestion.trim();
    if(k==='opening')return days.every(d=>state.days[d]?.openingIds?.length);if(k==='instruction')return days.every(d=>state.days[d]?.strategyIds.length);if(k==='assessment')return days.every(d=>state.days[d]?.assessmentIds.length);
    if(k==='closure')return days.every(d=>state.days[d]?.closureIds.length);if(k==='differentiation')return state.differentiationIds.length>0;if(k==='accommodations')return state.accommodationIds.length>0;
    if(k==='resources')return days.some(d=>state.days[d]?.resources.length);if(k==='notes')return days.some(d=>state.days[d]?.notes.trim());return true
  }
  profile?.required.forEach(k=>{if(!has(k))misses.push(REQUIREMENT_FIELDS.find(x=>x[0]===k)?.[1]||k)})
  const total=profile?.required.length||1;return {percent:Math.round(((total-misses.length)/total)*100),misses,profile:profile?.name||'Plan'}
}
function Nav({icon,label,active,onClick}:{icon:React.ReactNode,label:string,active:boolean,onClick:()=>void}){return <button className={'navbtn '+(active?'active':'')} onClick={onClick}>{React.cloneElement(icon as React.ReactElement<{size?:number}>,{size:19})}<span>{label}</span></button>}

function Dashboard({state,days,completeness,setView}:{state:PlannerState;days:string[];completeness:any;setView:(v:View)=>void}){
 const mastered=state.progression.filter(p=>p.status==='Mastered').length;const reteach=state.progression.filter(p=>p.status==='Needs Reteach').length
 return <Page title="Teacher Dashboard" subtitle="Your week, curriculum position, and reusable planning tools in one place.">
  <div className="stats"><Stat label="Current topic" value={state.topic||'Not selected'} icon={<BookOpen/>}/><Stat label="Plan completeness" value={`${completeness.percent}%`} icon={<ClipboardCheck/>}/><Stat label="Progress mastered" value={`${mastered}/${state.progression.length}`} icon={<Target/>}/><Stat label="Needs reteach" value={String(reteach)} icon={<Map/>}/></div>
  <div className="grid2">
   <Card title="This Week" icon={<CalendarDays/>}><p><b>{state.className||'Class'}</b> • Grade {state.grade} {state.subject}</p><p>{state.topic}</p><div className="day-summary">{days.map(d=><span key={d}>{d}: {state.days[d]?.completion||'—'}</span>)}</div><button className="primary" onClick={()=>setView('planner')}>Open weekly planner <ChevronRight size={16}/></button></Card>
   <Card title="Curriculum Position" icon={<Map/>}><div className="mini-progress">{state.progression.map(p=><span key={p.id} className={'dot '+p.status.toLowerCase().replaceAll(' ','-')} title={`${p.label}: ${p.status}`}></span>)}</div><p>{state.progression.find(p=>p.status==='In Progress')?.label||'No item currently marked In Progress'}</p><button className="secondary" onClick={()=>setView('progress')}>View progression</button></Card>
   <Card title="Plan Check" icon={<ClipboardCheck/>}><div className="score-big">{completeness.percent}%</div><p>{completeness.profile}</p>{completeness.misses.length?<div className="warning-list">{completeness.misses.slice(0,5).map((x:string)=><span key={x}>Missing: {x}</span>)}</div>:<p className="good">All required plan components are present.</p>}</Card>
   <Card title="Reuse & Resources" icon={<Library/>}><p>{state.savedPlans.length} saved plans • {state.resources.length} saved resources</p><p>Previous plans remain searchable by topic, standard, and subject.</p><button className="secondary" onClick={()=>setView('library')}>Open library</button></Card>
  </div>
 </Page>
}

function Planner(props:any){
 const {state,update,days,matchingStandards,selectedStandard,toggleArray,addTarget,targetSuggestions,genTargets,updateDay,toggleDay,draftWeek,applyClassProfile,duplicateDay,savePlan,closeAndNextWeek,completeness}=props
 const [newTarget,setNewTarget]=useState('');const [newVocab,setNewVocab]=useState('');const [preview,setPreview]=useState(false)
 const [aiIdeas,setAiIdeas]=useState<{task:string;items:string[]} | null>(null);const [aiBusy,setAiBusy]=useState('');const [aiDay,setAiDay]=useState(days[0]||'Monday')
 const setPrint=(k:keyof PrintSettings,v:any)=>update('print',{...state.print,[k]:v})
 const askAi=async(task:'activities'|'assessments'|'differentiation'|'weeklyDraft')=>{
   setAiBusy(task)
   try{
    const items=await generateAi(task,{grade:state.grade,subject:state.subject,course:selectedStandard?.course,standardCode:selectedStandard?.code,standardText:selectedStandard?.description,topic:state.topic,targets:state.targets,essentialQuestion:state.essentialQuestion,accommodations:state.accommodationIds.map((x:string)=>labelFor(x,accommodations)),differentiation:state.differentiationIds.map((x:string)=>labelFor(x,differentiation)),duration:state.duration,day:aiDay})
    setAiIdeas({task,items})
   }catch(e){setAiIdeas({task,items:[`AI unavailable: ${e instanceof Error?e.message:'Unknown error'}`]})}finally{setAiBusy('')}
 }
 const applyAiIdea=(idea:string)=>{
   const day=aiDay||days[0]; if(!day)return
   const label=aiIdeas?.task==='assessments'?'Assessment idea':aiIdeas?.task==='differentiation'?'Differentiation idea':aiIdeas?.task==='weeklyDraft'?'Weekly draft idea':'Activity idea'
   const existing=state.days[day]?.notes?.trim();updateDay(day,{notes:[existing,`${label}: ${idea}`].filter(Boolean).join('\n')})
 }
 return <Page title="Weekly Lesson Planner" subtitle="Choose from banks, adjust what you need, and reuse the plan in any print template.">
  <div className="toolbar no-print"><button className="secondary" onClick={savePlan}><Save size={16}/> Save to Library</button><button className="secondary" onClick={()=>setPreview(!preview)}><FileDown size={16}/> {preview?'Hide':'Preview'} Template</button><button className="primary" onClick={()=>window.print()}><Printer size={16}/> Print / PDF</button></div>
  <Section title="Plan Setup" description="Course, schedule, class profile, standards, and required-plan profile.">
   <div className="form-grid">
    <Field label="Teacher"><input value={state.teacher} onChange={e=>update('teacher',e.target.value)}/></Field><Field label="School"><input value={state.school} onChange={e=>update('school',e.target.value)}/></Field><Field label="Class / Period"><input value={state.className} onChange={e=>update('className',e.target.value)}/></Field><Field label="Week of"><input type="date" value={state.weekOf} onChange={e=>update('weekOf',e.target.value)}/></Field><Field label="Class duration"><select value={state.duration} onChange={e=>update('duration',e.target.value)}>{durations.map((x:string)=><option key={x}>{x}</option>)}</select></Field>
    <Field label="Schedule"><select value={state.scheduleType} onChange={e=>update('scheduleType',e.target.value)}><option value="5-day">5-day week</option><option value="4-day">4-day week</option><option value="AB-block">A/B block</option><option value="custom">Custom</option></select></Field>
    <Field label="Class profile"><select value={state.activeClassProfileId} onChange={e=>applyClassProfile(e.target.value)}>{state.classProfiles.map((x:ClassProfile)=><option value={x.id} key={x.id}>{x.name}</option>)}</select></Field>
    <Field label="Plan requirements"><select value={state.activeRequirementProfileId} onChange={e=>update('activeRequirementProfileId',e.target.value)}>{state.requirementProfiles.map((x:RequirementProfile)=><option value={x.id} key={x.id}>{x.name}</option>)}</select></Field>
    <Field label="Grade"><select value={state.grade} onChange={e=>update('grade',e.target.value)}>{grades.map((x:string)=><option key={x}>{x}</option>)}</select></Field><Field label="Subject"><select value={state.subject} onChange={e=>update('subject',e.target.value)}>{subjects.map((x:string)=><option key={x}>{x}</option>)}</select></Field>
    <Field label="Standard"><select value={state.standardId} onChange={e=>{const s=matchingStandards.find((x:Standard)=>x.id===e.target.value);update('standardId',e.target.value);if(s)update('topic',s.topics[0]||'')}}>{matchingStandards.map((s:Standard)=><option value={s.id} key={s.id}>{s.code}</option>)}</select></Field>
    <Field label="Topic"><select value={state.topic} onChange={e=>update('topic',e.target.value)}>{selectedStandard?.topics.map((x:string)=><option key={x}>{x}</option>)}</select></Field>
   </div>
   {state.scheduleType==='custom'&&<Field label="Custom day labels (comma separated)"><input value={state.customDays.join(', ')} onChange={e=>update('customDays',e.target.value.split(',').map(x=>x.trim()).filter(Boolean))}/></Field>}
   <div className="standard-box"><b>{selectedStandard?.code}</b><span>{selectedStandard?.description}</span>{selectedStandard?.source&&<small>{selectedStandard.source}{selectedStandard.version?` • ${selectedStandard.version}`:''}{selectedStandard.effectiveYear?` • ${selectedStandard.effectiveYear}`:''}</small>}{selectedStandard?.demo&&<em>Demo standard record — connect/import verified current GaDOE standards before production.</em>}</div>
  </Section>
  <div className="grid2">
   <Section title="Accommodations" description="Selection bank; class profiles can preload common supports."><Bank items={accommodations} selected={state.accommodationIds} onToggle={(id:string)=>toggleArray('accommodationIds',id)}/></Section>
   <Section title="Differentiation" description="Support, core, and extension choices."><Bank items={differentiation} selected={state.differentiationIds} onToggle={(id:string)=>toggleArray('differentiationIds',id)}/></Section>
  </div>
  <Section title="Learning Targets & Weekly Focus" description="Targets are selectable and editable. AI can later add more suggestions without replacing teacher choices.">
   <div className="grid2 inner"><div><Field label="Essential Question"><input value={state.essentialQuestion} onChange={e=>update('essentialQuestion',e.target.value)}/></Field><div className="space-top"><b className="micro-label">Vocabulary</b><ChipList items={state.vocabulary} onRemove={(x:string)=>update('vocabulary',state.vocabulary.filter((v:string)=>v!==x))}/><div className="inline-add"><input value={newVocab} onChange={e=>setNewVocab(e.target.value)} placeholder="Add vocabulary" onKeyDown={e=>{if(e.key==='Enter'){update('vocabulary',[...state.vocabulary,newVocab.trim()].filter(Boolean));setNewVocab('')}}}/><button className="secondary" onClick={()=>{if(newVocab.trim())update('vocabulary',[...state.vocabulary,newVocab.trim()]);setNewVocab('')}}><Plus size={15}/></button></div></div></div>
   <div><b className="micro-label">Selected targets</b><ChipList items={state.targets} onRemove={(x:string)=>update('targets',state.targets.filter((t:string)=>t!==x))}/><div className="inline-add"><input value={newTarget} onChange={e=>setNewTarget(e.target.value)} placeholder="Add custom target"/><button className="secondary" onClick={()=>{addTarget(newTarget);setNewTarget('')}}><Plus size={15}/></button></div><div className="button-row">{state.ai.enabled&&state.ai.learningTargets&&<button className="ai" onClick={genTargets}><Sparkles size={15}/> Suggest targets</button>}</div>{targetSuggestions.length>0&&<div className="suggestions">{targetSuggestions.map((t:string)=><button className="suggestion" key={t} onClick={()=>addTarget(t)}><Plus size={14}/>{t}</button>)}</div>}</div></div>
  </Section>
  <Section title="Daily Plan" description="Use banks for most planning. Minutes are tracked against the class duration.">
   <div className="planner-actions">{state.ai.enabled&&state.ai.weeklyDraft&&<button className="ai" onClick={draftWeek}><WandSparkles size={16}/> Build structured week</button>}<span className={'complete-pill '+(completeness.percent===100?'good-bg':'')}>{completeness.percent}% complete</span></div>
   {state.ai.enabled&&<div className="ai-workbench no-print"><div className="ai-workbench-head"><div><Sparkles size={17}/><div><b>Optional AI suggestion bank</b><span>Generate choices, then add only the ones you want. The administrator controls the model.</span></div></div><select value={aiDay} onChange={e=>setAiDay(e.target.value)}>{days.map((d:string)=><option key={d}>{d}</option>)}</select></div><div className="button-row">{state.ai.activities&&<button className="ai" disabled={!!aiBusy} onClick={()=>askAi('activities')}>{aiBusy==='activities'?'Generating…':'Suggest activities'}</button>}{state.ai.assessments&&<button className="ai" disabled={!!aiBusy} onClick={()=>askAi('assessments')}>{aiBusy==='assessments'?'Generating…':'Suggest assessments'}</button>}{state.ai.differentiation&&<button className="ai" disabled={!!aiBusy} onClick={()=>askAi('differentiation')}>{aiBusy==='differentiation'?'Generating…':'Differentiate this lesson'}</button>}{state.ai.weeklyDraft&&<button className="ai" disabled={!!aiBusy} onClick={()=>askAi('weeklyDraft')}>{aiBusy==='weeklyDraft'?'Generating…':'Suggest weekly progression'}</button>}</div>{aiIdeas&&<div className="ai-idea-list">{aiIdeas.items.map((idea:string,i:number)=><button key={`${idea}-${i}`} className="ai-idea" disabled={idea.startsWith('AI unavailable:')} onClick={()=>applyAiIdea(idea)}><Plus size={14}/><span>{idea}</span></button>)}</div>}</div>}
   <div className="days">{days.map((day:string,i:number)=><DayCard key={day} day={day} plan={state.days[day]} state={state} updateDay={updateDay} toggleDay={toggleDay} duplicateTargets={state.targets} duplicateOptions={days.filter((x:string)=>x!==day)} onDuplicate={(to:string)=>duplicateDay(day,to)} index={i}/>)}</div>
  </Section>
  <Section title="Finish the Week" description="Mark what actually happened. Carry-forward items can seed the next week without pretending they were completed.">
   <div className="closeout-grid">{days.map((d:string)=><Field label={d} key={d}><select value={state.days[d].completion} onChange={e=>updateDay(d,{completion:e.target.value as CompletionStatus})}><option>Completed</option><option>Needs Review</option><option>Carry Forward</option><option>Not Taught</option></select></Field>)}</div>
   <button className="primary" onClick={closeAndNextWeek}><ChevronRight size={16}/> Create next week from close-out</button>
  </Section>
  <Section title="Print / Lesson Plan Template" description="The lesson data stays the same while the printed sheet changes.">
   <div className="template-picker">{PRINT_TEMPLATES.map(t=><button className={'template-card '+(state.print.template===t.id?'selected':'')} key={t.id} onClick={()=>setPrint('template',t.id)}><b>{t.label}</b><span>{t.description}</span></button>)}</div>
   <div className="form-grid compact-grid"><Field label="Orientation"><select value={state.print.orientation} onChange={e=>setPrint('orientation',e.target.value)}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></Field><Field label="Standards"><select value={state.print.showFullStandard?'full':'code'} onChange={e=>setPrint('showFullStandard',e.target.value==='full')}><option value="full">Code + full description</option><option value="code">Code only</option></select></Field><Field label="Accommodations"><select value={state.print.showAccommodations} onChange={e=>setPrint('showAccommodations',e.target.value)}><option value="weekly">Show once for week</option><option value="daily">Show each day</option></select></Field><Field label="Teacher notes"><select value={state.print.includeTeacherNotes?'yes':'no'} onChange={e=>setPrint('includeTeacherNotes',e.target.value==='yes')}><option value="yes">Include</option><option value="no">Hide on print</option></select></Field></div>
   {preview&&<PrintPreview state={state} days={days} selectedStandard={selectedStandard}/>} 
  </Section>
 </Page>
}

function DayCard({day,plan,state,updateDay,toggleDay,duplicateOptions,onDuplicate,index}:any){
 const total=Object.values(plan.minutes).reduce((a:number,b:any)=>a+Number(b||0),0);const duration=parseInt(state.duration)||0
 const favFirst=(items:BankItem[],ids:string[])=>[...items].sort((a,b)=>Number(ids.includes(b.id))-Number(ids.includes(a.id)))
 return <div className="day-card"><div className="day-head"><div><h3>{day}</h3><span className={total===duration?'time-ok':'time-warn'}><Clock3 size={12}/>{total}/{duration} min</span></div><select className="copy-select" defaultValue="" onChange={e=>{if(e.target.value){onDuplicate(e.target.value);e.target.value=''}}}><option value="">Copy to…</option>{duplicateOptions.map((d:string)=><option key={d}>{d}</option>)}</select></div>
  <BankMini title="Learning targets" items={state.targets.map((x:string,i:number)=>({id:String(i),label:x}))} selected={plan.targetIds} onToggle={(id:string)=>toggleDay(day,'targetIds',id)}/><BankMini title="Opening / bell ringer" items={openings} selected={plan.openingIds||[]} onToggle={(id:string)=>toggleDay(day,'openingIds',id)}/>
  <BankMini title="Strategies" items={favFirst(strategies,state.favorites.strategies).slice(0,9)} selected={plan.strategyIds} onToggle={(id:string)=>toggleDay(day,'strategyIds',id)}/>
  <BankMini title="Assessment / CFU" items={favFirst(assessments,state.favorites.assessments).slice(0,8)} selected={plan.assessmentIds} onToggle={(id:string)=>toggleDay(day,'assessmentIds',id)}/>
  <BankMini title="Closure" items={favFirst(closures,state.favorites.closures).slice(0,6)} selected={plan.closureIds} onToggle={(id:string)=>toggleDay(day,'closureIds',id)}/>
  <div className="minutes-grid">{Object.entries(plan.minutes).map(([k,v])=><label key={k}><span>{k}</span><input type="number" min="0" value={String(v)} onChange={e=>updateDay(day,{minutes:{...plan.minutes,[k]:Number(e.target.value)}})}/></label>)}</div>
  <textarea value={plan.notes} onChange={e=>updateDay(day,{notes:e.target.value})} placeholder="Optional notes, small groups, materials, regulation supports, homework…"/>
 </div>
}

function UnitPlanner({state,update}:{state:PlannerState;update:any}){
 const u=state.unitPlan;const setU=(k:keyof UnitPlan,v:any)=>update('unitPlan',{...u,[k]:v})
 return <Page title="Unit Planner" subtitle="Connect the whole unit to weekly plans and curriculum progression.">
  <Section title="Unit Overview"><div className="form-grid"><Field label="Unit title"><input value={u.title} onChange={e=>setU('title',e.target.value)}/></Field><Field label="Start week"><input value={u.startWeek} onChange={e=>setU('startWeek',e.target.value)}/></Field><Field label="End week"><input value={u.endWeek} onChange={e=>setU('endWeek',e.target.value)}/></Field></div><Field label="Enduring understanding"><textarea value={u.enduringUnderstanding} onChange={e=>setU('enduringUnderstanding',e.target.value)}/></Field><Field label="Assessment plan"><textarea value={u.assessmentPlan} onChange={e=>setU('assessmentPlan',e.target.value)}/></Field></Section>
  <Section title="Essential Questions"><ChipList items={u.essentialQuestions} onRemove={x=>setU('essentialQuestions',u.essentialQuestions.filter(q=>q!==x))}/><QuickAdd placeholder="Add essential question" onAdd={v=>setU('essentialQuestions',[...u.essentialQuestions,v])}/></Section>
  <Section title="Unit Sequence" description="These steps are shared with Curriculum Progress; pacing is suggested, while actual status stays flexible."><div className="unit-sequence">{state.progression.map((p,i)=><div key={p.id}><span>{i+1}</span><div><b>{p.label}</b><small>Week {p.plannedWeek} • {p.status}</small></div></div>)}</div></Section>
 </Page>
}

function Progress({state,update,selectedStandard,relations}:{state:PlannerState;update:any;selectedStandard?:Standard;relations:StandardRelation[]}){
 const statuses:ProgressStatus[]=['Planned','In Progress','Taught','Needs Reteach','Mastered']
 const setItem=(id:string,patch:Partial<ProgressItem>)=>update('progression',state.progression.map(p=>p.id===id?{...p,...patch}:p))
 const add=()=>update('progression',[...state.progression,{id:crypto.randomUUID(),standardId:state.standardId,label:'New progression step',unit:state.unitPlan.title,plannedWeek:'',status:'Planned',notes:''}])
 const counts=Object.fromEntries(statuses.map(s=>[s,state.progression.filter(p=>p.status===s).length]))
 const previous=relations.filter(r=>r.direction==='previous'), next=relations.filter(r=>r.direction==='next')
 const useRelation=(r:StandardRelation)=>{
   if(state.progression.some(p=>p.standardId===r.standard.id))return
   update('progression',[...state.progression,{id:crypto.randomUUID(),standardId:r.standard.id,label:`${r.standard.code} — ${r.standard.description}`,unit:r.standard.unit||state.unitPlan.title,plannedWeek:'',status:'Planned',notes:`Added from Georgia CASE ${r.relation} relationship.`}])
 }
 return <Page title="Curriculum Progress" subtitle="See Georgia framework progression and your actual classroom pacing side by side.">
  <div className="coverage-strip">{statuses.map(s=><div key={s}><b>{counts[s]}</b><span>{s}</span></div>)}</div>
  <Section title="Georgia Standards Progression" description="Official CASE relationships are guidance from the synced state framework. Your classroom status and pacing remain teacher-controlled.">
   <div className="selected-progression-standard"><span>Selected standard</span><b>{selectedStandard?.code||'Select a synced Georgia standard'}</b><p>{selectedStandard?.description}</p></div>
   {selectedStandard?.demo?<div className="info-box">This demo standard has no official CASE relationships. Sync a current Georgia framework in Admin Settings to populate this view.</div>:relations.length===0?<div className="empty-relation">No synced predecessor/next relationships were returned for this standard.</div>:<div className="relation-grid">
    <div className="relation-column"><div className="relation-heading">← Precedes this standard</div>{previous.length?previous.map(r=><RelationCard key={r.id} relation={r} onAdd={()=>useRelation(r)}/>):<span className="subtle">No predecessor relationship listed.</span>}</div>
    <div className="relation-current"><Target size={20}/><b>{selectedStandard?.code}</b><span>Current selection</span></div>
    <div className="relation-column"><div className="relation-heading">Comes next →</div>{next.length?next.map(r=><RelationCard key={r.id} relation={r} onAdd={()=>useRelation(r)}/>):<span className="subtle">No next relationship listed.</span>}</div>
   </div>}
  </Section>
  <Section title="My Instructional Progress" description="Suggested weeks are references only. Mark what actually happened and revisit content whenever students need more time.">
   <div className="progress-legend">{statuses.map(s=><span key={s} className={'legend '+s.toLowerCase().replaceAll(' ','-')}>{s}</span>)}</div>
   <div className="timeline">{state.progression.map((p,i)=><div className="timeline-row" key={p.id}><div className="timeline-index">{i+1}</div><div className="timeline-main"><input className="progress-title" value={p.label} onChange={e=>setItem(p.id,{label:e.target.value})}/><div className="progress-meta"><span>Suggested week</span><input value={p.plannedWeek} onChange={e=>setItem(p.id,{plannedWeek:e.target.value})}/><select value={p.status} onChange={e=>setItem(p.id,{status:e.target.value as ProgressStatus})}>{statuses.map(s=><option key={s}>{s}</option>)}</select></div><textarea value={p.notes} onChange={e=>setItem(p.id,{notes:e.target.value})} placeholder="Optional pacing / reteach note"/></div></div>)}</div>
   <button className="secondary no-print" onClick={add}><Plus size={16}/> Add progression step</button>
  </Section>
  <Card title="Flexible pacing" icon={<Map/>}><p>Georgia's framework sequence can show what precedes or follows a standard, while your status can remain In Progress, move to Needs Reteach, or be revisited later without the calendar falsely marking it complete.</p></Card>
 </Page>
}

function RelationCard({relation,onAdd}:{relation:StandardRelation;onAdd:()=>void}){
 return <div className="relation-card"><div><b>{relation.standard.code}</b><span>{relation.standard.description}</span>{relation.standard.grade&&<small>Grade {relation.standard.grade} • {relation.standard.subject}</small>}</div><button className="secondary no-print" onClick={onAdd}><Plus size={14}/> Add to my sequence</button></div>
}

function LibraryView({state,update,search,setSearch,loadPlan}:{state:PlannerState;update:any;search:string;setSearch:any;loadPlan:(p:SavedPlan)=>void}){
 const q=search.toLowerCase();const plans=state.savedPlans.filter(p=>!q||`${p.name} ${p.topic} ${p.subject}`.toLowerCase().includes(q));const res=state.resources.filter(r=>!q||`${r.title} ${r.topic} ${r.type}`.toLowerCase().includes(q))
 const addResource=()=>update('resources',[{id:crypto.randomUUID(),title:'New resource',url:'',topic:state.topic,standardId:state.standardId,type:'Link'},...state.resources])
 const patchRes=(id:string,patch:Partial<ResourceItem>)=>update('resources',state.resources.map(r=>r.id===id?{...r,...patch}:r))
 return <Page title="Plan & Resource Library" subtitle="Search previous planning and keep useful resources attached to topics and standards.">
  <div className="searchbar"><Search size={18}/><input placeholder="Search plans, topics, subjects, resources…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
  <Section title="Saved Plans" description="Save a week, reuse it next year, or use it as a starting point.">{plans.length?<div className="saved-grid">{plans.map(p=><div className="saved-card" key={p.id}><div><b>{p.name}</b><span>{new Date(p.savedAt).toLocaleDateString()} • Grade {p.grade} {p.subject}</span></div><div className="button-row"><button className="secondary" onClick={()=>loadPlan(p)}><Copy size={14}/> Use plan</button><button className="icon-danger" onClick={()=>update('savedPlans',state.savedPlans.filter(x=>x.id!==p.id))}><Trash2 size={15}/></button></div></div>)}</div>:<Empty text="No saved plans yet. Save a week from the Weekly Planner."/>}</Section>
  <Section title="Resource Library" description="Keep links to slides, videos, worksheets, labs, quizzes, or other materials."><button className="secondary" onClick={addResource}><Plus size={15}/> Add resource</button><div className="resource-list">{res.map(r=><div className="resource-row" key={r.id}><input value={r.title} onChange={e=>patchRes(r.id,{title:e.target.value})}/><input value={r.type} onChange={e=>patchRes(r.id,{type:e.target.value})}/><input value={r.topic} onChange={e=>patchRes(r.id,{topic:e.target.value})}/><input value={r.url} placeholder="https://…" onChange={e=>patchRes(r.id,{url:e.target.value})}/><button className="icon-danger" onClick={()=>update('resources',state.resources.filter(x=>x.id!==r.id))}><Trash2 size={15}/></button></div>)}</div></Section>
 </Page>
}

function SettingsView({state,update,identity,cloudStatus,setCloudStatus,refreshStandards}:{state:PlannerState;update:any;identity:CloudIdentity|null;cloudStatus:string;setCloudStatus:(s:string)=>void;refreshStandards:()=>Promise<void>}){
 const setAI=(key:keyof AiPermissions,val:boolean)=>update('ai',{...state.ai,[key]:val});const setAdmin=(key:keyof AiAdminSettings,val:any)=>update('aiAdmin',{...state.aiAdmin,[key]:val})
 const setUser=(id:string,patch:Partial<UserAiAccess>)=>{update('userAiAccess',state.userAiAccess.map(u=>u.id===id?{...u,...patch}:u));if(identity?.role==='admin')updateTeacherAiAccess(id,{enabled:patch.enabled,monthlyLimit:patch.monthlyLimit}).catch(e=>setCloudStatus(`Teacher permission update failed: ${e.message}`))};const addUser=()=>update('userAiAccess',[...state.userAiAccess,{id:crypto.randomUUID(),name:'New Teacher',enabled:false,monthlyLimit:state.aiAdmin.perTeacherLimit}])
 const modelSelect=(key:keyof AiAdminSettings)=><select value={String(state.aiAdmin[key])} onChange={e=>setAdmin(key,e.target.value)}>{AI_MODELS.map(m=><option value={m.id} key={m.id}>{m.label}</option>)}</select>
 const addProfile=()=>update('classProfiles',[...state.classProfiles,{id:crypto.randomUUID(),name:'New Class Profile',accommodationIds:[],differentiationIds:[],favoriteStrategyIds:[]}]);const patchProfile=(id:string,patch:Partial<ClassProfile>)=>update('classProfiles',state.classProfiles.map(p=>p.id===id?{...p,...patch}:p))
 const addReq=()=>update('requirementProfiles',[...state.requirementProfiles,{id:crypto.randomUUID(),name:'New Requirement Profile',required:['standard','targets']}]);const patchReq=(id:string,patch:Partial<RequirementProfile>)=>update('requirementProfiles',state.requirementProfiles.map(p=>p.id===id?{...p,...patch}:p))
 const toggleReq=(p:RequirementProfile,id:string)=>patchReq(p.id,{required:p.required.includes(id)?p.required.filter(x=>x!==id):[...p.required,id]})
 return <Page title="Settings" subtitle="Teacher preferences stay simple; model routing and cost controls are admin-only.">
  <CloudAccount identity={identity} cloudStatus={cloudStatus} setCloudStatus={setCloudStatus}/>
  {cloudConfigured&&identity?.role==='admin'&&<StandardsAdmin setCloudStatus={setCloudStatus} refreshStandards={refreshStandards}/>}
  <Section title="Class Profiles" description="Save recurring accommodations, differentiation, and favorite strategies without storing student names or IEP details."><button className="secondary" onClick={addProfile}><Plus size={15}/> Add class profile</button><div className="profile-grid">{state.classProfiles.map(p=><div className="profile-card" key={p.id}><input className="profile-name" value={p.name} onChange={e=>patchProfile(p.id,{name:e.target.value})}/><b>Accommodations</b><Bank items={accommodations.slice(0,9)} selected={p.accommodationIds} onToggle={id=>patchProfile(p.id,{accommodationIds:p.accommodationIds.includes(id)?p.accommodationIds.filter(x=>x!==id):[...p.accommodationIds,id]})}/><b>Differentiation</b><Bank items={differentiation.slice(0,7)} selected={p.differentiationIds} onToggle={id=>patchProfile(p.id,{differentiationIds:p.differentiationIds.includes(id)?p.differentiationIds.filter(x=>x!==id):[...p.differentiationIds,id]})}/></div>)}</div></Section>
  <Section title="Lesson Plan Requirement Profiles" description="Match different school or administrator expectations and power the completeness checker."><button className="secondary" onClick={addReq}><Plus size={15}/> Add requirements profile</button><div className="profile-grid">{state.requirementProfiles.map(p=><div className="profile-card" key={p.id}><input className="profile-name" value={p.name} onChange={e=>patchReq(p.id,{name:e.target.value})}/>{REQUIREMENT_FIELDS.map(([id,label])=><button key={id} className={'check-item '+(p.required.includes(id)?'selected':'')} onClick={()=>toggleReq(p,id)}><span className="box">{p.required.includes(id)&&<Check size={14}/>}</span>{label}</button>)}</div>)}</div></Section>
  <Section title="Teacher AI Features" description="Teachers can hide individual helpers, but only an administrator can grant AI access. Model names never appear in the teacher planner.">{cloudConfigured?<div className={identity?.aiEnabled?'ai-access-badge enabled':'ai-access-badge disabled'}>AI access: {identity?.aiEnabled?'Enabled by administrator':'Disabled by administrator'}</div>:<Toggle label="Enable AI features for this local demo" checked={state.ai.enabled} onChange={v=>setAI('enabled',v)}/>}<div className={state.ai.enabled?'settings-list':'settings-list muted'}><Toggle label="Learning target suggestions" checked={state.ai.learningTargets} onChange={v=>setAI('learningTargets',v)}/><Toggle label="Activity suggestions" checked={state.ai.activities} onChange={v=>setAI('activities',v)}/><Toggle label="Assessment suggestions" checked={state.ai.assessments} onChange={v=>setAI('assessments',v)}/><Toggle label="Differentiation suggestions" checked={state.ai.differentiation} onChange={v=>setAI('differentiation',v)}/><Toggle label="Draft week button" checked={state.ai.weeklyDraft} onChange={v=>setAI('weeklyDraft',v)}/></div></Section>
  {(!cloudConfigured||identity?.role==='admin')&&<Section title="Admin • AI Model & Cost Controls" description="Only administrators choose model tiers. Teachers see actions, not models."><div className="admin-banner"><b>Administrator controls</b><span>Central model routing means providers/models can change later without rewriting the planner.</span></div><div className="form-grid ai-admin-grid"><Field label="Default model">{modelSelect('defaultModel')}</Field><Field label="Learning targets">{modelSelect('learningTargetsModel')}</Field><Field label="Activities">{modelSelect('activitiesModel')}</Field><Field label="Assessments">{modelSelect('assessmentsModel')}</Field><Field label="Differentiation">{modelSelect('differentiationModel')}</Field><Field label="Weekly draft">{modelSelect('weeklyDraftModel')}</Field></div><div className="model-notes">{AI_MODELS.map(m=><div key={m.id}><b>{m.label}</b><span>{m.note}</span></div>)}</div><div className="form-grid provider-model-grid"><Field label="Economy provider model"><input value={state.aiAdmin.economyProviderModel} onChange={e=>setAdmin('economyProviderModel',e.target.value)}/></Field><Field label="Balanced provider model"><input value={state.aiAdmin.balancedProviderModel} onChange={e=>setAdmin('balancedProviderModel',e.target.value)}/></Field><Field label="Premium provider model"><input value={state.aiAdmin.premiumProviderModel} onChange={e=>setAdmin('premiumProviderModel',e.target.value)}/></Field></div><div className="pricing-title"><b>Pricing used for budget estimates</b><span>USD per 1 million tokens. Update these when provider pricing changes.</span></div><div className="form-grid pricing-grid"><Field label="Economy input"><input type="number" step="0.01" min="0" value={state.aiAdmin.economyInputPrice} onChange={e=>setAdmin('economyInputPrice',Number(e.target.value))}/></Field><Field label="Economy output"><input type="number" step="0.01" min="0" value={state.aiAdmin.economyOutputPrice} onChange={e=>setAdmin('economyOutputPrice',Number(e.target.value))}/></Field><Field label="Balanced input"><input type="number" step="0.01" min="0" value={state.aiAdmin.balancedInputPrice} onChange={e=>setAdmin('balancedInputPrice',Number(e.target.value))}/></Field><Field label="Balanced output"><input type="number" step="0.01" min="0" value={state.aiAdmin.balancedOutputPrice} onChange={e=>setAdmin('balancedOutputPrice',Number(e.target.value))}/></Field><Field label="Premium input"><input type="number" step="0.01" min="0" value={state.aiAdmin.premiumInputPrice} onChange={e=>setAdmin('premiumInputPrice',Number(e.target.value))}/></Field><Field label="Premium output"><input type="number" step="0.01" min="0" value={state.aiAdmin.premiumOutputPrice} onChange={e=>setAdmin('premiumOutputPrice',Number(e.target.value))}/></Field></div><div className="form-grid budget-grid"><Field label="Monthly site budget ($)"><input type="number" min="0" value={state.aiAdmin.monthlyBudget} onChange={e=>setAdmin('monthlyBudget',Number(e.target.value))}/></Field><Field label="Default teacher limit / month"><input type="number" min="0" value={state.aiAdmin.perTeacherLimit} onChange={e=>setAdmin('perTeacherLimit',Number(e.target.value))}/></Field></div><Toggle label="Automatically disable AI when the site budget is reached" checked={state.aiAdmin.disableAtBudget} onChange={v=>setAdmin('disableAtBudget',v)}/><AiUsage budget={state.aiAdmin.monthlyBudget} active={cloudConfigured&&identity?.role==='admin'}/><div className="info-box">This build still does not expose an API key in the browser. Paid AI should be connected through a secure server-side function such as a Supabase Edge Function.</div></Section>}
  {(!cloudConfigured||identity?.role==='admin')&&<Section title="Admin • Teacher AI Access" description="Turn AI on/off per account and set individual monthly limits."><div className="user-access">{state.userAiAccess.map(u=><div className="user-access-row" key={u.id}><input value={u.name} onChange={e=>setUser(u.id,{name:e.target.value})}/><label><span>AI access</span><button type="button" className={'toggle '+(u.enabled?'on':'')} onClick={()=>setUser(u.id,{enabled:!u.enabled})}><i/></button></label><label><span>Monthly limit</span><input type="number" min="0" value={u.monthlyLimit} onChange={e=>setUser(u.id,{monthlyLimit:Number(e.target.value)})}/></label></div>)}</div><button className="secondary" onClick={addUser} disabled={cloudConfigured}><Plus size={16}/> {cloudConfigured?'Teachers appear here after account signup':'Add teacher'}</button></Section>}
  <Section title="Storage"><p className="subtle">Local autosave is always available. When Supabase is configured and you sign in, the planner also syncs your full planning state to your account.</p><div className="cloud-status">{cloudStatus}</div><button className="danger" onClick={()=>{localStorage.removeItem('gaPlannerStateV3');localStorage.removeItem('gaPlannerState');location.reload()}}>Reset local demo data</button></Section>
 </Page>
}


function AiUsage({budget,active}:{budget:number;active:boolean}){
 const [usage,setUsage]=useState({generations:0,cost:0});useEffect(()=>{if(active)loadAiUsageSummary().then(setUsage).catch(()=>{})},[active])
 return <div className="usage-placeholder"><div><span>This month</span><strong>{usage.generations} generations</strong></div><div><span>Estimated usage cost</span><strong>${usage.cost.toFixed(2)}</strong></div><div><span>Budget</span><strong>${budget.toFixed(2)}</strong></div></div>
}

function StandardsAdmin({setCloudStatus,refreshStandards}:{setCloudStatus:(s:string)=>void;refreshStandards:()=>Promise<void>}){
 const [docs,setDocs]=useState<GaFramework[]>([]);const [busy,setBusy]=useState('')
 const load=async()=>{setBusy('list');try{const x=await listGeorgiaFrameworks();setDocs(x);setCloudStatus(`Found ${x.length} Georgia CASE frameworks`)}catch(e){setCloudStatus(e instanceof Error?e.message:'Standards lookup failed')}finally{setBusy('')}}
 const sync=async(id:string)=>{setBusy(id);try{const r=await syncGeorgiaFramework(id);setCloudStatus(`Synced ${r.standards} standards from ${r.title}`);await refreshStandards()}catch(e){setCloudStatus(e instanceof Error?e.message:'Standards sync failed')}finally{setBusy('')}}
 return <Section title="Admin • Georgia Standards Sync" description="Read Georgia's machine-readable SuitCASE/CASE frameworks from the official state standards service and cache current standards in Supabase."><div className="standards-sync-head"><div><b>Official CASE source</b><span>case.georgiastandards.org • source/version retained with each standard</span></div><button className="secondary" onClick={load} disabled={!!busy}>{busy==='list'?'Loading…':'Find Georgia frameworks'}</button></div>{docs.length>0&&<div className="framework-list">{docs.map(d=><div className="framework-row" key={d.id}><div><b>{d.title}</b><span>{d.version&&`Version ${d.version}`}{d.statusStartDate&&` • starts ${d.statusStartDate}`}{d.lastChangeDateTime&&` • updated ${new Date(d.lastChangeDateTime).toLocaleDateString()}`}</span></div><button className="secondary" disabled={!!busy} onClick={()=>sync(d.id)}>{busy===d.id?'Syncing…':'Sync'}</button></div>)}</div>}<div className="info-box">For commercial deployment, verify the applicable GaDOE/CASE license terms for each framework before redistributing standards text. This project package does not bundle a copied full standards dataset.</div></Section>
}

function CloudAccount({identity,cloudStatus,setCloudStatus}:{identity:CloudIdentity|null;cloudStatus:string;setCloudStatus:(s:string)=>void}){
 const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [name,setName]=useState('');const [mode,setMode]=useState<'signin'|'signup'>('signin');const [busy,setBusy]=useState(false)
 const submit=async()=>{setBusy(true);try{if(mode==='signin')await signIn(email,password);else await signUp(email,password,name);setCloudStatus(mode==='signin'?'Signed in. Loading cloud data…':'Account created. Check your email if confirmation is required.')}catch(e){setCloudStatus(e instanceof Error?e.message:'Account error')}finally{setBusy(false)}}
 return <Section title="Account & Cloud Sync" description="Accounts are optional for local use; sign in to carry plans, progression, profiles, and preferences between devices.">
  {!cloudConfigured?<div className="info-box">Supabase is not configured yet. Copy <b>.env.example</b> to <b>.env</b> and add your project URL and anon key. The planner continues working locally until then.</div>:identity?<div className="account-card"><div><b>{identity.user.email}</b><span>{identity.role==='admin'?'Administrator':'Teacher'} • AI {identity.aiEnabled?'enabled':'disabled'} • {cloudStatus}</span></div><button className="secondary" onClick={()=>signOut()} disabled={busy}>Sign out</button></div>:<><div className="auth-tabs"><button className={mode==='signin'?'selected':''} onClick={()=>setMode('signin')}>Sign in</button><button className={mode==='signup'?'selected':''} onClick={()=>setMode('signup')}>Create account</button></div><div className="form-grid auth-grid">{mode==='signup'&&<Field label="Name"><input value={name} onChange={e=>setName(e.target.value)}/></Field>}<Field label="Email"><input type="email" value={email} onChange={e=>setEmail(e.target.value)}/></Field><Field label="Password"><input type="password" value={password} onChange={e=>setPassword(e.target.value)}/></Field></div><button className="primary" onClick={submit} disabled={busy||!email||password.length<6}>{busy?'Working…':mode==='signin'?'Sign in':'Create account'}</button><p className="subtle">{cloudStatus}</p></>}
 </Section>
}

function PrintPreview({state,days,selectedStandard}:{state:PlannerState;days:string[];selectedStandard?:Standard}){return <div className="print-preview"><PrintPlan state={state} days={days} selectedStandard={selectedStandard} embedded/></div>}
function PrintPlan({state,days,selectedStandard,embedded=false}:{state:PlannerState;days:string[];selectedStandard?:Standard;embedded?:boolean}){
 const labels=(ids:string[],items:BankItem[])=>ids.map(id=>labelFor(id,items)).join(', ');const klass=`print-plan template-${state.print.template} ${embedded?'embedded':'print-only'} orientation-${state.print.orientation}`
 return <div className={klass}><h1>Weekly Lesson Plan</h1><div className="print-meta"><b>{state.teacher||'Teacher'}</b><span>{state.school}</span><span>{state.className}</span><span>Week of {state.weekOf}</span><span>Grade {state.grade} • {state.subject}</span></div><div className="print-block"><b>{selectedStandard?.code}</b>{state.print.showFullStandard&&<p>{selectedStandard?.description}</p>}<p><strong>Topic:</strong> {state.topic}</p><p><strong>Essential Question:</strong> {state.essentialQuestion}</p><p><strong>Vocabulary:</strong> {state.vocabulary.join(', ')}</p></div><div className="print-grid">{days.map(day=>{const p=state.days[day];return <div className="print-day" key={day}><h2>{day}</h2><p><b>Targets:</b> {p.targetIds.map(id=>state.targets[Number(id)]).filter(Boolean).join('; ')}</p><p><b>{state.print.template==='family'?'Start / Focus':'Opening'}:</b> {labels(p.openingIds||[],openings)}</p>{state.print.template!=='family'&&<p><b>Strategies:</b> {labels(p.strategyIds,strategies)}</p>}<p><b>{state.print.template==='family'?'How we’ll check learning':'Assessment'}:</b> {labels(p.assessmentIds,assessments)}</p>{state.print.template!=='family'&&<p><b>Closure:</b> {labels(p.closureIds,closures)}</p>}{state.print.showAccommodations==='daily'&&state.print.template!=='family'&&<p><b>Accommodations:</b> {labels(state.accommodationIds,accommodations)}</p>}{state.print.includeTeacherNotes&&p.notes&&state.print.template!=='family'&&<p><b>{state.print.template==='substitute'?'Directions / Notes':'Notes'}:</b> {p.notes}</p>}</div>})}</div>{state.print.showAccommodations==='weekly'&&state.print.template!=='family'&&<div className="print-block"><p><b>Accommodations:</b> {labels(state.accommodationIds,accommodations)}</p><p><b>Differentiation:</b> {labels(state.differentiationIds,differentiation)}</p></div>}</div>
}

function Page({title,subtitle,children}:{title:string;subtitle:string;children:React.ReactNode}){return <div className="page"><header className="page-header"><div><h1>{title}</h1><p>{subtitle}</p></div></header>{children}</div>}
function Section({title,description,children}:{title:string;description?:string;children:React.ReactNode}){return <section className="section"><div className="section-title"><h2>{title}</h2>{description&&<p>{description}</p>}</div>{children}</section>}
function Card({title,icon,children}:{title:string;icon:React.ReactNode;children:React.ReactNode}){return <div className="card"><div className="card-title">{icon}<h3>{title}</h3></div>{children}</div>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="field"><span>{label}</span>{children}</label>}
function Stat({label,value,icon}:{label:string;value:string;icon:React.ReactNode}){return <div className="stat"><div className="stat-icon">{React.cloneElement(icon as React.ReactElement<{size?:number}>,{size:20})}</div><div><span>{label}</span><strong>{value}</strong></div></div>}
function Toggle({label,checked,onChange}:{label:string;checked:boolean;onChange:(v:boolean)=>void}){return <label className="toggle-row"><span>{label}</span><button type="button" className={'toggle '+(checked?'on':'')} onClick={()=>onChange(!checked)}><i/></button></label>}
function ChipList({items,onRemove}:{items:string[];onRemove:(x:string)=>void}){return <div className="chips">{items.map(x=><span className="chip" key={x}>{x}<button onClick={()=>onRemove(x)}>×</button></span>)}</div>}
function Bank({items,selected,onToggle}:{items:BankItem[];selected:string[];onToggle:(id:string)=>void}){const groups=grouped(items);return <div className="bank">{Object.entries(groups).map(([cat,arr])=><div key={cat}><h4>{cat}</h4>{arr.map(i=><button type="button" key={i.id} className={'check-item '+(selected.includes(i.id)?'selected':'')} onClick={()=>onToggle(i.id)}><span className="box">{selected.includes(i.id)&&<Check size={14}/>}</span>{i.label}</button>)}</div>)}</div>}
function BankMini({title,items,selected,onToggle}:{title:string;items:BankItem[];selected:string[];onToggle:(id:string)=>void}){return <div className="bank-mini"><b>{title}</b><div className="mini-options">{items.length?items.map(i=><button type="button" key={i.id} className={selected.includes(i.id)?'selected':''} onClick={()=>onToggle(i.id)}>{selected.includes(i.id)&&<Check size={12}/>} {i.label}</button>):<small>Add options above first.</small>}</div></div>}
function QuickAdd({placeholder,onAdd}:{placeholder:string;onAdd:(v:string)=>void}){const [v,setV]=useState('');return <div className="inline-add"><input value={v} placeholder={placeholder} onChange={e=>setV(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&v.trim()){onAdd(v.trim());setV('')}}}/><button className="secondary" onClick={()=>{if(v.trim()){onAdd(v.trim());setV('')}}}><Plus size={15}/></button></div>}
function Empty({text}:{text:string}){return <div className="empty"><FolderOpen size={26}/><span>{text}</span></div>}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>)
