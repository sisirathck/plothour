import { Router } from 'express';
import { createHash, createHmac, randomBytes } from 'crypto';
import { query } from '../db.js';
import { authenticate } from '../middleware.js';
import { emailDeliveryConfigured, escapeEmailHtml, sendEmail } from '../emailDelivery.js';

export const emailReportsRouter = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const allowedReportTypes = new Set(['agenda', 'weekly-plan', 'weekly-recap', 'monthly-recap', 'comparison']);
const hashToken = token => createHash('sha256').update(token).digest('hex');
const makeUnsubscribeToken = (userId, email) => createHmac('sha256', process.env.AUTH_SECRET || 'studyduel-development-fallback-secret-key-32b').update(`${userId}:${email}:email-report-unsubscribe`).digest('hex');
const validId = value => typeof value === 'string' && /^[\w-]{1,80}$/.test(value);
const validTime = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const validTaskId = value => typeof value === 'string' && /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(value);
const addDays = (value, amount) => { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10); };
const daySpan = (from, to) => Math.max(1, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1);
const fmtDuration = seconds => { const mins = Math.round((Number(seconds) || 0) / 60); return `${Math.floor(mins / 60)}h ${mins % 60}m`; };
const dateKeyAt = (date, timeZone) => { const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date); const values = Object.fromEntries(parts.map(part => [part.type, part.value])); return `${values.year}-${values.month}-${values.day}`; };
const localClock = (date, timeZone) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', hour: '2-digit', minute: '2-digit', weekday: 'long', day: 'numeric', month: 'numeric', hourCycle: 'h23' }).formatToParts(date).map(part => [part.type, part.value]));
const localToday = timeZone => dateKeyAt(new Date(), timeZone);
const supportedDateFormats = new Set(['system','dmy-slash','dmy-slash-short','dmy-dash','dmy-dash-short','dmy-dot','dmy-dot-short','mdy-slash','mdy-slash-short','mdy-dash','mdy-dot','year-month-day','month-day-year','day-month-year']);
const safeLocale = value => { try { return Intl.getCanonicalLocales(value || 'en-US')[0] || 'en-US'; } catch { return 'en-US'; } };
function formatDateKey(value, format = 'system', locale = 'en-US') {
  const [yearText, monthText, dayText] = String(value).slice(0, 10).split('-');
  const year = Number(yearText); const month = Number(monthText); const day = Number(dayText);
  if (![year, month, day].every(Number.isFinite)) return String(value);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dd = String(day).padStart(2, '0'); const mm = String(month).padStart(2, '0'); const yyyy = String(year);
  const numeric = {
    'dmy-slash': `${dd}/${mm}/${yyyy}`, 'dmy-slash-short': `${dd}/${mm}/${yyyy.slice(-2)}`,
    'dmy-dash': `${dd}-${mm}-${yyyy}`, 'dmy-dash-short': `${dd}-${mm}-${yyyy.slice(-2)}`,
    'dmy-dot': `${dd}.${mm}.${yyyy}`, 'dmy-dot-short': `${dd}.${mm}.${yyyy.slice(-2)}`,
    'mdy-slash': `${mm}/${dd}/${yyyy}`, 'mdy-slash-short': `${mm}/${dd}/${yyyy.slice(-2)}`,
    'mdy-dash': `${mm}-${dd}-${yyyy}`, 'mdy-dot': `${mm}.${dd}.${yyyy}`,
    'year-month-day': `${yyyy}-${mm}-${dd}`,
  };
  if (numeric[format]) return numeric[format];
  const monthName = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(date);
  if (format === 'month-day-year') return `${monthName} ${day}, ${year}`;
  if (format === 'day-month-year') return `${day} ${monthName} ${year}`;
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
}
const formatDateRange = (from, to, format, locale) => from === to ? formatDateKey(from, format, locale) : `${formatDateKey(from, format, locale)} – ${formatDateKey(to, format, locale)}`;
const emailBrandHeader = () => {
  const base = (process.env.APP_BASE_URL || 'https://plothour.com').replace(/\/$/, '');
  return `<header style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:14px;border-bottom:1px solid #e8eaf3"><span style="display:grid;gap:3px"><img src="${base}/plothour-logo-light.png" alt="PlotHour" width="84" style="display:block;width:84px;height:auto;max-height:25px;object-fit:contain;object-position:left center"><small style="font:10px Arial,sans-serif;color:#858aa0">Turn time into progress</small></span><span style="font:700 10px Arial,sans-serif;color:#777d97;text-align:right;letter-spacing:.08em">STUDY REPORT</span></header>`;
};

function resolveRange(range, timezone, from, to) {
  const today = localToday(timezone);
  const date = new Date(`${today}T00:00:00Z`);
  const weekDay = (date.getUTCDay() + 6) % 7;
  const weekStart = addDays(today, -weekDay);
  const monthStart = `${today.slice(0, 7)}-01`;
  if (range === 'Custom date range' && /^\d{4}-\d{2}-\d{2}$/.test(from || '') && /^\d{4}-\d{2}-\d{2}$/.test(to || '') && from <= to) return { from, to, label: `${from} – ${to}` };
  if (range === 'Today' || range === 'Today & upcoming') return { from: today, to: today, label: 'Today' };
  if (range === 'This week' || range === 'Next week') {
    const start = range === 'Next week' ? addDays(weekStart, 7) : weekStart;
    return { from: start, to: addDays(start, 6), label: `${start} – ${addDays(start, 6)}` };
  }
  if (range === 'Last week') { const start = addDays(weekStart, -7); return { from: start, to: addDays(start, 6), label: `${start} – ${addDays(start, 6)}` }; }
  if (range === 'Last month') { const end = addDays(monthStart, -1); const start = `${end.slice(0, 7)}-01`; return { from: start, to: end, label: `${start} – ${end}` }; }
  if (range === 'This quarter' || range === 'Last quarter') {
    let year = Number(today.slice(0, 4)); let month = Math.floor((Number(today.slice(5, 7)) - 1) / 3) * 3 + 1;
    if (range === 'Last quarter') month -= 3;
    if (month < 1) { month += 12; year -= 1; }
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const next = new Date(`${start}T00:00:00Z`); next.setUTCMonth(next.getUTCMonth() + 3);
    return { from: start, to: addDays(next.toISOString().slice(0, 10), -1), label: `Q${Math.floor((month - 1) / 3) + 1} ${year}` };
  }
  if (range === 'This year' || range === 'Last year') { const year = Number(today.slice(0, 4)) - (range === 'Last year' ? 1 : 0); return { from: `${year}-01-01`, to: `${year}-12-31`, label: `${year}` }; }
  const start = range === 'Last week' ? addDays(weekStart, -7) : range === 'Last month' ? `${addDays(monthStart, -1).slice(0, 7)}-01` : range === 'Last year' ? `${Number(today.slice(0, 4)) - 1}-01-01` : range === 'This week' ? weekStart : monthStart;
  return { from: start, to: today, label: range || 'This month' };
}

function previousRange(current, comparison) {
  const span = daySpan(current.from, current.to);
  if (comparison === 'Same period last year') return { from: `${Number(current.from.slice(0, 4)) - 1}${current.from.slice(4)}`, to: `${Number(current.to.slice(0, 4)) - 1}${current.to.slice(4)}`, label: 'Same period last year' };
  if (comparison === '3 months earlier') { const from = new Date(`${current.from}T00:00:00Z`); from.setUTCMonth(from.getUTCMonth() - 3); const to = new Date(`${current.to}T00:00:00Z`); to.setUTCMonth(to.getUTCMonth() - 3); return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), label: 'Three months earlier' }; }
  const to = addDays(current.from, -1); const from = addDays(to, -(span - 1));
  return { from, to, label: 'Previous comparable period' };
}

async function reportStats(userId, timezone, range) {
  const result = await query(
    `SELECT te.started_at, te.ended_at, te.note, p.name AS project_name, s.name AS subject_name
     FROM time_entries te JOIN projects p ON p.id = te.project_id
     LEFT JOIN subprojects s ON s.id = te.subproject_id
     WHERE te.user_id=$1 AND (te.started_at AT TIME ZONE $2)::date >= $3::date AND (te.started_at AT TIME ZONE $2)::date <= $4::date
     ORDER BY te.started_at`, [userId, timezone, range.from, range.to]
  );
  const entries = result.rows;
  const seconds = entries.reduce((sum, entry) => sum + Math.max(0, (new Date(entry.ended_at) - new Date(entry.started_at)) / 1000), 0);
  const activeDays = new Set(entries.map(entry => dateKeyAt(new Date(entry.started_at), timezone))).size;
  const sortedDays = [...new Set(entries.map(entry => dateKeyAt(new Date(entry.started_at), timezone)))].sort();
  let currentRun = 0; let bestStreak = 0; let lastDay = null;
  for (const day of sortedDays) { const consecutive = lastDay && addDays(lastDay, 1) === day; currentRun = consecutive ? currentRun + 1 : 1; bestStreak = Math.max(bestStreak, currentRun); lastDay = day; }
  const longest = entries.reduce((max, entry) => Math.max(max, (new Date(entry.ended_at) - new Date(entry.started_at)) / 1000), 0);
  const projects = new Map();
  entries.forEach(entry => { const name = entry.project_name; const item = projects.get(name) || { seconds: 0, sessions: 0 }; item.seconds += Math.max(0, (new Date(entry.ended_at) - new Date(entry.started_at)) / 1000); item.sessions++; projects.set(name, item); });
  return { entries: entries.length, seconds, activeDays, average: entries.length ? seconds / entries.length : 0, longest, bestStreak, projects: [...projects.entries()].map(([name, values]) => ({ name, ...values })).sort((a,b) => b.seconds-a.seconds).slice(0, 6) };
}

async function renderReport(userId, user, schedule) {
  const timezone = schedule.timezone || user.timezone || 'UTC';
  const dateFormat = supportedDateFormats.has(schedule.dateFormat) ? schedule.dateFormat : 'system';
  const locale = safeLocale(schedule.locale);
  const range = resolveRange(schedule.range || (schedule.type === 'agenda' ? 'Today' : 'This week'), timezone, schedule.from, schedule.to);
  range.label = formatDateRange(range.from, range.to, dateFormat, locale);
  if (schedule.type === 'agenda' || schedule.type === 'weekly-plan') {
    const [tasks, stats, goalResult] = await Promise.all([
      query(`SELECT title, project_name, due_date, reminder_date, completed FROM user_tasks WHERE user_id=$1 AND completed=false AND (due_date IS NULL OR due_date >= $2::date) AND (due_date IS NULL OR due_date <= $3::date) ORDER BY due_date NULLS LAST LIMIT 30`, [userId, range.from, range.to]),
      reportStats(userId, timezone, range),
      schedule.type === 'weekly-plan' ? query(`SELECT COALESCE(SUM(g.target_hours),0) AS hours,COUNT(DISTINCT d.weekday) AS study_days FROM subproject_goals g JOIN subprojects s ON s.id=g.subproject_id JOIN projects p ON p.id=s.project_id LEFT JOIN subproject_study_days d ON d.subproject_id=s.id WHERE p.user_id=$1 AND g.cadence='weekly'`, [userId]) : Promise.resolve({ rows: [{ hours: 0, study_days: 7 }] }),
    ]);
    const taskRows = tasks.rows.map(task => `${task.title}${task.due_date ? ` · due ${formatDateKey(String(task.due_date).slice(0, 10), dateFormat, locale)}` : ''}`);
    const subject = schedule.type === 'agenda' ? 'Your PlotHour day ahead' : `Your PlotHour study plan · ${range.label}`;
    const weeklyGoalHours = Number(goalResult.rows[0]?.hours) || 0;
    const daysPerWeek = Math.max(1, Number(goalResult.rows[0]?.study_days) || 7);
    const remainingStudyDays = Math.max(1, Math.ceil(daysPerWeek * Math.min(7, daySpan(range.from > localToday(timezone) ? range.from : localToday(timezone), range.to)) / 7));
    const remainingGoalHours = Math.max(0, weeklyGoalHours - stats.seconds / 3600);
    const dailyPace = remainingGoalHours / remainingStudyDays;
    const planPace = schedule.type === 'weekly-plan' ? weeklyGoalHours > 0 ? `${fmtDuration(stats.seconds)} studied so far · ${fmtDuration(remainingGoalHours * 3600)} left across ${remainingStudyDays} planned study day${remainingStudyDays === 1 ? '' : 's'} · ${fmtDuration(dailyPace * 3600)} per day to reach the weekly goal.` : 'No weekly study goal is set yet. Add a recurring goal in Projects to get a recommended daily pace in this report.' : '';
    const text = `${subject}\n\n${planPace ? `${planPace}\n` : ''}Study time already logged in this period: ${fmtDuration(stats.seconds)}\nOpen tasks: ${tasks.rows.length}\n${taskRows.join('\n') || 'No upcoming tasks.'}\n\nManage email reports in PlotHour.`;
    const html = `<main style="font:15px Arial,sans-serif;color:#252843;max-width:620px;margin:24px auto;padding:24px">${emailBrandHeader()}<h1 style="font-size:22px;color:#525db5">${escapeEmailHtml(subject)}</h1><p>${escapeEmailHtml(range.label)} · ${fmtDuration(stats.seconds)} studied so far</p>${planPace ? `<div style="padding:14px;background:#f2f3fc;border-left:3px solid #6f78d1;border-radius:8px"><strong>${weeklyGoalHours > 0 ? 'Daily pace to reach your goal' : 'Set a goal for a daily pace'}</strong>${weeklyGoalHours > 0 ? `<div style="font-size:20px;color:#525db5;font-weight:700;margin-top:5px">${fmtDuration(dailyPace * 3600)} per study day</div><small>${escapeEmailHtml(planPace)}</small>` : `<p>${escapeEmailHtml(planPace)}</p>`}</div>` : ''}<h2 style="font-size:16px">Upcoming tasks</h2>${tasks.rows.length ? `<ul>${tasks.rows.map(task => `<li>${escapeEmailHtml(task.title)}${task.due_date ? ` · due ${escapeEmailHtml(formatDateKey(String(task.due_date).slice(0,10), dateFormat, locale))}` : ''}</li>`).join('')}</ul>` : '<p>No upcoming tasks.</p>'}<p style="color:#82869a;font-size:12px">Manage email reports in PlotHour.</p></main>`;
    return { subject, text, html, range };
  }
  const current = await reportStats(userId, timezone, range);
  const compare = schedule.type === 'comparison' && schedule.compare === 'Custom dates' && /^\d{4}-\d{2}-\d{2}$/.test(schedule.compareFrom || '') && /^\d{4}-\d{2}-\d{2}$/.test(schedule.compareTo || '') && schedule.compareFrom <= schedule.compareTo
    ? { from: schedule.compareFrom, to: schedule.compareTo, label: 'Selected comparison range' }
    : previousRange(range, schedule.compare);
  compare.label = formatDateRange(compare.from, compare.to, dateFormat, locale);
  const previous = await reportStats(userId, timezone, compare);
  const goals = await query(`SELECT COALESCE(SUM(g.target_hours),0) AS weekly_hours FROM subproject_goals g JOIN subprojects s ON s.id=g.subproject_id JOIN projects p ON p.id=s.project_id WHERE p.user_id=$1 AND g.cadence='weekly'`, [userId]);
  const weeklyGoalSeconds = (Number(goals.rows[0]?.weekly_hours) || 0) * 3600;
  const currentGoal = weeklyGoalSeconds * daySpan(range.from, range.to) / 7;
  const previousGoal = weeklyGoalSeconds * daySpan(compare.from, compare.to) / 7;
  const pct = previous.seconds ? Math.round((current.seconds - previous.seconds) / previous.seconds * 100) : null;
  const goalPct = goal => goal > 0 ? `${Math.round(current.seconds / goal * 100)}%` : 'No goal set';
  const previousGoalPct = previousGoal > 0 ? `${Math.round(previous.seconds / previousGoal * 100)}%` : 'No goal set';
  const subject = schedule.type === 'comparison' ? `Study comparison · ${range.label}` : `PlotHour study report · ${range.label}`;
  const metrics = [
    ['Study time', fmtDuration(current.seconds), fmtDuration(previous.seconds), pct == null ? '—' : `${pct > 0 ? '+' : ''}${pct}%`],
    ['Average session', fmtDuration(current.average), fmtDuration(previous.average), ''],
    ['Sessions', String(current.entries), String(previous.entries), ''],
    ['Active days', String(current.activeDays), String(previous.activeDays), ''],
    ['Longest session', fmtDuration(current.longest), fmtDuration(previous.longest), ''],
    ['Goal completion', goalPct(currentGoal), previousGoalPct, currentGoal > 0 && previousGoal > 0 ? `${Math.round(current.seconds / currentGoal * 100) - Math.round(previous.seconds / previousGoal * 100)} pts` : ''],
    ['Best study streak', `${current.bestStreak} days`, `${previous.bestStreak} days`, ''],
  ];
  const wanted = new Set(schedule.metrics || ['studyTime','averageSession','sessions','activeDays','longestSession','goalProgress','bestStreak']);
  const metricIds = ['studyTime','averageSession','sessions','activeDays','longestSession','goalProgress','bestStreak'];
  const rows = metrics.filter((_, index) => wanted.has(metricIds[index]));
  let peopleRows = [];
  const selectedPeople = (schedule.people || []).filter(id => /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(id));
  if (schedule.type === 'comparison' && selectedPeople.length) {
    const friends = await query(`SELECT u.id,u.display_name FROM users u JOIN friendships f ON (f.user_low_id=$1 AND f.user_high_id=u.id) OR (f.user_high_id=$1 AND f.user_low_id=u.id) WHERE u.id=ANY($2::uuid[])`, [userId, selectedPeople]);
    peopleRows = await Promise.all(friends.rows.map(async friend => ({ name: friend.display_name, stats: await reportStats(friend.id, timezone, range) })));
  }
  const friendMetrics = [
    ['studyTime', 'Study time', person => fmtDuration(person.stats.seconds)],
    ['averageSession', 'Average session', person => fmtDuration(person.stats.average)],
    ['sessions', 'Sessions', person => String(person.stats.entries)],
    ['activeDays', 'Active days', person => String(person.stats.activeDays)],
    ['longestSession', 'Longest session', person => fmtDuration(person.stats.longest)],
    ['goalProgress', 'Goal completion', person => weeklyGoalSeconds > 0 ? `${Math.round(person.stats.seconds / (weeklyGoalSeconds * daySpan(range.from, range.to) / 7) * 100)}%` : 'No goal'],
    ['bestStreak', 'Best streak', person => `${person.stats.bestStreak} days`],
  ].filter(metric => wanted.has(metric[0]));
  const peopleText = peopleRows.length && friendMetrics.length ? `\n\nSame-period study partners:\n${peopleRows.map(person => `${person.name}: ${friendMetrics.map(metric => `${metric[1]} ${metric[2](person)}`).join(' · ')}`).join('\n')}` : '';
  const peopleHtml = peopleRows.length && friendMetrics.length ? `<h2 style="font-size:17px;margin-top:24px">Study partners · same period</h2><table style="width:100%;border-collapse:collapse"><thead><tr><th align="left">Person</th>${friendMetrics.map(metric => `<th align="right">${escapeEmailHtml(metric[1])}</th>`).join('')}</tr></thead><tbody>${peopleRows.map(person => `<tr><td style="padding:9px 2px;border-bottom:1px solid #eee">${escapeEmailHtml(person.name)}</td>${friendMetrics.map(metric => `<td align="right">${escapeEmailHtml(metric[2](person))}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '';
  const headlineMetric = rows[0];
  const text = `${subject}\n\n${range.label}: ${rows.map(row => `${row[0]} ${row[1]}`).join(' · ')}.\n${compare.label}: ${rows.map(row => `${row[0]} ${row[2]}`).join(' · ')}.\n\n${rows.map(row => `${row[0]}: ${row[1]} · previous ${row[2]}${row[3] ? ` · ${row[3]}` : ''}`).join('\n')}${peopleText}\n\nManage email reports in PlotHour.`;
  const html = `<main style="font:14px Arial,sans-serif;color:#252843;max-width:640px;margin:24px auto;padding:24px">${emailBrandHeader()}<h1 style="font-size:24px;margin:10px 0">${escapeEmailHtml(range.label)} comparison</h1><p style="color:#666b80">${escapeEmailHtml(formatDateRange(range.from, range.to, dateFormat, locale))} compared with ${escapeEmailHtml(formatDateRange(compare.from, compare.to, dateFormat, locale))}</p>${headlineMetric ? `<div style="padding:16px;background:#f2f3fc;border-radius:12px"><strong style="font-size:26px;color:#6872c5">${escapeEmailHtml(headlineMetric[1])}</strong><div>${escapeEmailHtml(headlineMetric[0])}${headlineMetric[3] ? ` · ${escapeEmailHtml(headlineMetric[3])} vs previous` : ''}</div></div>` : ''}<table style="width:100%;border-collapse:collapse;margin-top:16px"><thead><tr><th align="left">Metric</th><th align="right">This period</th><th align="right">Previous</th><th align="right">Change</th></tr></thead><tbody>${rows.map(row => `<tr><td style="padding:10px 2px;border-bottom:1px solid #eee">${escapeEmailHtml(row[0])}</td><td align="right">${escapeEmailHtml(row[1])}</td><td align="right">${escapeEmailHtml(row[2])}</td><td align="right">${escapeEmailHtml(row[3])}</td></tr>`).join('')}</tbody></table>${peopleHtml}<p style="color:#82869a;font-size:12px">Manage email reports in PlotHour.</p></main>`;
  return { subject, text, html, range };
}

async function getDestinations(userId) {
  const userResult = await query('SELECT email,email_verified,display_name,timezone FROM users WHERE id=$1', [userId]);
  const user = userResult.rows[0];
  if (!user || !user.email_verified) throw Object.assign(new Error('Verify your account email before sending reports.'), { status: 403 });
  const extra = await query(`SELECT email,unsubscribe_token_hash FROM email_report_recipients WHERE user_id=$1 AND status='active'`, [userId]);
  return { user, destinations: [{ email: user.email, unsubscribeToken: null }, ...extra.rows.map(row => ({ email: row.email, unsubscribeToken: makeUnsubscribeToken(userId, row.email) }))] };
}

async function sendReportToUser(userId, schedule, forcedFormat = null) {
  const { user, destinations } = await getDestinations(userId);
  const report = await renderReport(userId, user, schedule);
  const format = forcedFormat || schedule.format || 'html';
  for (const destination of destinations) {
    const base = process.env.APP_BASE_URL || 'https://plothour.com';
    const unsubscribe = destination.unsubscribeToken ? `${base}/api/email-reports/recipient/unsubscribe?token=${destination.unsubscribeToken}` : '';
    await sendEmail({ to: destination.email, subject: report.subject, text: unsubscribe ? `${report.text}\nUnsubscribe: ${unsubscribe}` : report.text, html: format === 'html' ? (unsubscribe ? report.html.replace('Manage email reports in PlotHour.', `<a href="${unsubscribe}">Unsubscribe from these reports</a>`) : report.html) : undefined });
  }
  return { count: destinations.length, subject: report.subject };
}

// Verification is deliberately a one-time recipient opt-in. Later scheduled
// reports are sent only while that recipient remains active.
emailReportsRouter.get('/recipient/verify', async (req, res) => {
  const token = String(req.query.token || '');
  if (!/^[\da-f]{64}$/i.test(token)) return res.status(400).send('This invitation link is invalid or expired.');
  try {
    const result = await query(`SELECT email FROM email_report_recipients WHERE token_hash=$1 AND status='pending'`, [hashToken(token)]);
    if (!result.rows.length) return res.status(410).send('This invitation is no longer available. Ask the PlotHour user to send a new one.');
    return res.send(`<main style="font:16px Arial,sans-serif;max-width:520px;margin:12vh auto;padding:28px;color:#252843"><h1>Accept PlotHour reports</h1><p>Confirm that you want this address to receive study reports.</p><form method="post" action="/api/email-reports/recipient/verify"><input type="hidden" name="token" value="${token}"><button style="padding:12px 18px;border:0;border-radius:8px;background:#6f78d1;color:white;font-weight:700">Accept invitation</button></form></main>`);
  } catch (error) { console.error('[Email recipient verify]', error); return res.status(500).send('We could not confirm this address. Please try again.'); }
});

emailReportsRouter.post('/recipient/verify', async (req, res) => {
  const token = String(req.body?.token || '');
  if (!/^[\da-f]{64}$/i.test(token)) return res.status(400).send('This invitation link is invalid or expired.');
  try {
    const result = await query(`UPDATE email_report_recipients SET status='active',accepted_at=now(),token_hash=NULL WHERE token_hash=$1 AND status='pending' RETURNING email`, [hashToken(token)]);
    if (!result.rows.length) return res.status(410).send('This invitation is no longer available. Ask the PlotHour user to send a new one.');
    return res.send('<main style="font:16px Arial,sans-serif;max-width:520px;margin:12vh auto;padding:28px;color:#252843"><h1>You’re subscribed to PlotHour reports</h1><p>This address can now receive reports that were shared with you. You can unsubscribe from any report email.</p></main>');
  } catch (error) { console.error('[Email recipient verify]', error); return res.status(500).send('We could not confirm this address. Please try again.'); }
});

emailReportsRouter.get('/recipient/unsubscribe', async (req, res) => {
  const token = String(req.query.token || '');
  if (!/^[\da-f]{64}$/i.test(token)) return res.status(400).send('This unsubscribe link is invalid.');
  return res.send(`<main style="font:16px Arial,sans-serif;max-width:520px;margin:12vh auto;padding:28px;color:#252843"><h1>Stop PlotHour reports?</h1><p>Confirm to stop report emails to this address.</p><form method="post" action="/api/email-reports/recipient/unsubscribe"><input type="hidden" name="token" value="${token}"><button style="padding:12px 18px;border:0;border-radius:8px;background:#6f78d1;color:white;font-weight:700">Unsubscribe</button></form></main>`);
});

emailReportsRouter.post('/recipient/unsubscribe', async (req, res) => {
  const token = String(req.body?.token || '');
  if (!/^[\da-f]{64}$/i.test(token)) return res.status(400).send('This unsubscribe link is invalid.');
  try {
    const result = await query(`UPDATE email_report_recipients SET status='unsubscribed',token_hash=NULL,unsubscribe_token_hash=NULL WHERE unsubscribe_token_hash=$1 RETURNING email`, [hashToken(token)]);
    return res.send(result.rows.length ? '<main style="font:16px Arial,sans-serif;max-width:520px;margin:12vh auto;padding:28px;color:#252843"><h1>You’re unsubscribed</h1><p>No more PlotHour reports will be sent to this address.</p></main>' : 'This link is invalid or already used.');
  } catch (error) { console.error('[Email recipient unsubscribe]', error); return res.status(500).send('Could not update email preferences.'); }
});

emailReportsRouter.use(authenticate);

emailReportsRouter.get('/tasks', async (req, res) => {
  try {
    const result = await query(`SELECT id,title,project_name,due_date,reminder_date,completed FROM user_tasks WHERE user_id=$1 AND completed=false AND (due_date IS NOT NULL OR reminder_date IS NOT NULL) ORDER BY due_date NULLS LAST,created_at DESC`, [req.userId]);
    return res.json({ tasks: result.rows });
  } catch (error) { console.error('[Email report tasks]', error); return res.status(500).json({ error: 'Could not load tasks for reminder settings.' }); }
});

emailReportsRouter.get('/friends', async (req, res) => {
  try {
    const result = await query(`SELECT u.id,u.display_name FROM friendships f JOIN users u ON u.id=CASE WHEN f.user_low_id=$1::uuid THEN f.user_high_id ELSE f.user_low_id END WHERE f.user_low_id=$1 OR f.user_high_id=$1 ORDER BY u.display_name`, [req.userId]);
    return res.json({ friends: result.rows });
  } catch (error) { console.error('[Email report friends]', error); return res.status(500).json({ error: 'Could not load study partners.' }); }
});

emailReportsRouter.get('/', async (req, res) => {
  try {
    const [settings, recipients, user] = await Promise.all([
      query(`SELECT preferences->'emailReports' AS settings FROM user_preferences WHERE user_id=$1`, [req.userId]),
      query(`SELECT id,email,status,invited_at,accepted_at FROM email_report_recipients WHERE user_id=$1 ORDER BY invited_at`, [req.userId]),
      query(`SELECT email,email_verified,timezone FROM users WHERE id=$1`, [req.userId]),
    ]);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ settings: settings.rows[0]?.settings || null, recipients: recipients.rows, account: user.rows[0] || null, deliveryConfigured: emailDeliveryConfigured() });
  } catch (error) { console.error('[Email reports GET]', error); return res.status(500).json({ error: 'Could not load email-report settings.' }); }
});

emailReportsRouter.put('/', async (req, res) => {
  const settings = req.body?.settings;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings) || !Array.isArray(settings.schedules) || settings.schedules.length > 20 || !Array.isArray(settings.taskRules) || settings.taskRules.length > 500) return res.status(400).json({ error: 'Email-report settings are incomplete or too large.' });
  if (settings.schedules.some(item => !validId(item.id) || !allowedReportTypes.has(item.type) || !['Daily','Weekly','Monthly','Quarterly','Yearly'].includes(item.frequency) || !validTime(item.time))) return res.status(400).json({ error: 'Check your report schedule options.' });
  if (settings.taskRules.some(rule => !validTaskId(rule.id) || typeof rule.enabled !== 'boolean' || !Array.isArray(rule.reminders) || rule.reminders.length > 20 || rule.reminders.some(reminder => !validId(reminder.id) || !validTime(reminder.time) || !(reminder.offset === 'On due date' || /^(?:[1-9]|[1-9]\d|[12]\d\d|3[0-5]\d|36[0-5]) days before$/.test(reminder.offset))))) return res.status(400).json({ error: 'Check your task reminder rules.' });
  if (typeof settings.enabled !== 'boolean' || typeof settings.allTasksEnabled !== 'boolean' || !['html','text'].includes(settings.format)) return res.status(400).json({ error: 'Check your email delivery preferences.' });
  if (settings.dateFormat && !supportedDateFormats.has(settings.dateFormat)) return res.status(400).json({ error: 'Choose a supported date format.' });
  if (settings.locale && safeLocale(settings.locale) !== settings.locale) return res.status(400).json({ error: 'Choose a valid language and region.' });
  if (settings.timezone) { try { new Intl.DateTimeFormat('en-US', { timeZone: settings.timezone }).format(); } catch { return res.status(400).json({ error: 'Choose a valid local timezone.' }); } }
  try {
    await query(`INSERT INTO user_preferences(user_id,preferences) VALUES($1,jsonb_build_object('emailReports',$2::jsonb)) ON CONFLICT(user_id) DO UPDATE SET preferences=user_preferences.preferences || jsonb_build_object('emailReports',$2::jsonb),updated_at=now()`, [req.userId, JSON.stringify(settings)]);
    return res.json({ saved: true });
  } catch (error) { console.error('[Email reports PUT]', error); return res.status(500).json({ error: 'Could not save email-report settings.' }); }
});

emailReportsRouter.post('/recipients', async (req, res) => {
  const emails = [...new Set((Array.isArray(req.body?.emails) ? req.body.emails : []).map(value => String(value).trim().toLowerCase()))];
  if (!emails.length || emails.length > 25 || emails.some(email => email.length > 254 || !emailPattern.test(email))) return res.status(400).json({ error: 'Add between 1 and 25 valid email addresses.' });
  if (!emailDeliveryConfigured()) return res.status(503).json({ error: 'Email delivery is not configured on this server.' });
  try {
    const recentInvites = await query(`SELECT COUNT(*)::int AS count FROM email_report_recipients WHERE user_id=$1 AND invited_at > now() - interval '24 hours'`, [req.userId]);
    if (recentInvites.rows[0].count + emails.length > 50) return res.status(429).json({ error: 'For safety, you can send up to 50 recipient invitations per day.' });
    const account = await query('SELECT email FROM users WHERE id=$1', [req.userId]);
    const accountEmail = account.rows[0]?.email.toLowerCase();
    const links = [];
    for (const email of emails.filter(address => address !== accountEmail)) {
      const token = randomBytes(32).toString('hex');
      const unsubscribeTokenHash = hashToken(makeUnsubscribeToken(req.userId, email));
      const inserted = await query(`INSERT INTO email_report_recipients(user_id,email,status,token_hash,unsubscribe_token_hash) VALUES($1,$2,'pending',$3,$4) ON CONFLICT(user_id,email) DO NOTHING RETURNING id,email`, [req.userId, email, hashToken(token), unsubscribeTokenHash]);
      if (!inserted.rows.length) continue;
      const base = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
      const verifyUrl = `${base}/api/email-reports/recipient/verify?token=${token}`;
      const safeAddress = escapeEmailHtml(email);
      try { await sendEmail({ to: email, subject: 'Accept PlotHour study reports', text: `A PlotHour user invited this address to receive study reports. Accept once: ${verifyUrl}\n\nIf you don't recognize this request, ignore this email.`, html: `<main style="font:15px Arial,sans-serif;max-width:540px;margin:24px auto;padding:24px;color:#252843"><h1 style="color:#5964bb">PlotHour report invitation</h1><p>${safeAddress} was invited to receive study reports from a PlotHour user.</p><p><a href="${verifyUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#6f78d1;color:white;text-decoration:none">Accept invitation</a></p><p>If you don't recognize this message, ignore it.</p></main>` }); }
      catch (error) { await query(`DELETE FROM email_report_recipients WHERE id=$1 AND status='pending'`, [inserted.rows[0].id]); throw error; }
      links.push(inserted.rows[0]);
    }
    return res.status(202).json({ invited: links.length, recipients: links });
  } catch (error) { console.error('[Email recipient invite]', error); return res.status(500).json({ error: error.message || 'Could not send recipient invitations.' }); }
});

emailReportsRouter.delete('/recipients/:id', async (req, res) => {
  if (!/^[\da-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: 'Invalid recipient.' });
  try { await query('DELETE FROM email_report_recipients WHERE id=$1 AND user_id=$2', [req.params.id, req.userId]); return res.sendStatus(204); }
  catch (error) { console.error('[Email recipient remove]', error); return res.status(500).json({ error: 'Could not remove recipient.' }); }
});

emailReportsRouter.post('/send', async (req, res) => {
  const schedule = req.body?.schedule;
  if (!schedule || !allowedReportTypes.has(schedule.type)) return res.status(400).json({ error: 'Select a valid report.' });
  if (!emailDeliveryConfigured()) return res.status(503).json({ error: 'Email delivery is not configured on this server.' });
  try {
    const saved = await query(`SELECT preferences->'emailReports' AS settings FROM user_preferences WHERE user_id=$1`, [req.userId]);
    schedule.timezone = schedule.timezone || saved.rows[0]?.settings?.timezone || 'UTC';
    schedule.dateFormat = schedule.dateFormat || saved.rows[0]?.settings?.dateFormat || 'system';
    schedule.locale = schedule.locale || saved.rows[0]?.settings?.locale || 'en-US';
    const recentSends = await query(`SELECT COUNT(*)::int AS count FROM email_report_deliveries WHERE user_id=$1 AND schedule_id='manual' AND status='sent' AND delivered_at > now() - interval '1 hour'`, [req.userId]);
    if (recentSends.rows[0].count >= 10) return res.status(429).json({ error: 'You’ve reached the 10 on-demand reports per hour limit.' });
    const result = await sendReportToUser(req.userId, schedule);
    await query(`INSERT INTO email_report_deliveries(user_id,schedule_id,period_key,status) VALUES($1,'manual',$2,'sent')`, [req.userId, randomBytes(12).toString('hex')]);
    return res.json({ sent: true, ...result });
  }
  catch (error) { console.error('[Send email report]', error); return res.status(error.status || 500).json({ error: error.message || 'Could not send this report.' }); }
});

function scheduleOccurrence(schedule, now, timezone) {
  const parts = localClock(now, timezone);
  if (parts.hour === '24') parts.hour = '00';
  const today = dateKeyAt(now, timezone);
  let scheduledDate = today;
  if (schedule.frequency === 'Weekly') {
    const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const weekdayIndex = weekdays.indexOf(parts.weekday);
    const desiredIndex = weekdays.indexOf(schedule.day);
    if (desiredIndex < 0) return null;
    scheduledDate = addDays(today, -((weekdayIndex - desiredIndex + 7) % 7));
  } else if (schedule.frequency === 'Monthly') {
    const lastDay = new Date(Date.UTC(Number(parts.year), Number(parts.month), 0)).getUTCDate();
    const targetDay = schedule.day === '15th of the month' ? 15 : schedule.day === 'Last day of month' ? lastDay : 1;
    scheduledDate = `${parts.year}-${parts.month}-${String(targetDay).padStart(2, '0')}`;
  } else if (schedule.frequency === 'Quarterly') {
    const startMonth = Math.floor((Number(parts.month) - 1) / 3) * 3 + 1;
    const targetMonth = schedule.day === 'Last day of quarter' ? startMonth + 2 : startMonth;
    const targetDay = schedule.day === 'Last day of quarter' ? new Date(Date.UTC(Number(parts.year), targetMonth, 0)).getUTCDate() : 1;
    scheduledDate = `${parts.year}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
  } else if (schedule.frequency === 'Yearly') {
    const targetMonth = schedule.day === 'December 31' ? 12 : 1;
    const targetDay = schedule.day === 'January 31' || schedule.day === 'December 31' ? 31 : 1;
    scheduledDate = `${parts.year}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
  }
  if (today < scheduledDate || `${parts.hour}:${parts.minute}` < schedule.time) return null;
  return scheduledDate;
}

function localTimeReached(time, now, timezone) {
  const parts = localClock(now, timezone);
  if (parts.hour === '24') parts.hour = '00';
  return `${parts.hour}:${parts.minute}` >= time;
}

export async function processScheduledEmailReports() {
  await query(`DELETE FROM email_report_deliveries WHERE status='processing' AND delivered_at < now() - interval '15 minutes'`);
  const configurations = await query(`SELECT u.id,u.email,u.display_name,u.timezone,u.email_verified,p.preferences->'emailReports' AS settings FROM user_preferences p JOIN users u ON u.id=p.user_id WHERE p.preferences ? 'emailReports'`);
  for (const user of configurations.rows) {
    const settings = user.settings || {};
    if (!settings.enabled || !user.email_verified) continue;
    for (const schedule of settings.schedules || []) {
      const timezone = settings.timezone || user.timezone || 'UTC';
      const occurrenceDate = !settings.enabled || !schedule.enabled ? null : scheduleOccurrence(schedule, new Date(), timezone);
      if (!occurrenceDate) continue;
      const periodKey = occurrenceDate;
      const claimed = await query(`INSERT INTO email_report_deliveries(user_id,schedule_id,period_key) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id`, [user.id, schedule.id, periodKey]);
      if (!claimed.rows.length) continue;
      try { await sendReportToUser(user.id, { ...schedule, timezone, dateFormat: settings.dateFormat, locale: safeLocale(settings.locale), format: settings.format || 'html' }); await query(`UPDATE email_report_deliveries SET status='sent',delivered_at=now() WHERE id=$1`, [claimed.rows[0].id]); }
      catch (error) { await query('DELETE FROM email_report_deliveries WHERE id=$1', [claimed.rows[0].id]); console.error('[Scheduled email report]', error.message); }
    }
    if (!settings.enabled || !emailDeliveryConfigured()) continue;
    const timezone = settings.timezone || user.timezone || 'UTC';
    const tasksResult = await query(`SELECT id,title,project_name,due_date,reminder_date FROM user_tasks WHERE user_id=$1 AND completed=false AND (due_date IS NOT NULL OR reminder_date IS NOT NULL)`, [user.id]);
    const rulesByTask = new Map((settings.taskRules || []).map(rule => [rule.id, rule]));
    for (const task of tasksResult.rows) {
      const taskRule = rulesByTask.get(task.id);
      if (taskRule && !taskRule.enabled) continue;
      const reminders = [...(taskRule?.reminders || (settings.allTasksEnabled && task.due_date ? [3,2,1,0].map(days => ({ id: `default-${days}`, offset: days ? `${days} days before` : 'On due date', time: '08:00' })) : [])), ...(task.reminder_date ? [{ id: 'existing-reminder-date', offset: 'On reminder date', date: String(task.reminder_date).slice(0,10), time: '08:00' }] : [])];
        const dueDate = task.due_date ? String(task.due_date).slice(0, 10) : 'No due date';
        const dueDateLabel = task.due_date ? formatDateKey(dueDate, settings.dateFormat, safeLocale(settings.locale)) : dueDate;
      const today = localToday(timezone);
      for (const reminder of reminders) {
        const days = reminder.offset === 'On due date' ? 0 : Number.parseInt(reminder.offset, 10);
        const targetDate = reminder.date || (Number.isFinite(days) && task.due_date ? addDays(dueDate, -days) : '');
        if (!targetDate || targetDate !== today || !localTimeReached(reminder.time, new Date(), timezone)) continue;
        const key = `task-${task.id}-${reminder.id}`; const period = `${dueDate}-${reminder.offset}`;
        const claimed = await query(`INSERT INTO email_report_deliveries(user_id,schedule_id,period_key) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id`, [user.id, key, period]);
        if (!claimed.rows.length) continue;
        const subject = `Task reminder · ${task.title}`;
        const text = `${task.title}\n${task.project_name ? `${task.project_name}\n` : ''}Due ${dueDateLabel}. This is your ${reminder.offset.toLowerCase()} reminder.\n\nManage your task reminders in PlotHour.`;
        const html = `<main style="font:15px Arial,sans-serif;max-width:560px;margin:24px auto;padding:24px;color:#252843">${emailBrandHeader()}<h1 style="font-size:23px">${escapeEmailHtml(task.title)}</h1><p>${escapeEmailHtml(task.project_name || 'Personal task')} · due ${escapeEmailHtml(dueDateLabel)}</p><div style="padding:14px;background:#f2f3fc;border-left:3px solid #6f78d1;border-radius:8px">${escapeEmailHtml(reminder.offset)} · ${escapeEmailHtml(reminder.time)}</div><p style="color:#82869a;font-size:12px">Manage your task reminders in PlotHour.</p></main>`;
        try { const { destinations } = await getDestinations(user.id); for (const destination of destinations) { const base = process.env.APP_BASE_URL || 'https://plothour.com'; const unsubscribe = destination.unsubscribeToken ? `${base}/api/email-reports/recipient/unsubscribe?token=${destination.unsubscribeToken}` : ''; const personalizedHtml = html.replace('Manage your task reminders in PlotHour.', unsubscribe ? `<a href="${unsubscribe}">Unsubscribe</a>` : 'Manage your task reminders in PlotHour.'); await sendEmail({ to: destination.email, subject, text: unsubscribe ? `${text}\nUnsubscribe: ${unsubscribe}` : text, html: settings.format === 'text' ? undefined : personalizedHtml }); } await query(`UPDATE email_report_deliveries SET status='sent',delivered_at=now() WHERE id=$1`, [claimed.rows[0].id]); }
        catch (error) { await query('DELETE FROM email_report_deliveries WHERE id=$1', [claimed.rows[0].id]); console.error('[Scheduled task reminder]', error.message); }
      }
    }
  }
}

