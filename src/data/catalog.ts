export type Standard = {
  id: string
  grade: string
  subject: string
  course: string
  unit: string
  code: string
  description: string
  topics: string[]
  demo?: boolean
  source?: string
  sourceUrl?: string
  version?: string
  effectiveYear?: string
  isCurrent?: boolean
}

export type BankItem = { id: string; label: string; category?: string }

// Demo records prove the workflow only. Replace/import these with the official current GaDOE standards dataset.
export const standards: Standard[] = [
  {
    id: 'demo-5-sci-earth', grade: '5', subject: 'Science', course: 'Grade 5 Science', unit: 'Earth Systems',
    code: 'DEMO-S5-EARTH', description: 'Investigate processes that shape Earth’s surface and use evidence to explain change over time.',
    topics: ['Weathering', 'Erosion', 'Deposition', 'Constructive & destructive processes'], demo: true, source:'Demo only', version:'demo', isCurrent:false
  },
  {
    id: 'demo-7-math-prop', grade: '7', subject: 'Mathematics', course: 'Grade 7 Mathematics', unit: 'Proportional Reasoning',
    code: 'DEMO-M7-PROP', description: 'Use proportional relationships to solve multistep real-world and mathematical problems.',
    topics: ['Unit rates', 'Proportions', 'Percent', 'Scale drawings'], demo: true, source:'Demo only', version:'demo', isCurrent:false
  },
  {
    id: 'demo-8-ss-ga', grade: '8', subject: 'Social Studies', course: 'Georgia Studies', unit: 'Revolution & Early Georgia',
    code: 'DEMO-SS8-REV', description: 'Analyze causes, perspectives, and effects connected to the American Revolution and Georgia.',
    topics: ['Causes of the Revolution', 'Georgia and the Revolution', 'Perspectives', 'Primary sources'], demo: true, source:'Demo only', version:'demo', isCurrent:false
  },
  {
    id: 'demo-6-ela-info', grade: '6', subject: 'ELA', course: 'Grade 6 ELA', unit: 'Informational Text',
    code: 'DEMO-ELA6-INFO', description: 'Analyze informational texts and support explanations with relevant textual evidence.',
    topics: ['Central idea', 'Text evidence', 'Author’s purpose', 'Text structure'], demo: true, source:'Demo only', version:'demo', isCurrent:false
  }
]

export const accommodations: BankItem[] = [
  ['ext-time','Extended time','IEP / 504'], ['small-group','Small-group setting','IEP / 504'], ['pref-seat','Preferential seating','IEP / 504'],
  ['chunk','Chunk directions/tasks','IEP / 504'], ['repeat','Repeat/rephrase directions','IEP / 504'], ['guided-notes','Guided notes','Academic Support'],
  ['checks','Frequent checks for understanding','Academic Support'], ['graphic','Graphic organizer','Academic Support'], ['models','Models/worked examples','Academic Support'],
  ['visuals','Visual supports','English Learners'], ['sentence','Sentence frames','English Learners'], ['vocab-preview','Preteach vocabulary','English Learners'],
  ['choice','Choice of response/product','Behavior / Engagement'], ['breaks','Planned movement breaks','Behavior / Engagement'], ['feedback','Frequent feedback','Behavior / Engagement'],
  ['at','Assistive technology as documented','Accessibility']
].map(([id,label,category]) => ({id,label,category}))

export const differentiation: BankItem[] = [
  ['reteach','Teacher-led reteaching','Support'], ['scaffold','Scaffolded practice','Support'], ['prereq','Prerequisite skill review','Support'],
  ['reduced','Reduced item set with same target','Support'], ['onlevel','On-level collaborative practice','Core'], ['flex-group','Flexible grouping','Core'],
  ['extension','Extension task','Advanced'], ['complexity','Increase complexity/depth','Advanced'], ['inquiry','Independent inquiry','Advanced'],
  ['compact','Curriculum compacting','Advanced']
].map(([id,label,category]) => ({id,label,category}))


export const openings: BankItem[] = [
  ['bell','Bell ringer / warm-up','Opening'], ['retrieval-open','Retrieval practice','Opening'], ['quickwrite-open','Quick write','Opening'],
  ['anticipation','Anticipation guide','Opening'], ['error-analysis','Error analysis','Opening'], ['vocab-open','Vocabulary preview','Opening'],
  ['notice-wonder','Notice & Wonder','Opening'], ['prior-knowledge','Activate prior knowledge','Opening'], ['question-day','Question of the day','Opening']
].map(([id,label,category]) => ({id,label,category}))

export const strategies: BankItem[] = [
  ['model','Teacher modeling / think aloud','Instruction'], ['gradual','Gradual release: I Do / We Do / You Do','Instruction'], ['mini','Mini-lesson','Instruction'],
  ['stations','Station rotation','Practice'], ['pairs','Think-Pair-Share','Discussion'], ['collab','Collaborative problem solving','Practice'],
  ['inquiry','Inquiry / investigation','Practice'], ['cer','Claim-Evidence-Reasoning','Writing'], ['frayer','Frayer Model','Vocabulary'],
  ['retrieval','Retrieval practice','Review'], ['spiral','Spiral review','Review']
].map(([id,label,category]) => ({id,label,category}))

export const assessments: BankItem[] = [
  ['whiteboard','Individual whiteboards','Check for Understanding'], ['turntalk','Turn and talk','Check for Understanding'], ['quickwrite','Quick write','Check for Understanding'],
  ['observe','Teacher observation/checklist','Formative'], ['exit','Exit ticket','Formative'], ['quiz','Short quiz','Formative'],
  ['product','Performance/product rubric','Summative'], ['unit','Unit assessment','Summative'], ['conference','Student conference','Formative']
].map(([id,label,category]) => ({id,label,category}))

export const closures: BankItem[] = [
  ['321','3-2-1 reflection'], ['minute','One-minute response'], ['exit','Exit ticket'], ['confidence','Confidence scale'],
  ['summarize','Student summary'], ['misconception','Misconception check'], ['preview','Preview tomorrow / connect forward']
].map(([id,label]) => ({id,label}))

export const durations = ['30 minutes','45 minutes','50 minutes','55 minutes','60 minutes','75 minutes','90 minutes / block']
export const grades = ['K','1','2','3','4','5','6','7','8','9','10','11','12']
export const subjects = ['ELA','Mathematics','Science','Social Studies']
