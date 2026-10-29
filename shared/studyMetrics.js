// A single contract for saved sessions: sessions belong to the local day on
// which they started. Durations are stored focus time, excluding pauses.
export function studyDateKey(value, timeZone) {
  const date=new Date(value);
  if(!Number.isFinite(date.getTime())) return null;
  if(!timeZone) return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function goalSecondsForRange(projects,range,days=1) {
  if(range==='all') return 0;
  return (projects || []).filter(p=>!p.archived).reduce((sum,p)=>sum+(p.subjects || []).filter(s=>!s.archived).reduce((part,s)=>{
    const hours=range==='week' ? subjectGoalHours(s,'weekly') : range==='month' ? subjectGoalHours(s,'monthly') : subjectGoalHours(s,'daily')*(range==='today' ? 1 : days);
    return part+Math.max(0,hours)*3600;
  },0),0);
}
export function summarizeSessions(entries,timeZone) {
  const valid=(entries || []).filter(e=>Number.isFinite(new Date(e.startedAt).getTime()) && Number(e.durationSeconds)>0);
  const days=new Map();
  for(const e of valid) {
    const key=studyDateKey(e.startedAt,timeZone);const row=days.get(key) || {date:key,seconds:0,sessions:0};
    row.seconds+=Number(e.durationSeconds);row.sessions++;days.set(key,row);
  }
  const daily=[...days.values()].sort((a,b)=>a.date.localeCompare(b.date));
  const seconds=valid.reduce((sum,e)=>sum+Number(e.durationSeconds),0);
  let longestStreak=0,run=0,last=null;
  for(const day of daily) { const serial=Date.parse(`${day.date}T00:00:00Z`)/86400000;run=last===serial-1 ? run+1 : 1;longestStreak=Math.max(longestStreak,run);last=serial; }
  const values=daily.map(d=>d.seconds).sort((a,b)=>a-b);
  const median=values.length ? values.length%2 ? values[Math.floor(values.length/2)] : (values[values.length/2-1]+values[values.length/2])/2 : 0;
  return {seconds,sessions:valid.length,activeDays:daily.length,daily,averageSessionSeconds:valid.length ? seconds/valid.length : 0,averageActiveDaySeconds:daily.length ? seconds/daily.length : 0,longestStreak,streakAtLastDay:run,medianActiveDaySeconds:median,longestSessionSeconds:Math.max(0,...valid.map(e=>Number(e.durationSeconds)))};
}
export function summarizeProfile({id,name,entries=[],projects=[],timeZone,start,end,previousStart,previousEnd,range,calendarDays=1,recentStart,recentEnd}) {
  const select=(a,b)=>entries.filter(e=>new Date(e.startedAt).getTime()>=Number(a) && new Date(e.startedAt).getTime()<=Number(b));
  const period=select(start,end);const stats=summarizeSessions(period,timeZone);
  const goalSeconds=goalSecondsForRange(projects,range,calendarDays);
  const dailyGoal=goalSecondsForRange(projects,'today');
  let weekdaySeconds=0;const hours=new Map(),areas=new Map();
  for(const entry of period) {
    const seconds=Number(entry.durationSeconds)||0;
    const key=studyDateKey(entry.startedAt,timeZone);
    if(![0,6].includes(new Date(`${key}T00:00:00Z`).getUTCDay())) weekdaySeconds+=seconds;
    const hour=timeZone ? Number(new Intl.DateTimeFormat('en-US',{timeZone,hour:'numeric',hourCycle:'h23'}).format(new Date(entry.startedAt))) : new Date(entry.startedAt).getHours();
    hours.set(hour,(hours.get(hour)||0)+seconds);
    const label=entry.subjectName || entry.projectName || 'Shared project';areas.set(label,(areas.get(label)||0)+seconds);
  }
  const longest=[...period].sort((a,b)=>b.durationSeconds-a.durationSeconds)[0];
  return {id,name,current:{...stats,averageSessionSeconds:Math.round(stats.averageSessionSeconds),averageActiveDaySeconds:Math.round(stats.averageActiveDaySeconds),sessionsPerCalendarDay:stats.sessions/Math.max(1,calendarDays),longSessionShare:stats.sessions ? period.filter(e=>e.durationSeconds>=2700).length/stats.sessions : 0,shortSessions:period.filter(e=>e.durationSeconds<900).length,thirtyMinuteDays:stats.daily.filter(d=>d.seconds>=1800).length,goalDays:dailyGoal ? stats.daily.filter(d=>d.seconds>=dailyGoal).length : 0,goalSeconds,goalProgressPct:goalSeconds ? Math.round(stats.seconds/goalSeconds*100) : null,weekdaySeconds,weekendSeconds:stats.seconds-weekdaySeconds,streakAtEnd:stats.daily.at(-1)?.date===studyDateKey(Number(end),timeZone) ? stats.streakAtLastDay : 0,bestDay:[...stats.daily].sort((a,b)=>b.seconds-a.seconds)[0] || null,longestSession:longest ? {seconds:longest.durationSeconds,date:studyDateKey(longest.startedAt,timeZone)} : null,peakHour:[...hours].sort((a,b)=>b[1]-a[1])[0]?.[0] ?? null,projectBreakdown:[...areas].map(([name,seconds])=>({name,seconds})).sort((a,b)=>b.seconds-a.seconds)},previous:{seconds:summarizeSessions(select(previousStart,previousEnd),timeZone).seconds},daily:stats.daily,recentDaily:summarizeSessions(select(recentStart ?? start,recentEnd ?? end),timeZone).daily};
}

export const WEEKS_PER_MONTH = 365.25 / 7 / 12;
export const MAX_MONTHLY_GOAL_HOURS = Math.floor(168 * WEEKS_PER_MONTH * 100) / 100;
export function deriveStudyGoals(basis,rawValue,studyDays) {
  const days=studyDays?.length || 7;
  const max=basis==='daily'?24:basis==='weekly'?168:MAX_MONTHLY_GOAL_HOURS;
  const source=rawValue===''?0:Math.max(0,Math.min(max,Number(rawValue)||0));
  const weekly=basis==='daily'?source*days:basis==='weekly'?source:source/WEEKS_PER_MONTH;
  const round=value=>Math.round(value*100)/100;
  return {daily:basis==='daily'&&rawValue===''?'':round(weekly/days),weekly:basis==='weekly'&&rawValue===''?'':round(weekly),monthly:basis==='monthly'&&rawValue===''?'':round(weekly*WEEKS_PER_MONTH),basis};
}
export function subjectGoalHours(subject = {},cadence) {
  const goals=subject.goals || {};
  const days=subject.studyDays?.length || 7;
  if(Number(goals[cadence])>0) return Number(goals[cadence]);
  const weekly=Number(goals.weekly)>0?Number(goals.weekly):Number(goals.daily)>0?Number(goals.daily)*days:Math.max(0,Number(goals.monthly)||0)/WEEKS_PER_MONTH;
  return cadence==='daily'?weekly/days:cadence==='monthly'?weekly*WEEKS_PER_MONTH:weekly;
}
