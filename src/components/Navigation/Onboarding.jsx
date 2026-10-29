import React, { useState } from 'react';
import { flushWorkspace } from '../../data/workspaceSync';
export function Onboarding({user,onNavigate}) {
  const prefix=`studyduel_user_${user?.id}_`;
  const [open,setOpen]=useState(()=>{if(!user?.id)return false;try{return !JSON.parse(localStorage.getItem(`${prefix}onboarding_done`)||'false')&&!JSON.parse(localStorage.getItem(`${prefix}projects`)||'[]').length;}catch{return false;}});
  const [step,setStep]=useState(1),[purpose,setPurpose]=useState('study'),[name,setName]=useState(''),[subject,setSubject]=useState(''),[hours,setHours]=useState('5'),[busy,setBusy]=useState(false),[error,setError]=useState('');
  if(!open)return null;
  const finish=async event=>{event.preventDefault();setBusy(true);setError('');try{
    const project={id:crypto.randomUUID(),name:name.trim(),color:'#777dd0',subjects:[{id:crypto.randomUUID(),name:subject.trim() || 'General',color:'#777dd0',goals:{weekly:Number(hours)},studyDays:[1,2,3,4,5]}]};
    let existing=[];try{existing=JSON.parse(localStorage.getItem(`${prefix}projects`)||'[]');}catch{}
    if(!existing.length)localStorage.setItem(`${prefix}projects`,JSON.stringify([project]));
    localStorage.setItem(`${prefix}onboarding_done`,'true');await flushWorkspace();window.dispatchEvent(new Event('storage'));setOpen(false);onNavigate('timer');
  }catch(e){setError(e.message);}finally{setBusy(false);}};
  return <section className="workspace-onboarding" aria-labelledby="welcome-title"><p>WELCOME TO PLOTHOUR · {step} OF 2</p><h2 id="welcome-title">{step===1?'Make a little room for focused work.':'Set up your first project.'}</h2>{step===1?<><p>Choose a starting point. Your workspace stays flexible as your goals change.</p><div className="onboarding-options">{[['study','Study & learning'],['business','Business & projects'],['personal','Personal goals']].map(([id,label])=><button type="button" key={id} aria-pressed={purpose===id} onClick={()=>setPurpose(id)}>{label}</button>)}</div><button type="button" onClick={()=>{setName(purpose==='study'?'My studies':purpose==='business'?'My business':'Personal project');setStep(2);}}>Continue</button></>:<form onSubmit={finish}><label>Project name<input autoFocus value={name} onChange={e=>setName(e.target.value)} required maxLength={240}/></label><label>First subproject<input value={subject} onChange={e=>setSubject(e.target.value)} placeholder={purpose==='study'?'e.g. Mathematics':'e.g. Product launch'} maxLength={240}/></label><label>Weekly focus target (hours)<input type="number" min="0.5" max="80" step="0.5" required value={hours} onChange={e=>setHours(e.target.value)}/></label><p>Start with a target that fits your week. You can change it in Workspace.</p><button type="button" onClick={()=>setStep(1)}>Back</button><button type="submit" disabled={busy}>{busy?'Saving…':'Create project & open timer'}</button></form>}{error&&<p role="alert">{error}</p>}</section>;
}
