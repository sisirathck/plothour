import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, Check, ChevronLeft, ChevronRight, CirclePlus,
  LockKeyhole, Mail, Search, ShieldCheck, Trash2, Users, X,
} from 'lucide-react';
import './AdminPage.css';

const PAGE_SIZE = 50;

async function api(path, options = {}) {
  const response = await fetch(`/api/admin${path}`, {
    credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'The request could not be completed.');
  return payload;
}

const dateLabel = (value) => value
  ? new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value))
  : 'No sessions yet';

const durationLabel = (seconds) => {
  const minutes = Math.floor((Number(seconds) || 0) / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
};

export const AdminPage = ({ user }) => {
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [createForm, setCreateForm] = useState({ displayName: '', email: '' });

  const loadData = useCallback(async () => {
    if (!user?.is_admin) return;
    setBusy(true);
    setError('');
    try {
      const [dashboard, userList] = await Promise.all([
        api('/overview'),
        api(`/users?limit=${PAGE_SIZE}&offset=${offset}&search=${encodeURIComponent(search)}`),
      ]);
      setOverview(dashboard);
      setUsers(userList.users);
      setTotal(userList.total);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setBusy(false);
    }
  }, [offset, search, user?.is_admin]);

  useEffect(() => { loadData(); }, [loadData]);

  const setSignupState = async (enabled) => {
    setError('');
    try {
      const result = await api('/settings/signups', {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      });
      setOverview((current) => current ? { ...current, settings: result.settings } : current);
      setNotice(enabled ? 'New signups are open.' : 'New signups are paused.');
    } catch (requestError) { setError(requestError.message); }
  };

  const createUser = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const result = await api('/users', {
        method: 'POST',
        body: JSON.stringify(createForm),
      });
      setCreateOpen(false);
      setCreateForm({ displayName: '', email: '' });
      setNotice(result.setupEmailSent
        ? `Account created and setup email sent to ${result.user.email}.`
        : `Account created. Setup email could not be sent: ${result.setupEmailError || 'check email configuration'}`);
      setOffset(0);
      setSearch('');
      setSearchValue('');
      await loadData();
    } catch (requestError) { setError(requestError.message); }
  };

  const sendPasswordReset = async (target) => {
    setError('');
    try {
      const result = await api(`/users/${encodeURIComponent(target.id)}/send-password-reset`, { method: 'POST' });
      setNotice(result.message);
    } catch (requestError) { setError(requestError.message); }
  };

  const deleteUser = async (event) => {
    event.preventDefault();
    if (!deleteTarget) return;
    setError('');
    try {
      await api(`/users/${encodeURIComponent(deleteTarget.id)}`, {
        method: 'DELETE',
        body: JSON.stringify({ confirmEmail }),
      });
      setNotice(`Deleted ${deleteTarget.email} and their stored StudyDuel data.`);
      setDeleteTarget(null);
      setConfirmEmail('');
      if (users.length === 1 && offset > 0) setOffset(Math.max(0, offset - PAGE_SIZE));
      else await loadData();
    } catch (requestError) { setError(requestError.message); }
  };

  if (!user?.is_admin) {
    return <main className="admin-page"><section className="admin-access-card"><ShieldCheck size={28} /><h1>Admin access required</h1><p>Sign in with an administrator account to open this area.</p></section></main>;
  }

  const stats = overview?.stats;
  return (
    <main className="admin-page">
      <header className="admin-page-heading">
        <div>
          <span className="admin-eyebrow"><ShieldCheck size={14} /> ADMINISTRATION</span>
          <h1>Admin console</h1>
          <p>Manage accounts and essential service settings.</p>
        </div>
        <div className="admin-session-badge"><ShieldCheck size={15} /> Signed in as {user.email}</div>
      </header>

      {error && <div className="admin-alert is-error" role="alert"><AlertTriangle size={16} />{error}<button type="button" onClick={() => setError('')} aria-label="Dismiss error"><X size={15} /></button></div>}
      {notice && <div className="admin-alert is-success" role="status"><Check size={16} />{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss notice"><X size={15} /></button></div>}

      <section className="admin-stats-grid" aria-label="User and activity summary">
        <article className="admin-stat-card"><span><Users size={17} /> Accounts</span><strong>{stats?.total_users ?? '—'}</strong><small>{stats?.verified_users ?? 0} verified</small></article>
        <article className="admin-stat-card"><span><CirclePlus size={17} /> New accounts</span><strong>{stats?.new_users_30d ?? '—'}</strong><small>in the last 30 days</small></article>
        <article className="admin-stat-card"><span><Activity size={17} /> Study sessions</span><strong>{stats?.total_sessions ?? '—'}</strong><small>{durationLabel(stats?.total_study_seconds)} tracked</small></article>
      </section>

      <section className="admin-settings-card">
        <div className="admin-card-copy"><span className="admin-icon-tile"><LockKeyhole size={17} /></span><div><h2>Signup access</h2><p>Pause public account creation while keeping existing accounts available.</p></div></div>
        <button
          type="button"
          role="switch"
          aria-checked={overview?.settings?.signups_enabled !== false}
          className={`admin-switch${overview?.settings?.signups_enabled === false ? '' : ' is-on'}`}
          onClick={() => setSignupState(overview?.settings?.signups_enabled === false)}
        ><span />{overview?.settings?.signups_enabled === false ? 'Paused' : 'Open'}</button>
      </section>

      <section className="admin-users-card">
        <div className="admin-users-heading">
          <div><h2>User accounts</h2><p>{total.toLocaleString()} account{total === 1 ? '' : 's'} · private account data</p></div>
          <button className="admin-primary-button" type="button" onClick={() => setCreateOpen(true)}><CirclePlus size={16} /> Create account</button>
        </div>
        <form className="admin-search-row" onSubmit={(event) => { event.preventDefault(); setOffset(0); setSearch(searchValue.trim()); }}>
          <label className="admin-search"><Search size={16} /><input aria-label="Search users" placeholder="Search name or email" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} /></label>
          <button type="submit" className="admin-secondary-button">Search</button>
          {search && <button type="button" className="admin-clear-search" onClick={() => { setSearch(''); setSearchValue(''); setOffset(0); }}>Clear</button>}
        </form>

        <div className="admin-table-wrap">
          <table className="admin-users-table">
            <thead><tr><th>Account</th><th>Status</th><th>Activity</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map((account) => (
                <tr key={account.id}>
                  <td><strong>{account.display_name}</strong><span>{account.email}</span></td>
                  <td><span className={`admin-status-pill${account.email_verified ? ' is-verified' : ' is-pending'}`}>{account.email_verified ? 'Verified' : 'Setup pending'}</span><small>{[account.has_password && 'Password', account.has_google && 'Google'].filter(Boolean).join(' · ') || 'No sign-in method'}</small></td>
                  <td><strong>{account.session_count} sessions</strong><span>{durationLabel(account.study_seconds)} · {dateLabel(account.last_studied_at)}</span></td>
                  <td>{dateLabel(account.created_at)}</td>
                  <td><div className="admin-row-actions"><button type="button" className="admin-icon-action" title={`Send setup or reset email to ${account.email}`} aria-label={`Send password setup or reset email to ${account.email}`} onClick={() => sendPasswordReset(account)}><Mail size={16} /></button><button type="button" className="admin-icon-action is-danger" title={`Delete ${account.email}`} aria-label={`Delete ${account.email}`} onClick={() => { setDeleteTarget(account); setConfirmEmail(''); }}><Trash2 size={16} /></button></div></td>
                </tr>
              ))}
              {!busy && users.length === 0 && <tr><td colSpan="5" className="admin-empty-row">{search ? 'No accounts match this search.' : 'No accounts found.'}</td></tr>}
              {busy && <tr><td colSpan="5" className="admin-empty-row">Loading user records…</td></tr>}
            </tbody>
          </table>
        </div>
        <footer className="admin-table-footer"><span>Showing {total ? offset + 1 : 0}–{Math.min(offset + PAGE_SIZE, total)} of {total}</span><div><button className="admin-page-arrow" type="button" aria-label="Previous page" disabled={offset === 0 || busy} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}><ChevronLeft size={17} /></button><button className="admin-page-arrow" type="button" aria-label="Next page" disabled={offset + PAGE_SIZE >= total || busy} onClick={() => setOffset(offset + PAGE_SIZE)}><ChevronRight size={17} /></button></div></footer>
      </section>

      {createOpen && <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateOpen(false); }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-create-title"><header><div><span className="admin-eyebrow">NEW ACCOUNT</span><h2 id="admin-create-title">Create user</h2></div><button type="button" className="admin-modal-close" onClick={() => setCreateOpen(false)} aria-label="Close"><X size={18} /></button></header><p>The user will receive a password setup code at their email. You will not see or set their password.</p><form onSubmit={createUser}><label>Display name<input autoComplete="off" maxLength={80} required value={createForm.displayName} onChange={(event) => setCreateForm({ ...createForm, displayName: event.target.value })} /></label><label>Email address<input type="email" autoComplete="off" required value={createForm.email} onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })} /></label><footer><button className="admin-secondary-button" type="button" onClick={() => setCreateOpen(false)}>Cancel</button><button className="admin-primary-button" type="submit"><CirclePlus size={16} /> Create & send setup</button></footer></form></section></div>}

      {deleteTarget && <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteTarget(null); }}><section className="admin-modal is-delete" role="alertdialog" aria-modal="true" aria-labelledby="admin-delete-title"><header><div><span className="admin-eyebrow">PERMANENT ACCOUNT ACTION</span><h2 id="admin-delete-title">Delete {deleteTarget.display_name}?</h2></div><button type="button" className="admin-modal-close" onClick={() => setDeleteTarget(null)} aria-label="Close"><X size={18} /></button></header><p>This permanently deletes <strong>{deleteTarget.email}</strong> and their projects, sessions, connections, and saved workspace. This cannot be undone.</p><form onSubmit={deleteUser}><label>Type the email address to confirm<input autoComplete="off" value={confirmEmail} onChange={(event) => setConfirmEmail(event.target.value)} /></label><footer><button className="admin-secondary-button" type="button" onClick={() => setDeleteTarget(null)}>Cancel</button><button className="admin-danger-button" type="submit" disabled={confirmEmail.trim().toLowerCase() !== deleteTarget.email.toLowerCase()}><Trash2 size={16} /> Permanently delete</button></footer></form></section></div>}
    </main>
  );
};
