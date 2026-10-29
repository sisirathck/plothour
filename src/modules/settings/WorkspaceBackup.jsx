import React, { useRef, useState } from 'react';
import { Archive, Download, FileCheck2, LockKeyhole, RotateCcw, Upload } from 'lucide-react';
import { flushWorkspace } from '../../data/workspaceSync';

export function WorkspaceBackup({ user }) {
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const download = async () => {
    setBusy(true);
    setMessage('');
    try {
      let server = { format: 'plothour-workspace', version: 1, accountId: user.id, items: {}, tasks: [] };
      try {
        const response = await fetch('/api/backup', { credentials: 'same-origin' });
        if (!response.ok) throw new Error();
        server = await response.json();
      } catch {
        setMessage('Offline backup created. Server-only tasks may not be included.');
      }
      const prefix = `studyduel_user_${user.id}_`;
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(prefix) && !key.endsWith('_active_timer')) server.items[key] = localStorage.getItem(key);
      }
      server.conflictArchive = JSON.parse(localStorage.getItem(`plothour_conflicts_${user.id}`) || '[]');
      const url = URL.createObjectURL(new Blob([JSON.stringify({ ...server, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `plothour-workspace-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setMessage('Could not create backup. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const inspect = async (event) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > 8000000) throw new Error('Choose a backup smaller than 8 MB.');
      const data = JSON.parse(await file.text());
      if (data.format !== 'plothour-workspace' || data.version !== 1 || data.accountId !== user.id) {
        throw new Error('Choose a PlotHour workspace backup from this account.');
      }
      setPreview({ ...data, fileName: file.name });
      setMessage('');
    } catch (error) {
      setMessage(error.message);
      setPreview(null);
    } finally {
      event.target.value = '';
    }
  };

  const restore = async () => {
    setBusy(true);
    setMessage('');
    try {
      await flushWorkspace();
      const { fileName, ...backup } = preview;
      const response = await fetch('/api/backup/restore', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backup),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not restore this backup.');
      window.location.reload();
    } catch (error) {
      setMessage(error.message);
      setBusy(false);
    }
  };

  const cancelPreview = () => { setPreview(null); setMessage(''); };

  return (
    <section className="settings-bento-card workspace-backup-card" aria-labelledby="workspace-backup-title">
      <header className="workspace-backup-header">
        <span className="workspace-backup-icon"><Archive size={18} /></span>
        <div>
          <h2 id="workspace-backup-title">Workspace backup &amp; recovery</h2>
          <p>Take a copy of your workspace or restore one you saved earlier.</p>
        </div>
      </header>

      {!user?.id ? <div className="workspace-backup-state">Sign in to back up your account workspace. Demo session export remains available above.</div> : <>
        <div className="workspace-backup-actions">
          <article className="workspace-backup-action">
            <span className="workspace-backup-action-icon"><Download size={17} /></span>
            <div className="workspace-backup-action-copy">
              <h3>Download a backup</h3>
              <p>Save projects, goals, sessions, tasks, and workspace preferences as a file.</p>
            </div>
            <button type="button" className="settings-secondary-btn" disabled={busy} onClick={download}>
              <Download size={15} /> {busy ? 'Working…' : 'Download backup'}
            </button>
          </article>

          <article className="workspace-backup-action">
            <span className="workspace-backup-action-icon"><Upload size={17} /></span>
            <div className="workspace-backup-action-copy">
              <h3>Restore from a backup</h3>
              <p>Review a backup file first. Restoring merges missing records and keeps your existing edits.</p>
            </div>
            <input ref={fileRef} className="workspace-backup-file-input" type="file" accept=".json,application/json" onChange={inspect} disabled={busy} />
            <button type="button" className="settings-secondary-btn" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Upload size={15} /> Choose backup file
            </button>
          </article>
        </div>

        {preview && <section className="workspace-backup-preview" aria-live="polite">
          <div className="workspace-backup-preview-icon"><FileCheck2 size={18} /></div>
          <div className="workspace-backup-preview-copy">
            <strong>Backup ready to review</strong>
            <span>{preview.fileName} · Created {preview.exportedAt ? new Date(preview.exportedAt).toLocaleString() : 'date unavailable'} · {preview.tasks?.length || 0} task records</span>
            <small>Your current edits stay in place. Only records missing from this account are added.</small>
          </div>
          <div className="workspace-backup-preview-actions">
            <button type="button" className="settings-secondary-btn" disabled={busy} onClick={cancelPreview}>Cancel</button>
            <button type="button" className="settings-primary-btn" disabled={busy} onClick={restore}><RotateCcw size={15} /> {busy ? 'Restoring…' : 'Merge backup'}</button>
          </div>
        </section>}
      </>}

      {message && <p className="workspace-backup-message" role="status">{message}</p>}
      <p className="workspace-backup-footnote"><LockKeyhole size={14} /> Restoring doesn’t start timers or change email and comparison sharing settings.</p>
    </section>
  );
}
