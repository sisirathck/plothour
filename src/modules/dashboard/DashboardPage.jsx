import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Sun,
  Moon,
  Settings,
  LogOut,
  Sparkles,
  Zap,
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Pin,
  Clock,
  Target,
  Trophy,
  Flame,
  ChevronDown,
  Calendar,
  Activity,
  Timer,
  Compass,
  Layers,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { getSiteFontStyle, useSiteCustomization } from '../../context/SiteCustomizationContext';
import { CalendarPage } from '../calendar/CalendarPage';
import { formatDisplayDate } from '../../utils/dateFormat';
import './Dashboard.css';

/* ── Helpers ─────────────────────────────────── */
const fmtDur = (s) => {
  if (!s || s <= 0) return '0m';
  if (s < 60) return `${Math.floor(s)}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
};

const formatHoursTick = (seconds) => {
  const hours = seconds / 3600;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
};

const getHourTicks = (seconds) => {
  const hours = seconds / 3600;
  const step = hours <= 3 ? 0.5 : hours <= 6 ? 1 : Math.ceil(hours / 5);
  const max = Math.max(step, Math.ceil(hours / step) * step);
  return Array.from({ length: Math.round(max / step) + 1 }, (_, index) => index * step);
};

const percentComparison = (current, previous, periodLabel) => {
  if (previous <= 0) {
    return {
      label: current > 0 ? `New · no time ${periodLabel}` : `No change ${periodLabel}`,
      tone: current > 0 ? 'positive' : 'neutral',
      direction: current > 0 ? 'up' : 'neutral',
    };
  }
  const change = Math.round(((current - previous) / previous) * 100);
  return {
    label: `${change > 0 ? '+' : ''}${change}% ${periodLabel}`,
    tone: change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral',
    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
  };
};

const snapshotPeriodSeconds = (entries, start, end) => entries.reduce((total, entry) => {
  const startedAt = new Date(entry.startedAt).getTime();
  if (Number(entry.durationSeconds) <= 0 || !Number.isFinite(startedAt) || startedAt < start.getTime() || startedAt >= end.getTime()) return total;
  return total + (Number(entry.durationSeconds) || 0);
}, 0);

const useSvgChartTooltip = () => {
  const [tooltip, setTooltip] = useState(null);
  const show = (event, title, details) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX || bounds.left + bounds.width / 2;
    const y = event.clientY || bounds.top + bounds.height / 2;
    setTooltip({
      title,
      details,
      x: Math.max(8, Math.min(x + 14, window.innerWidth - 248)),
      y: Math.max(8, Math.min(y + 14, window.innerHeight - 76)),
    });
  };
  const hide = () => setTooltip(null);
  const node = tooltip && createPortal(
    <div className="db-chart-tooltip" role="tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
      <strong>{tooltip.title}</strong>
      <span>{tooltip.details}</span>
    </div>,
    document.querySelector('.db-apple-root') || document.body
  );
  return { show, hide, node };
};

const SnapshotPanel = ({ snapshotMetrics }) => {
  const weekMetric = snapshotMetrics.find((m) => m.id === 'time-week');
  const weekSeconds = weekMetric ? (weekMetric.weekDays || []).reduce((s, d) => s + d.seconds, 0) : 0;
  const weeklyPlanned = weekMetric?.weeklyPlannedSeconds || 0;
  const weekDaysElapsed = weekMetric?.weekDays?.filter((d) => d.isPastOrToday).length || 1;
  const weekDaysTotal = 7;
  const weekDaysRemaining = Math.max(0, weekDaysTotal - weekDaysElapsed);
  const goalProgressRows = weekMetric?.goalProgressRows || [];
  const goalsBehindCount = goalProgressRows.filter((goal) => goal.status === 'behind').length;
  const goalsOnTrackCount = goalProgressRows.filter((goal) => goal.status === 'on-track').length;
  const goalsMetCount = goalProgressRows.filter((goal) => goal.status === 'met').length;
  const goalsUpcomingCount = goalProgressRows.filter((goal) => goal.status === 'upcoming').length;

  // Insight computation
  let insightText = null;
  let insightKind = 'neutral'; // 'good' | 'warn' | 'neutral'
  if (weeklyPlanned > 0) {
    const expectedByNow = (weeklyPlanned * weekDaysElapsed) / weekDaysTotal;
    const deficit = weeklyPlanned - weekSeconds;
    const pace = weekSeconds / Math.max(1, weekDaysElapsed);
    const projectedEnd = pace * weekDaysTotal;

    if (weekSeconds >= weeklyPlanned) {
      insightKind = 'good';
      insightText = 'Weekly goal reached — keep the momentum.';
    } else if (weekSeconds >= expectedByNow * 0.92) {
      insightKind = 'good';
      const hoursPerDay = Math.ceil((pace / 3600) * 10) / 10;
      insightText = `On pace · ${fmtDur(pace)}/day · projecting ${fmtDur(projectedEnd)} by week end`;
    } else if (weekDaysRemaining > 0) {
      const neededPerDay = deficit / weekDaysRemaining;
      insightKind = 'warn';
      insightText = `${fmtDur(deficit)} remaining · needs ${fmtDur(neededPerDay)}/day over ${weekDaysRemaining} day${weekDaysRemaining !== 1 ? 's' : ''}`;
    } else {
      insightKind = 'warn';
      insightText = `${fmtDur(deficit)} short of weekly goal`;
    }
  }

  return (
    <div className="db-snapshot-card db-card">
      <div className="db-snapshot-header">
        <div className="db-snapshot-header-left">
          <span className="db-snapshot-eyebrow">SNAPSHOT</span>
          <h3 className="db-snapshot-title">Weekly &amp; Monthly Overview</h3>
        </div>
        {insightText && (
          <div className={`db-snapshot-insight-chip db-snapshot-insight-chip--${insightKind}`}>
            <span className={`db-snapshot-insight-dot db-snapshot-insight-dot--${insightKind}`} />
            <span>{insightText}</span>
          </div>
        )}
      </div>

      <div className="db-snapshot-grid" aria-label="Weekly and monthly study snapshot">
        {snapshotMetrics.map((metric) => {
          const isWeek = metric.id === 'time-week';
          const isMonth = metric.id === 'time-month';

          // Compact comparison: only show percentage number, no label text
          let compactDelta = null;
          if (metric.comparison && metric.comparison.tone !== 'neutral') {
            const raw = metric.comparison.label.match(/([+-]?\d+)%/);
            if (raw) {
              compactDelta = { value: raw[1] + '%', tone: metric.comparison.tone };
            }
          }
          let sessionDelta = null;
          if (metric.sessionComparison && metric.sessionComparison.tone !== 'neutral') {
            const raw = metric.sessionComparison.label.match(/([+-]?\d+)%/);
            if (raw) sessionDelta = { value: `${raw[1]}%`, tone: metric.sessionComparison.tone };
          }

          return (
            <article className="db-snap-card" key={metric.label}>
              <div className="db-snap-card-top">
                <span className="db-snap-label">{metric.label}</span>
                {compactDelta && (
                  <span className={`db-snap-delta db-snap-delta--${compactDelta.tone}`}>
                    {compactDelta.tone === 'positive' ? '↑' : '↓'} {compactDelta.value}
                  </span>
                )}
              </div>

              <div className="db-snap-value-row">
                <strong className="db-snap-value">{metric.value}</strong>
                {metric.subDetail && <span className="db-snap-badge">{metric.subDetail}</span>}
              </div>

              {isWeek && metric.weekDays && (
                <div className="db-snap-days">
                  {metric.weekDays.map((d) => (
                    <div
                      key={d.key}
                      className={`db-snap-day${d.active ? ' is-active' : ''}${d.isToday ? ' is-today' : ''}${!d.isPastOrToday ? ' is-future' : ''}`}
                      title={`${d.fullDay}: ${fmtDur(d.seconds)}`}
                    >
                      <span className="db-snap-day-label">{d.label}</span>
                      <span className="db-snap-day-pip" />
                    </div>
                  ))}
                </div>
              )}

              {isMonth && (
                <div className="db-snap-bar-wrap">
                  <div className="db-snap-bar">
                    <div className="db-snap-bar-fill" style={{ width: `${Math.min(100, Math.round((new Date().getDate() / 31) * 100))}%` }} />
                  </div>
                  <small className="db-snap-detail">{metric.detail}</small>
                </div>
              )}

              {metric.id === 'daily-avg' && (
                <small className="db-snap-detail">{metric.detail}</small>
              )}

              {metric.id === 'daily-avg' && (
                <div className="db-snap-session-summary">
                  <div className="db-snap-session-heading">
                    <span className="db-snap-session-label">AVERAGE SESSION</span>
                    <strong>{metric.averageSessionValue}</strong>
                    {metric.averageSessionTier && <span className="db-snap-badge">{metric.averageSessionTier}</span>}
                    {sessionDelta && (
                      <span className={`db-snap-delta db-snap-delta--${sessionDelta.tone}`}>
                        {sessionDelta.tone === 'positive' ? '↑' : '↓'} {sessionDelta.value}
                      </span>
                    )}
                  </div>
                  <small>{metric.sessionCount} {metric.sessionCount === 1 ? 'session' : 'sessions'} this week</small>
                </div>
              )}
            </article>
          );
        })}
        <article className="db-snap-card db-snap-goal-card">
          <div className="db-snap-card-top">
            <span className="db-snap-label">PROJECT GOAL PACE</span>
            <span className={`db-snap-goal-summary${goalsBehindCount ? ' is-behind' : ''}`}>
              {goalProgressRows.length ? [
                goalsBehindCount ? `${goalsBehindCount} behind` : '',
                goalsOnTrackCount ? `${goalsOnTrackCount} on pace` : '',
                goalsMetCount ? `${goalsMetCount} met` : '',
                goalsUpcomingCount ? `${goalsUpcomingCount} upcoming` : '',
              ].filter(Boolean).join(' · ') : 'No recurring goals set'}
            </span>
          </div>
          {goalProgressRows.length ? (
            <div className="db-snap-goal-list">
              {goalProgressRows.map((goal) => (
                <div className={`db-snap-goal-row is-${goal.status}`} key={goal.id}>
                  <div className="db-snap-goal-row-heading">
                    <strong title={`${goal.projectName} · ${goal.subjectName}`}>{goal.projectName} <span>·</span> {goal.subjectName}</strong>
                    <span className={`db-snap-goal-status is-${goal.status}`}>{goal.statusLabel}</span>
                  </div>
                  <div className="db-snap-goal-track"><span style={{ width: `${goal.progress}%` }} /></div>
                  <div className="db-snap-goal-row-meta"><span>{fmtDur(goal.loggedSeconds)} of {fmtDur(goal.targetSeconds)} this week</span><span>{goal.statusDetail}</span></div>
                </div>
              ))}
            </div>
          ) : (
            <p className="db-snap-goal-empty">Add daily or weekly goals to subprojects in Manage to see whether each plan is on pace.</p>
          )}
        </article>
      </div>
    </div>
  );
};

const WeeklyTrendGraph = ({ weeks, hasData, onStart, rangeLabel, periodUnit = 'week' }) => {
  const chartTooltip = useSvgChartTooltip();
  const width = Math.max(520, weeks.length * 64);
  const height = 300;
  const margin = { top: 20, right: 22, bottom: 42, left: 48 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxSeconds = Math.max(1800, ...weeks.flatMap((week) => [week.seconds, week.averageSeconds]));
  const hourTicks = getHourTicks(maxSeconds);
  const maxHours = hourTicks[hourTicks.length - 1];
  const xFor = (index) => margin.left + ((index + 0.5) / Math.max(1, weeks.length)) * plotWidth;
  const yFor = (seconds) => margin.top + plotHeight - (seconds / (maxHours * 3600)) * plotHeight;
  const linePoints = weeks.map((week, index) => `${xFor(index)},${yFor(week.averageSeconds)}`).join(' ');

  return (
    <div className="db-chart-card db-card">
      <div className="db-chart-heading db-chart-heading-stack">
        <div>
          <h3 className="db-section-title">{periodUnit === 'week' ? 'Weekly Study Trend' : 'Study Trend'}</h3>
          <span className="db-section-meta">{rangeLabel} · {periodUnit === 'week' ? `${weeks[0]?.weekStartLabel || 'Monday'}-start weeks` : `${periodUnit} totals`}</span>
        </div>
        <div className="db-chart-legend" aria-label="Chart legend">
          <span><i className="db-legend-bar" /> Study hours</span>
          <span><i className="db-legend-line" /> 4-{periodUnit} average</span>
        </div>
      </div>
      {!hasData ? <QuietEmptyState message="No weekly activity to chart in this range." onStart={onStart} /> : <div className="db-chart-scroll">
        <svg className="db-svg-chart db-trend-chart" style={{ width: `${width}px` }} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Study hours and four-${periodUnit} moving average`}>
          {hourTicks.map((value) => {
            const y = margin.top + plotHeight - (value / maxHours) * plotHeight;
            return (
              <g key={value}>
                <line className="db-chart-grid-line" x1={margin.left} x2={width - margin.right} y1={y} y2={y} />
                <text className="db-chart-axis-label" x={margin.left - 8} y={y + 4} textAnchor="end">{formatHoursTick(value * 3600)}</text>
              </g>
            );
          })}
          {weeks.map((week, index) => {
            const slot = plotWidth / weeks.length;
            const barWidth = slot * 0.5;
            const barHeight = (week.seconds / (maxHours * 3600)) * plotHeight;
            const x = xFor(index) - barWidth / 2;
            const y = margin.top + plotHeight - barHeight;
            return (
              <g key={week.key}>
                <rect
                  className="db-chart-bar db-chart-bar-muted"
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(week.seconds ? 2 : 0, barHeight)}
                  rx="4"
                  tabIndex="0"
                  aria-label={`${periodUnit === 'week' ? 'Week of ' : ''}${week.startLabel}: ${fmtDur(week.seconds)}, ${week.sessions} ${week.sessions === 1 ? 'session' : 'sessions'}`}
                  onMouseEnter={(event) => chartTooltip.show(event, `${periodUnit === 'week' ? 'Week of ' : ''}${week.startLabel}`, `${fmtDur(week.seconds)} · ${week.sessions} ${week.sessions === 1 ? 'session' : 'sessions'}`)}
                  onMouseMove={(event) => chartTooltip.show(event, `${periodUnit === 'week' ? 'Week of ' : ''}${week.startLabel}`, `${fmtDur(week.seconds)} · ${week.sessions} ${week.sessions === 1 ? 'session' : 'sessions'}`)}
                  onMouseLeave={chartTooltip.hide}
                  onFocus={(event) => chartTooltip.show(event, `Week of ${week.startLabel}`, `${fmtDur(week.seconds)} · ${week.sessions} ${week.sessions === 1 ? 'session' : 'sessions'}`)}
                  onBlur={chartTooltip.hide}
                >
                  <title>{`${periodUnit === 'week' ? 'Week of ' : ''}${week.startLabel} · ${fmtDur(week.seconds)} · ${week.sessions} sessions`}</title>
                </rect>
                {(index === 0 || index % Math.max(1, Math.ceil(weeks.length / 8)) === 0 || index === weeks.length - 1) && (
                  <text className="db-chart-axis-label" x={xFor(index)} y={height - 12} textAnchor="middle">{week.axisLabel}</text>
                )}
                <circle
                  className="db-chart-line-hit-target"
                  cx={xFor(index)}
                  cy={yFor(week.averageSeconds)}
                  r="10"
                  tabIndex="0"
                  aria-label={`Four-${periodUnit} average through ${week.startLabel}: ${fmtDur(week.averageSeconds)}`}
                  onMouseEnter={(event) => chartTooltip.show(event, `4-${periodUnit} average through ${week.startLabel}`, fmtDur(week.averageSeconds))}
                  onMouseMove={(event) => chartTooltip.show(event, `4-${periodUnit} average through ${week.startLabel}`, fmtDur(week.averageSeconds))}
                  onMouseLeave={chartTooltip.hide}
                  onFocus={(event) => chartTooltip.show(event, `4-week average through ${week.startLabel}`, fmtDur(week.averageSeconds))}
                  onBlur={chartTooltip.hide}
                />
                <circle className="db-chart-line-point" cx={xFor(index)} cy={yFor(week.averageSeconds)} r="3.2" pointerEvents="none">
                  <title>{`4-week average through ${week.startLabel} · ${fmtDur(week.averageSeconds)}`}</title>
                </circle>
              </g>
            );
          })}
          <polyline className="db-chart-average-line" points={linePoints} />
        </svg>
        {chartTooltip.node}
      </div>}
    </div>
  );
};

const SessionLengthGraph = ({ buckets, hasData, onStart }) => {
  const width = 720;
  const height = 300;
  const margin = { top: 22, right: 18, bottom: 44, left: 42 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxCount = Math.max(1, ...buckets.map((bucket) => bucket.count));
  const tickStep = Math.max(1, Math.ceil(maxCount / 4));
  const maxY = tickStep * 4;
  const slotWidth = plotWidth / buckets.length;
  const barWidth = slotWidth * 0.56;

  return (
    <div className="db-chart-card db-card">
      <div className="db-chart-heading db-chart-heading-stack">
        <div>
          <h3 className="db-section-title">Session Length</h3>
          <span className="db-section-meta">Distribution across sessions in the selected range</span>
        </div>
      </div>
      {!hasData ? <QuietEmptyState message="Session length appears after your first tracked session." onStart={onStart} /> : <div className="db-chart-scroll">
        <svg className="db-svg-chart db-session-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Number of sessions by session length">
          {Array.from({ length: 5 }, (_, index) => {
            const value = (maxY * index) / 4;
            const y = margin.top + plotHeight - (value / maxY) * plotHeight;
            return (
              <g key={index}>
                <line className="db-chart-grid-line" x1={margin.left} x2={width - margin.right} y1={y} y2={y} />
                <text className="db-chart-axis-label" x={margin.left - 8} y={y + 4} textAnchor="end">{Math.round(value)}</text>
              </g>
            );
          })}
          {buckets.map((bucket, index) => {
            const barHeight = (bucket.count / maxY) * plotHeight;
            const x = margin.left + index * slotWidth + (slotWidth - barWidth) / 2;
            const y = margin.top + plotHeight - barHeight;
            return (
              <g key={bucket.label}>
                <rect className="db-chart-bar" x={x} y={y} width={barWidth} height={Math.max(bucket.count ? 2 : 0, barHeight)} rx="4">
                  <title>{`${bucket.label}: ${bucket.count} ${bucket.count === 1 ? 'session' : 'sessions'}`}</title>
                </rect>
                {bucket.count > 0 && <text className="db-chart-value-label" x={x + barWidth / 2} y={Math.max(margin.top + 12, y - 7)} textAnchor="middle">{bucket.count}</text>}
                <text className="db-chart-axis-label" x={x + barWidth / 2} y={height - 12} textAnchor="middle">{bucket.label}</text>
              </g>
            );
          })}
        </svg>
      </div>}
    </div>
  );
};

const StudyVelocityCard = ({ stats, hasData, onStart }) => {
  return (
    <div className="db-chart-card db-card db-velocity-card">
      <div className="db-chart-heading db-chart-heading-stack">
        <div>
          <h3 className="db-section-title">Study Velocity & Consistency</h3>
          <span className="db-section-meta">Cadence, target hit rate, and daily output</span>
        </div>
      </div>

      {!hasData ? (
        <QuietEmptyState
          message="Velocity and consistency stats will appear after your first session."
          onStart={onStart}
        />
      ) : (
        <div className="db-velocity-content">
          {/* Top highlight row: Consistency score + Ring + Rating */}
          <div className="db-velocity-hero">
            <div className="db-velocity-ring-wrap">
              <svg className="db-velocity-ring" viewBox="0 0 44 44" aria-hidden="true">
                <circle
                  className="db-ring-track"
                  cx="22"
                  cy="22"
                  r="18"
                />
                <circle
                  className="db-ring-fill"
                  cx="22"
                  cy="22"
                  r="18"
                  style={{
                    strokeDasharray: 113.1,
                    strokeDashoffset: 113.1 - (113.1 * Math.min(100, Math.max(4, stats.consistencyPct))) / 100,
                  }}
                />
              </svg>
              <div className="db-ring-text">
                <span className="db-ring-number">{stats.consistencyPct}%</span>
              </div>
            </div>
            <div className="db-velocity-hero-info">
              <div className="db-velocity-score-title">
                <strong>{stats.consistencyRating}</strong>
                <span className="db-velocity-score-sub">
                  {stats.activeDaysCount} of {stats.totalDaysCount} {stats.totalDaysCount === 1 ? 'day' : 'days'} active in this period
                </span>
              </div>
            </div>
          </div>

          {/* 4 Bento metric tiles */}
          <div className="db-velocity-grid">
            <div className="db-velocity-metric-tile">
              <div className="db-velocity-metric-top">
                <span className="db-velocity-tile-label">ACTIVE DAY PACE</span>
                <Clock className="db-velocity-icon" size={13} />
              </div>
              <div className="db-velocity-tile-val">
                {stats.activeDayAvgSeconds > 0 ? fmtDur(stats.activeDayAvgSeconds) : '—'}
              </div>
              <div className="db-velocity-tile-sub">
                avg per study day
              </div>
            </div>

            <div className="db-velocity-metric-tile">
              <div className="db-velocity-metric-top">
                <span className="db-velocity-tile-label">GOAL HIT RATE</span>
                <Target className="db-velocity-icon" size={13} />
              </div>
              <div className="db-velocity-tile-val">
                {stats.goalHitDays} / {stats.totalDaysCount} <span className="db-val-unit">days</span>
              </div>
              <div className="db-velocity-tile-sub">
                {stats.goalHitDays > 0 ? `${stats.goalHitPct}% of active days` : `Target: ${stats.targetHours}h / day`}
              </div>
            </div>

            <div className="db-velocity-metric-tile">
              <div className="db-velocity-metric-top">
                <span className="db-velocity-tile-label">PEAK RECORD</span>
                <Trophy className="db-velocity-icon" size={13} />
              </div>
              <div className="db-velocity-tile-val">
                {stats.peakDayOutput > 0 ? fmtDur(stats.peakDayOutput) : '—'}
              </div>
              <div className="db-velocity-tile-sub">
                {stats.peakDayLabel ? `${stats.peakDayLabel} record` : 'Highest day'}
              </div>
            </div>

            <div className="db-velocity-metric-tile">
              <div className="db-velocity-metric-top">
                <span className="db-velocity-tile-label">STUDY DENSITY</span>
                <Flame className="db-velocity-icon" size={13} />
              </div>
              <div className="db-velocity-tile-val">
                {stats.sessionsPerActiveDay} <span className="db-val-unit">sess/day</span>
              </div>
              <div className="db-velocity-tile-sub">
                active day frequency
              </div>
            </div>
          </div>

          {/* Micro Habit Trail */}
          <div className="db-velocity-habit-strip">
            <div className="db-habit-strip-heading">
              <span>Recent Day Habit Trail</span>
              <span className="db-habit-legend">
                <span className="db-dot-sample dot-goal" /> Goal met
                <span className="db-dot-sample dot-active" /> Studied
                <span className="db-dot-sample dot-rest" /> Rest
              </span>
            </div>
            <div className="db-habit-dots-row">
              {stats.habitTrail.map((day) => {
                const statusClass = day.isGoalMet ? 'hit-goal' : day.isActive ? 'active-study' : 'rest-day';
                return (
                  <div
                    key={day.key}
                    className={`db-habit-pill ${statusClass}`}
                    title={`${day.fullDate}: ${day.seconds > 0 ? fmtDur(day.seconds) : 'Rest day'}${day.isGoalMet ? ' (Goal reached!)' : ''}`}
                  >
                    <span className="db-habit-day-num">{day.dateNum}</span>
                    <span className="db-habit-dot" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DashboardSection = ({ section, order, onExpand, children }) => {
  if (!section?.visible) return null;
  return (
    <section className="db-preference-section" style={{ order }} aria-label={section.label}>
      {section.collapsed ? (
        <button type="button" className="db-collapsed-section" onClick={() => onExpand(section.id)}>
          <span>{section.label}</span><span>Show section <span aria-hidden="true">＋</span></span>
        </button>
      ) : children}
    </section>
  );
};

const QuietEmptyState = ({ message, onStart }) => (
  <div className="db-range-empty">
    <span>{message}</span>
    <button type="button" onClick={onStart}>Start a session <span aria-hidden="true">→</span></button>
  </div>
);


const dateKey = (d) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const weekDayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const getWeekStartDayIndex = (weekStart) => {
  const index = weekDayKeys.indexOf(weekStart);
  return index < 0 ? 1 : index;
};
const getWeekStartOffset = (date, weekStart) => (date.getDay() - getWeekStartDayIndex(weekStart) + 7) % 7;

const dashboardRangeOptions = [
  { id: 'today', label: 'Today' },
  { id: '7days', label: 'Last 7 days' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: '30days', label: 'Last 30 days' },
  { id: '90days', label: 'Last 90 days' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom' },
];

const dashboardSectionDefaults = [
  { id: 'daily', label: 'Snapshot', visible: true, pinned: true, collapsed: false },
  { id: 'overview', label: 'Overview', visible: true, pinned: true, collapsed: false },
  { id: 'focus', label: 'Focus distribution', visible: false, pinned: false, collapsed: false },
  { id: 'rhythms', label: 'Study rhythms', visible: false, pinned: false, collapsed: false },
  { id: 'projects', label: 'Project progress', visible: true, pinned: true, collapsed: false },
  { id: 'patterns', label: 'Study pattern charts', visible: false, pinned: false, collapsed: false },
  { id: 'heatmap', label: 'Time-of-day heatmap', visible: false, pinned: false, collapsed: false },
  { id: 'calendar', label: 'Activity calendar', visible: false, pinned: false, collapsed: false },
];
const demoDashboardSectionDefaults = dashboardSectionDefaults.map((section) => ({ ...section, visible: true }));

const previousDefaultDashboardSections = [
  { id: 'overview', pinned: true },
  { id: 'focus', pinned: false },
  { id: 'rhythms', pinned: false },
  { id: 'projects', pinned: true },
  { id: 'patterns', pinned: false },
  { id: 'heatmap', pinned: false },
  { id: 'calendar', pinned: false },
];
const previousCurrentDefaultOrder = ['overview', 'daily', 'focus', 'rhythms', 'projects', 'patterns', 'heatmap', 'calendar'];
const previousCurrentDefaultVisibility = {
  overview: true,
  daily: true,
  focus: false,
  rhythms: false,
  projects: true,
  patterns: false,
  heatmap: false,
  calendar: false,
};

const getSavedDashboardPreferences = (preferenceKey, defaults = dashboardSectionDefaults) => {
  try {
    const saved = JSON.parse(localStorage.getItem(preferenceKey) || 'null');
    if (!Array.isArray(saved)) return defaults;
    const isUntouchedCurrentDefault = saved.length === defaults.length && saved.every((item, index) => {
      const currentDefault = defaults[index];
      return item.id === currentDefault.id && item.visible === currentDefault.visible && item.pinned === currentDefault.pinned && item.collapsed === currentDefault.collapsed;
    });
    if (isUntouchedCurrentDefault) return defaults;
    const isUntouchedPreviousStorageDefault = saved.length === dashboardSectionDefaults.length && saved.every((item, index) => {
      const previous = dashboardSectionDefaults[index];
      return item.id === previous.id && item.visible === previous.visible && item.pinned === previous.pinned && item.collapsed === previous.collapsed;
    });
    if (isUntouchedPreviousStorageDefault) return defaults;
    const isUntouchedPreviousCurrentDefault = saved.length === previousCurrentDefaultOrder.length && saved.every((item, index) => {
      const previousId = previousCurrentDefaultOrder[index];
      const previous = dashboardSectionDefaults.find((section) => section.id === previousId);
      return item.id === previousId && item.visible === previousCurrentDefaultVisibility[previousId] && item.pinned === previous.pinned && item.collapsed === false;
    });
    if (isUntouchedPreviousCurrentDefault) return defaults;
    const isUntouchedOldDefault = saved.length === previousDefaultDashboardSections.length && saved.every((item, index) => {
      const previous = previousDefaultDashboardSections[index];
      return item.id === previous.id && item.visible === true && item.pinned === previous.pinned && item.collapsed === false;
    });
    if (isUntouchedOldDefault) return defaults;
    const current = new Map(saved.map((item) => [item.id, item]));
    return defaults.map((section) => ({ ...section, ...(current.get(section.id) || {}), label: section.label }));
  } catch {
    return defaults;
  }
};

const getDashboardWindow = (range, customStart, customEnd, entries, now = new Date(), weekStart = 'monday') => {
  const end = new Date(now);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === 'today') { /* start already marks today */ }
  else if (range === '7days') start.setDate(start.getDate() - 6);
  else if (range === 'week') start.setDate(start.getDate() - getWeekStartOffset(start, weekStart));
  else if (range === 'month') start.setDate(1);
  else if (range === '30days') start.setDate(start.getDate() - 29);
  else if (range === '90days') start.setDate(start.getDate() - 89);
  else if (range === 'custom') {
    const parsedStart = customStart ? new Date(`${customStart}T00:00:00`) : null;
    const parsedEnd = customEnd ? new Date(`${customEnd}T23:59:59.999`) : null;
    return {
      start: parsedStart && !Number.isNaN(parsedStart.getTime()) ? parsedStart : start,
      end: parsedEnd && !Number.isNaN(parsedEnd.getTime()) ? new Date(Math.min(parsedEnd.getTime(), end.getTime())) : end,
    };
  } else if (range === 'all') {
    const timestamps = entries.map((entry) => new Date(entry.startedAt).getTime()).filter(Number.isFinite);
    if (timestamps.length) {
      const earliest = new Date(Math.min(...timestamps));
      earliest.setHours(0, 0, 0, 0);
      return { start: earliest, end };
    }
  }
  start.setHours(0, 0, 0, 0);
  return { start, end };
};

export function DashboardPage({ user, onNavigate, standalone = false }) {
  const { theme: currentTheme, toggleTheme } = useTheme();
  const { config, text } = useSiteCustomization();
  const isDark = currentTheme === 'dark';

  const [activeNav, setActiveNav] = useState('Dashboard');
  const preferenceKey = user?.id ? `studyduel_user_${user.id}_dashboard_preferences` : 'studyduel_demo_dashboard_preferences';
  const sectionDefaults = user?.id ? dashboardSectionDefaults : demoDashboardSectionDefaults;
  const [dateRange, setDateRange] = useState(() => {
    try {
      const saved = localStorage.getItem(`${preferenceKey}_range_v2`);
      return dashboardRangeOptions.some((option) => option.id === saved) ? saved : 'week';
    } catch { return 'week'; }
  });
  const [customStart, setCustomStart] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString('en-CA'));
  const [customEnd, setCustomEnd] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [hoursDonutTooltip, setHoursDonutTooltip] = useState(null);
  const weeklyStudyScrollRef = useRef(null);
  const rangeMenuRef = useRef(null);
  const customizerRef = useRef(null);
  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!rangeMenuRef.current?.contains(event.target)) setRangeMenuOpen(false);
      if (!customizerRef.current?.contains(event.target)) setCustomizerOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setRangeMenuOpen(false);
        setCustomizerOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(id); }, []);
  const [dashboardPreferences, setDashboardPreferences] = useState(() => {
    return getSavedDashboardPreferences(preferenceKey, sectionDefaults);
  });
  useEffect(() => {
    localStorage.setItem(`${preferenceKey}_range_v2`, dateRange);
  }, [preferenceKey, dateRange]);
  useEffect(() => {
    localStorage.setItem(preferenceKey, JSON.stringify(dashboardPreferences));
  }, [preferenceKey, dashboardPreferences]);
  const orderedDashboardSections = useMemo(() => [...dashboardPreferences].sort((a, b) => (
    Number(b.pinned) - Number(a.pinned) || dashboardPreferences.findIndex((item) => item.id === a.id) - dashboardPreferences.findIndex((item) => item.id === b.id)
  )), [dashboardPreferences]);
  const dashboardSection = (id) => dashboardPreferences.find((section) => section.id === id);
  const dashboardSectionOrder = (id) => orderedDashboardSections.findIndex((section) => section.id === id) + 1;
  const updateDashboardSection = (id, changes) => setDashboardPreferences((sections) => sections.map((section) => (
    section.id === id ? { ...section, ...changes } : section
  )));
  const moveDashboardSection = (id, direction) => setDashboardPreferences((sections) => {
    const next = [...sections];
    const index = next.findIndex((section) => section.id === id);
    const target = index + direction;
    if (target < 0 || target >= next.length) return sections;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  // Project goals are managed in /manage and stored with the project hierarchy.
  const projectsKey = user?.id ? `studyduel_user_${user.id}_projects` : 'studyduel_demo_projects';
  const [projects, setProjects] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(projectsKey) || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    const syncProjects = () => {
      try {
        const saved = JSON.parse(localStorage.getItem(projectsKey) || '[]');
        setProjects(Array.isArray(saved) ? saved : []);
      } catch {
        setProjects([]);
      }
    };
    window.addEventListener('storage', syncProjects);
    return () => window.removeEventListener('storage', syncProjects);
  }, [projectsKey]);

  // Storage key for user session entries
  const entriesKey = user?.id ? `studyduel_user_${user.id}_time_entries` : 'studyduel_demo_time_entries';
  const preferencesKey = user?.id ? `studyduel_user_${user.id}_preferences` : 'studyduel_demo_preferences';
  const [preferences, setPreferences] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(preferencesKey) || 'null');
      return saved || {};
    } catch {
      return {};
    }
  });

  const [weekStart, setWeekStart] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(preferencesKey) || 'null');
      return weekDayKeys.includes(saved?.weekStart) ? saved.weekStart : 'monday';
    } catch {
      return 'monday';
    }
  });

  useEffect(() => {
    const syncPreferences = (event) => {
      if (event?.detail?.preferencesKey && event.detail.preferencesKey !== preferencesKey) return;
      try {
        const saved = JSON.parse(localStorage.getItem(preferencesKey) || 'null');
        setPreferences(saved || {});
        setWeekStart(weekDayKeys.includes(saved?.weekStart) ? saved.weekStart : 'monday');
      } catch {
        setPreferences({});
        setWeekStart('monday');
      }
    };
    window.addEventListener('studyduel:preferences-storage', syncPreferences);
    window.addEventListener('storage', syncPreferences);
    return () => {
      window.removeEventListener('studyduel:preferences-storage', syncPreferences);
      window.removeEventListener('storage', syncPreferences);
    };
  }, [preferencesKey]);

  const dailyGoalHours = useMemo(() => {
    if (preferences.dailyGoalHours !== undefined && preferences.dailyGoalHours !== null && preferences.dailyGoalHours !== '') {
      const parsed = Number(preferences.dailyGoalHours);
      if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }
    const projectTotal = projects.reduce(
      (total, project) => total + (project.archived ? 0 : (project.subjects || []).reduce(
        (subjectTotal, subject) => subjectTotal + (Number(subject.goals?.daily) || 0), 0
      )), 0
    );
    return projectTotal > 0 ? projectTotal : 4;
  }, [projects, preferences.dailyGoalHours]);

  const [entries, setEntries] = useState(() => {
    try {
      const d = JSON.parse(localStorage.getItem(entriesKey) || 'null');
      return Array.isArray(d) ? d : [];
    } catch {
      return [];
    }
  });

  // Sync entries from storage
  useEffect(() => {
    const sync = () => {
      try {
        const d = JSON.parse(localStorage.getItem(entriesKey) || 'null');
        setEntries(Array.isArray(d) ? d : []);
      } catch {
        setEntries([]);
      }
    };
    window.addEventListener('storage', sync);
    window.addEventListener('studyduel:timer-storage', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('studyduel:timer-storage', sync);
    };
  }, [entriesKey]);

  const dateWindow = useMemo(
    () => getDashboardWindow(dateRange, customStart, customEnd, entries, now, weekStart),
    [dateRange, customStart, customEnd, entries, now, weekStart]
  );
  const rangeEntries = useMemo(() => entries.filter((entry) => {
    const time = new Date(entry.startedAt).getTime();
    return Number(entry.durationSeconds) > 0 && Number.isFinite(time) && time >= dateWindow.start.getTime() && time <= dateWindow.end.getTime();
  }), [entries, dateWindow]);
  const rangeDaysCount = Math.max(1, Math.floor((dateWindow.end.getTime() - dateWindow.start.getTime()) / 86400000) + 1);
  const rangeSecs = useMemo(
    () => rangeEntries.reduce((sum, entry) => sum + (Number(entry.durationSeconds) || 0), 0),
    [rangeEntries]
  );
  const previousWindow = useMemo(() => {
    if (dateRange === 'all') return null;
    const shiftDays = (date, amount) => {
      const shifted = new Date(date);
      shifted.setDate(shifted.getDate() + amount);
      return shifted;
    };
    if (dateRange === 'today') return { start: shiftDays(dateWindow.start, -1), end: shiftDays(dateWindow.end, -1) };
    if (dateRange === 'week') {
      return { start: shiftDays(dateWindow.start, -7), end: shiftDays(dateWindow.end, -7) };
    }
    if (dateRange === 'month') {
      const start = new Date(dateWindow.start.getFullYear(), dateWindow.start.getMonth() - 1, 1);
      const previousMonthLastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
      const end = new Date(start.getFullYear(), start.getMonth(), Math.min(dateWindow.end.getDate(), previousMonthLastDay), dateWindow.end.getHours(), dateWindow.end.getMinutes(), dateWindow.end.getSeconds(), dateWindow.end.getMilliseconds());
      return { start, end };
    }
    if (dateRange === '7days') return { start: shiftDays(dateWindow.start, -7), end: shiftDays(dateWindow.end, -7) };
    if (dateRange === '30days') return { start: shiftDays(dateWindow.start, -30), end: shiftDays(dateWindow.end, -30) };
    if (dateRange === '90days') return { start: shiftDays(dateWindow.start, -90), end: shiftDays(dateWindow.end, -90) };
    const span = Math.max(1, dateWindow.end.getTime() - dateWindow.start.getTime() + 1);
    return {
      start: new Date(dateWindow.start.getTime() - span),
      end: new Date(dateWindow.start.getTime() - 1),
    };
  }, [dateRange, dateWindow]);
  const previousRangeEntries = useMemo(() => previousWindow ? entries.filter((entry) => {
    const time = new Date(entry.startedAt).getTime();
    return Number(entry.durationSeconds) > 0 && Number.isFinite(time) && time >= previousWindow.start.getTime() && time <= previousWindow.end.getTime();
  }) : [], [entries, previousWindow]);
  const previousRangeSecs = useMemo(
    () => previousRangeEntries.reduce((sum, entry) => sum + (Number(entry.durationSeconds) || 0), 0),
    [previousRangeEntries]
  );
  const rangeDeltaSecs = rangeSecs - previousRangeSecs;
  const rangeActiveDays = new Set(rangeEntries.filter((entry) => entry.durationSeconds > 0).map((entry) => dateKey(entry.startedAt))).size;
  const averageActiveDaySecs = rangeActiveDays ? Math.round(rangeSecs / rangeActiveDays) : 0;
  const rangeLabel = dateRange === 'custom'
    ? `${formatDisplayDate(dateWindow.start, { month: 'short', day: 'numeric', year: 'numeric' })} – ${formatDisplayDate(dateWindow.end, { month: 'short', day: 'numeric', year: 'numeric' })}`
    : dashboardRangeOptions.find((item) => item.id === dateRange)?.label || 'This week';
  const rangeGoalHours = useMemo(() => projects.reduce((total, project) => {
    if (project.archived) return total;
    return total + (project.subjects || []).reduce((projectTotal, subject) => {
      if (dateRange === 'today') return projectTotal + (Number(subject.goals?.daily) || 0);
      if (dateRange === '7days') return projectTotal + (Number(subject.goals?.daily) || 0) * 7;
      if (dateRange === 'week') return projectTotal + (Number(subject.goals?.weekly) || 0);
      if (dateRange === 'month') return projectTotal + (Number(subject.goals?.monthly) || 0);
      if (['30days', '90days', 'custom'].includes(dateRange)) return projectTotal + (Number(subject.goals?.daily) || 0) * (dateRange === '30days' ? 30 : dateRange === '90days' ? 90 : rangeDaysCount);
      return projectTotal;
    }, 0);
  }, 0), [projects, dateRange, rangeDaysCount]);
  const rangeGoalSecs = rangeGoalHours * 3600;
  const hasComparableGoal = dateRange !== 'all' && rangeGoalSecs > 0;
  const elapsedRangeDays = Math.min(rangeDaysCount, Math.max(1, Math.floor((Math.min(now.getTime(), dateWindow.end.getTime()) - dateWindow.start.getTime()) / 86400000) + 1));
  const rangeGoalPct = rangeGoalSecs > 0 ? Math.min(100, Math.round((rangeSecs / rangeGoalSecs) * 100)) : 0;
  const rangeGoalRemainingSecs = Math.max(0, rangeGoalSecs - rangeSecs);
  const expectedGoalByNowSecs = rangeGoalSecs > 0 ? rangeGoalSecs * (elapsedRangeDays / rangeDaysCount) : 0;
  const paceDifferenceSecs = Math.max(0, expectedGoalByNowSecs - rangeSecs);
  const paceIsOnTrack = rangeSecs >= expectedGoalByNowSecs;
  const todaySnapshot = useMemo(() => {
    const todayKey = dateKey(now);
    const todayEntries = entries.filter((entry) => Number(entry.durationSeconds) > 0 && entry.startedAt && dateKey(entry.startedAt) === todayKey);
    const loggedSeconds = todayEntries.reduce((total, entry) => total + (Number(entry.durationSeconds) || 0), 0);
    const plannedGoalHours = projects.reduce((total, project) => {
      if (project.archived) return total;
      return total + (project.subjects || []).reduce((subjectTotal, subject) => {
        const dailyHours = Number(subject.goals?.daily) || 0;
        const weeklyHours = Number(subject.goals?.weekly) || 0;
        const studyDays = Array.isArray(subject.studyDays)
          ? subject.studyDays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
          : dailyHours > 0 ? [0, 1, 2, 3, 4, 5, 6] : [];
        if (!studyDays.includes(now.getDay())) return subjectTotal;
        const targetHours = dailyHours || (weeklyHours > 0 && studyDays.length ? weeklyHours / studyDays.length : 0);
        return subjectTotal + targetHours;
      }, 0);
    }, 0);
    const globalGoalHours = Number(preferences.dailyGoalHours) || 0;
    const targetSeconds = (plannedGoalHours || globalGoalHours) * 3600;
    return {
      loggedSeconds,
      sessionCount: todayEntries.length,
      targetSeconds,
      remainingSeconds: Math.max(0, targetSeconds - loggedSeconds),
      progress: targetSeconds ? Math.min(100, Math.round((loggedSeconds / targetSeconds) * 100)) : 0,
    };
  }, [entries, projects, now, preferences.dailyGoalHours]);
  const snapshotMetrics = useMemo(() => {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekStartDate = new Date(todayStart);
    const elapsedDays = getWeekStartOffset(todayStart, weekStart) + 1;
    weekStartDate.setDate(weekStartDate.getDate() - elapsedDays + 1);
    const previousWeekStart = new Date(weekStartDate);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const previousWeekEnd = new Date(previousWeekStart);
    previousWeekEnd.setDate(previousWeekEnd.getDate() + elapsedDays);
    const weekSeconds = snapshotPeriodSeconds(entries, weekStartDate, tomorrow);
    const previousWeekSeconds = snapshotPeriodSeconds(entries, previousWeekStart, previousWeekEnd);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(previousMonthStart);
    previousMonthEnd.setDate(Math.min(now.getDate(), new Date(now.getFullYear(), now.getMonth(), 0).getDate()) + 1);
    const monthSeconds = snapshotPeriodSeconds(entries, monthStart, tomorrow);
    const previousMonthSeconds = snapshotPeriodSeconds(entries, previousMonthStart, previousMonthEnd);

    const currentWeekEntries = entries.filter((entry) => {
      const startedAt = new Date(entry.startedAt).getTime();
      return Number(entry.durationSeconds) > 0 && Number.isFinite(startedAt) && startedAt >= weekStartDate.getTime() && startedAt < tomorrow.getTime();
    });
    const previousWeekEntries = entries.filter((entry) => {
      const startedAt = new Date(entry.startedAt).getTime();
      return Number(entry.durationSeconds) > 0 && Number.isFinite(startedAt) && startedAt >= previousWeekStart.getTime() && startedAt < previousWeekEnd.getTime();
    });
    const averagePerDay = weekSeconds / elapsedDays;
    const previousAveragePerDay = previousWeekSeconds / elapsedDays;
    const averageSession = currentWeekEntries.length ? weekSeconds / currentWeekEntries.length : 0;
    const previousAverageSession = previousWeekEntries.length ? previousWeekSeconds / previousWeekEntries.length : 0;

    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStartDate);
      d.setDate(d.getDate() + i);
      const k = dateKey(d);
      const daySecs = currentWeekEntries
        .filter((e) => dateKey(e.startedAt) === k)
        .reduce((sum, e) => sum + (Number(e.durationSeconds) || 0), 0);
      const dayNarrow = d.toLocaleDateString(undefined, { weekday: 'narrow' });
      const dayShort = d.toLocaleDateString(undefined, { weekday: 'short' });
      const isToday = k === dateKey(now);
      const isPastOrToday = d.getTime() < tomorrow.getTime();
      return {
        key: k,
        label: dayNarrow,
        fullDay: dayShort,
        seconds: daySecs,
        active: daySecs > 0,
        isToday,
        isPastOrToday,
      };
    });
    const goalProgressRows = projects.filter((project) => !project.archived).flatMap((project) => (project.subjects || []).map((subject) => {
      const goals = subject.goals || {};
      const selectedDays = Array.isArray(subject.studyDays)
        ? subject.studyDays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
        : [];
      const plannedDays = selectedDays.length ? selectedDays : [0, 1, 2, 3, 4, 5, 6];
      const weeklyHours = Number(goals.weekly) || (Number(goals.daily) * plannedDays.length) || (Number(goals.monthly) / 4.35) || 0;
      if (weeklyHours <= 0) return null;
      const targetSeconds = weeklyHours * 3600;
      const elapsedPlannedDays = weekDays.filter((day) => day.isPastOrToday && plannedDays.includes(new Date(`${day.key}T12:00:00`).getDay())).length;
      const expectedSeconds = targetSeconds * elapsedPlannedDays / plannedDays.length;
      const loggedSeconds = currentWeekEntries.filter((entry) => {
        const projectMatches = entry.projectId
          ? String(entry.projectId) === String(project.id)
          : entry.projectName === project.name;
        const subjectMatches = entry.subjectId
          ? String(entry.subjectId) === String(subject.id)
          : entry.subjectName === subject.name;
        return projectMatches && subjectMatches;
      }).reduce((total, entry) => total + (Number(entry.durationSeconds) || 0), 0);
      const status = loggedSeconds >= targetSeconds ? 'met' : elapsedPlannedDays === 0 ? 'upcoming' : loggedSeconds >= expectedSeconds ? 'on-track' : 'behind';
      const statusDetail = status === 'met'
        ? 'Weekly goal met'
        : status === 'upcoming'
          ? 'Next planned day ahead'
          : status === 'behind'
            ? `${fmtDur(expectedSeconds - loggedSeconds)} behind pace`
            : 'On pace';
      return {
        id: `${project.id}-${subject.id}`,
        projectName: project.name,
        subjectName: subject.name,
        loggedSeconds,
        targetSeconds,
        progress: Math.min(100, Math.round((loggedSeconds / targetSeconds) * 100)),
        status,
        statusLabel: status === 'met' ? 'Goal met' : status === 'upcoming' ? 'Upcoming' : status === 'behind' ? 'Behind' : 'On pace',
        statusDetail,
      };
    })).filter(Boolean).sort((a, b) => Number(b.status === 'behind') - Number(a.status === 'behind') || a.progress - b.progress || a.projectName.localeCompare(b.projectName));
    const activeDaysCount = weekDays.filter((d) => d.active).length;

    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const monthPacingEstimateSeconds = dayOfMonth > 0 ? Math.round((monthSeconds / dayOfMonth) * daysInMonth) : 0;

    const weeklyPlannedSeconds = projects.reduce((total, project) => {
      if (project.archived) return total;
      return total + (project.subjects || []).reduce((subTotal, sub) => subTotal + (Number(sub.goals?.weekly) || 0) * 3600, 0);
    }, 0);

    let sessionTierLabel = 'Quick Sprint';
    if (averageSession >= 5400) sessionTierLabel = 'Marathon (90m+)';
    else if (averageSession >= 2700) sessionTierLabel = 'Deep Flow (45m+)';
    else if (averageSession >= 1200) sessionTierLabel = 'Standard Focus';

    return [
      {
        id: 'time-week',
        label: 'TIME THIS WEEK',
        value: fmtDur(weekSeconds),
        comparison: percentComparison(weekSeconds, previousWeekSeconds, 'vs last week'),
        weekDays,
        activeDaysCount,
        weeklyPlannedSeconds,
        goalProgressRows,
        detail: weeklyPlannedSeconds > 0
          ? `${fmtDur(weekSeconds)} of ${fmtDur(weeklyPlannedSeconds)} goal (${Math.round((weekSeconds / weeklyPlannedSeconds) * 100)}%)`
          : `${activeDaysCount} of 7 days active this week`,
        iconType: 'clock',
        accent: 'accent',
      },
      {
        id: 'time-month',
        label: 'TIME THIS MONTH',
        value: fmtDur(monthSeconds),
        comparison: percentComparison(monthSeconds, previousMonthSeconds, 'vs same dates last month'),
        detail: monthPacingEstimateSeconds > 0
          ? `Pacing ~${fmtDur(monthPacingEstimateSeconds)} by month end`
          : `Day ${dayOfMonth} of ${daysInMonth} · ${fmtDur(monthSeconds)} logged`,
        subDetail: `Day ${dayOfMonth} of ${daysInMonth}`,
        iconType: 'calendar',
        accent: 'violet',
      },
      {
        id: 'daily-avg',
        label: 'DAILY AVERAGE',
        value: fmtDur(averagePerDay),
        detail: 'Week to date · includes today',
        subDetail: `${elapsedDays} ${elapsedDays === 1 ? 'day' : 'days'} elapsed`,
        comparison: percentComparison(averagePerDay, previousAveragePerDay, 'vs same days last week'),
        averageSessionValue: averageSession ? fmtDur(averageSession) : '—',
        averageSessionTier: averageSession > 0 ? sessionTierLabel : null,
        sessionCount: currentWeekEntries.length,
        sessionComparison: averageSession ? percentComparison(averageSession, previousAverageSession, 'vs same days last week') : null,
        iconType: 'activity',
        accent: 'amber',
      },
    ];
  }, [entries, now, weekStart, projects]);
  const rangeTopProject = useMemo(() => {
    const totals = new Map();
    rangeEntries.forEach((entry) => {
      const name = entry.projectName || 'General Study';
      totals.set(name, (totals.get(name) || 0) + (Number(entry.durationSeconds) || 0));
    });
    return Array.from(totals.entries()).sort((a, b) => b[1] - a[1])[0] || null;
  }, [rangeEntries]);

  /* ── Core Computed Metrics ───────────────────── */
  /* ── ROW 2: Focus Depth & Flow State Tiers ──── */
  const sessionTierStats = useMemo(() => {
    let sprint = 0,
      pomodoro = 0,
      deepFlow = 0,
      marathon = 0;
    rangeEntries.forEach((e) => {
      const dur = e.durationSeconds || 0;
      if (dur < 20 * 60) sprint++;
      else if (dur < 45 * 60) pomodoro++;
      else if (dur < 90 * 60) deepFlow++;
      else marathon++;
    });
    const total = rangeEntries.length;
    const flowCount = deepFlow + marathon;
    const flowRatio = total > 0 ? Math.round((flowCount / total) * 100) : 0;

    return {
      sprint,
      pomodoro,
      deepFlow,
      marathon,
      total,
      flowRatio,
      sprintPct: total > 0 ? Math.round((sprint / total) * 100) : 0,
      pomodoroPct: total > 0 ? Math.round((pomodoro / total) * 100) : 0,
      deepFlowPct: total > 0 ? Math.round((deepFlow / total) * 100) : 0,
      marathonPct: total > 0 ? Math.round((marathon / total) * 100) : 0,
    };
  }, [rangeEntries]);

  // Avg focus depth & longest session
  const avgFocusDepth = useMemo(() => {
    if (!rangeEntries.length) return 0;
    return Math.round(rangeSecs / rangeEntries.length);
  }, [rangeEntries, rangeSecs]);

  const longestSession = useMemo(() => {
    if (!rangeEntries.length) return 0;
    return Math.max(...rangeEntries.map((e) => e.durationSeconds || 0));
  }, [rangeEntries]);

  // Context switching rate (subjects per active day)
  const contextSwitching = useMemo(() => {
    if (!rangeEntries.length) return '1.0 subj/day';
    const dayMap = {};
    rangeEntries.forEach((e) => {
      const k = dateKey(e.startedAt);
      if (!dayMap[k]) dayMap[k] = new Set();
      dayMap[k].add(e.subjectName || e.projectName || 'General');
    });
    const days = Object.keys(dayMap);
    if (!days.length) return '1.0 subj/day';
    const totalSubjects = days.reduce((sum, d) => sum + dayMap[d].size, 0);
    return `${(totalSubjects / days.length).toFixed(1)} subj/day`;
  }, [rangeEntries]);

  // Peak cognitive hour
  const peakHourLabel = useMemo(() => {
    if (!rangeEntries.length) return '—';
    const hourVolumes = Array(24).fill(0);
    rangeEntries.forEach((e) => {
      if (!e.startedAt) return;
      const h = new Date(e.startedAt).getHours();
      hourVolumes[h] += e.durationSeconds || 0;
    });
    let bestH = 0,
      maxV = -1;
    hourVolumes.forEach((v, h) => {
      if (v > maxV) {
        maxV = v;
        bestH = h;
      }
    });
    if (maxV <= 0) return '—';
    const period = bestH >= 12 ? 'PM' : 'AM';
    const displayH = bestH % 12 === 0 ? 12 : bestH % 12;
    return `${displayH}:00 ${period}`;
  }, [rangeEntries]);

  /* ── ROW 3: Circadian Focus Window ──────────── */
  const circadianStats = useMemo(() => {
    let m = 0,
      a = 0,
      e = 0,
      n = 0;
    rangeEntries.forEach((entry) => {
      if (!entry.startedAt) return;
      const h = new Date(entry.startedAt).getHours();
      const dur = entry.durationSeconds || 0;
      if (h >= 5 && h < 12) m += dur;
      else if (h >= 12 && h < 17) a += dur;
      else if (h >= 17 && h < 22) e += dur;
      else n += dur;
    });
    const total = m + a + e + n;
    const slots = [
      { title: 'Morning', sub: '5A–12P', secs: m },
      { title: 'Afternoon', sub: '12P–5P', secs: a },
      { title: 'Evening', sub: '5P–10P', secs: e },
      { title: 'Night', sub: '10P–5A', secs: n },
    ];
    let bestSlot = slots[0];
    slots.forEach((s) => {
      if (s.secs > bestSlot.secs) bestSlot = s;
    });

    return {
      slots: slots.map((s) => ({
        ...s,
        val: s.secs > 0 ? fmtDur(s.secs) : '—',
        pctNum: total > 0 ? Math.round((s.secs / total) * 100) : 0,
        pct: total > 0 ? `${Math.round((s.secs / total) * 100)}% of study` : '0% of study',
        active: s.secs > 0 && s.title === bestSlot.title,
      })),
      bestSlotTitle: bestSlot.secs > 0 ? `${bestSlot.title} (${bestSlot.sub})` : 'Morning (5A–12P)',
      bestPct: total > 0 ? Math.round((bestSlot.secs / total) * 100) : 0,
      hasData: total > 0,
    };
  }, [rangeEntries]);

  /* ── ROW 3: Day-of-Week Power Rhythm ────────── */
  const dayOfWeekStats = useMemo(() => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const startDay = getWeekStartDayIndex(weekStart);
    const orderedDays = Array.from({ length: 7 }, (_, offset) => (startDay + offset) % 7);
    const dayTotals = [0, 0, 0, 0, 0, 0, 0];
    rangeEntries.forEach((entry) => {
      if (!entry.startedAt) return;
      const dayIdx = new Date(entry.startedAt).getDay();
      dayTotals[dayIdx] += entry.durationSeconds || 0;
    });
    const maxDaySecs = Math.max(1, ...dayTotals);
    let bestIdx = 1;
    dayTotals.forEach((secs, idx) => {
      if (secs > dayTotals[bestIdx]) bestIdx = idx;
    });

    return {
      rows: orderedDays.map((idx) => {
        const name = dayNames[idx];
        const secs = dayTotals[idx];
        const pct = Math.max(2, Math.round((secs / maxDaySecs) * 100));
        const active = secs > 0 && idx === bestIdx;
        return {
          day: name,
          val: secs > 0 ? fmtDur(secs) : '—',
          pct,
          active,
          secs,
        };
      }),
      powerDayName: dayTotals[bestIdx] > 0 ? dayNames[bestIdx] : 'Mon',
      powerDayVolume: fmtDur(dayTotals[bestIdx]),
      hasData: dayTotals.some((s) => s > 0),
    };
  }, [rangeEntries, weekStart]);

  /* ── Study volume by day or week in the selected range ──────── */
  const weekBarData = useMemo(() => {
    const map = new Map();
    rangeEntries.forEach((e) => {
      if (!e.startedAt) return;
      const k = dateKey(e.startedAt);
      map.set(k, (map.get(k) || 0) + (e.durationSeconds || 0));
    });
    const useYears = dateRange === 'all' && rangeDaysCount > 365 * 5;
    const useQuarters = dateRange === 'all' && rangeDaysCount > 180 && !useYears;
    const useWeeks = !useYears && !useQuarters && rangeDaysCount > 45;
    const days = [];
    const dayCount = Math.max(1, Math.floor((dateWindow.end.getTime() - dateWindow.start.getTime()) / 86400000) + 1);
    if (!useWeeks && !useQuarters && !useYears) {
      const daysCount = dateRange === 'week' ? 7 : dayCount;
      for (let offset = 0; offset < daysCount; offset++) {
        const date = new Date(dateWindow.start);
        date.setDate(date.getDate() + offset);
        const key = dateKey(date);
        const val = map.get(key) || 0;
        days.push({ day: date.toLocaleDateString(undefined, { weekday: 'short' }), dateLabel: formatDisplayDate(date, { month: 'short', day: 'numeric' }), val, label: val > 0 ? fmtDur(val) : '', active: date.toDateString() === new Date().toDateString(), key });
      }
    } else if (useQuarters || useYears) {
      const cursor = new Date(dateWindow.start.getFullYear(), useYears ? 0 : Math.floor(dateWindow.start.getMonth() / 3) * 3, 1);
      while (cursor <= dateWindow.end) {
        const periodStart = new Date(cursor);
        const periodEnd = useYears
          ? new Date(periodStart.getFullYear() + 1, 0, 1)
          : new Date(periodStart.getFullYear(), periodStart.getMonth() + 3, 1);
        let val = 0;
        for (let offset = new Date(periodStart); offset < periodEnd && offset <= dateWindow.end; offset.setDate(offset.getDate() + 1)) {
          val += map.get(dateKey(offset)) || 0;
        }
        const quarter = Math.floor(periodStart.getMonth() / 3) + 1;
        days.push({
          day: useYears ? `${periodStart.getFullYear()}` : `Q${quarter} '${String(periodStart.getFullYear()).slice(-2)}`,
          dateLabel: useYears ? `${periodStart.getFullYear()}` : `Q${quarter} ${periodStart.getFullYear()}`,
          val,
          label: val > 0 ? fmtDur(val) : '',
          active: periodStart <= new Date() && periodEnd > new Date(),
          key: dateKey(periodStart),
        });
        cursor.setTime(periodEnd.getTime());
      }
    } else {
      const cursor = new Date(dateWindow.start);
      const startOffset = getWeekStartOffset(cursor, weekStart);
      cursor.setDate(cursor.getDate() - startOffset);
      const end = new Date(dateWindow.end);
      while (cursor <= end) {
        const weekStart = new Date(cursor);
        const weekEnd = new Date(cursor);
        weekEnd.setDate(weekEnd.getDate() + 6);
        let val = 0;
        for (let offset = 0; offset < 7; offset++) {
          const date = new Date(weekStart);
          date.setDate(date.getDate() + offset);
          val += map.get(dateKey(date)) || 0;
        }
        days.push({ day: formatDisplayDate(weekStart, { month: 'short', day: 'numeric' }), dateLabel: `${formatDisplayDate(weekStart, { month: 'short', day: 'numeric' })}–${formatDisplayDate(weekEnd, { month: 'short', day: 'numeric' })}`, val, label: val > 0 ? fmtDur(val) : '', active: weekStart <= new Date() && weekEnd >= new Date(), key: dateKey(weekStart) });
        cursor.setDate(cursor.getDate() + 7);
      }
    }
    const maxVal = Math.max(1, ...days.map((d) => d.val));
    const totalWeeklySecs = rangeSecs;
    const peakCol = days.reduce((peak, day) => day.val > peak.val ? day : peak, days[0] || { val: 0, day: '—' });

    return {
      cols: days.map((d) => ({
        ...d,
        h: d.val > 0 ? Math.max(6, Math.round((d.val / maxVal) * 100)) : 0,
        muted: d.val > 0 && !d.active,
      })),
      totalWeeklySecs,
      totalWeeklyFmt: fmtDur(totalWeeklySecs),
      peakDayLabel: peakCol.val > 0 ? peakCol.day : '—',
      peakDayFmt: peakCol.val > 0 ? fmtDur(peakCol.val) : '0m',
      unit: useYears ? 'years' : useQuarters ? 'quarters' : useWeeks ? 'weeks' : 'days',
      minWidth: Math.max(520, days.length * (useYears ? 34 : useQuarters ? 32 : useWeeks ? 20 : 48) + (!useWeeks && !useQuarters && !useYears ? 4 : 0)),
    };
  }, [rangeEntries, rangeSecs, dateWindow, rangeDaysCount, weekStart, dateRange]);

  useEffect(() => {
    const scroller = weeklyStudyScrollRef.current;
    if (!scroller) return undefined;
    const frame = window.requestAnimationFrame(() => { scroller.scrollLeft = scroller.scrollWidth; });
    return () => window.cancelAnimationFrame(frame);
  }, [dateRange, weekBarData.minWidth]);

  const studyVelocityStats = useMemo(() => {
    const totalDaysCount = Math.max(1, rangeDaysCount);
    const dateMap = new Map();
    const count = Math.min(60, totalDaysCount);
    const dayKeys = [];

    for (let i = 0; i < count; i++) {
      const d = new Date(dateWindow.start);
      d.setDate(d.getDate() + i);
      const k = dateKey(d);
      dayKeys.push(k);
      dateMap.set(k, { date: d, seconds: 0, sessions: 0 });
    }

    rangeEntries.forEach((entry) => {
      if (!entry.startedAt) return;
      const k = dateKey(entry.startedAt);
      if (dateMap.has(k)) {
        const item = dateMap.get(k);
        item.seconds += Number(entry.durationSeconds) || 0;
        item.sessions += 1;
      }
    });

    const daysList = dayKeys.map((k) => dateMap.get(k));
    const activeDaysList = daysList.filter((d) => d.seconds > 0);
    const activeDaysCount = activeDaysList.length;

    const consistencyPct = totalDaysCount > 0 ? Math.round((activeDaysCount / totalDaysCount) * 100) : 0;
    const activeDayAvgSeconds = activeDaysCount > 0 ? Math.round(rangeSecs / activeDaysCount) : 0;
    const overallDailyAvgSeconds = totalDaysCount > 0 ? Math.round(rangeSecs / totalDaysCount) : 0;

    const targetSeconds = (dailyGoalHours || 2) * 3600;
    const goalHitDays = daysList.filter((d) => d.seconds >= targetSeconds).length;
    const goalHitPct = activeDaysCount > 0 ? Math.round((goalHitDays / activeDaysCount) * 100) : 0;

    const totalSessions = rangeEntries.length;
    const sessionsPerActiveDay = activeDaysCount > 0 ? (totalSessions / activeDaysCount).toFixed(1) : '0';

    let peakDayOutput = 0;
    let peakDayLabel = '';
    let peakDaySessions = 0;
    daysList.forEach((d) => {
      if (d.seconds > peakDayOutput) {
        peakDayOutput = d.seconds;
        peakDayLabel = formatDisplayDate(d.date, { month: 'short', day: 'numeric' });
        peakDaySessions = d.sessions;
      }
    });

    let consistencyRating = 'Building Rhythm';
    if (consistencyPct >= 75) consistencyRating = 'Optimal Regularity';
    else if (consistencyPct >= 50) consistencyRating = 'Steady Cadence';
    else if (consistencyPct >= 25) consistencyRating = 'Moderate Pace';

    const habitTrail = daysList.slice(-Math.min(10, daysList.length)).map((d) => ({
      key: dateKey(d.date),
      dayLabel: d.date.toLocaleDateString(undefined, { weekday: 'narrow' }),
      dateNum: d.date.getDate(),
      fullDate: formatDisplayDate(d.date, { month: 'short', day: 'numeric' }),
      seconds: d.seconds,
      isGoalMet: d.seconds >= targetSeconds,
      isActive: d.seconds > 0,
    }));

    return {
      hasData: rangeEntries.length > 0,
      activeDaysCount,
      totalDaysCount,
      consistencyPct,
      consistencyRating,
      activeDayAvgSeconds,
      overallDailyAvgSeconds,
      goalHitDays,
      goalHitPct,
      targetSeconds,
      targetHours: dailyGoalHours || 2,
      sessionsPerActiveDay,
      peakDayOutput,
      peakDayLabel,
      peakDaySessions,
      habitTrail,
    };
  }, [rangeEntries, dateWindow, rangeDaysCount, rangeSecs, dailyGoalHours]);

  const weeklyTrendData = useMemo(() => {
    const showRecentWeeks = dateRange === 'week';
    const sourceEntries = showRecentWeeks ? entries : rangeEntries;
    const useYears = !showRecentWeeks && dateRange === 'all' && rangeDaysCount > 365 * 5;
    const useQuarters = dateRange === 'all' && rangeDaysCount > 180 && !useYears;
    const unit = useYears ? 'year' : useQuarters ? 'quarter' : 'week';
    const totals = new Map();
    sourceEntries.forEach((entry) => {
      if (!entry.startedAt) return;
      const date = new Date(entry.startedAt);
      if (useYears) date.setMonth(0, 1);
      else if (useQuarters) date.setMonth(Math.floor(date.getMonth() / 3) * 3, 1);
      else date.setDate(date.getDate() - getWeekStartOffset(date, weekStart));
      date.setHours(0, 0, 0, 0);
      const key = dateKey(date);
      const total = totals.get(key) || { seconds: 0, sessions: 0 };
      total.seconds += Number(entry.durationSeconds) || 0;
      total.sessions += 1;
      totals.set(key, total);
    });
    const weeks = [];
    const chartStart = new Date(showRecentWeeks ? dateWindow.end : dateWindow.start);
    if (showRecentWeeks) {
      chartStart.setDate(chartStart.getDate() - getWeekStartOffset(chartStart, weekStart) - 42);
    }
    const cursor = chartStart;
    if (useYears) cursor.setMonth(0, 1);
    else if (useQuarters) cursor.setMonth(Math.floor(cursor.getMonth() / 3) * 3, 1);
    else cursor.setDate(cursor.getDate() - getWeekStartOffset(cursor, weekStart));
    while (cursor <= dateWindow.end) {
      const start = new Date(cursor);
      const key = dateKey(start);
      const total = totals.get(key) || { seconds: 0, sessions: 0 };
      const seconds = total.seconds;
      const quarter = Math.floor(start.getMonth() / 3) + 1;
      const periodLabel = useYears ? `${start.getFullYear()}` : useQuarters ? `Q${quarter} ${start.getFullYear()}` : formatDisplayDate(start, { month: 'short', day: 'numeric' });
      weeks.push({
        key,
        seconds,
        sessions: total.sessions,
        averageSeconds: seconds,
        startLabel: periodLabel,
        axisLabel: useYears ? `${start.getFullYear()}` : useQuarters ? `Q${quarter} '${String(start.getFullYear()).slice(-2)}` : formatDisplayDate(start, { month: 'short', day: 'numeric' }),
        weekStartLabel: `${weekDayKeys[getWeekStartDayIndex(weekStart)][0].toUpperCase()}${weekDayKeys[getWeekStartDayIndex(weekStart)].slice(1)}`,
      });
      if (useYears) cursor.setFullYear(cursor.getFullYear() + 1);
      else if (useQuarters) cursor.setMonth(cursor.getMonth() + 3);
      else cursor.setDate(cursor.getDate() + 7);
    }
    return {
      unit,
      rangeLabel: showRecentWeeks ? 'Last 7 weeks' : rangeLabel,
      points: weeks.map((week, index) => ({
        ...week,
        averageSeconds: weeks.slice(Math.max(0, index - 3), index + 1).reduce((sum, item) => sum + item.seconds, 0) / Math.min(4, index + 1),
      })),
    };
  }, [entries, rangeEntries, dateWindow, weekStart, dateRange, rangeDaysCount, rangeLabel]);

  const sessionLengthData = useMemo(() => {
    const buckets = [
      { label: 'Under 15m', count: 0 },
      { label: '15–45m', count: 0 },
      { label: '45–90m', count: 0 },
      { label: '90m+', count: 0 },
    ];
    rangeEntries.forEach((entry) => {
      const duration = entry.durationSeconds || 0;
      if (duration < 15 * 60) buckets[0].count += 1;
      else if (duration < 45 * 60) buckets[1].count += 1;
      else if (duration < 90 * 60) buckets[2].count += 1;
      else buckets[3].count += 1;
    });
    return buckets;
  }, [rangeEntries]);

  /* ── ROW 4: Project Portfolio Breakdown ─────── */
  const portfolioEntries = rangeEntries;

  const portfolioStats = useMemo(() => {
    const map = new Map();
    portfolioEntries.forEach((e) => {
      const proj = e.projectName || 'General Study';
      const sub = e.subjectName || '';
      const project = projects.find((item) => item.id === e.projectId) || projects.find((item) => item.name === proj);
      // Archived projects stay in session history, but should not appear in
      // the active dashboard portfolio.
      if (project?.archived) return;
      const subject = project?.subjects?.find((item) => item.id === e.subjectId) || project?.subjects?.find((item) => item.name === sub);
      const selectedColor = subject?.color || project?.color || e.color || '#f3957f';
      const key = `${proj}:::${sub}`;
      if (!map.has(key)) {
        map.set(key, {
          projectId: project?.id || e.projectId,
          projectName: proj,
          subjectName: sub,
          color: selectedColor,
          count: 0,
          secs: 0,
        });
      }
      const item = map.get(key);
      item.count += 1;
      item.secs += e.durationSeconds || 0;
    });

    const list = Array.from(map.values()).sort((a, b) => b.secs - a.secs);
    const rangeTotalSecs = list.reduce((sum, item) => sum + item.secs, 0);
    const topPct =
      list.length > 0 && rangeTotalSecs > 0
        ? Math.round((list[0].secs / rangeTotalSecs) * 100)
        : 100;

    return {
      list: list.map((item) => ({
        ...item,
        pct: rangeTotalSecs > 0 ? Math.max(4, Math.round((item.secs / rangeTotalSecs) * 100)) : 0,
        durationFmt: fmtDur(item.secs),
      })),
      totalProjects: new Set(list.map((item) => item.projectName)).size,
      topKind: list[0]?.subjectName ? 'subproject' : 'project',
      topPct,
    };
  }, [portfolioEntries, projects]);

  const hoursByProject = useMemo(() => {
    const totals = new Map();
    portfolioStats.list.forEach((item) => {
      const project = projects.find((candidate) => candidate.id === item.projectId || candidate.name === item.projectName);
      const hasSubprojects = Boolean(project?.subjects?.length);
      const kind = hasSubprojects ? 'subproject' : 'project';
      const name = kind === 'subproject' ? `${item.projectName} · ${item.subjectName || 'Unassigned'}` : item.projectName;
      const current = totals.get(name) || {
        name,
        kind,
        color: item.color || project?.color || 'var(--db-portfolio-accent)',
        seconds: 0,
      };
      current.seconds += item.secs;
      totals.set(name, current);
    });
    const rows = [...totals.values()].sort((a, b) => b.seconds - a.seconds);
    const totalSeconds = rows.reduce((sum, item) => sum + item.seconds, 0);
    const circumference = 2 * Math.PI * 96;
    let offset = 0;
    const segments = rows.map((item, index) => {
      const length = totalSeconds ? item.seconds / totalSeconds * circumference : 0;
      const segment = { ...item, index, offset, length: Math.max(0, length - 4.5) };
      offset += length;
      return segment;
    });
    return {
      rows: rows.map((item) => ({ ...item, pct: totalSeconds ? Math.round(item.seconds / totalSeconds * 100) : 0 })),
      rowLabel: rows.every((item) => item.kind === 'subproject') ? 'subprojects' : rows.every((item) => item.kind === 'project') ? 'projects' : 'study areas',
      totalSeconds,
      segments,
      circumference,
    };
  }, [portfolioStats.list, projects]);

  const projectPlans = useMemo(() => projects.filter((project) => !project.archived).map((project) => {
    const matching = entries.filter((entry) => entry.projectId === project.id || (!entry.projectId && entry.projectName === project.name));
    const subjectPlans = project.subjects || [];
    const estimatedSubjects = subjectPlans.filter((subject) => Number(subject.estimateHours) > 0);
    const estimateHours = estimatedSubjects.reduce((sum, subject) => sum + (Number(subject.estimateHours) || 0), 0);
    const planEntries = !estimatedSubjects.length ? matching : matching.filter((entry) => estimatedSubjects.some((subject) => entry.subjectId === subject.id || (!entry.subjectId && entry.subjectName === subject.name)));
    const seconds = planEntries.reduce((sum, entry) => sum + (Number(entry.durationSeconds) || 0), 0);
    const remainingSeconds = Math.max(0, estimateHours * 3600 - seconds);
    const recentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    const recentSeconds = planEntries.filter((entry) => {
      const time = new Date(entry.startedAt).getTime();
      return Number.isFinite(time) && time >= recentStart.getTime() && time <= now.getTime();
    }).reduce((sum, entry) => sum + (Number(entry.durationSeconds) || 0), 0);
    const recentActiveDays = new Set(planEntries.filter((entry) => {
      const time = new Date(entry.startedAt).getTime();
      return Number.isFinite(time) && time >= recentStart.getTime() && time <= now.getTime() && (Number(entry.durationSeconds) || 0) > 0;
    }).map((entry) => dateKey(entry.startedAt))).size;
    const pacePerDay = recentActiveDays ? recentSeconds / 30 : 0;
    const forecastDate = remainingSeconds > 0 && pacePerDay > 0 ? new Date(now.getTime() + (remainingSeconds / pacePerDay) * 86400000) : null;
    const deadlineValues = subjectPlans.map((subject) => subject.deadline).filter(Boolean).map((value) => new Date(`${value}T23:59:59`)).filter((value) => Number.isFinite(value.getTime())).sort((a, b) => a - b);
    const deadline = deadlineValues[0] || null;
    const milestones = subjectPlans.flatMap((subject) => Array.isArray(subject.milestones) ? subject.milestones : []);
    const completedMilestones = milestones.filter((milestone) => milestone.completed).length;
    return { id: project.id, name: project.name, color: project.color, seconds, estimateHours, remainingSeconds, progress: estimateHours > 0 ? Math.min(100, Math.round(seconds / (estimateHours * 3600) * 100)) : null, forecastDate: forecastDate && Number.isFinite(forecastDate.getTime()) ? forecastDate : null, deadline: deadline && Number.isFinite(deadline.getTime()) ? deadline : null, milestones, completedMilestones };
  }), [projects, entries, now]);

  /* ── ROW 5: 24h × 7d Time-of-Day Heatmap ────── */
  const heatmapStats = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
    rangeEntries.forEach((e) => {
      if (!e.startedAt) return;
      const d = new Date(e.startedAt);
      const dayIdx = d.getDay();
      const hour = d.getHours();
      matrix[dayIdx][hour] += e.durationSeconds || 0;
    });

    let maxCell = 1;
    let peakDayIdx = 2; // Tue default
    let peakHour = 0;
    for (let day = 0; day < 7; day++) {
      for (let hr = 0; hr < 24; hr++) {
        if (matrix[day][hr] > maxCell) {
          maxCell = matrix[day][hr];
          peakDayIdx = day;
          peakHour = hr;
        }
      }
    }

    return {
      days,
      matrix,
      maxCell,
      peakDayIdx,
      peakHour,
    };
  }, [rangeEntries]);

  /* ── ROW 6: 52-Week Activity Calendar ───────── */
  const activityCalStats = useMemo(() => {
    const dateMap = new Map();
    rangeEntries.forEach((e) => {
      if (!e.startedAt) return;
      const k = dateKey(e.startedAt);
      dateMap.set(k, (dateMap.get(k) || 0) + (e.durationSeconds || 0));
    });

    const rangeStart = new Date(dateWindow.start);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(dateWindow.end);
    rangeEnd.setHours(0, 0, 0, 0);
    const visibleEnd = new Date(rangeEnd);
    if (dateRange === 'week') visibleEnd.setDate(visibleEnd.getDate() + (6 - getWeekStartOffset(visibleEnd, weekStart)));
    const start = new Date(rangeStart);
    start.setDate(start.getDate() - getWeekStartOffset(start, weekStart));
    const weeks = [];
    let maxVal = 1;
    let activeDaysCount = 0;
    const monthNames = [];
    const cursor = new Date(start);
    while (cursor <= visibleEnd) {
      const week = [];
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const day = new Date(cursor);
        day.setDate(day.getDate() + dayIndex);
        if (day < rangeStart || day > visibleEnd) {
          week.push(null);
          continue;
        }
        const key = dateKey(day);
        const val = dateMap.get(key) || 0;
        if (val > maxVal) maxVal = val;
        if (val > 0) activeDaysCount++;
        const monthLabel = day.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
        if (!monthNames.includes(monthLabel)) monthNames.push(monthLabel);
        week.push({ key, dateStr: formatDisplayDate(day, { month: 'short', day: 'numeric', year: 'numeric' }), val, isToday: day.toDateString() === new Date().toDateString(), isFuture: day > new Date() });
      }
      weeks.push(week);
      cursor.setDate(cursor.getDate() + 7);
    }

    return {
      weeks,
      monthNames,
      maxVal,
      activeDaysCount,
    };
  }, [rangeEntries, dateWindow, dateRange, weekStart]);

  // Determine dominant tier to highlight
  const dominantTier = useMemo(() => {
    const { sprint, pomodoro, deepFlow, marathon } = sessionTierStats;
    const maxVal = Math.max(sprint, pomodoro, deepFlow, marathon);
    if (maxVal === 0) return 'marathon';
    if (marathon === maxVal) return 'marathon';
    if (deepFlow === maxVal) return 'deepFlow';
    if (pomodoro === maxVal) return 'pomodoro';
    return 'sprint';
  }, [sessionTierStats]);

  return (
    <div className={`db-apple-root ${isDark ? 'dark-mode' : 'light-mode'}`} style={getSiteFontStyle(config, 'dashboard')}>
      {/* ================= OPTIONAL FLOATING NAVBAR (When standalone) ================= */}
      {standalone && (
        <header className="db-apple-navbar">
          <div className="db-navbar-inner">
            <div className="db-navbar-brand">
              <div className="db-brand-icon">⏳</div>
              <span className="db-brand-text">
                Study<span className="db-brand-accent">Duel</span>
              </span>
              <span className="db-brand-divider" />
              <span className="db-brand-user">{user ? user.display_name : 'Guest'}</span>
            </div>

            <nav className="db-segmented-nav">
              {['Timer', 'Dashboard', 'Compare', 'Manage'].map((tab) => {
                const active = activeNav === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveNav(tab);
                      onNavigate?.(tab.toLowerCase());
                    }}
                    className={`db-nav-pill ${active ? 'active' : ''}`}
                  >
                    {tab}
                  </button>
                );
              })}
            </nav>

            <div className="db-navbar-actions">
              <button
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className="db-action-circle-btn"
                title="Toggle Theme"
              >
                {isDark ? (
                  <Sun className="w-4 h-4" style={{ color: 'var(--sd-coral-primary)' }} />
                ) : (
                  <Moon className="w-4 h-4 text-[#5C5C5F]" />
                )}
              </button>
              <button
                onClick={() => onNavigate?.('settings')}
                className="db-action-circle-btn"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={() => onNavigate?.('timer')}
                className="db-action-exit-btn"
                title="Exit Demo"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Exit demo</span>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* ================= MAIN BENTO CONTAINER ================= */}
      <div className="db-bento-container">
        <section className="db-dashboard-controls" style={{ order: 0 }} aria-label="Dashboard display controls">
          <div className="db-range-control-copy">
            <span>STUDY PERIOD</span>
            <div className="db-range-dropdown" ref={rangeMenuRef}>
              <button type="button" className={`db-range-trigger${rangeMenuOpen ? ' active' : ''}`} aria-label="Dashboard date range" aria-haspopup="listbox" aria-expanded={rangeMenuOpen} onClick={() => setRangeMenuOpen((open) => !open)}>
                <strong>{rangeLabel}</strong><ChevronDown size={14} aria-hidden="true" />
              </button>
              {rangeMenuOpen && <div className="db-range-menu" role="listbox" aria-label="Dashboard date range options">
                {dashboardRangeOptions.map((option) => (
                  <button key={option.id} type="button" role="option" aria-selected={dateRange === option.id} className={dateRange === option.id ? 'active' : ''} onClick={() => { setDateRange(option.id); setRangeMenuOpen(false); }}>
                    <span>{option.label}</span>{dateRange === option.id && <span className="db-range-menu-check" aria-hidden="true">✓</span>}
                  </button>
                ))}
              </div>}
            </div>
          </div>
          {dateRange === 'custom' && (
            <div className="db-custom-date-inputs">
              <label>From<input type="date" value={customStart} max={customEnd} onChange={(event) => setCustomStart(event.target.value)} /></label>
              <label>To<input type="date" value={customEnd} min={customStart} max={new Date().toLocaleDateString('en-CA')} onChange={(event) => setCustomEnd(event.target.value)} /></label>
            </div>
          )}
          <div className="db-today-inline" aria-label="Today's study progress">
            <div className="db-today-inline-date"><span>TODAY</span><strong>{formatDisplayDate(now, { weekday: 'short', month: 'short', day: 'numeric' })}</strong></div>
            <div className="db-today-inline-main">
              <strong>{fmtDur(todaySnapshot.loggedSeconds)} <small>{todaySnapshot.targetSeconds ? `of ${fmtDur(todaySnapshot.targetSeconds)} goal` : 'logged'}</small></strong>
              <div className={`db-today-inline-track${todaySnapshot.targetSeconds ? '' : ' is-empty'}`}><span style={{ width: `${todaySnapshot.progress}%` }} /></div>
            </div>
            <div className="db-today-inline-meta">
              <strong>{todaySnapshot.targetSeconds ? `${todaySnapshot.progress}%` : '—'}</strong>
              <small>{todaySnapshot.sessionCount} {todaySnapshot.sessionCount === 1 ? 'session' : 'sessions'}{todaySnapshot.targetSeconds ? ` · ${todaySnapshot.remainingSeconds ? `${fmtDur(todaySnapshot.remainingSeconds)} left` : 'goal met'}` : ''}</small>
            </div>
          </div>
          <div className="db-customize-wrap" ref={customizerRef}>
            <button type="button" className={`db-customize-trigger${customizerOpen ? ' active' : ''}`} aria-label="Customize dashboard sections" aria-expanded={customizerOpen} onClick={() => setCustomizerOpen((open) => !open)}>
              <SlidersHorizontal size={16} aria-hidden="true" />
            </button>
            {customizerOpen && (
              <div className="db-customizer-panel" role="dialog" aria-label="Personalize dashboard sections">
                <div className="db-customizer-heading"><strong>Personalize dashboard</strong><span>Show, pin, collapse, or reorder sections.</span></div>
                {orderedDashboardSections.map((section, index) => (
                  <div className="db-customizer-row" key={section.id}>
                    <label><input type="checkbox" checked={section.visible} onChange={(event) => updateDashboardSection(section.id, { visible: event.target.checked })} /><span>{section.label}</span></label>
                    <div className="db-customizer-actions">
                      <button type="button" className={section.pinned ? 'selected' : ''} title={section.pinned ? 'Unpin section' : 'Pin section near top'} aria-label={`${section.pinned ? 'Unpin' : 'Pin'} ${section.label}`} onClick={() => updateDashboardSection(section.id, { pinned: !section.pinned })}><Pin size={13} /></button>
                      <button type="button" className={section.collapsed ? 'selected' : ''} title={section.collapsed ? 'Expand section' : 'Collapse section'} aria-label={`${section.collapsed ? 'Expand' : 'Collapse'} ${section.label}`} onClick={() => updateDashboardSection(section.id, { collapsed: !section.collapsed })}>{section.collapsed ? '＋' : '−'}</button>
                      <button type="button" title="Move section up" aria-label={`Move ${section.label} up`} disabled={index === 0} onClick={() => moveDashboardSection(section.id, -1)}><ArrowUp size={13} /></button>
                      <button type="button" title="Move section down" aria-label={`Move ${section.label} down`} disabled={index === orderedDashboardSections.length - 1} onClick={() => moveDashboardSection(section.id, 1)}><ArrowDown size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        <DashboardSection section={dashboardSection('overview')} order={dashboardSectionOrder('overview')} onExpand={(id) => updateDashboardSection(id, { collapsed: false })}>
          <section className="db-weekly-focus-card" aria-label={`${rangeLabel} study summary`}>
            <div className="db-weekly-focus-heading">
              <div>
                <span className="db-weekly-focus-eyebrow">{rangeLabel.toUpperCase()} · STUDY SUMMARY</span>
              </div>
            </div>

            <div className="db-weekly-focus-main">
              <div className="db-weekly-total-block">
                <span className="db-weekly-total-label">{text('dashboard', 'timeTrackedLabel', 'TIME LOGGED')}</span>
                <strong className="db-weekly-total">{fmtDur(rangeSecs)}</strong>
                <span className={`db-weekly-comparison ${previousWindow ? (rangeDeltaSecs >= 0 ? 'is-positive' : 'is-negative') : 'is-neutral'}`}>
                  {previousWindow
                    ? `${rangeDeltaSecs > 0 ? '+' : rangeDeltaSecs < 0 ? '−' : ''}${fmtDur(Math.abs(rangeDeltaSecs))} vs previous comparable period`
                    : 'Total across all recorded time'}
                </span>
              </div>

              <div className="db-weekly-goal-block">
                <div className="db-weekly-goal-heading">
                  <div><span className="db-weekly-total-label">{dateRange === 'week' ? 'WEEKLY' : 'PERIOD'} TARGET</span><strong>{hasComparableGoal ? `${fmtDur(rangeSecs)} of ${fmtDur(rangeGoalSecs)}` : dateRange === 'all' ? 'Not used for all-time totals' : 'No target set yet'}</strong></div>
                  {hasComparableGoal
                    ? <span className="db-weekly-goal-percent">{rangeGoalPct}%</span>
                    : dateRange !== 'all' && <button type="button" className="db-weekly-set-goal" onClick={() => onNavigate?.('manage')}>Set a target <ArrowRight size={13} /></button>}
                </div>
                {dateRange !== 'all' && <div className={`db-weekly-goal-track${hasComparableGoal ? '' : ' is-empty'}`} aria-label={hasComparableGoal ? `Goal progress ${rangeGoalPct}%` : 'No period target set'}>
                  <span style={{ width: `${rangeGoalPct}%` }} />
                </div>}
                <p className="db-weekly-pace-copy">
                  {dateRange === 'all'
                    ? 'All recorded study time across your account.'
                    : hasComparableGoal
                    ? rangeGoalRemainingSecs === 0
                      ? 'Weekly target reached. Great work.'
                      : paceIsOnTrack
                        ? `${fmtDur(rangeGoalRemainingSecs)} left · on pace for this point in the period`
                        : `${fmtDur(paceDifferenceSecs)} behind the planned pace · ${fmtDur(rangeGoalRemainingSecs)} left`
                    : 'Add weekly goals to your projects to see whether you are on pace.'}
                </p>
              </div>
            </div>

            <div className="db-weekly-quick-stats">
              <div><strong>{rangeActiveDays}<span> / {elapsedRangeDays}</span></strong><small>days studied so far</small></div>
              <div><strong>{rangeEntries.length}</strong><small>sessions this period</small></div>
              <div><strong>{rangeActiveDays ? fmtDur(averageActiveDaySecs) : '—'}</strong><small>average per study day</small></div>
              <div className="db-weekly-top-project"><strong>{rangeTopProject?.[0] || '—'}</strong><small>most studied project</small></div>
            </div>
          </section>
        </DashboardSection>

        <DashboardSection section={dashboardSection('daily')} order={dashboardSectionOrder('daily')} onExpand={(id) => updateDashboardSection(id, { collapsed: false })}>
          <SnapshotPanel snapshotMetrics={snapshotMetrics} />
        </DashboardSection>

        <DashboardSection section={dashboardSection('focus')} order={dashboardSectionOrder('focus')} onExpand={(id) => updateDashboardSection(id, { collapsed: false })}>
          {/* ROW 2: FOCUS DEPTH & FLOW STATE (FULL WIDTH) */}
          <div className="db-card db-flow-card">
            {rangeEntries.length === 0 ? <><h2 className="db-section-title">Focus Depth & Flow State</h2><QuietEmptyState message="Focus breakdowns appear after you log a session in this range." onStart={() => onNavigate?.('timer')} /></> : <>
              <div className="db-card-header-flex">
                <div className="db-card-title-group">
                  <h2 className="db-section-title">Focus Depth & Flow State</h2>
                </div>
                <span className="db-section-meta">Cognitive Session Distribution</span>
              </div>

              {/* Harmonized Proportional Segmented Bar in Recessed Track */}
              <div className="db-segmented-bar-track">
                {sessionTierStats.total === 0 ? (
                  <div className="db-segmented-empty" />
                ) : (
                  <>
                    {sessionTierStats.sprintPct > 0 && (
                      <div
                        className="db-segmented-slice slice-sprint"
                        style={{ width: `${sessionTierStats.sprintPct}%` }}
                        title={`Sprint (<20m): ${sessionTierStats.sprintPct}%`}
                      />
                    )}
                    {sessionTierStats.pomodoroPct > 0 && (
                      <div
                        className="db-segmented-slice slice-pomodoro"
                        style={{ width: `${sessionTierStats.pomodoroPct}%` }}
                        title={`Pomodoro (20–45m): ${sessionTierStats.pomodoroPct}%`}
                      />
                    )}
                    {sessionTierStats.deepFlowPct > 0 && (
                      <div
                        className="db-segmented-slice slice-deepflow"
                        style={{ width: `${sessionTierStats.deepFlowPct}%` }}
                        title={`Deep Flow (45–90m): ${sessionTierStats.deepFlowPct}%`}
                      />
                    )}
                    {sessionTierStats.marathonPct > 0 && (
                      <div
                        className="db-segmented-slice slice-marathon"
                        style={{ width: `${sessionTierStats.marathonPct}%` }}
                        title={`Marathon (>90m): ${sessionTierStats.marathonPct}%`}
                      />
                    )}
                  </>
                )}
              </div>

              {/* 4 Session Sub-Cards with Internal Mini Progress Bars */}
              <div className="db-tier-cards-grid">
                {[
                  {
                    id: 'sprint',
                    name: 'Sprint (<20m)',
                    sess: `${sessionTierStats.sprint} sess`,
                    pct: `${sessionTierStats.sprintPct}%`,
                    pctNum: sessionTierStats.sprintPct,
                    dotClass: 'dot-sprint',
                    active: dominantTier === 'sprint' && sessionTierStats.sprint > 0,
                  },
                  {
                    id: 'pomodoro',
                    name: 'Pomodoro (20–45m)',
                    sess: `${sessionTierStats.pomodoro} sess`,
                    pct: `${sessionTierStats.pomodoroPct}%`,
                    pctNum: sessionTierStats.pomodoroPct,
                    dotClass: 'dot-pomodoro',
                    active: dominantTier === 'pomodoro' && sessionTierStats.pomodoro > 0,
                  },
                  {
                    id: 'deepFlow',
                    name: 'Deep Flow (45–90m)',
                    sess: `${sessionTierStats.deepFlow} sess`,
                    pct: `${sessionTierStats.deepFlowPct}%`,
                    pctNum: sessionTierStats.deepFlowPct,
                    dotClass: 'dot-deepflow',
                    active: dominantTier === 'deepFlow' && sessionTierStats.deepFlow > 0,
                  },
                  {
                    id: 'marathon',
                    name: 'Marathon (>90m)',
                    sess: `${sessionTierStats.marathon} sess`,
                    pct: `${sessionTierStats.marathonPct}%`,
                    pctNum: sessionTierStats.marathonPct,
                    dotClass: 'dot-marathon',
                    active: dominantTier === 'marathon' && sessionTierStats.marathon > 0,
                  },
                ].map((tier) => (
                  <div key={tier.id} className={`db-tier-card ${tier.active ? 'active-tier' : ''}`}>
                    <div className="db-tier-meta">
                      <span className={`db-tier-dot ${tier.dotClass}`} />
                      <span>{tier.name}</span>
                    </div>
                    <div className="db-tier-val-flex">
                      <span className="db-tier-sess">{tier.sess}</span>
                      <span className="db-tier-pct">{tier.pct}</span>
                    </div>
                    {/* Visual Micro Progress Bar inside each sub-card */}
                    <div className="db-tier-micro-track">
                      <div
                        className={`db-tier-micro-fill ${tier.dotClass}`}
                        style={{ width: `${tier.pctNum}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom 4 Summary Metrics with Clean Dividers */}
              <div className="db-flow-bottom-stats">
                <div className="db-flow-stat-col">
                  <div className="db-metric-label">AVG FOCUS DEPTH</div>
                  <div className="db-metric-val">
                    {avgFocusDepth > 0 ? fmtDur(avgFocusDepth) : '—'}
                  </div>
                </div>
                <div className="db-flow-stat-col">
                  <div className="db-metric-label">LONGEST SESSION</div>
                  <div className="db-metric-val">
                    {longestSession > 0 ? fmtDur(longestSession) : '—'}
                  </div>
                </div>
                <div className="db-flow-stat-col">
                  <div className="db-metric-label">CONTEXT SWITCHING</div>
                  <div className="db-metric-val">{contextSwitching}</div>
                </div>
                <div className="db-flow-stat-col">
                  <div className="db-metric-label">PEAK HOUR</div>
                  <div className="db-metric-val">{peakHourLabel}</div>
                </div>
              </div>
            </>}
          </div>
        </DashboardSection>

        <DashboardSection section={dashboardSection('rhythms')} order={dashboardSectionOrder('rhythms')} onExpand={(id) => updateDashboardSection(id, { collapsed: false })}>
          {/* ROW 3: CIRCADIAN FOCUS WINDOW (LEFT) + DAY-OF-WEEK POWER RHYTHM (RIGHT) */}
          <div className="db-bento-grid-row db-two-col db-rhythm-row">
            {rangeEntries.length === 0 ? <div className="db-card"><QuietEmptyState message="Study timing patterns appear after your first session in this range." onStart={() => onNavigate?.('timer')} /></div> : <>
              {/* Circadian Focus Window */}
              <div className="db-card db-card-column">
                <div>
                  <div className="db-card-header-flex mb-5">
                    <h2 className="db-section-title">Circadian Focus Window</h2>
                    <span className="db-section-meta">When you actually study</span>
                  </div>

                  <div className="db-circadian-grid">
                    {circadianStats.slots.map((slot, i) => (
                      <div
                        key={i}
                        className={`db-circadian-card ${slot.active ? 'active-slot' : ''}`}
                        title={`${slot.title} (${slot.sub}): ${fmtDur(slot.secs)} · ${slot.pct}`}
                      >
                        <div className="db-circadian-top">
                          <span>{slot.title}</span>
                          <span className="db-circadian-hours">{slot.sub}</span>
                        </div>
                        <div className="db-circadian-val">{slot.val}</div>
                        <div className="db-circadian-bar-track">
                          {slot.active && (
                            <div
                              className="db-circadian-bar-fill"
                              style={{ width: `${Math.max(10, slot.pctNum)}%` }}
                            />
                          )}
                        </div>
                        <div className="db-circadian-pct">{slot.pct}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="db-insight-footer">
                  <div className="db-insight-main">
                    <span className="db-insight-icon"><Sparkles /></span>
                    <span className="db-insight-label">Peak Cognitive Timing</span>
                    <strong className="db-insight-value">{circadianStats.hasData ? circadianStats.bestSlotTitle : '—'}</strong>
                  </div>
                  <span className="db-insight-metric">
                    {circadianStats.hasData ? `${circadianStats.bestPct}% of study` : '—'}
                  </span>
                </div>
              </div>

              {/* Day-of-Week Power Rhythm */}
              <div className="db-card db-card-column">
                <div>
                  <div className="db-card-header-flex mb-5">
                    <h2 className="db-section-title">Day-of-Week Power Rhythm</h2>
                    <span className="db-section-meta">Study output per weekday</span>
                  </div>

                  <div className="db-power-rhythm-list">
                    {dayOfWeekStats.rows.map((row, i) => (
                      <div
                        key={i}
                        className="db-power-rhythm-row"
                        title={`${row.day}: ${row.val}`}
                      >
                        <span className={`db-power-day-label ${row.active ? 'active' : ''}`}>
                          {row.day}
                        </span>
                        <div className="db-power-track">
                          <div
                            className={`db-power-fill ${row.active ? 'active' : ''}`}
                            style={{ width: `${row.pct}%` }}
                          />
                        </div>
                        <span className={`db-power-val-label ${row.active ? 'active' : ''}`}>
                          {row.val}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="db-insight-footer">
                  <div className="db-insight-main">
                    <span className="db-insight-icon"><Zap /></span>
                    <span className="db-insight-label">Power Day</span>
                    <strong className="db-insight-value">{dayOfWeekStats.powerDayName}</strong>
                  </div>
                  <span className="db-insight-metric">
                    {dayOfWeekStats.hasData ? `${dayOfWeekStats.powerDayVolume} total volume` : '—'}
                  </span>
                </div>
              </div>
            </>}
          </div>
        </DashboardSection>

        <DashboardSection section={dashboardSection('projects')} order={dashboardSectionOrder('projects')} onExpand={(id) => updateDashboardSection(id, { collapsed: false })}>
          {/* ROW 4: WEEKLY STUDY BAR CHART (LEFT) + PROJECT PORTFOLIO (RIGHT) */}
          <div className="db-bento-grid-row db-two-col db-weekly-portfolio-row">
            {/* Weekly Study Bar Chart */}
            <div className="db-card">
              <div className="db-card-header-flex mb-6">
                <h2 className="db-section-title">{weekBarData.unit === 'days' ? text('dashboard', 'dailyStudyTitle', 'Daily Study') : weekBarData.unit === 'weeks' ? text('dashboard', 'weeklyStudyTitle', 'Weekly Study') : text('dashboard', 'studyVolumeTitle', 'Study Volume')}</h2>
                <span className="db-section-meta">
                  {rangeLabel} · {weekBarData.totalWeeklyFmt} total · Peak {weekBarData.unit === 'days' ? 'day' : weekBarData.unit === 'weeks' ? 'week' : weekBarData.unit === 'quarters' ? 'quarter' : 'year'}: {weekBarData.peakDayLabel}{' '}
                  ({weekBarData.peakDayFmt})
                </span>
              </div>

              {/* Zero Overlap Bar Chart Container with Headroom */}
              {rangeEntries.length === 0 ? <QuietEmptyState message="No study logged in this date range." onStart={() => onNavigate?.('timer')} /> : <div className="db-weekly-chart-scroll" ref={weeklyStudyScrollRef}>
                <div className={`db-weekly-bar-chart-stage${weekBarData.unit === 'days' ? ' is-daily' : ''}`} style={{ minWidth: weekBarData.minWidth }}>
                  {weekBarData.cols.map((col, i) => (
                    <div
                      key={i}
                      className="db-weekly-bar-column"
                      title={`${col.dateLabel || col.day}: ${col.label || 'No study logged'}`}
                      aria-label={`${col.dateLabel || col.day}: ${col.label || 'No study logged'}`}
                    >
                      {col.label ? (
                        <span className={`db-weekly-bar-val-text ${col.active ? 'active' : ''}`}>
                          {col.label}
                        </span>
                      ) : (
                        <span className="db-weekly-bar-val-spacer" />
                      )}
                      <div
                        className={`db-weekly-bar-element ${col.active ? 'active' : ''} ${col.muted ? 'muted' : ''
                          }`}
                        style={{ height: `${Math.max(col.val > 0 ? 8 : 0, col.h)}%` }}
                      />
                    </div>
                  ))}
                </div>

                <div className="db-weekly-bar-days-footer" style={{ minWidth: weekBarData.minWidth }}>
                  {weekBarData.cols.map((col, idx) => (
                    <span
                      key={idx}
                      className={`db-weekly-day-item ${col.active ? 'active' : ''}`}
                    >
                      {col.day}
                    </span>
                  ))}
                </div>
              </div>}
            </div>

            {/* Project Portfolio */}
            <div className="db-card db-card-column">
              <div>
                <div className="db-card-header-flex mb-6">
                  <h2 className="db-section-title">Project Portfolio</h2>
                  <span className="db-section-meta">{rangeLabel}</span>
                </div>

                {/* Dynamic Project Items */}
                {portfolioStats.list.length === 0 ? (
                  <div className="db-portfolio-empty">
                    <p>No study logged for this range.</p>
                    <button onClick={() => onNavigate?.('timer')} className="db-portfolio-timer-btn">
                      Start a session
                    </button>
                  </div>
                ) : (
                  <div className="db-portfolio-list">
                    {portfolioStats.list.map((item, idx) => (
                      <div
                        key={idx}
                        className="db-portfolio-item"
                        title={`${item.projectName}${item.subjectName ? ` · ${item.subjectName}` : ''}: ${item.durationFmt} across ${item.count} ${item.count === 1 ? 'session' : 'sessions'}`}
                      >
                        <div className="db-portfolio-item-meta">
                          <div className="db-portfolio-item-name-group">
                            <span
                              className="db-portfolio-dot"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="db-portfolio-item-title">
                              {item.projectName}
                              {item.subjectName ? ` · ${item.subjectName}` : ''}
                            </span>
                          </div>
                          <div className="db-portfolio-item-stats">
                            <span className="db-portfolio-sess-count">
                              {item.count} {item.count === 1 ? 'session' : 'sessions'}
                            </span>
                            <span className="db-portfolio-duration">{item.durationFmt}</span>
                          </div>
                        </div>
                        <div className="db-portfolio-bar-track">
                          <div
                            className="db-portfolio-bar-fill"
                            style={{
                              width: `${item.pct}%`,
                              '--portfolio-color': item.color,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="db-portfolio-footer">
                <span>Top {portfolioStats.topKind} accounts for {portfolioStats.topPct}% of {rangeLabel.toLowerCase()} study</span>
                <span className="accent">
                  {portfolioStats.totalProjects} active{' '}
                  {portfolioStats.totalProjects === 1 ? 'project' : 'projects'}
                </span>
              </div>
            </div>
          </div>
          <div className="db-bento-grid-row db-two-col db-project-plans-row">
            <div className="db-card db-project-plans-card">
              <div className="db-card-header-flex">
                <div><h2 className="db-section-title">Project plans</h2><span className="db-section-meta">Estimate, progress, and a pace-based finish forecast</span></div>
                <button type="button" className="db-manage-link" onClick={() => onNavigate?.('manage')}>Edit plans <span aria-hidden="true">→</span></button>
              </div>
              {projectPlans.length === 0 ? (
                <div className="db-range-empty"><span>Add a project to plan its estimate, deadline, and milestones.</span><button type="button" onClick={() => onNavigate?.('manage')}>Open project library <span aria-hidden="true">→</span></button></div>
              ) : (
                <div className="db-project-plans-list">
                  {projectPlans.map((plan) => (
                    <article className="db-project-plan-row" key={plan.id}>
                      <span className="db-project-plan-dot" style={{ backgroundColor: plan.color || 'var(--db-portfolio-accent)' }} />
                      <div className="db-project-plan-main">
                        <div className="db-project-plan-title"><strong>{plan.name}</strong>{plan.estimateHours > 0 && <span>{fmtDur(plan.seconds)} / {fmtDur(plan.estimateHours * 3600)}</span>}</div>
                        {plan.estimateHours > 0 ? <div className="db-project-plan-track"><span style={{ width: `${plan.progress}%` }} /></div> : <p>Set a total estimate in Manage to track progress.</p>}
                        <div className="db-project-plan-meta">
                          <span>{plan.estimateHours > 0 ? `${plan.progress}% complete · ${fmtDur(plan.remainingSeconds)} left` : 'No total estimate set'}</span>
                          <span>{plan.milestones.length ? `${plan.completedMilestones}/${plan.milestones.length} milestones` : 'No milestones yet'}</span>
                          <span>{plan.deadline ? `Due ${formatDisplayDate(plan.deadline, { month: 'short', day: 'numeric' })}${plan.forecastDate ? ` · pace ${formatDisplayDate(plan.forecastDate, { month: 'short', day: 'numeric' })}` : ''}` : plan.estimateHours > 0 && plan.remainingSeconds === 0 ? 'Time estimate reached' : plan.forecastDate ? `At recent pace: ${formatDisplayDate(plan.forecastDate, { month: 'short', day: 'numeric' })}` : 'Log sessions to estimate finish'}</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
            <div className="db-card db-hours-project-card">
              <div className="db-card-header-flex"><div><h2 className="db-section-title">Hours by Subproject</h2><span className="db-section-meta">Study time in {rangeLabel.toLowerCase()}</span></div></div>
              {hoursByProject.rows.length ? <div className="db-hours-project-body">
                <div className="db-hours-project-donut-shell">
                  <svg className="db-hours-project-donut" viewBox="0 0 260 260" role="img" aria-label={`Hours by subproject: ${hoursByProject.rows.map((row) => `${row.name} ${row.pct}%`).join(', ')}`}>
                    <defs>
                      <linearGradient id="hours-donut-center-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="var(--db-glass-goal-bg)" /><stop offset="100%" stopColor="var(--db-card-bg)" /></linearGradient>
                      <filter id="hours-donut-shadow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur" /><feOffset dy="3" result="offsetBlur" /><feComponentTransfer><feFuncA type="linear" slope=".22" /></feComponentTransfer><feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                      {hoursByProject.segments.map((segment) => <linearGradient key={segment.name} id={`hours-project-gradient-${segment.index}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={`color-mix(in srgb, ${segment.color} 66%, #161923 34%)`} />
                        <stop offset="52%" stopColor={segment.color} />
                        <stop offset="100%" stopColor={`color-mix(in srgb, ${segment.color} 62%, white 38%)`} />
                      </linearGradient>)}
                    </defs>
                    <circle className="db-hours-donut-orbit" cx="130" cy="130" r="114" />
                    <circle cx="130" cy="130" r="96" fill="none" stroke="var(--db-track-bg)" strokeWidth="31" />
                    {hoursByProject.segments.map((segment) => <circle
                      key={segment.name}
                      className="db-hours-donut-segment"
                      cx="130" cy="130" r="96" fill="none"
                      stroke={`url(#hours-project-gradient-${segment.index})`}
                      strokeWidth="31"
                      strokeDasharray={`${segment.length} ${hoursByProject.circumference - segment.length}`}
                      strokeDashoffset={-segment.offset}
                      transform="rotate(-90 130 130)"
                      filter="url(#hours-donut-shadow)"
                      tabIndex="0"
                      aria-label={`${segment.name}: ${fmtDur(segment.seconds)}, ${Math.round(segment.seconds / hoursByProject.totalSeconds * 100)}%`}
                      onMouseEnter={() => setHoursDonutTooltip(segment)}
                      onFocus={() => setHoursDonutTooltip(segment)}
                      onMouseLeave={() => setHoursDonutTooltip(null)}
                      onBlur={() => setHoursDonutTooltip(null)}
                    ><title>{`${segment.name}: ${fmtDur(segment.seconds)} (${Math.round(segment.seconds / hoursByProject.totalSeconds * 100)}%)`}</title></circle>)}
                    <circle className="db-hours-donut-inner-orbit" cx="130" cy="130" r="72" />
                    <circle cx="130" cy="130" r="68" fill="url(#hours-donut-center-glass)" stroke="var(--db-glass-goal-border)" strokeWidth="1.2" />
                  </svg>
                  {hoursDonutTooltip && <div className="db-hours-project-tooltip" role="tooltip"><strong>{hoursDonutTooltip.name}</strong><span>{fmtDur(hoursDonutTooltip.seconds)} · {Math.round(hoursDonutTooltip.seconds / hoursByProject.totalSeconds * 100)}%</span></div>}
                  <div className="db-hours-project-total"><span>STUDY TIME</span><strong>{fmtDur(hoursByProject.totalSeconds)}</strong><small>{hoursByProject.rows.length} {hoursByProject.rows.length === 1 ? hoursByProject.rowLabel.replace(/s$/, '') : hoursByProject.rowLabel}</small></div>
                </div>
                <div className="db-hours-project-legend">
                  {hoursByProject.rows.map((row) => <div className="db-hours-project-legend-row" key={row.name} title={`${row.name}: ${fmtDur(row.seconds)}`}>
                    <span className="db-hours-project-name"><i style={{ backgroundColor: row.color }} /><span>{row.name}</span></span>
                    <strong>{fmtDur(row.seconds)}</strong><small>{row.pct}%</small>
                  </div>)}
                </div>
              </div> : <div className="db-hours-project-empty">No project study time in this date range yet.</div>}
            </div>
          </div>
        </DashboardSection>

        {/* Study trend charts */}
        <DashboardSection section={dashboardSection('patterns')} order={dashboardSectionOrder('patterns')} onExpand={(id) => updateDashboardSection(id, { collapsed: false })}>
          <section className="db-chart-section" aria-labelledby="db-study-patterns-title">
            <div className="db-chart-section-heading">
              <div>
                <h2 id="db-study-patterns-title">Study patterns</h2>
                <p>Study consistency, momentum, and session length</p>
              </div>
            </div>
            <div className="db-bento-grid-row db-two-col db-chart-pair">
              <StudyVelocityCard stats={studyVelocityStats} hasData={rangeEntries.length > 0} onStart={() => onNavigate?.('timer')} />
            </div>
            <div className="db-bento-grid-row db-two-col db-chart-pair">
              <WeeklyTrendGraph weeks={weeklyTrendData.points} periodUnit={weeklyTrendData.unit} hasData={weeklyTrendData.points.some((week) => week.seconds > 0)} onStart={() => onNavigate?.('timer')} rangeLabel={weeklyTrendData.rangeLabel} />
              <SessionLengthGraph buckets={sessionLengthData} hasData={rangeEntries.length > 0} onStart={() => onNavigate?.('timer')} />
            </div>
          </section>
        </DashboardSection>

        <DashboardSection section={dashboardSection('heatmap')} order={dashboardSectionOrder('heatmap')} onExpand={(id) => updateDashboardSection(id, { collapsed: false })}>
          {/* ROW 5: TIME-OF-DAY HEATMAP (24H x 7 DAYS) */}
          <div className="db-card">
            <div className="db-card-header-flex mb-5">
              <h2 className="db-section-title">Time-of-Day Heatmap</h2>
              <span className="db-section-meta">Study hours by day and hour</span>
            </div>

            {rangeEntries.length === 0 ? <QuietEmptyState message="The heatmap fills in as you log sessions." onStart={() => onNavigate?.('timer')} /> : <div className="db-heatmap-scroll">
              <div className="db-heatmap-matrix-min">
                {/* Hour Headers */}
                <div className="db-heatmap-hour-headers">
                  <div className="db-heatmap-hour-spacer" />
                  {Array.from({ length: 24 }).map((_, h) => (
                    <div key={h} className="db-heatmap-hour-tag">
                      {h % 3 === 0 ? `${h}h` : ''}
                    </div>
                  ))}
                </div>

                {/* 7 Day Rows */}
                <div className="db-heatmap-rows-stack">
                  {heatmapStats.days.map((day, dayIdx) => (
                    <div key={day} className="db-heatmap-day-row">
                      <span className="db-heatmap-day-label">{day}</span>
                      {Array.from({ length: 24 }).map((_, h) => {
                        const secs = heatmapStats.matrix[dayIdx][h];
                        const isPeak =
                          secs > 0 &&
                          dayIdx === heatmapStats.peakDayIdx &&
                          h === heatmapStats.peakHour;
                        const hasStudy = secs > 0;
                        const opacity = hasStudy
                          ? Math.min(1, Math.max(0.25, secs / heatmapStats.maxCell))
                          : 0;

                        return (
                          <div
                            key={h}
                            title={`${day} ${h}:00 · ${secs > 0 ? fmtDur(secs) : 'No study'}`}
                            className={`db-heatmap-slot ${isPeak ? 'peak-slot' : ''} ${hasStudy ? 'study-slot' : 'empty-slot'
                              }`}
                            style={hasStudy && !isPeak ? { opacity } : {}}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            }
          </div>
        </DashboardSection>

        <DashboardSection section={dashboardSection('calendar')} order={dashboardSectionOrder('calendar')} onExpand={(id) => updateDashboardSection(id, { collapsed: false })}>
          {/* Activity calendar for the selected range */}
          <div className="db-card">
            <div className="db-card-header-flex mb-5">
              <h2 className="db-section-title">Activity Calendar</h2>
              <span className="db-section-meta">
                {rangeLabel} · {activityCalStats.activeDaysCount} active days · {fmtDur(rangeSecs)} logged
              </span>
            </div>

            {rangeEntries.length === 0 ? <QuietEmptyState message="Your activity calendar will appear after the first session in this range." onStart={() => onNavigate?.('timer')} /> : (
              <div className="db-activity-cal-scroll">
                <div className="db-activity-cal-min">
                  <div className="db-activity-cal-months">
                    {activityCalStats.monthNames.map((m, idx) => (
                      <span key={idx}>{m}</span>
                    ))}
                  </div>

                  {activityCalStats.weeks.length <= 2 ? (
                    <div className="db-activity-cal-days">
                      {activityCalStats.weeks.flat().filter(Boolean).map((day) => {
                        const date = new Date(`${day.key}T12:00:00`);
                        return (
                          <div
                            key={day.key}
                            title={`${day.dateStr} · ${day.val > 0 ? fmtDur(day.val) : 'No study'}`}
                            className={`db-activity-cal-day${day.isToday ? ' is-today' : ''}${day.val > 0 ? ' has-study' : ''}${day.isFuture ? ' is-future' : ''}`}
                          >
                            <span>{date.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                            <strong>{date.getDate()}</strong>
                            <small>{day.isFuture ? 'Upcoming' : day.val > 0 ? fmtDur(day.val) : '—'}</small>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="db-activity-cal-body">
                      <div className="db-activity-cal-weekdays" aria-hidden="true">
                        <span>Sun</span>
                        <span>Wed</span>
                        <span>Sat</span>
                      </div>
                      <div className="db-activity-cal-grid" style={{ gridTemplateColumns: `repeat(${activityCalStats.weeks.length}, minmax(0, 1fr))` }}>
                        {activityCalStats.weeks.map((week, weekIdx) => (
                          <div key={weekIdx} className="db-activity-cal-week-col">
                            {week.map((day, dayIdx) => {
                              if (!day) return <div key={dayIdx} className="db-activity-cal-cell empty-ghost" />;
                              const hasVal = day.val > 0;
                              const isMax = hasVal && day.val === activityCalStats.maxVal;
                              const opacity = hasVal ? Math.min(1, Math.max(0.3, day.val / activityCalStats.maxVal)) : 0;
                              return (
                                <div
                                  key={dayIdx}
                                  title={`${day.dateStr} · ${hasVal ? fmtDur(day.val) : 'No study'}`}
                                  className={`db-activity-cal-cell ${day.isToday ? 'is-today-ring' : ''} ${isMax ? 'is-max' : hasVal ? 'is-active' : 'is-empty'}`}
                                  style={hasVal && !isMax ? { opacity } : {}}
                                />
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </DashboardSection>
      </div>
      {calendarOpen && (
        <CalendarPage
          user={user}
          entries={entries}
          setEntries={setEntries}
          projects={projects}
          onClose={() => setCalendarOpen(false)}
        />
      )}
    </div>
  );
}

export default DashboardPage;
