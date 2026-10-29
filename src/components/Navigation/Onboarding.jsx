import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { flushWorkspace } from '../../data/workspaceSync';

export function Onboarding({ user, onNavigate }) {
  const prefix = `studyduel_user_${user?.id}_`;
  const dialogRef = useRef(null);
  const [open, setOpen] = useState(() => {
    if (!user?.id) return false;
    try {
      return !JSON.parse(localStorage.getItem(`${prefix}onboarding_done`) || 'false')
        && !JSON.parse(localStorage.getItem(`${prefix}projects`) || '[]').length;
    } catch { return false; }
  });
  const [step, setStep] = useState(1);
  const [purpose, setPurpose] = useState('study');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [hours, setHours] = useState('5');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.id) { setOpen(false); return; }
    try {
      const complete = JSON.parse(localStorage.getItem(`${prefix}onboarding_done`) || 'false');
      const projects = JSON.parse(localStorage.getItem(`${prefix}projects`) || '[]');
      setOpen(!complete && !projects.length);
    } catch { setOpen(false); }
  }, [prefix, user?.id]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  if (!open) return null;

  const finish = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const project = {
        id: crypto.randomUUID(),
        name: name.trim(),
        color: '#777dd0',
        subjects: [{ id: crypto.randomUUID(), name: subject.trim() || 'General', color: '#777dd0', goals: { weekly: Number(hours) }, studyDays: [1, 2, 3, 4, 5] }],
      };
      let existing = [];
      try { existing = JSON.parse(localStorage.getItem(`${prefix}projects`) || '[]'); } catch {}
      if (!existing.length) localStorage.setItem(`${prefix}projects`, JSON.stringify([project]));
      localStorage.setItem(`${prefix}onboarding_done`, 'true');
      await flushWorkspace();
      window.dispatchEvent(new Event('storage'));
      setOpen(false);
      onNavigate('timer');
    } catch (exception) {
      setError(exception.message);
    } finally {
      setBusy(false);
    }
  };

  const keepFocusInside = (event) => {
    if (event.key !== 'Tab') return;
    const controls = Array.from(dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled)'));
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return createPortal(
    <div className="workspace-onboarding-backdrop">
      <section ref={dialogRef} className="workspace-onboarding" role="dialog" aria-modal="true" aria-labelledby="welcome-title" tabIndex={-1} onKeyDown={keepFocusInside}>
        <p className="workspace-onboarding-step">WELCOME TO PLOTHOUR <span /> {step} OF 2</p>
        <h2 id="welcome-title">{step === 1 ? 'Make a little room for focused work.' : 'Set up your first project.'}</h2>
        {step === 1 ? <>
          <p>Choose a starting point. Your workspace stays flexible as your goals change.</p>
          <div className="onboarding-options" role="group" aria-label="What are you working on?">
            {[['study', 'Study & learning'], ['business', 'Business & projects'], ['personal', 'Personal goals']].map(([id, label]) => <button type="button" key={id} aria-pressed={purpose === id} onClick={() => setPurpose(id)}>{label}</button>)}
          </div>
          <button type="button" className="workspace-onboarding-primary" onClick={() => { setName(purpose === 'study' ? 'My studies' : purpose === 'business' ? 'My business' : 'Personal project'); setStep(2); }}>Continue</button>
        </> : <form onSubmit={finish}>
          <label>Project name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} required maxLength={240} /></label>
          <label>First subproject<input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder={purpose === 'study' ? 'e.g. Mathematics' : 'e.g. Product launch'} maxLength={240} /></label>
          <label>Weekly focus target (hours)<input type="number" min="0.5" max="80" step="0.5" required value={hours} onChange={(event) => setHours(event.target.value)} /></label>
          <p>Start with a target that fits your week. You can change it in Workspace.</p>
          <div className="workspace-onboarding-actions"><button type="button" onClick={() => setStep(1)}>Back</button><button type="submit" className="workspace-onboarding-primary" disabled={busy}>{busy ? 'Saving…' : 'Create project & open timer'}</button></div>
        </form>}
        {error && <p role="alert" className="workspace-onboarding-error">{error}</p>}
      </section>
    </div>,
    document.body,
  );
}
