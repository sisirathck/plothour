import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Eye, LockKeyhole, Users } from 'lucide-react';

export function ComparisonSharing({ user }) {
  const [data, setData] = useState(null);
  const [partner, setPartner] = useState('');
  const [ids, setIds] = useState([]);
  const [names, setNames] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);
  const pickerButtonRef = useRef(null);

  useEffect(() => {
    if (!user?.id) return undefined;
    let alive = true;
    fetch('/api/connections/sharing', { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load sharing settings.');
        return response.json();
      })
      .then((result) => { if (alive) setData(result); })
      .catch((error) => { if (alive) setMessage(error.message); });
    return () => { alive = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!pickerOpen) return undefined;
    const closeOutside = (event) => {
      if (!pickerRef.current?.contains(event.target)) setPickerOpen(false);
    };
    const closeEscape = (event) => {
      if (event.key === 'Escape') {
        setPickerOpen(false);
        pickerButtonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeEscape);
    };
  }, [pickerOpen]);

  const selectPartner = (id) => {
    setPartner(id);
    const saved = data.permissions.find((permission) => permission.partner_id === id);
    setIds(saved?.project_ids || []);
    setNames(saved?.share_project_names || false);
    setMessage('');
  };

  const save = async () => {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/connections/sharing/${partner}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectIds: ids, shareProjectNames: names }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Could not save sharing preferences.');
      }
      setData((current) => ({
        ...current,
        permissions: [...current.permissions.filter((permission) => permission.partner_id !== partner), {
          partner_id: partner,
          project_ids: ids,
          share_project_names: names,
        }],
      }));
      setMessage('Your sharing preferences are saved.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleProject = (id) => setIds((current) => current.includes(id)
    ? current.filter((projectId) => projectId !== id)
    : [...current, id]);

  return (
    <section className="settings-bento-card comparison-sharing-card" aria-labelledby="comparison-sharing-title">
      <header className="comparison-sharing-header">
        <span className="comparison-sharing-icon"><LockKeyhole size={18} /></span>
        <div>
          <h2 id="comparison-sharing-title">Comparison privacy</h2>
          <p>Choose what each connection can see in Compare.</p>
        </div>
        <span className="comparison-sharing-private"><LockKeyhole size={13} /> Private by default</span>
      </header>

      {!user?.id ? <div className="comparison-sharing-state">Sign in to manage what you share with connections.</div>
        : !data ? <div className="comparison-sharing-state" role="status">{message || 'Loading sharing settings…'}</div>
          : !data.partners.length ? <div className="comparison-sharing-state comparison-sharing-empty"><Users size={20} /><div><strong>No connections yet</strong><span>Add a study partner below. You can choose their access here afterward.</span></div></div>
            : <div className="comparison-sharing-body">
              <div className="comparison-sharing-field" ref={pickerRef}>
                <span>Connection</span>
                <button ref={pickerButtonRef} id="comparison-sharing-person" type="button" className={`comparison-sharing-picker-trigger${pickerOpen ? ' is-open' : ''}`} aria-haspopup="listbox" aria-expanded={pickerOpen} aria-controls="comparison-sharing-people" onClick={() => setPickerOpen((open) => !open)} onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setPickerOpen(true);
                    requestAnimationFrame(() => pickerRef.current?.querySelector('[role="option"]')?.focus());
                  }
                }}>
                  <span>{data.partners.find((person) => person.id === partner)?.name || 'Choose a connection'}</span>
                  <ChevronDown size={16} aria-hidden="true" />
                </button>
                {pickerOpen && <div className="comparison-sharing-picker-menu" id="comparison-sharing-people" role="listbox" aria-label="Choose a connection">
                  {data.partners.map((person) => <button key={person.id} type="button" role="option" aria-selected={partner === person.id} onClick={() => { selectPartner(person.id); setPickerOpen(false); pickerButtonRef.current?.focus(); }} onKeyDown={(event) => {
                    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
                    event.preventDefault();
                    const options = Array.from(event.currentTarget.parentElement.querySelectorAll('[role="option"]'));
                    const index = options.indexOf(event.currentTarget);
                    const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
                    options[next]?.focus();
                  }}><span>{person.name}</span>{partner === person.id && <Check size={15} aria-hidden="true" />}</button>)}
                </div>}
              </div>

              {partner && <>
                <div className="comparison-sharing-section-heading">
                  <div><strong>Projects to share</strong><span>Only totals, activity patterns, and goals from these projects are visible.</span></div>
                  <span>{ids.length} selected</span>
                </div>
                {data.projects.length ? <div className="sharing-project-list">
                  {data.projects.map((project) => {
                    const selected = ids.includes(project.id);
                    return <label className={`sharing-project-option${selected ? ' is-selected' : ''}`} key={project.id}>
                      <input type="checkbox" checked={selected} onChange={() => toggleProject(project.id)} />
                      <span className="sharing-project-check" aria-hidden="true">{selected && <Check size={13} />}</span>
                      <span>{project.name}</span>
                    </label>;
                  })}
                </div> : <p className="comparison-sharing-no-projects">Create a project before sharing study activity.</p>}

                <label className="comparison-sharing-names">
                  <input type="checkbox" checked={names} onChange={(event) => setNames(event.target.checked)} />
                  <span><strong>Share project and subproject names</strong><small>When off, shared activity is labeled “Shared project.”</small></span>
                </label>

                <footer className="comparison-sharing-footer">
                  <span><Eye size={15} /> {ids.length ? `${ids.length} project${ids.length === 1 ? '' : 's'} shared with ${data.partners.find((person) => person.id === partner)?.name}` : 'No project activity will be shared'}</span>
                  <button type="button" className="settings-primary-btn" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save sharing'}</button>
                </footer>
              </>}
            </div>}

      {message && data && <p className={`comparison-sharing-message${message.includes('saved') ? ' is-success' : ''}`} role="status">{message}</p>}
      <p className="comparison-sharing-footnote"><LockKeyhole size={14} /> Session notes and task details are never shared. You can change access at any time.</p>
    </section>
  );
}
