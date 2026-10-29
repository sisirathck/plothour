import React, { useState } from 'react';
import { Play } from 'lucide-react';
import { fmtDur } from './TimerSupport';

export const FocusPlanner = ({ projects, entries, activeTimer, elapsed, now, weekStart = 'monday', onStart }) => {
  const [period, setPeriod] = useState('weekly');
  const start = new Date(now.getFullYear(), now.getMonth(), period === 'monthly' ? 1 : now.getDate());
  const weekIndex = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].indexOf(weekStart);
  if (period === 'weekly') start.setDate(start.getDate() - (start.getDay() - Math.max(0,weekIndex) + 7) % 7);
  const end = new Date(start);
  if (period === 'weekly') end.setDate(end.getDate()+7); else end.setMonth(end.getMonth()+1);
  const fraction = Math.min(1, Math.max(0, (now-start)/(end-start)));
  const daysLeft = Math.max(1, Math.ceil((end-now)/86400000));
  const elapsedDays = Math.max(0, (now-start)/86400000);
  const remainingDays = Math.max(1/86400, (end-now)/86400000);
  const pace = (seconds) => {
    const minutes = Math.round(seconds / 60);
    return minutes >= 60 ? `${Math.floor(minutes/60)}h${minutes%60 ? ` ${minutes%60}m` : ''}` : `${minutes}m`;
  };
  const rows = projects.flatMap(project => (project.subjects || []).flatMap(subject => {
    const target = Number(subject.goals?.[period]) * 3600;
    if (!(target > 0)) return [];
    const logged = entries.reduce((sum, entry) => {
      const time = new Date(entry.startedAt).getTime();
      const matches = (entry.projectId ? entry.projectId === project.id : entry.projectName === project.name)
        && (entry.subjectId ? entry.subjectId === subject.id : entry.subjectName === subject.name);
      return matches && time >= start.getTime() && time < end.getTime() && time <= now.getTime() ? sum + (Number(entry.durationSeconds) || 0) : sum;
    },0) + (activeTimer?.projectId === project.id && activeTimer?.subjectId === subject.id ? elapsed : 0);
    const remaining = Math.max(0,target-logged);
    return [{project,subject,target,logged,remaining,currentPace:elapsedDays > 0 ? logged/elapsedDays : 0,requiredPace:remaining/remainingDays,progress:Math.min(100,Math.round(logged/target*100)),deficit:target*fraction-logged}];
  })).sort((a,b) => Number(a.remaining === 0)-Number(b.remaining === 0) || b.deficit-a.deficit || b.remaining-a.remaining);
  const next = rows.find(row => row.remaining > 0);
  return <div className="focus-planner">
    <header className="focus-planner-toolbar"><div role="tablist" aria-label="Planning period">{[['weekly','This week'],['monthly','This month']].map(([id,label]) => <button key={id} role="tab" aria-selected={period===id} onClick={() => setPeriod(id)}>{label}</button>)}</div><span>{daysLeft} {daysLeft===1?'day':'days'} left</span></header>
    {next && <section className="focus-planner-next"><span>RECOMMENDED NEXT</span><div><strong>{next.subject.name}</strong><button className="timer-study-plan-start" onClick={() => onStart(next.project.id,next.subject.id)}><Play size={12} fill="currentColor" /> Start</button></div><p>{next.deficit > 0 ? `${fmtDur(next.deficit)} behind an even pace` : 'On pace · largest remaining priority'} · Current {pace(next.currentPace)}/day · Required {pace(next.requiredPace)}/day</p></section>}
    <div className="focus-planner-rows">{!rows.length && <p className="timer-study-plan-empty">Set {period} goals in Tasks → Projects to build your focus plan.</p>}{rows.map(row => <article key={`${row.project.id}-${row.subject.id}`} className={`focus-planner-row${!row.remaining?' is-completed':''}`}>
      <div><strong>{row.subject.name}</strong><small>{row.project.name} · {fmtDur(row.logged)} / {fmtDur(row.target)}</small></div><div className="focus-planner-pace" title="Current: logged hours per elapsed calendar day. Required: remaining hours per day until the period ends."><span>Current <b>{pace(row.currentPace)}/day</b></span><span>Required <b>{pace(row.requiredPace)}/day</b></span></div><span>{row.progress}%<small>{row.remaining ? `${fmtDur(row.remaining)} left` : 'Complete'}</small></span><button className="timer-study-plan-start" onClick={() => onStart(row.project.id,row.subject.id)} aria-label={`Start ${row.subject.name}`}><Play size={11} fill="currentColor" /> Start</button><div className="focus-planner-track"><i style={{width:`${row.progress}%`}} /></div>
    </article>)}</div>
  </div>;
};
