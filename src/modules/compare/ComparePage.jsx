import React, { useState, useEffect, useMemo } from 'react';
import { Award, Swords, Trophy, Users, UserPlus } from 'lucide-react';
import './Compare.css';

const formatDuration = (totalSeconds) => {
  if (!totalSeconds || totalSeconds <= 0) return '0m';
  if (totalSeconds < 60) return `${Math.floor(totalSeconds)}s`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

const isEntryInPeriod = (entry, period) => {
  if (!entry?.startedAt) return false;
  const entryDate = new Date(entry.startedAt);
  const now = new Date();

  if (period === 'today') {
    return entryDate.toDateString() === now.toDateString();
  }
  if (period === '7 days') {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    return entryDate >= sevenDaysAgo;
  }
  if (period === 'this week') {
    const startOfWeek = new Date(now);
    const day = (now.getDay() + 6) % 7;
    startOfWeek.setDate(now.getDate() - day);
    startOfWeek.setHours(0, 0, 0, 0);
    return entryDate >= startOfWeek;
  }
  if (period === 'month') {
    return entryDate.getFullYear() === now.getFullYear() && entryDate.getMonth() === now.getMonth();
  }
  return true;
};

const demoLeaderboard = [
  { rank: 1, name: 'You (Alex)', subtext: 'Algorithms & Linear Algebra', hours: '5h 24m', isYou: true },
  { rank: 2, name: 'Marcus Vance', subtext: 'Stanford CS · Systems', hours: '4h 57m', isYou: false },
  { rank: 3, name: 'Elena Rostova', subtext: 'Oxford · Machine Learning', hours: '4h 12m', isYou: false },
  { rank: 4, name: 'David Kim', subtext: 'Berkeley · Distributed Systems', hours: '3h 30m', isYou: false },
];

export const ComparePage = ({ user, onNavigate: _onNavigate }) => {
  const [activePeriod, setActivePeriod] = useState('today');
  const [friendEmail, setFriendEmail] = useState('');
  const [inviteNotice, setInviteNotice] = useState('');

  const entriesKey = user?.id ? `studyduel_user_${user.id}_time_entries` : 'studyduel_demo_time_entries';
  const friendsKey = user?.id ? `studyduel_user_${user.id}_friends` : 'studyduel_demo_friends';
  const projectsKey = user?.id ? `studyduel_user_${user.id}_projects` : 'studyduel_demo_projects';

  const [entries, setEntries] = useState(() => {
    try {
      const data = JSON.parse(localStorage.getItem(entriesKey) || 'null');
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  });

  const [friends, setFriends] = useState(() => {
    try {
      const data = JSON.parse(localStorage.getItem(friendsKey) || 'null');
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const sync = () => {
      try {
        const ent = JSON.parse(localStorage.getItem(entriesKey) || 'null');
        setEntries(Array.isArray(ent) ? ent : []);
      } catch {
        setEntries([]);
      }
      try {
        const fr = JSON.parse(localStorage.getItem(friendsKey) || 'null');
        setFriends(Array.isArray(fr) ? fr : []);
      } catch {
        setFriends([]);
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [entriesKey, friendsKey]);

  // If in guest demo mode (!user), show sample demo data
  const isDemoPreview = !user && entries.length === 0;

  const userPeriodSeconds = useMemo(() => {
    return entries
      .filter((entry) => isEntryInPeriod(entry, activePeriod))
      .reduce((sum, e) => sum + (e.durationSeconds || 0), 0);
  }, [entries, activePeriod]);

  const userPeriodEntries = useMemo(() => entries.filter((entry) => isEntryInPeriod(entry, activePeriod) && Number(entry.durationSeconds) > 0), [entries, activePeriod]);
  const userPeriodActiveDays = new Set(userPeriodEntries.map((entry) => new Date(entry.startedAt).toDateString())).size;
  const userPeriodDayCount = activePeriod === 'today' ? 1 : activePeriod === '7 days' ? 7 : activePeriod === 'this week' ? new Date().getDay() + 1 : activePeriod === 'month' ? new Date().getDate() : 1;
  const userConsistencyPct = Math.round((userPeriodActiveDays / Math.max(1, userPeriodDayCount)) * 100);
  const userPeriodAverage = userPeriodEntries.length ? Math.round(userPeriodSeconds / userPeriodEntries.length) : 0;
  const userGoalProgress = useMemo(() => {
    let projects = [];
    try { projects = JSON.parse(localStorage.getItem(projectsKey) || '[]'); } catch { projects = []; }
    const goalHours = (Array.isArray(projects) ? projects : []).filter((project) => !project.archived).reduce((sum, project) => sum + (project.subjects || []).reduce((part, subject) => {
      if (activePeriod === 'today') return part + (Number(subject.goals?.daily) || 0);
      if (activePeriod === 'this week') return part + (Number(subject.goals?.weekly) || 0);
      if (activePeriod === 'month') return part + (Number(subject.goals?.monthly) || 0);
      return part + (Number(subject.goals?.daily) || 0) * 7;
    }, 0), 0);
    return goalHours ? Math.min(100, Math.round(userPeriodSeconds / (goalHours * 3600) * 100)) : null;
  }, [activePeriod, projectsKey, userPeriodSeconds]);
  const weeklyRecap = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const previousStart = new Date(weekStart);
    previousStart.setDate(previousStart.getDate() - 7);
    const previousEnd = new Date(now.getTime() - 7 * 86400000);
    const current = entries.filter((entry) => Number(entry.durationSeconds) > 0 && new Date(entry.startedAt).getTime() >= weekStart.getTime() && new Date(entry.startedAt).getTime() <= now.getTime());
    const previous = entries.filter((entry) => Number(entry.durationSeconds) > 0 && new Date(entry.startedAt).getTime() >= previousStart.getTime() && new Date(entry.startedAt).getTime() <= previousEnd.getTime());
    const seconds = current.reduce((sum, entry) => sum + Number(entry.durationSeconds), 0);
    const priorSeconds = previous.reduce((sum, entry) => sum + Number(entry.durationSeconds), 0);
    const projectsByTime = new Map();
    current.forEach((entry) => {
      const name = entry.projectName || 'General Study';
      projectsByTime.set(name, (projectsByTime.get(name) || 0) + Number(entry.durationSeconds));
    });
    let projects = [];
    try { projects = JSON.parse(localStorage.getItem(projectsKey) || '[]'); } catch { projects = []; }
    const goalHours = (Array.isArray(projects) ? projects : []).filter((project) => !project.archived).reduce((sum, project) => sum + (project.subjects || []).reduce((part, subject) => part + (Number(subject.goals?.weekly) || 0), 0), 0);
    return {
      seconds,
      delta: seconds - priorSeconds,
      sessions: current.length,
      activeDays: new Set(current.map((entry) => new Date(entry.startedAt).toDateString())).size,
      topProject: [...projectsByTime.entries()].sort((a, b) => b[1] - a[1])[0] || null,
      goalHours,
      goalPct: goalHours ? Math.min(100, Math.round(seconds / (goalHours * 3600) * 100)) : null,
    };
  }, [entries, projectsKey]);

  const userName = user?.display_name || user?.email?.split('@')[0] || 'You';

  const handleAddFriend = (e) => {
    e.preventDefault();
    const email = friendEmail.trim().toLowerCase();
    if (!email) return;

    if (email === user?.email?.toLowerCase()) {
      setInviteNotice("You cannot add your own account as a friend.");
      return;
    }

    if (friends.some((f) => f.email?.toLowerCase() === email)) {
      setInviteNotice("This friend is already in your list.");
      return;
    }

    const newFriend = {
      id: crypto.randomUUID(),
      name: email.split('@')[0],
      email,
      subtext: 'Study Partner',
      seconds: 0,
    };

    const updated = [...friends, newFriend];
    setFriends(updated);
    localStorage.setItem(friendsKey, JSON.stringify(updated));
    setFriendEmail('');
    setInviteNotice(`Added ${email} to this browser's list. An invitation was not sent because account sharing is not connected.`);
    setTimeout(() => setInviteNotice(''), 4000);
  };

  // Build combined leaderboard for authenticated user
  const combinedLeaderboard = useMemo(() => {
    if (isDemoPreview) return demoLeaderboard;

    const youItem = {
      rank: 1,
      name: `You (${userName})`,
      subtext: user?.email || 'Personal Profile',
      hours: formatDuration(userPeriodSeconds),
      seconds: userPeriodSeconds,
      isYou: true,
      activeDays: userPeriodActiveDays,
      consistencyPct: userConsistencyPct,
      avgSession: userPeriodAverage,
      goalProgress: userGoalProgress,
    };

    const friendItems = friends.map((f) => ({
      rank: 2,
      name: f.name,
      subtext: f.subtext || f.email,
      hours: f.sharedStatsAvailable ? formatDuration(f.seconds || 0) : '—',
      seconds: f.sharedStatsAvailable ? (f.seconds || 0) : -1,
      isYou: false,
      activeDays: f.activeDays,
      consistencyPct: f.consistencyPct,
      avgSession: f.avgSessionSeconds,
      goalProgress: f.goalProgressPct,
    }));

    const sorted = [youItem, ...friendItems].sort((a, b) => b.seconds - a.seconds);
    return sorted.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
  }, [isDemoPreview, userName, user?.email, userPeriodSeconds, userPeriodActiveDays, userPeriodAverage, userGoalProgress, friends]);

  return (
    <div className="compare-module-container">
      {/* Live Duel Spotlight Arena */}
      <section className="duel-arena-card" aria-label="Live study duel arena">
        <div className="duel-section-header">
          <div className="duel-header-title">
            <Swords className="duel-icon" size={24} />
            <h2>Live Study Duel</h2>
          </div>
          {isDemoPreview ? (
            <span className="duel-badge live">ROUND 2 OF 3</span>
          ) : (
            <span className="duel-badge standby">NO ACTIVE DUEL</span>
          )}
        </div>

        {isDemoPreview ? (
          <>
            <p className="duel-subtitle">
              Head-to-head match against <strong>Marcus Vance (Stanford CS)</strong> for today's focus duel crown.
            </p>

            <div className="duel-match-progress">
              <div className="duel-participant you">
                <span className="name">You</span>
                <span className="hours">5h 24m</span>
              </div>
              <div className="duel-vs-divider">VS</div>
              <div className="duel-participant rival">
                <span className="name">Marcus V.</span>
                <span className="hours">4h 57m</span>
              </div>
            </div>

            <div className="duel-progress-bar-track" aria-label="Duel progress: 52 percent">
              <div className="duel-progress-bar-fill" style={{ width: '52%' }} />
            </div>

            <div className="duel-footer-banner">
              <Award className="award-icon" size={18} />
              <span>Leading by <strong>27 mins</strong>! +150 Duel Rating upon day completion.</span>
            </div>
          </>
        ) : (
          <div className="duel-empty-state">
            <div className="duel-empty-icon-wrap">
              <Swords size={28} />
            </div>
            <h3>Live duels need shared account data</h3>
            <p className="duel-empty-desc">
              This build keeps study entries in this browser, so other accounts cannot contribute live totals yet. You can still review your own weekly recap and compare profiles saved on this device.
            </p>
            <button
              type="button"
              className="duel-cta-btn"
              onClick={() => {
                document.getElementById('friend-invite-input')?.focus();
              }}
            >
              <Users size={16} />
              <span>Add a compare profile</span>
            </button>
          </div>
        )}
      </section>

      {!isDemoPreview && <section className="compare-weekly-recap" aria-label="Weekly study recap">
        <div className="compare-weekly-recap-heading">
          <div><span>THIS WEEK · SUNDAY START</span><h2>Your weekly recap</h2></div>
          <span className={`compare-recap-change ${weeklyRecap.delta >= 0 ? 'positive' : 'negative'}`}>{weeklyRecap.delta > 0 ? '+' : weeklyRecap.delta < 0 ? '−' : ''}{formatDuration(Math.abs(weeklyRecap.delta))} vs same elapsed time last week</span>
        </div>
        <div className="compare-weekly-recap-grid">
          <div><strong>{formatDuration(weeklyRecap.seconds)}</strong><span>study time</span></div>
          <div><strong>{weeklyRecap.activeDays} / {new Date().getDay() + 1}</strong><span>active days so far</span></div>
          <div><strong>{weeklyRecap.sessions}</strong><span>sessions</span></div>
          <div><strong>{weeklyRecap.sessions ? formatDuration(Math.round(weeklyRecap.seconds / weeklyRecap.sessions)) : '—'}</strong><span>average per session</span></div>
          <div><strong>{weeklyRecap.mostStudied?.[0] || '—'}</strong><span>most studied project</span></div>
          <div><strong>{weeklyRecap.weeklyGoalHours ? `${weeklyRecap.goalPct}%` : '—'}</strong><span>weekly goal progress</span></div>
        </div>
        {weeklyRecap.weeklyGoalHours > 0 && <div className="compare-recap-goal-track"><span style={{ width: `${weeklyRecap.goalPct}%` }} /></div>}
      </section>}

      {/* Friend Standings & Comparison */}
      <section className="standings-card" aria-label="Friend comparison standings">
        <div className="standings-heading">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Trophy size={20} color="var(--sd-orange)" />
            <h3>Friend Group Standings</h3>
          </div>
          <div className="date-range-pills" role="tablist">
            {['today', '7 days', 'this week', 'month'].map((period) => (
              <button
                key={period}
                type="button"
                className={`date-range-btn ${activePeriod === period ? 'active' : ''}`}
                onClick={() => setActivePeriod(period)}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="standings-list">
          {combinedLeaderboard.map((item) => (
            <div key={item.name} className={`standings-row ${item.isYou ? 'highlight-user' : ''}`}>
              <span className={`rank-badge ${item.rank <= 3 ? 'top' : ''}`}>#{item.rank}</span>
              <div className="avatar-circle">
                {item.name.replace(/^You \((.*)\)$/, '$1').charAt(0).toUpperCase()}
              </div>
              <div className="user-info-col">
                <strong>{item.name}</strong>
                <span>{item.subtext}</span>
                <span className="standings-context-metrics">{item.activeDays != null ? `${item.activeDays} active days · ${item.consistencyPct ?? '—'}% consistency · ${item.avgSession ? `${formatDuration(item.avgSession)} avg/session` : '—'} · ${item.goalProgress != null ? `${item.goalProgress}% of goal` : 'Goal not set'}` : 'Active days, consistency, and goal progress not shared'}</span>
              </div>
              <span className="standings-hours">{item.hours}</span>
            </div>
          ))}
        </div>

        {!isDemoPreview && friends.length === 0 && (
          <div className="standings-empty-state">
            <div className="standings-empty-content">
              <Users size={22} className="standings-empty-icon" />
              <div>
                <strong>No compare profiles yet</strong>
                <p>Profiles added here are saved in this browser. Shared study totals and live invitations are not connected yet.</p>
              </div>
            </div>

            <form className="friend-invite-form" onSubmit={handleAddFriend}>
              <input
                id="friend-invite-input"
                type="email"
                placeholder="Profile email (saved in this browser)..."
                value={friendEmail}
                onChange={(e) => setFriendEmail(e.target.value)}
              />
              <button type="submit">
                <UserPlus size={15} />
                <span>Add profile</span>
              </button>
            </form>
            {inviteNotice && <p className="friend-invite-notice">{inviteNotice}</p>}
          </div>
        )}
      </section>
    </div>
  );
};
