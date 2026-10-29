import React, { useEffect, useState } from 'react';
import { BellRing, CalendarClock, Check, ChevronDown, Clock3, FileText, LoaderCircle, Mail, Plus, Send, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import './EmailReportsPanel.css';
import { WorkspaceHeader } from './WorkspaceHeader';
import { formatDisplayDate } from '../../utils/dateFormat';

const reportTypes = [
  { id: 'agenda', name: "Today's agenda", detail: 'Today’s study target, project plan, and upcoming tasks', icon: CalendarClock, cadence: 'Daily' },
  { id: 'weekly-plan', name: 'Weekly study plan', detail: 'A look at the week ahead', icon: Clock3, cadence: 'Weekly' },
  { id: 'weekly-recap', name: 'Weekly progress recap', detail: 'How last week went', icon: Sparkles, cadence: 'Weekly' },
  { id: 'monthly-recap', name: 'Monthly progress report', detail: 'Study time, active days, and goals', icon: FileText, cadence: 'Monthly' },
  { id: 'comparison', name: 'Date range comparison', detail: 'Compare progress across selected dates', icon: BellRing, cadence: 'Monthly' },
  { id: 'task-reminder', name: 'Task reminders', detail: 'A nudge before selected deadlines', icon: BellRing, cadence: 'Before each due date' },
];

const scheduledReportTypes = reportTypes.filter(type => type.id !== 'task-reminder');
const comparisonMetrics = [
  { id: 'studyTime', label: 'Total study time', current: '36h 20m', previous: '30h 45m', change: '+18%' },
  { id: 'averageSession', label: 'Average session', current: '35m 44s', previous: '30m 15s', change: '+18%' },
  { id: 'sessions', label: 'Study sessions', current: '61', previous: '61', change: 'No change' },
  { id: 'activeDays', label: 'Active study days', current: '18 days', previous: '15 days', change: '+3 days' },
  { id: 'goalProgress', label: 'Goal completed', current: '91%', previous: '77%', change: '+14 pts' },
  { id: 'longestSession', label: 'Longest session', current: '2h 10m', previous: '1h 48m', change: '+22m' },
  { id: 'bestStreak', label: 'Best study streak', current: '6 days', previous: '4 days', change: '+2 days' },
];
const defaultComparisonMetrics = comparisonMetrics.map(metric => metric.id);

const previewCopy = {
  agenda: { eyebrow: 'THURSDAY · OCTOBER 29', title: 'Your agenda for today.', intro: 'A clear target and the projects and subprojects to focus on.', metric: '1h 45m', metricLabel: "today's study target", rows: [['Studied so far', '25 minutes'], ['Time remaining', '1h 20m'], ['Upcoming tasks', '2 open tasks']], areaRows: [{ project: 'Computer Science', subject: 'Algorithms', time: '1h', detail: '25m studied · 35m remaining' }, { project: 'Mathematics', subject: 'Statistics', time: '45m', detail: 'Not started · 45m remaining' }] },
  'weekly-plan': { eyebrow: 'NEXT WEEK · NOV 2–8', title: 'A clear plan for the week ahead.', intro: 'Your study goals, gathered in one place.', metric: '12h', metricLabel: 'weekly study goal', callout: { label: 'Daily pace to reach your goal', value: '1h 43m each day', detail: 'Spread across 7 days, that adds up to 12 focused hours.' }, rows: [['Projects in your plan', '3'], ['Subjects and subprojects', '6'], ['Planned study days', 'Mon · Tue · Thu · Sat']], areaRows: [{ project: 'Computer Science', subject: 'Algorithms', time: '2h 40m', detail: '3h goal · 20m remaining' }, { project: 'Computer Science', subject: 'Database Systems', time: '1h 15m', detail: '2h goal · 45m remaining' }, { project: 'Mathematics', subject: 'Statistics', time: '45m', detail: '2h goal · 1h 15m remaining' }] },
  'weekly-recap': { eyebrow: 'LAST WEEK · SUNDAY–SATURDAY', title: 'Your week, measured against your goals.', intro: 'A clear view of what you planned and what you studied.', metric: '8h 42m', metricLabel: 'studied this week', rows: [['Weekly goal', '10h 30m'], ['Goal completed', '83%'], ['Time remaining', '1h 48m']], areaRows: [{ project: 'Computer Science', subject: 'Algorithms', time: '3h 10m', detail: '4h goal · 50m remaining' }, { project: 'Japanese', subject: 'Listening Practice', time: '2h 05m', detail: '2h goal · goal reached' }, { project: 'Mathematics', subject: 'Statistics', time: '1h 40m', detail: '2h 30m goal · 50m remaining' }] },
  'monthly-recap': { eyebrow: 'MONTHLY REPORT · OCTOBER', title: 'Your October, in perspective.', intro: 'Small sessions added up to meaningful progress.', metric: '36h 20m', metricLabel: 'focused this month', rows: [['Active days', '18 days'], ['Study sessions', '61 sessions'], ['Best streak', '6 days']], areaRows: [{ project: 'Computer Science', subject: 'Algorithms', time: '12h 20m', detail: '18 sessions' }, { project: 'Japanese', subject: 'Listening Practice', time: '8h 05m', detail: '14 sessions' }, { project: 'Mathematics', subject: 'Statistics', time: '6h 40m', detail: '11 sessions' }] },
  comparison: { eyebrow: 'DATE RANGE COMPARISON', title: 'See how your study time changed.', intro: 'Choose any date range, then compare it with a previous period or a custom range.', metric: '+18%', metricLabel: 'total study time', comparisonRows: comparisonMetrics, areaRows: [{ project: 'Computer Science', subject: 'Algorithms', time: '12h 20m', detail: '10h 05m before · +22%' }, { project: 'Japanese', subject: 'Listening Practice', time: '8h 05m', detail: '6h 40m before · +21%' }, { project: 'Mathematics', subject: 'Statistics', time: '6h 40m', detail: '7h 15m before · −8%' }] },
  'task-reminder': { eyebrow: 'UPCOMING DEADLINE', title: 'A gentle nudge for what matters next.', intro: 'You asked to be reminded before this deadline.', metric: '2 days', metricLabel: 'until it’s due', rows: [['Task', 'Finish statistics problem set'], ['Project / subject', 'Mathematics / Statistics'], ['Due date', 'Saturday, Oct 31'], ['Your reminder', 'Thursday, Oct 29 · 8:00 AM']] },
};

const timeLabel = (time) => {
  const [hour, minute] = time.split(':').map(Number);
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const periodOptions = ['This week', 'Last week', 'This month', 'Last month', 'This quarter', 'Last quarter', 'This year', 'Last year', 'Custom date range'];
const reportRangeOptions = (type) => type === 'weekly-plan' ? ['This week', 'Next week', 'Custom date range'] : periodOptions;
const validDateRange = (from, to) => /^\d{4}-\d{2}-\d{2}$/.test(from || '') && /^\d{4}-\d{2}-\d{2}$/.test(to || '') && from <= to;
const cadenceSummary = (schedule) => {
  if (schedule.frequency === 'Daily') return 'Every day';
  if (schedule.frequency === 'Weekly') return `Every ${schedule.day}`;
  if (schedule.frequency === 'Monthly') return `Monthly · ${schedule.day}`;
  if (schedule.frequency === 'Quarterly') return `Quarterly · ${schedule.day}`;
  return `Yearly · ${schedule.day}`;
};

const EmailReportTypeSelect = ({ value, options, onChange, label }) => {
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.id === value) || options[0];
  return <div className="email-select-wrap" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}>
    <button type="button" className="email-type-trigger" aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)}>
      <span>{selected?.name || 'Choose a report'}</span><ChevronDown size={13} />
    </button>
    {open && <div className="email-type-menu" role="listbox" aria-label={label}>
      {options.map(option => <button type="button" role="option" aria-selected={value === option.id} className={value === option.id ? 'is-selected' : ''} key={option.id} onClick={() => { onChange(option.id); setOpen(false); }}>{option.name}</button>)}
    </div>}
  </div>;
};

async function emailApi(path, options = {}) {
  const response = await fetch(`/api/email-reports${path}`, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Could not complete email settings request.');
  return payload;
}

export const EmailReportsPanel = ({ user }) => {
  const [schedules, setSchedules] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [allTasksEnabled, setAllTasksEnabled] = useState(false);
  const [taskRemindersEnabled, setTaskRemindersEnabled] = useState(false);
  const [taskRules, setTaskRules] = useState([]);
  const [taskOptions, setTaskOptions] = useState([]);
  const [friendOptions, setFriendOptions] = useState([]);
  const [reportsEnabled, setReportsEnabled] = useState(false);
  const [dateFormat, setDateFormat] = useState(() => document.documentElement.dataset.dateFormat || 'system');
  const [locale, setLocale] = useState(() => navigator.language || 'en-US');
  const [loading, setLoading] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveState, setSaveState] = useState('saved');
  const [deliveryConfigured, setDeliveryConfigured] = useState(false);
  const [accountVerified, setAccountVerified] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [sendButtonStates, setSendButtonStates] = useState({});
  const [emailInput, setEmailInput] = useState('');
  const [addError, setAddError] = useState('');
  const accountEmail = user?.email || 'alex.morgan@example.com';
  useEffect(() => {
    const syncDatePreference = () => {
      setDateFormat(document.documentElement.dataset.dateFormat || 'system');
      setLocale(navigator.language || 'en-US');
    };
    window.addEventListener('studyduel:preferences-storage', syncDatePreference);
    window.addEventListener('storage', syncDatePreference);
    return () => {
      window.removeEventListener('studyduel:preferences-storage', syncDatePreference);
      window.removeEventListener('storage', syncDatePreference);
    };
  }, []);
  useEffect(() => {
    let alive = true;
    Promise.all([emailApi('/'), emailApi('/tasks').catch(() => ({ tasks: [] })), emailApi('/friends').catch(() => ({ friends: [] }))]).then(([payload, taskPayload, friendPayload]) => {
      if (!alive) return;
      const settings = payload.settings || {};
      setDateFormat(document.documentElement.dataset.dateFormat || settings.dateFormat || 'system');
      setLocale(navigator.language || settings.locale || 'en-US');
      setSchedules(settings.schedules || []);
      setRecipients(payload.recipients || []);
      setAllTasksEnabled(settings.allTasksEnabled || false);
      setTaskRemindersEnabled(settings.taskRemindersEnabled === true);
      setTaskRules(settings.taskRules || []);
      setReportsEnabled(settings.enabled || false);
      setDeliveryConfigured(Boolean(payload.deliveryConfigured));
      setAccountVerified(Boolean(payload.account?.email_verified));
      setTaskOptions(taskPayload.tasks || []);
      setFriendOptions(friendPayload.friends || []);
      setSettingsLoaded(true);
      setLoading(false);
    }).catch(error => { if (alive) { setLoadError(error.message); setActionError(error.message); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (loading || !settingsLoaded) return undefined;
    setSaveState('saving');
    const timer = window.setTimeout(() => {
      emailApi('/', { method: 'PUT', body: JSON.stringify({ settings: { enabled: reportsEnabled, format: 'html', schedules, allTasksEnabled, taskRemindersEnabled, taskRules, dateFormat, locale, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } }) })
        .then(() => setSaveState('saved')).catch(error => { setSaveState('error'); setActionError(error.message); });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [loading, settingsLoaded, reportsEnabled, schedules, allTasksEnabled, taskRemindersEnabled, taskRules, dateFormat, locale]);

  const updateSchedule = (id, patch) => setSchedules(items => items.map(item => item.id === id ? { ...item, ...patch } : item));
  const addSchedule = () => {
    const availableType = scheduledReportTypes.find(type => !schedules.some(item => item.type === type.id));
    if (!availableType) return;
    setSchedules(items => [...items, { id: crypto.randomUUID(), type: availableType.id, frequency: availableType.cadence === 'Daily' ? 'Daily' : availableType.cadence === 'Monthly' ? 'Monthly' : 'Weekly', day: availableType.cadence === 'Monthly' ? '1st of the month' : 'Monday', time: '08:00', compare: 'Previous period', range: availableType.id === 'agenda' ? 'Today' : availableType.id === 'weekly-recap' ? 'Last week' : availableType.id === 'monthly-recap' ? 'This month' : availableType.id === 'weekly-plan' ? 'Next week' : 'This week', includeUpcomingTasks: false, metrics: defaultComparisonMetrics, people: ['You'], enabled: true }]);
  };
  const addRecipient = (event) => {
    event.preventDefault();
    const emails = [...new Set(emailInput.split(/[\s,;]+/).map(email => email.trim().toLowerCase()).filter(Boolean))];
    if (!emails.length) return setAddError('Add one or more email addresses.');
    emailApi('/recipients', { method: 'POST', body: JSON.stringify({ emails }) }).then(payload => {
      setRecipients(items => [...items.filter(item => !payload.recipients.some(next => next.id === item.id)), ...payload.recipients]);
      setEmailInput(''); setAddError(''); setActionMessage(`${payload.invited} invitation${payload.invited === 1 ? '' : 's'} sent. Each recipient can accept once.`);
    }).catch(error => setAddError(error.message));
  };
  const removeRecipient = (recipient) => emailApi(`/recipients/${recipient.id}`, { method: 'DELETE' }).then(() => setRecipients(items => items.filter(item => item.id !== recipient.id))).catch(error => setActionError(error.message));
  const setTemporarySendState = (id, state) => {
    setSendButtonStates(current => ({ ...current, [id]: state }));
    if (state.status === 'sent' || state.status === 'error') {
      window.setTimeout(() => setSendButtonStates(current => current[id] === state ? { ...current, [id]: null } : current), state.status === 'sent' ? 2600 : 4500);
    }
  };
  const sendNow = (schedule) => {
    setTemporarySendState(schedule.id, { status: 'sending' });
    emailApi('/send', { method: 'POST', body: JSON.stringify({ schedule: { ...schedule, format: 'html', dateFormat, locale, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } }) })
      .then(() => setTemporarySendState(schedule.id, { status: 'sent' }))
      .catch(error => setTemporarySendState(schedule.id, { status: 'error', message: error.message }));
  };
  const sendTaskInfoNow = () => {
    setTemporarySendState('task-info', { status: 'sending' });
    emailApi('/send-task-info', { method: 'POST' })
      .then(() => setTemporarySendState('task-info', { status: 'sent' }))
      .catch(error => setTemporarySendState('task-info', { status: 'error', message: error.message }));
  };
  const renderSendButton = (id, onClick, disabled, idleLabel = 'Send now', idleTitle = 'Send this report now') => {
    const state = sendButtonStates[id];
    return <button type="button" className={`email-send-now${state ? ` is-${state.status}` : ''}`} onClick={onClick} disabled={disabled || state?.status === 'sending'} title={state?.message || idleTitle} aria-live="polite">
      {state?.status === 'sending' ? <><LoaderCircle size={12} /> Sending…</> : state?.status === 'sent' ? <><Check size={12} /> Sent</> : state?.status === 'error' ? <><ShieldCheck size={12} /> Try again</> : <><Send size={12} /> {idleLabel}</>}
    </button>;
  };
  const addTaskRule = (task) => setTaskRules(items => items.some(item => item.id === task.id) ? items : [...items, { id: task.id, title: task.title, project: task.project_name, subproject: task.subproject_name, due: task.due_date, enabled: true, reminders: [{ id: crypto.randomUUID(), offset: '1 day before', time: '08:00' }] }]);
  return <section className="email-studio email-settings">
    <WorkspaceHeader title="Email reports" description="Your progress, on your schedule. Manage reports, reminders, and recipients.">
      <span className={`email-prototype-badge ${saveState === 'error' || loadError ? 'is-error' : ''}`} title={loadError || (saveState === 'error' ? actionError : undefined)}><span /> {loading ? 'Loading settings…' : loadError ? 'Could not load settings' : saveState === 'saving' ? 'Saving changes…' : saveState === 'error' ? 'Could not save' : 'Settings saved'}</span>
    </WorkspaceHeader>

    <div className="email-studio-toolbar"><span className="email-format-note"><ShieldCheck size={15} /> HTML reports include a plain-text alternative · recipients can unsubscribe any time</span><a className="email-design-preview-link" href="/previews/email-design.html" target="_blank" rel="noreferrer">Preview all email designs ↗</a></div>

    <div className="email-studio-grid">
      <section className="email-card email-schedules-card">
        <div className="email-card-heading"><div><span className="email-section-kicker">REPORT DELIVERY</span><h2>Delivery schedule</h2><p>Choose what arrives and when. Each report has its own schedule.</p></div><label className="email-scope-toggle"><input type="checkbox" checked={reportsEnabled} onChange={event => setReportsEnabled(event.target.checked)} /><span>{reportsEnabled ? 'Email on' : 'Email off'}</span></label></div>
        {settingsLoaded && !deliveryConfigured && <p className="email-delivery-warning"><ShieldCheck size={14} /> Email delivery is not configured on this server yet. Your preferences can be saved, but messages won’t go out until SMTP or Resend is configured.</p>}
        {settingsLoaded && !accountVerified && <p className="email-delivery-warning"><ShieldCheck size={14} /> Verify your PlotHour account email before enabling report delivery.</p>}
        <div className="email-schedule-list">
          {!schedules.length && <div className="email-empty-state"><span>01 / REPORTS</span><h3>{loading ? 'Loading your reports…' : loadError ? 'Your reports are unavailable' : 'Build your reporting routine'}</h3><p>{loadError ? 'We couldn’t load your preferences. Refresh the page to reconnect to your account.' : 'Add a daily agenda, weekly recap, or monthly report. You choose the timing and what’s included.'}</p></div>}
          {schedules.map(schedule => {
            const selectedType = reportTypes.find(item => item.id === schedule.type) || reportTypes[0];
            const Icon = selectedType.icon;
            const missingCurrentRange = ['weekly-plan','monthly-recap','comparison'].includes(schedule.type) && schedule.range === 'Custom date range' && !validDateRange(schedule.from, schedule.to);
            const missingCompareRange = schedule.type === 'comparison' && schedule.compare === 'Custom dates' && !validDateRange(schedule.compareFrom, schedule.compareTo);
            return <article className="email-schedule-row" key={schedule.id}>
              <span className="email-schedule-icon"><Icon size={17} /></span>
              <div className="email-schedule-main">
                <div className="email-schedule-title-line"><EmailReportTypeSelect label="Report type" value={schedule.type} options={scheduledReportTypes} onChange={type => updateSchedule(schedule.id, { type })} /><div className="email-row-actions"><label title={schedule.enabled ? 'Pause this report' : 'Enable this report'}><input type="checkbox" checked={schedule.enabled !== false} onChange={event => updateSchedule(schedule.id, { enabled: event.target.checked })} /><span>{schedule.enabled === false ? 'Paused' : 'On'}</span></label>{renderSendButton(schedule.id, () => sendNow(schedule), !deliveryConfigured || !accountVerified || missingCurrentRange || missingCompareRange)}<button type="button" className="email-remove-schedule" aria-label={`Remove ${selectedType.name} schedule`} onClick={() => setSchedules(items => items.filter(item => item.id !== schedule.id))}><Trash2 size={14} /></button></div></div>
                <p>{selectedType.detail}</p>
                <div className="email-schedule-controls">
                  <label className="email-control-field"><span>Repeats</span><span className="email-control-select"><select value={schedule.frequency} onChange={event => updateSchedule(schedule.id, { frequency: event.target.value, day: event.target.value === 'Daily' ? 'Every day' : event.target.value === 'Weekly' ? 'Monday' : event.target.value === 'Monthly' ? '1st of the month' : event.target.value === 'Quarterly' ? 'First day of quarter' : 'January 1' })}><option>Daily</option><option>Weekly</option><option>Monthly</option><option>Quarterly</option><option>Yearly</option></select><ChevronDown size={13} /></span></label>
                  {schedule.frequency === 'Weekly' && <label className="email-control-field"><span>On</span><span className="email-control-select"><select value={schedule.day} onChange={event => updateSchedule(schedule.id, { day: event.target.value })}>{['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day => <option key={day}>{day}</option>)}</select><ChevronDown size={13} /></span></label>}
                  {schedule.frequency === 'Monthly' && <label className="email-control-field"><span>On</span><span className="email-control-select"><select value={schedule.day} onChange={event => updateSchedule(schedule.id, { day: event.target.value })}><option>1st of the month</option><option>15th of the month</option><option>Last day of month</option></select><ChevronDown size={13} /></span></label>}
                  {schedule.frequency === 'Quarterly' && <label className="email-control-field"><span>On</span><span className="email-control-select"><select value={schedule.day} onChange={event => updateSchedule(schedule.id, { day: event.target.value })}><option>First day of quarter</option><option>Last day of quarter</option></select><ChevronDown size={13} /></span></label>}
                  {schedule.frequency === 'Yearly' && <label className="email-control-field"><span>On</span><span className="email-control-select"><select value={schedule.day} onChange={event => updateSchedule(schedule.id, { day: event.target.value })}><option>January 1</option><option>January 31</option><option>December 31</option></select><ChevronDown size={13} /></span></label>}
                  {['weekly-plan','monthly-recap','comparison'].includes(schedule.type) && <label className="email-control-field email-period-field"><span>{schedule.type === 'comparison' ? 'Date range' : 'Study period'}</span><span className="email-control-select"><select value={schedule.range || (schedule.type === 'weekly-plan' ? 'This week' : schedule.type === 'comparison' ? 'This month' : 'This month')} onChange={event => updateSchedule(schedule.id, { range: event.target.value })}>{reportRangeOptions(schedule.type).map(period => <option key={period}>{period}</option>)}</select><ChevronDown size={13} /></span></label>}
                  {schedule.type === 'comparison' && <label className="email-control-field"><span>Compare against</span><span className="email-control-select"><select value={schedule.compare || 'Previous period'} onChange={event => updateSchedule(schedule.id, { compare: event.target.value })}><option>Previous period</option><option>3 months earlier</option><option>Same period last year</option><option>Custom dates</option></select><ChevronDown size={13} /></span></label>}
                  <label className="email-control-field email-time-field"><span>Send at</span><input type="time" value={schedule.time} onChange={event => updateSchedule(schedule.id, { time: event.target.value })} /></label>
                </div>
                <label className="email-include-upcoming-tasks"><input type="checkbox" checked={schedule.includeUpcomingTasks === true} onChange={event => updateSchedule(schedule.id, { includeUpcomingTasks: event.target.checked })} /><span><strong>Include upcoming tasks</strong><small>Off by default. Task details are added only when you turn this on.</small></span></label>
                {schedule.type === 'comparison' && <div className="email-comparison-controls"><span className="email-comparison-label">Compare people</span><div className="email-people-pills">{[{ id: 'You', name: 'You' }, ...friendOptions].map(person => { const selected = (schedule.people || ['You']).includes(person.id); return <button key={person.id} type="button" className={selected ? 'is-selected' : ''} aria-pressed={selected} disabled={person.id === 'You'} onClick={() => updateSchedule(schedule.id, { people: selected ? (schedule.people || ['You']).filter(id => id !== person.id) : [...(schedule.people || ['You']), person.id] })}>{selected && <Check size={11} />}{person.name}</button>; })}</div><small>Only connected study partners appear here. Their totals are compared for the same date range.</small><div className="email-metric-config"><div><strong>Include in report</strong><small>Choose the stats to compare in the email.</small></div><div className="email-metric-options">{comparisonMetrics.map(metric => { const selected = (schedule.metrics || defaultComparisonMetrics).includes(metric.id); const selectedCount = (schedule.metrics || defaultComparisonMetrics).length; return <label key={metric.id}><input type="checkbox" checked={selected} disabled={selected && selectedCount === 1} onChange={() => updateSchedule(schedule.id, { metrics: selected ? (schedule.metrics || defaultComparisonMetrics).filter(id => id !== metric.id) : [...(schedule.metrics || defaultComparisonMetrics), metric.id] })} /><span>{metric.label}</span></label>; })}</div></div></div>}
                {['weekly-plan','monthly-recap','comparison'].includes(schedule.type) && schedule.range === 'Custom date range' && <div className="email-custom-range"><label>From<input type="date" required value={schedule.from || ''} onChange={event => updateSchedule(schedule.id, { from: event.target.value })} /></label><span>to</span><label>Through<input type="date" required min={schedule.from || undefined} value={schedule.to || ''} onChange={event => updateSchedule(schedule.id, { to: event.target.value })} /></label></div>}
                {schedule.type === 'comparison' && schedule.compare === 'Custom dates' && <div className="email-custom-range"><label>Compare from<input type="date" required value={schedule.compareFrom || ''} onChange={event => updateSchedule(schedule.id, { compareFrom: event.target.value })} /></label><span>to</span><label>Through<input type="date" required min={schedule.compareFrom || undefined} value={schedule.compareTo || ''} onChange={event => updateSchedule(schedule.id, { compareTo: event.target.value })} /></label></div>}
                <div className="email-next-send"><Clock3 size={12} /> {cadenceSummary(schedule)} at {timeLabel(schedule.time)} <span>· your local time</span></div>
              </div>
            </article>;
          })}
        </div>
        <button type="button" className="email-add-schedule" onClick={addSchedule} disabled={!settingsLoaded || schedules.length >= scheduledReportTypes.length}><Plus size={15} /> {schedules.length ? 'Add another report' : 'Add a report'}</button>
      <div className="email-task-reminder-schedule">
        <div className="email-task-schedule-heading"><div><span className="email-section-kicker">TASK ALERTS</span><h3>Task reminders</h3><p>Choose which deadlines to include and when reminders arrive.</p></div><div className="email-task-heading-actions"><label className="email-schedule-reminder-toggle"><input type="checkbox" checked={taskRemindersEnabled} onChange={event => setTaskRemindersEnabled(event.target.checked)} /><span>Automatic reminders {taskRemindersEnabled ? 'On' : 'Off'}</span></label>{renderSendButton('task-info', sendTaskInfoNow, !deliveryConfigured || !accountVerified || loading || (!allTasksEnabled && !taskRules.some(task => task.enabled)), 'Send task info now', !deliveryConfigured ? 'Email delivery is not configured on this server' : !accountVerified ? 'Verify your account email before sending' : 'Send the current task selection now')}</div></div>
        <div className="email-reminder-scope"><div><strong>Apply reminders to</strong><small>Choose all open tasks or customize each task below.</small></div><label className="email-scope-toggle"><input type="checkbox" checked={allTasksEnabled} onChange={event => setAllTasksEnabled(event.target.checked)} /><span>{allTasksEnabled ? 'All open tasks' : 'Selected tasks'}</span></label></div>
        {!allTasksEnabled && <><div className="email-task-rule-list">{taskRules.map(task => <article className={`email-task-rule${task.enabled ? ' is-enabled' : ''}`} key={task.id}>
          <div className="email-task-rule-head"><label className="email-task-choice"><input type="checkbox" checked={task.enabled} onChange={event => setTaskRules(items => items.map(item => item.id === task.id ? { ...item, enabled: event.target.checked } : item))} /><span className="email-checkmark"><Check size={12} /></span><span><strong>{task.title}</strong><small>{[task.project, task.subproject].filter(Boolean).join(' / ')}{task.due ? ` · Due ${formatDisplayDate(task.due, { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}</small></span></label><span className="email-rule-count">{task.enabled ? `${task.reminders.length} reminders` : 'Off'}</span></div>
          {task.enabled && <div className="email-task-reminder-list">{task.reminders.map(reminder => <div className="email-task-reminder-rule" key={reminder.id}><span className="email-reminder-rule-dot" /><label className="email-reminder-days"><span className="sr-only">Days before due date</span><input type="number" min="0" max="365" value={reminder.offset === 'On due date' ? 0 : Number.parseInt(reminder.offset, 10) || 0} onChange={event => { const days = Math.max(0, Math.min(365, Number(event.target.value) || 0)); setTaskRules(items => items.map(item => item.id !== task.id ? item : { ...item, reminders: item.reminders.map(rule => rule.id === reminder.id ? { ...rule, offset: days ? `${days} days before` : 'On due date' } : rule) })); }} /></label><span className="email-reminder-at">days before · at</span><input aria-label={`Send time for ${task.title} reminder`} type="time" value={reminder.time} onChange={event => setTaskRules(items => items.map(item => item.id !== task.id ? item : { ...item, reminders: item.reminders.map(rule => rule.id === reminder.id ? { ...rule, time: event.target.value } : rule) }))} /><button type="button" aria-label="Remove reminder" onClick={() => setTaskRules(items => items.map(item => item.id === task.id ? { ...item, reminders: item.reminders.filter(rule => rule.id !== reminder.id) } : item))}><Trash2 size={13} /></button></div>)}
            <button type="button" className="email-add-reminder-rule" onClick={() => setTaskRules(items => items.map(item => item.id === task.id ? { ...item, reminders: [...item.reminders, { id: crypto.randomUUID(), offset: '1 day before', time: '08:00' }] } : item))}><Plus size={13} /> Add reminder moment</button>
          </div>}
        </article>)}</div><label className="email-task-add-select"><span>Add a task to customize</span><span className="email-control-select"><select value="" onChange={event => { const task = taskOptions.find(item => item.id === event.target.value); if (task) addTaskRule(task); }}><option value="">Choose an open task…</option>{taskOptions.filter(task => !taskRules.some(rule => rule.id === task.id)).map(task => <option key={task.id} value={task.id}>{task.title}</option>)}</select><ChevronDown size={13} /></span></label></>}
        {allTasksEnabled && <div className="email-all-tasks-state"><Check size={15} /><span><strong>All open tasks included</strong><small>Each task can have reminders 3 days before, 2 days before, 1 day before, or on its due date. You can still fine-tune individual tasks.</small></span><button type="button" onClick={() => setAllTasksEnabled(false)}>Customize tasks</button></div>}
        <div className="email-reminder-note"><BellRing size={15} /><span>Existing “Remind me on” dates can be carried over as a reminder rule.</span></div>
      </div>
      </section>

      <aside className="email-side-column">
        <section className="email-card email-recipients-card">
          <div className="email-card-heading compact"><div><span className="email-section-kicker">DELIVER TO</span><h2>Recipients</h2><p>Only recipients who accepted their invitation receive reports.</p></div></div>
          <div className="email-recipient-row"><span className="email-recipient-avatar">{accountEmail.slice(0,1).toUpperCase()}</span><span className="email-recipient-address"><strong>{accountEmail}</strong><small>Your account email</small></span><span className={accountVerified ? 'email-verified-pill' : 'email-pending-pill'}>{!settingsLoaded ? 'Unavailable' : accountVerified ? <><Check size={12} /> Verified</> : 'Verify account'}</span></div>
          {recipients.map(item => <div className={`email-recipient-row ${item.status === 'active' ? 'is-verified' : 'is-pending'}`} key={item.id}><span className="email-recipient-avatar is-pending"><Mail size={14} /></span><span className="email-recipient-address"><strong>{item.email}</strong><small>{item.status === 'active' ? 'Accepted invitation' : item.status === 'unsubscribed' ? 'Unsubscribed' : 'Invitation sent · awaiting acceptance'}</small></span><span className={item.status === 'active' ? 'email-verified-pill' : 'email-pending-pill'}>{item.status === 'active' ? 'Active' : item.status === 'unsubscribed' ? 'Stopped' : 'Pending'}</span><button type="button" aria-label={`Remove ${item.email}`} onClick={() => removeRecipient(item)}><Trash2 size={14} /></button></div>)}
          <form className="email-add-recipient" onSubmit={addRecipient}><label htmlFor="email-additional-recipient">Invite recipients</label><textarea id="email-additional-recipient" placeholder="Paste addresses separated by commas or new lines" value={emailInput} onChange={event => setEmailInput(event.target.value)} rows={3} /><button type="submit" className="email-invite-batch" disabled={!emailInput.trim() || !deliveryConfigured}><Mail size={14} /> Send invitations</button>{addError && <small role="alert">{addError}</small>}</form>
          <p className="email-verification-note"><ShieldCheck size={13} /> New recipients accept once, then can receive future reports. They can unsubscribe at any time.</p>
        </section>
      </aside>
    </div>
    {(actionMessage || actionError) && <p className={`email-action-feedback${actionError ? ' is-error' : ''}`} role={actionError ? 'alert' : 'status'}>{actionError || actionMessage}</p>}
    <footer className="email-prototype-footer"><ShieldCheck size={14} /><span>Settings are stored securely with your account. Reports include only enabled metrics and accepted recipients.</span></footer>
  </section>;
};

export const EmailPreviewsGallery = () => {
  const [previewType, setPreviewType] = useState('weekly-recap');
  const email = { ...previewCopy[previewType], type: previewType };
  return <div className="email-studio"><section className="email-card email-previews-page">
    <div className="email-card-heading"><div><span className="email-section-kicker">EMAIL DESIGN LIBRARY</span><h2>Email previews</h2><p>Review each report layout and message style before delivery.</p></div><span className="email-preview-mode"><Sparkles size={14} /> Preview library</span></div>
    <div className="email-full-preview-grid"><nav className="email-preview-nav" aria-label="Email types">{reportTypes.map(type => <button type="button" key={type.id} className={previewType === type.id ? 'selected' : ''} onClick={() => setPreviewType(type.id)}><type.icon size={16} /><span><strong>{type.name}</strong><small>{type.detail}</small></span><span className="email-preview-nav-arrow">›</span></button>)}</nav><div className="email-large-mockup-wrap"><EmailMockup email={email} large /></div></div>
  </section></div>;
};

const EmailMockup = ({ email }) => <iframe className="email-production-preview" title={`${reportTypes.find(type => type.id === email.type)?.name || 'Report'} email preview · sample data`} src={`/previews/email-letters/${email.type || 'weekly-recap'}.html`} />;
