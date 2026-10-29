import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, Check, ChevronLeft, ChevronRight, CirclePlus,
  ArrowUpDown, Image, LockKeyhole, LogIn, Mail, Search, ShieldCheck, Trash2, Users, X, Shuffle, Type,
} from 'lucide-react';
import { getSiteFontStyle, SITE_COPY_FIELDS, SITE_FONT_OPTIONS, siteAssetUrl } from '../../context/SiteCustomizationContext';
import './AdminPage.css';
import { EmailPreviewsGallery } from '../manage/EmailReportsPanel';
import { formatDisplayDate } from '../../utils/dateFormat';

const PAGE_SIZE = 50;
const EMPTY_CONFIG = { copy: {}, fonts: {}, visuals: { login: { light: [], dark: [], shuffle: true }, dashboard: { light: [], dark: [], shuffle: true }, logo: { light: null, dark: null } } };

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
  ? formatDisplayDate(value, { year: 'numeric', month: 'short', day: 'numeric' })
  : 'No sessions yet';
const dateTimeLabel = (value) => value
  ? `${formatDisplayDate(value, { year: 'numeric', month: 'short', day: 'numeric' })} · ${new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value))}`
  : 'Never';

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
  const [sortBy, setSortBy] = useState('joined');
  const [sortDir, setSortDir] = useState('desc');
  const [userFilters, setUserFilters] = useState({ status: 'all', loginActivity: 'all', studyActivity: 'all', pageActivity: 'all', joinedFrom: '', joinedTo: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [createForm, setCreateForm] = useState({ displayName: '', email: '' });
  const [siteConfig, setSiteConfig] = useState(EMPTY_CONFIG);
  const [siteAssets, setSiteAssets] = useState([]);
  const [customizationBusy, setCustomizationBusy] = useState(false);
  const [customizationSaved, setCustomizationSaved] = useState(false);
  const [assetSlot, setAssetSlot] = useState('login');
  const [assetTheme, setAssetTheme] = useState('light');
  const [copyPage, setCopyPage] = useState('login');
  const [fontPage, setFontPage] = useState('login');
  const [loginHistoryTarget, setLoginHistoryTarget] = useState(null);
  const [loginHistory, setLoginHistory] = useState([]);
  const [loginHistoryBusy, setLoginHistoryBusy] = useState(false);
  const [pageActivityTarget, setPageActivityTarget] = useState(null);
  const [pageActivity, setPageActivity] = useState([]);
  const [pageActivityBusy, setPageActivityBusy] = useState(false);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!user?.is_admin) return;
    if (!silent) {
      setBusy(true);
      setError('');
    }
    try {
      const userQuery = new URLSearchParams({
        limit: String(PAGE_SIZE), offset: String(offset), search,
        sortBy, sortDir, ...userFilters,
      });
      const [dashboard, userList, customization] = await Promise.all([
        api('/overview'),
        api(`/users?${userQuery.toString()}`),
        api('/customization'),
      ]);
      setOverview(dashboard);
      setUsers(userList.users);
      setTotal(userList.total);
      setSiteConfig(customization.config || EMPTY_CONFIG);
      setSiteAssets(customization.assets || []);
    } catch (loadError) {
      if (!silent) setError(loadError.message);
    } finally {
      if (!silent) setBusy(false);
    }
  }, [offset, search, sortBy, sortDir, userFilters, user?.is_admin]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const refreshInterval = window.setInterval(() => loadData({ silent: true }), 30_000);
    return () => window.clearInterval(refreshInterval);
  }, [loadData]);

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

  const showLoginHistory = async (target) => {
    setLoginHistoryTarget(target);
    setLoginHistory([]);
    setLoginHistoryBusy(true);
    setError('');
    try {
      const result = await api(`/users/${encodeURIComponent(target.id)}/login-sessions`);
      setLoginHistory(result.sessions || []);
    } catch (requestError) { setError(requestError.message); }
    finally { setLoginHistoryBusy(false); }
  };

  const showPageActivity = async (target) => {
    setPageActivityTarget(target);
    setPageActivity([]);
    setPageActivityBusy(true);
    setError('');
    try {
      const result = await api(`/users/${encodeURIComponent(target.id)}/page-activity`);
      setPageActivity(result.pages || []);
    } catch (requestError) { setError(requestError.message); }
    finally { setPageActivityBusy(false); }
  };

  const changeUserFilter = (field, value) => {
    setOffset(0);
    setUserFilters((current) => ({ ...current, [field]: value }));
  };

  const changeSort = (field) => {
    setOffset(0);
    if (sortBy === field) setSortDir((current) => current === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir(field === 'account' ? 'asc' : 'desc'); }
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
      setNotice(`Deleted ${deleteTarget.email} and their stored PlotHour data.`);
      setDeleteTarget(null);
      setConfirmEmail('');
      if (users.length === 1 && offset > 0) setOffset(Math.max(0, offset - PAGE_SIZE));
      else await loadData();
    } catch (requestError) { setError(requestError.message); }
  };

  const updateSiteConfig = (update) => {
    setCustomizationSaved(false);
    setSiteConfig((current) => update(current));
  };

  const saveCustomization = async () => {
    setCustomizationBusy(true);
    setError('');
    try {
      const result = await api('/customization', { method: 'PUT', body: JSON.stringify({ config: siteConfig }) });
      setSiteConfig(result.config || siteConfig);
      setCustomizationSaved(true);
      window.dispatchEvent(new Event('studyduel:site-customization-updated'));
      setNotice('Site branding and copy have been updated.');
    } catch (requestError) { setError(requestError.message); }
    finally { setCustomizationBusy(false); }
  };

  const uploadAsset = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('Choose a PNG, JPG, or WebP image.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Images must be 5 MB or smaller.'); return; }
    setCustomizationBusy(true);
    setError('');
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read this image file.'));
        reader.readAsDataURL(file);
      });
      const result = await api('/assets', { method: 'POST', body: JSON.stringify({ slot: assetSlot, theme: assetTheme, fileName: file.name, mimeType: file.type, data }) });
      setSiteAssets((current) => [result.asset, ...current]);
      setNotice(`${file.name} added to the ${assetSlot} ${assetTheme} collection.`);
    } catch (requestError) { setError(requestError.message); }
    finally { setCustomizationBusy(false); }
  };

  const removeAsset = async (asset) => {
    setCustomizationBusy(true);
    setError('');
    try {
      const result = await api(`/assets/${encodeURIComponent(asset.id)}`, { method: 'DELETE' });
      setSiteAssets((current) => current.filter((item) => item.id !== asset.id));
      setSiteConfig(result.config || siteConfig);
      window.dispatchEvent(new Event('studyduel:site-customization-updated'));
      setNotice(`${asset.file_name} removed.`);
    } catch (requestError) { setError(requestError.message); }
    finally { setCustomizationBusy(false); }
  };

  const setAssetActive = (asset) => updateSiteConfig((current) => {
    const next = {
      ...current,
      visuals: {
        ...current.visuals,
        [asset.slot]: {
          ...current.visuals[asset.slot],
          ...(asset.slot !== 'logo' ? { [asset.theme]: [...(current.visuals[asset.slot][asset.theme] || [])] } : {}),
        },
      },
    };
    if (asset.slot === 'logo') next.visuals.logo[asset.theme] = next.visuals.logo[asset.theme] === asset.id ? null : asset.id;
    else {
      const ids = next.visuals[asset.slot][asset.theme] || [];
      next.visuals[asset.slot][asset.theme] = ids.includes(asset.id) ? ids.filter((id) => id !== asset.id) : [...ids, asset.id];
    }
    return next;
  });

  if (!user?.is_admin) {
    return <main className="admin-page"><section className="admin-access-card"><ShieldCheck size={28} /><h1>Admin access required</h1><p>Sign in with an administrator account to open this area.</p></section></main>;
  }

  const stats = overview?.stats;
  return (
    <main className="admin-page" style={getSiteFontStyle(siteConfig, 'admin')}>
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

      <section className="admin-customization-card">
        <div className="admin-users-heading">
          <div><h2><Image size={17} /> Site appearance & copy</h2><p>Customize artwork and visible text while keeping the PlotHour layout and themes.</p></div>
          <button className="admin-primary-button" type="button" onClick={saveCustomization} disabled={customizationBusy}><Check size={16} /> {customizationBusy ? 'Saving…' : customizationSaved ? 'Saved' : 'Save site changes'}</button>
        </div>

        <div className="admin-customization-section">
          <div className="admin-customization-heading"><div><span className="admin-icon-tile"><Image size={17} /></span><div><h3>Images and logo</h3><p>Upload up to 24 images per collection. Use landscape artwork for backgrounds.</p></div></div></div>
          <div className="admin-asset-controls">
            <label>Collection<select value={assetSlot} onChange={(event) => setAssetSlot(event.target.value)}><option value="login">Login background</option><option value="dashboard">Dashboard artwork</option><option value="logo">Logo</option></select></label>
            <label>Theme<select value={assetTheme} onChange={(event) => setAssetTheme(event.target.value)}><option value="light">Light theme</option><option value="dark">Dark theme</option></select></label>
            <label className="admin-upload-button"><CirclePlus size={15} /> Add image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadAsset} disabled={customizationBusy} /></label>
          </div>
          {assetSlot !== 'logo' && <label className="admin-shuffle-option"><input type="checkbox" checked={siteConfig.visuals?.[assetSlot]?.shuffle !== false} onChange={(event) => updateSiteConfig((current) => ({ ...current, visuals: { ...current.visuals, [assetSlot]: { ...current.visuals[assetSlot], shuffle: event.target.checked } } }))} /><span className="admin-shuffle-icon"><Shuffle size={15} /></span><span><strong>Shuffle artwork</strong><small>Choose a random image on each visit{assetSlot === 'dashboard' ? ' and rotate every 10 minutes' : ''}.</small></span></label>}
          <div className="admin-asset-grid">
            {siteAssets.filter((asset) => asset.slot === assetSlot && asset.theme === assetTheme).map((asset) => {
              const active = asset.slot === 'logo'
                ? siteConfig.visuals?.logo?.[asset.theme] === asset.id
                : siteConfig.visuals?.[asset.slot]?.[asset.theme]?.includes(asset.id);
              return <article className={`admin-asset-card${asset.slot === 'logo' ? ' is-logo' : ''}${active ? ' is-active' : ''}`} key={asset.id}>
                <button type="button" className="admin-asset-preview" onClick={() => setAssetActive(asset)} aria-pressed={active} title={active ? 'Remove from active artwork' : 'Use this image'}>
                  <img src={siteAssetUrl(asset.id)} alt={asset.file_name} />{active && <span className="admin-asset-selected"><Check size={14} /></span>}
                </button>
                <div><strong title={asset.file_name}>{asset.file_name}</strong><small>{Math.max(1, Math.round(asset.byte_size / 1024))} KB · {active ? asset.slot === 'logo' ? 'Current logo' : 'In rotation' : 'Available'}</small></div>
                <button type="button" className="admin-icon-action is-danger" onClick={() => removeAsset(asset)} aria-label={`Remove ${asset.file_name}`} disabled={customizationBusy}><Trash2 size={15} /></button>
              </article>;
            })}
            {siteAssets.every((asset) => asset.slot !== assetSlot || asset.theme !== assetTheme) && <div className="admin-assets-empty"><Image size={19} /><span>No custom images yet. Built-in artwork remains active until you add images here.</span></div>}
          </div>
          <p className="admin-customization-hint">Select thumbnails to add or remove them from the rotation. For logos, selecting one replaces the current logo for that theme. You can drag files into the upload button or choose them from your device.</p>
        </div>

        <div className="admin-customization-section">
          <div className="admin-customization-heading"><div><span className="admin-icon-tile"><Mail size={17} /></span><div><h3>Page text</h3><p>Edit key interface copy. Leave a field blank to restore its built-in wording.</p></div></div></div>
          <div className="admin-copy-tabs" role="tablist" aria-label="Page copy">
            {['login', 'timer', 'dashboard', 'manage', 'compare'].map((page) => <button key={page} type="button" role="tab" aria-selected={copyPage === page} className={copyPage === page ? 'is-active' : ''} onClick={() => setCopyPage(page)}>{page[0].toUpperCase() + page.slice(1)}</button>)}
          </div>
          <div className="admin-copy-grid">
            {SITE_COPY_FIELDS.filter((field) => field.page === copyPage).map((field) => <label key={`${field.page}.${field.key}`}>{field.label}<input maxLength={240} value={siteConfig.copy?.[field.page]?.[field.key] ?? ''} placeholder={field.fallback} onChange={(event) => updateSiteConfig((current) => ({ ...current, copy: { ...current.copy, [field.page]: { ...current.copy?.[field.page], [field.key]: event.target.value } } }))} /></label>)}
          </div>
        </div>

        <div className="admin-customization-section">
          <div className="admin-customization-heading"><div><span className="admin-icon-tile"><Type size={17} /></span><div><h3>Typography</h3><p>Choose a font for each section. It applies in both light and dark themes.</p></div></div></div>
          <div className="admin-copy-tabs admin-font-tabs" role="tablist" aria-label="Section typography">
            {['login', 'timer', 'dashboard', 'manage', 'compare', 'settings', 'calendar', 'admin'].map((page) => <button key={page} type="button" role="tab" aria-selected={fontPage === page} className={fontPage === page ? 'is-active' : ''} onClick={() => setFontPage(page)}>{page[0].toUpperCase() + page.slice(1)}</button>)}
          </div>
          <div className="admin-font-groups">
            {['Casual', 'Enterprise', 'Google Noto'].map((group) => <section className="admin-font-group" key={group} aria-label={`${group} fonts`}>
              <h4>{group === 'Google Noto' ? 'Google Noto' : `${group} fonts`}<span>{group === 'Casual' ? '5 options' : group === 'Enterprise' ? '5 options' : '1 option'}</span></h4>
              <div className="admin-font-grid">
                {SITE_FONT_OPTIONS.filter((font) => font.group === group).map((font) => {
                  const active = (siteConfig.fonts?.[fontPage] || 'inter') === font.id;
                  return <button type="button" key={font.id} className={`admin-font-option${active ? ' is-active' : ''}`} aria-pressed={active} onClick={() => updateSiteConfig((current) => ({ ...current, fonts: { ...current.fonts, [fontPage]: font.id } }))}>
                    <span className="admin-font-option-copy"><strong style={{ fontFamily: `'${font.family}', sans-serif` }}>Aa PlotHour</strong><small>{font.name} · {font.descriptor}</small></span>
                    {active && <span className="admin-font-selected" aria-label="Selected"><Check size={14} strokeWidth={2.5} /></span>}
                  </button>;
                })}
              </div>
            </section>)}
          </div>
          <p className="admin-customization-hint">Google Noto is Noto Sans, a Google Fonts family designed for broad multilingual support. Choose “Save site changes” to publish your selection.</p>
        </div>
      </section>

      <section className="admin-customization-card admin-email-preview-library">
        <div className="admin-users-heading"><div><h2><Mail size={17} /> Email preview library</h2><p>Review the report designs and task reminder emails available to PlotHour users.</p></div></div>
        <EmailPreviewsGallery />
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
            <thead>
              <tr>
                {[
                  ['account', 'Account'], ['status', 'Status'], ['logins', 'Login sessions'],
                  ['study', 'Study activity'], ['appTime', 'Time in app'], ['joined', 'Joined'],
                ].map(([key, label]) => <th key={key} aria-sort={sortBy === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}><button type="button" className="admin-sort-button" onClick={() => changeSort(key)}>{label}<ArrowUpDown size={12} className={sortBy === key ? 'is-sorted' : ''} />{sortBy === key && <span className="admin-sort-direction">{sortDir === 'asc' ? '↑' : '↓'}</span>}</button></th>)}
                <th>Actions</th>
              </tr>
              <tr className="admin-filter-row">
                <th><span className="admin-filter-hint">Use account search above</span></th>
                <th><select aria-label="Filter by account status" value={userFilters.status} onChange={(event) => changeUserFilter('status', event.target.value)}><option value="all">All statuses</option><option value="verified">Verified</option><option value="pending">Setup pending</option></select></th>
                <th><select aria-label="Filter by login activity" value={userFilters.loginActivity} onChange={(event) => changeUserFilter('loginActivity', event.target.value)}><option value="all">All login activity</option><option value="has">Has logged in</option><option value="none">Never logged in</option></select></th>
                <th><select aria-label="Filter by study activity" value={userFilters.studyActivity} onChange={(event) => changeUserFilter('studyActivity', event.target.value)}><option value="all">All study activity</option><option value="has">Has study sessions</option><option value="none">No study sessions</option></select></th>
                <th><select aria-label="Filter by app page activity" value={userFilters.pageActivity} onChange={(event) => changeUserFilter('pageActivity', event.target.value)}><option value="all">All app activity</option><option value="has">Has page time</option><option value="none">No page time</option></select></th>
                <th><div className="admin-date-filters"><input aria-label="Joined on or after" type="date" value={userFilters.joinedFrom} onChange={(event) => changeUserFilter('joinedFrom', event.target.value)} /><input aria-label="Joined on or before" type="date" value={userFilters.joinedTo} onChange={(event) => changeUserFilter('joinedTo', event.target.value)} /></div></th>
                <th><button type="button" className="admin-filter-reset" onClick={() => { setUserFilters({ status: 'all', loginActivity: 'all', studyActivity: 'all', pageActivity: 'all', joinedFrom: '', joinedTo: '' }); setSearch(''); setSearchValue(''); setOffset(0); }}>Reset filters</button></th>
              </tr>
            </thead>
            <tbody>
              {users.map((account) => (
                <tr key={account.id}>
                  <td><strong>{account.display_name}</strong><span>{account.email}</span></td>
                  <td><span className={`admin-status-pill${account.email_verified ? ' is-verified' : ' is-pending'}`}>{account.email_verified ? 'Verified' : 'Setup pending'}</span><small>{[account.has_password && 'Password', account.has_google && 'Google'].filter(Boolean).join(' · ') || 'No sign-in method'}</small></td>
                  <td><strong>{account.login_count} login{account.login_count === 1 ? '' : 's'}</strong><button type="button" className="admin-history-link" onClick={() => showLoginHistory(account)}><LogIn size={12} /> {dateTimeLabel(account.last_login_at)}</button></td>
                  <td><strong>{account.session_count} study session{account.session_count === 1 ? '' : 's'}</strong><span>{durationLabel(account.study_seconds)} · {account.last_studied_at ? dateTimeLabel(account.last_studied_at) : 'No study yet'}</span></td>
                  <td><strong>{durationLabel(account.app_seconds)}</strong><button type="button" className="admin-history-link" onClick={() => showPageActivity(account)}><Activity size={12} /> Page breakdown</button></td>
                  <td>{dateLabel(account.created_at)}</td>
                  <td><div className="admin-row-actions"><button type="button" className="admin-icon-action" title={`Send setup or reset email to ${account.email}`} aria-label={`Send password setup or reset email to ${account.email}`} onClick={() => sendPasswordReset(account)}><Mail size={16} /></button><button type="button" className="admin-icon-action is-danger" title={`Delete ${account.email}`} aria-label={`Delete ${account.email}`} onClick={() => { setDeleteTarget(account); setConfirmEmail(''); }}><Trash2 size={16} /></button></div></td>
                </tr>
              ))}
              {!busy && users.length === 0 && <tr><td colSpan="7" className="admin-empty-row">{search || Object.values(userFilters).some((value) => value !== 'all' && value !== '') ? 'No accounts match these filters.' : 'No accounts found.'}</td></tr>}
              {busy && <tr><td colSpan="7" className="admin-empty-row">Loading user records…</td></tr>}
            </tbody>
          </table>
        </div>
        <footer className="admin-table-footer"><span>Showing {total ? offset + 1 : 0}–{Math.min(offset + PAGE_SIZE, total)} of {total}</span><div><button className="admin-page-arrow" type="button" aria-label="Previous page" disabled={offset === 0 || busy} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}><ChevronLeft size={17} /></button><button className="admin-page-arrow" type="button" aria-label="Next page" disabled={offset + PAGE_SIZE >= total || busy} onClick={() => setOffset(offset + PAGE_SIZE)}><ChevronRight size={17} /></button></div></footer>
      </section>

      {loginHistoryTarget && <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setLoginHistoryTarget(null); }}><section className="admin-modal admin-login-modal" role="dialog" aria-modal="true" aria-labelledby="admin-login-history-title"><header><div><span className="admin-eyebrow"><LogIn size={13} /> ACCOUNT SECURITY</span><h2 id="admin-login-history-title">Login history</h2><p>{loginHistoryTarget.display_name} · {loginHistoryTarget.email}</p></div><button type="button" className="admin-modal-close" onClick={() => setLoginHistoryTarget(null)} aria-label="Close"><X size={18} /></button></header><div className="admin-login-history-list">{loginHistoryBusy ? <div className="admin-login-history-empty">Loading login records…</div> : loginHistory.length === 0 ? <div className="admin-login-history-empty">No login sessions recorded for this account yet.</div> : loginHistory.map((session) => <article className="admin-login-session" key={session.id}><div className="admin-login-session-heading"><div><strong>{dateTimeLabel(session.created_at)}</strong><span>{({ google: 'Google', password: 'Password', password_signup: 'Password signup', password_reset: 'Password reset' })[session.auth_method] || session.auth_method}</span></div><span className={`admin-login-state is-${session.status}`}>{session.status}</span></div><dl><div><dt>IP address</dt><dd>{session.ip_address || 'Not available'}</dd></div><div><dt>{session.status === 'ended' ? 'Signed out' : 'Session expiry'}</dt><dd>{dateTimeLabel(session.ended_at || session.expires_at)}</dd></div></dl><p title={session.user_agent || ''}>{session.user_agent || 'Browser details not available'}</p></article>)}</div><footer className="admin-login-history-footer"><span>Showing up to 100 recent sign-ins</span><button type="button" className="admin-secondary-button" onClick={() => setLoginHistoryTarget(null)}>Done</button></footer></section></div>}

      {pageActivityTarget && <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPageActivityTarget(null); }}><section className="admin-modal admin-login-modal" role="dialog" aria-modal="true" aria-labelledby="admin-page-activity-title"><header><div><span className="admin-eyebrow"><Activity size={13} /> PRODUCT ACTIVITY</span><h2 id="admin-page-activity-title">Time by page</h2><p>{pageActivityTarget.display_name} · {pageActivityTarget.email}</p></div><button type="button" className="admin-modal-close" onClick={() => setPageActivityTarget(null)} aria-label="Close"><X size={18} /></button></header><div className="admin-page-activity-list">{pageActivityBusy ? <div className="admin-login-history-empty">Loading page activity…</div> : pageActivity.length === 0 ? <div className="admin-login-history-empty">No page time recorded yet. Tracking starts with the next authenticated visit.</div> : pageActivity.map((item) => <article className="admin-page-activity-row" key={item.page}><div><strong>{({ timer: 'Timer', dashboard: 'Dashboard', compare: 'Compare', manage: 'Manage', settings: 'Settings', calendar: 'Calendar', admin: 'Admin' })[item.page] || item.page}</strong><span>{item.active_days} active day{item.active_days === 1 ? '' : 's'} · Last viewed {dateTimeLabel(item.last_seen_at)}</span></div><b>{durationLabel(item.duration_seconds)}</b></article>)}</div><footer className="admin-login-history-footer"><span>Foreground time for authenticated sessions</span><button type="button" className="admin-secondary-button" onClick={() => setPageActivityTarget(null)}>Done</button></footer></section></div>}

      {createOpen && <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateOpen(false); }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-create-title"><header><div><span className="admin-eyebrow">NEW ACCOUNT</span><h2 id="admin-create-title">Create user</h2></div><button type="button" className="admin-modal-close" onClick={() => setCreateOpen(false)} aria-label="Close"><X size={18} /></button></header><p>The user will receive a password setup code at their email. You will not see or set their password.</p><form onSubmit={createUser}><label>Display name<input autoComplete="off" maxLength={80} required value={createForm.displayName} onChange={(event) => setCreateForm({ ...createForm, displayName: event.target.value })} /></label><label>Email address<input type="email" autoComplete="off" required value={createForm.email} onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })} /></label><footer><button className="admin-secondary-button" type="button" onClick={() => setCreateOpen(false)}>Cancel</button><button className="admin-primary-button" type="submit"><CirclePlus size={16} /> Create & send setup</button></footer></form></section></div>}

      {deleteTarget && <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteTarget(null); }}><section className="admin-modal is-delete" role="alertdialog" aria-modal="true" aria-labelledby="admin-delete-title"><header><div><span className="admin-eyebrow">PERMANENT ACCOUNT ACTION</span><h2 id="admin-delete-title">Delete {deleteTarget.display_name}?</h2></div><button type="button" className="admin-modal-close" onClick={() => setDeleteTarget(null)} aria-label="Close"><X size={18} /></button></header><p>This permanently deletes <strong>{deleteTarget.email}</strong> and their projects, sessions, connections, and saved workspace. This cannot be undone.</p><form onSubmit={deleteUser}><label>Type the email address to confirm<input autoComplete="off" value={confirmEmail} onChange={(event) => setConfirmEmail(event.target.value)} /></label><footer><button className="admin-secondary-button" type="button" onClick={() => setDeleteTarget(null)}>Cancel</button><button className="admin-danger-button" type="submit" disabled={confirmEmail.trim().toLowerCase() !== deleteTarget.email.toLowerCase()}><Trash2 size={16} /> Permanently delete</button></footer></form></section></div>}
    </main>
  );
};
