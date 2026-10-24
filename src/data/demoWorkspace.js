const demoProjects = [
  {
    id: 'demo-project-cs',
    name: 'Computer Science',
    color: '#7284dc',
    subjects: [
      { id: 'demo-subject-algorithms', name: 'Algorithms', color: '#7284dc', goals: { daily: 1.5, weekly: 8, monthly: 32 }, estimateHours: 80, milestones: [{ id: 'demo-milestone-algorithms-1', title: 'Review graph algorithms', completed: true }, { id: 'demo-milestone-algorithms-2', title: 'Complete practice set', completed: false }] },
      { id: 'demo-subject-databases', name: 'Database Systems', color: '#48a99b', goals: { daily: 1, weekly: 5, monthly: 20 }, estimateHours: 45, milestones: [{ id: 'demo-milestone-db-1', title: 'Build a study tracker schema', completed: true }] },
      { id: 'demo-subject-web', name: 'Web Development', color: '#df9a53', goals: { daily: 1, weekly: 6, monthly: 24 }, estimateHours: 60 },
    ],
  },
  {
    id: 'demo-project-math',
    name: 'Mathematics',
    color: '#9a79cc',
    subjects: [
      { id: 'demo-subject-linear', name: 'Linear Algebra', color: '#9a79cc', goals: { daily: 1, weekly: 5, monthly: 20 }, estimateHours: 50 },
      { id: 'demo-subject-statistics', name: 'Statistics', color: '#ce7794', goals: { daily: 0.75, weekly: 4, monthly: 16 }, estimateHours: 36 },
    ],
  },
  {
    id: 'demo-project-language',
    name: 'Japanese',
    color: '#56a783',
    subjects: [
      { id: 'demo-subject-kanji', name: 'Kanji & Vocabulary', color: '#56a783', goals: { daily: 0.5, weekly: 4, monthly: 16 }, estimateHours: 40 },
      { id: 'demo-subject-speaking', name: 'Listening Practice', color: '#5b9dc1', goals: { daily: 0.5, weekly: 3, monthly: 12 }, estimateHours: 30 },
    ],
  },
  {
    id: 'demo-project-capstone',
    name: 'Portfolio Capstone',
    color: '#d48368',
    subjects: [
      { id: 'demo-subject-capstone-research', name: 'Research & Planning', color: '#d48368', goals: { daily: 0.5, weekly: 3, monthly: 12 }, estimateHours: 28 },
      { id: 'demo-subject-capstone-build', name: 'Implementation', color: '#d2a14e', goals: { daily: 1, weekly: 5, monthly: 20 }, estimateHours: 55 },
    ],
  },
  {
    id: 'demo-project-python',
    name: 'Python Fundamentals',
    color: '#7082b7',
    archived: true,
    archivedAt: Date.now() - 35 * 86400000,
    subjects: [{ id: 'demo-subject-python', name: 'Python Projects', color: '#7082b7', goals: { daily: 1, weekly: 5, monthly: 20 }, estimateHours: 42 }],
  },
];

const demoPartners = [
  { id: 'demo-friend-maya', name: 'Maya Chen', code: 'DUEL-MAYA', subtext: 'Study partner', seconds: 3 * 3600 + 42 * 60, activeDays: 5, consistencyPct: 71, avgSessionSeconds: 52 * 60, goalProgressPct: 82, sharedStatsAvailable: true },
  { id: 'demo-friend-noah', name: 'Noah Patel', code: 'DUEL-NOAH', subtext: 'Study partner', seconds: 2 * 3600 + 55 * 60, activeDays: 4, consistencyPct: 57, avgSessionSeconds: 46 * 60, goalProgressPct: 68, sharedStatsAvailable: true },
  { id: 'demo-friend-ava', name: 'Ava Williams', code: 'DUEL-AVA', subtext: 'Study partner', seconds: 2 * 3600 + 18 * 60, activeDays: 4, consistencyPct: 57, avgSessionSeconds: 41 * 60, goalProgressPct: 61, sharedStatsAvailable: true },
  { id: 'demo-friend-liam', name: 'Liam Patel', code: 'DUEL-LIAM', subtext: 'Study partner', seconds: 2 * 3600 + 6 * 60, activeDays: 3, consistencyPct: 48, avgSessionSeconds: 44 * 60, goalProgressPct: 59, sharedStatsAvailable: true },
  { id: 'demo-friend-emily', name: 'Emily Carter', code: 'DUEL-EMILY', subtext: 'Study partner', seconds: 1 * 3600 + 49 * 60, activeDays: 3, consistencyPct: 43, avgSessionSeconds: 38 * 60, goalProgressPct: 52, sharedStatsAvailable: true },
];

const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const choose = (items) => items[randomBetween(0, items.length - 1)];

const createStudyDay = (date, projectPool, sessionCount, now, isToday) => {
  const entries = [];
  let cursor;

  if (isToday) {
    const latestEnd = Math.max(date.getTime() + 60_000, now.getTime() - randomBetween(5, 45) * 60_000);
    cursor = latestEnd;
  } else {
    cursor = new Date(date.getFullYear(), date.getMonth(), date.getDate(), randomBetween(10, 17), randomBetween(0, 45)).getTime();
  }

  for (let index = 0; index < sessionCount; index += 1) {
    const endMs = cursor;
    let durationSeconds = randomBetween(35, 90) * 60;
    if (isToday) {
      durationSeconds = Math.min(durationSeconds, Math.max(1, Math.floor((endMs - date.getTime()) / 1000) - 1));
    }
    const startMs = endMs - durationSeconds * 1000;
    const project = choose(projectPool);
    const subject = choose(project.subjects);
    entries.push({
      id: crypto.randomUUID(),
      projectId: project.id,
      projectName: project.name,
      subjectId: subject.id,
      subjectName: subject.name,
      color: subject.color || project.color,
      startedAt: startMs,
      endedAt: endMs,
      durationSeconds,
      mode: choose(['50m', '50m', '25m', 'stopwatch']),
      note: choose(['Lecture notes and review', 'Practice problems', 'Reading and flashcards', 'Project work', '']),
    });
    cursor = startMs - randomBetween(25, 70) * 60_000;
  }

  return entries;
};

const makeYearOfEntries = () => {
  const now = new Date();
  const activeProjects = demoProjects.filter((project) => !project.archived);
  const projectPool = [...activeProjects, demoProjects.find((project) => project.id === 'demo-project-python')];
  const dayBuckets = [];

  for (let dayOffset = 0; dayOffset < 365; dayOffset += 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOffset);
    const isToday = dayOffset === 0;
    const studyDay = isToday || Math.random() < 0.74;
    const sessions = studyDay ? (isToday ? 1 : randomBetween(1, 3)) : 0;
    dayBuckets.push(studyDay ? createStudyDay(date, projectPool, sessions, now, isToday) : []);
  }

  // Keep at least one session in every rolling week so demo charts never show
  // a stale-looking full week with no activity.
  for (let start = 0; start < 365; start += 7) {
    const end = Math.min(start + 7, 365);
    if (dayBuckets.slice(start, end).some((bucket) => bucket.length > 0)) continue;
    const dayOffset = randomBetween(start, end - 1);
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOffset);
    dayBuckets[dayOffset] = createStudyDay(date, projectPool, 1, now, dayOffset === 0);
  }

  return dayBuckets.flat().sort((a, b) => b.startedAt - a.startedAt);
};

const makePartnerEntries = (partnerIndex) => {
  const now = new Date();
  const projectPool = demoProjects.filter((project) => !project.archived);
  const entries = [];
  for (let dayOffset = 0; dayOffset < 180; dayOffset += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOffset);
    if (dayOffset !== 0 && (dayOffset + partnerIndex * 2) % 7 > 3) continue;
    const sessionCount = 1 + ((dayOffset + partnerIndex) % 3 === 0 ? 1 : 0);
    for (let session = 0; session < sessionCount; session += 1) {
      const project = projectPool[(dayOffset + partnerIndex * 2 + session) % projectPool.length];
      const subject = project.subjects[(dayOffset + partnerIndex + session) % project.subjects.length];
      const durationSeconds = (25 + ((dayOffset * 13 + partnerIndex * 19 + session * 11) % 66)) * 60;
      const end = new Date(day);
      end.setHours(10 + ((dayOffset + partnerIndex * 3 + session * 4) % 12), (dayOffset * 7 + partnerIndex * 13 + session * 17) % 60, 0, 0);
      if (dayOffset === 0 && end.getTime() > now.getTime()) end.setTime(Math.max(day.getTime() + 60_000, now.getTime() - 3 * 60_000));
      entries.push({
        id: `demo-${demoPartners[partnerIndex].id}-${dayOffset}-${session}`,
        projectId: project.id, projectName: project.name, subjectId: subject.id, subjectName: subject.name,
        color: subject.color || project.color, startedAt: end.getTime() - durationSeconds * 1000,
        endedAt: end.getTime(), durationSeconds, mode: '50m', note: '',
      });
    }
  }
  return entries;
};

/** Reset sample data to a fresh, rolling 365-day demo whenever demo mode starts. */
export function resetDemoWorkspace() {
  localStorage.setItem('studyduel_demo_projects', JSON.stringify(demoProjects));
  localStorage.setItem('studyduel_demo_time_entries', JSON.stringify(makeYearOfEntries()));
  localStorage.setItem('studyduel_demo_active_timer', 'null');
  localStorage.setItem('studyduel_demo_friends', JSON.stringify(demoPartners));
  localStorage.setItem('studyduel_demo_compare_profiles', JSON.stringify(demoPartners.map((partner, index) => ({ ...partner, entries: makePartnerEntries(index) }))));
  localStorage.setItem('studyduel_demo_compare_profiles_selected', JSON.stringify(['demo-profile', ...demoPartners.map((partner) => partner.id)]));
  localStorage.setItem('studyduel_demo_preferences', JSON.stringify({
    displayName: 'Alex Morgan',
    dailyGoalHours: 3,
    weekStart: 'monday',
    defaultTimerMode: '50m',
    soundEnabled: true,
  }));
}
