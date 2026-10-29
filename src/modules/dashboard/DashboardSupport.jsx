import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Target, Trophy, Flame } from 'lucide-react';

/* ── Helpers ─────────────────────────────────── */
export const fmtDur = (s) => {
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

export const percentComparison = (current, previous, periodLabel) => {
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

export const snapshotPeriodSeconds = (entries, start, end) => entries.reduce((total, entry) => {
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

export const SnapshotPanel = ({ snapshotMetrics, onReviewTargets }) => {
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
      insightText = `On pace · ${fmtDur(pace)}/day · projecting ${fmtDur(projectedEnd)} by week end`;
    } else if (weekDaysRemaining > 0) {
      const neededPerDay = deficit / weekDaysRemaining;
      insightKind = 'warn';
      insightText = neededPerDay > 8 * 3600 ? 'Your remaining target needs a demanding pace. Review your priorities or lower the target.' : `${fmtDur(deficit)} remaining · ${fmtDur(neededPerDay)}/day across ${weekDaysRemaining} remaining days. Adjust the target if your plans changed.`;
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
            <span className="db-snapshot-insight-copy">
              <strong>{insightKind === 'warn' ? 'Review your plan' : insightKind === 'good' ? 'On track' : 'Weekly pace'}</strong>
              <span>{insightText}</span>{insightKind === 'warn' && onReviewTargets && <button type="button" className="db-weekly-set-goal" onClick={onReviewTargets}>Review targets</button>}
            </span>
          </div>
        )}
      </div>

      <div className="db-snapshot-grid" aria-label="Weekly and monthly study snapshot">
        {snapshotMetrics.map((metric) => {
          const isWeek = metric.id === 'time-week';
          const isMonth = metric.id === 'time-month';
          const weekDayMax = isWeek && metric.weekDays
            ? Math.max(...metric.weekDays.map((day) => day.seconds), 1)
            : 1;

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
                <div className="db-snap-week-chart" aria-label="Study time by day this week">
                  {metric.weekDays.map((d) => (
                    <div
                      key={d.key}
                      className={`db-snap-week-column${d.active ? ' is-active' : ''}${d.isToday ? ' is-today' : ''}${!d.isPastOrToday ? ' is-future' : ''}`}
                      style={{ '--week-bar-height': `${(d.seconds / weekDayMax) * 100}%` }}
                      data-tooltip={`${d.fullDay}: ${fmtDur(d.seconds)} studied`}
                      aria-label={`${d.fullDay}: ${fmtDur(d.seconds)} studied`}
                    >
                      <span
                        className="db-snap-week-bar"
                        aria-label={`${d.fullDay}: ${fmtDur(d.seconds)} studied`}
                        role="img"
                        style={{ height: `${(d.seconds / weekDayMax) * 100}%` }}
                      />
                      <span className="db-snap-day-label">{d.label}</span>
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

export const WeeklyTrendGraph = ({ weeks, hasData, onStart, rangeLabel, periodUnit = 'week' }) => {
  const chartTooltip = useSvgChartTooltip();
  const chartScrollRef = useRef(null);
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

  useEffect(() => {
    const scroller = chartScrollRef.current;
    if (!scroller) return undefined;
    const frame = window.requestAnimationFrame(() => { scroller.scrollLeft = scroller.scrollWidth; });
    return () => window.cancelAnimationFrame(frame);
  }, [width, weeks]);

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
      {!hasData ? <QuietEmptyState message="No weekly activity to chart in this range." onStart={onStart} /> : <div className="db-chart-scroll" ref={chartScrollRef}>
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

export const SessionLengthGraph = ({ buckets, hasData, onStart }) => {
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

export const StudyVelocityCard = ({ stats, hasData, onStart }) => {
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

export const DashboardSection = ({ section, order, onExpand, children }) => {
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

export const QuietEmptyState = ({ message, onStart }) => (
  <div className="db-range-empty">
    <span>{message}</span>
    <button type="button" onClick={onStart}>Start a session <span aria-hidden="true">→</span></button>
  </div>
);


export const dateKey = (d) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

export const weekDayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
export const getWeekStartDayIndex = (weekStart) => {
  const index = weekDayKeys.indexOf(weekStart);
  return index < 0 ? 1 : index;
};
export const getWeekStartOffset = (date, weekStart) => (date.getDay() - getWeekStartDayIndex(weekStart) + 7) % 7;

export const dashboardRangeOptions = [
  { id: 'today', label: 'Today' },
  { id: '7days', label: 'Last 7 days' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: '30days', label: 'Last 30 days' },
  { id: '90days', label: 'Last 90 days' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom' },
];

export const dashboardSectionDefaults = [
  { id: 'daily', label: 'Snapshot', visible: true, pinned: true, collapsed: false },
  { id: 'overview', label: 'Overview', visible: true, pinned: true, collapsed: false },
  { id: 'focus', label: 'Focus distribution', visible: false, pinned: false, collapsed: false },
  { id: 'rhythms', label: 'Study rhythms', visible: false, pinned: false, collapsed: false },
  { id: 'projects', label: 'Project progress', visible: true, pinned: true, collapsed: false },
  { id: 'patterns', label: 'Study pattern charts', visible: false, pinned: false, collapsed: false },
  { id: 'heatmap', label: 'Time-of-day heatmap', visible: false, pinned: false, collapsed: false },
  { id: 'calendar', label: 'Activity calendar', visible: false, pinned: false, collapsed: false },
];
export const demoDashboardSectionDefaults = dashboardSectionDefaults.map((section) => ({ ...section, visible: true }));

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

export const getSavedDashboardPreferences = (preferenceKey, defaults = dashboardSectionDefaults) => {
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

export const getDashboardWindow = (range, customStart, customEnd, entries, now = new Date(), weekStart = 'monday') => {
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

