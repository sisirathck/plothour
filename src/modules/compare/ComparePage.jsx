import React, { useState, useEffect, useMemo } from 'react';
import { Award, Swords, Trophy, Users, UserPlus } from 'lucide-react';
import './Compare.css';

const formatDuration = (totalSeconds) => {
  if (!totalSeconds || totalSeconds <= 0) return '0m';
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
    setInviteNotice(`Friend invitation sent to ${email}!`);
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
    };

    const friendItems = friends.map((f) => ({
      rank: 2,
      name: f.name,
      subtext: f.subtext || f.email,
      hours: formatDuration(f.seconds || 0),
      seconds: f.seconds || 0,
      isYou: false,
    }));

    const sorted = [youItem, ...friendItems].sort((a, b) => b.seconds - a.seconds);
    return sorted.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
  }, [isDemoPreview, userName, user?.email, userPeriodSeconds, friends]);

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
            <h3>No active study duel today</h3>
            <p className="duel-empty-desc">
              Study Duels match you head-to-head with a friend to compare focus hours in real time for today's crown. Add friends below to challenge them to a duel!
            </p>
            <button
              type="button"
              className="duel-cta-btn"
              onClick={() => {
                document.getElementById('friend-invite-input')?.focus();
              }}
            >
              <Users size={16} />
              <span>Find or Invite Friends to Duel</span>
            </button>
          </div>
        )}
      </section>

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
                <strong>No friends connected yet</strong>
                <p>Add friends by email to compare study hours, view rankings, and study together.</p>
              </div>
            </div>

            <form className="friend-invite-form" onSubmit={handleAddFriend}>
              <input
                id="friend-invite-input"
                type="email"
                placeholder="Enter friend's email (e.g. friend@example.com)..."
                value={friendEmail}
                onChange={(e) => setFriendEmail(e.target.value)}
              />
              <button type="submit">
                <UserPlus size={15} />
                <span>Add Friend</span>
              </button>
            </form>
            {inviteNotice && <p className="friend-invite-notice">{inviteNotice}</p>}
          </div>
        )}
      </section>
    </div>
  );
};
