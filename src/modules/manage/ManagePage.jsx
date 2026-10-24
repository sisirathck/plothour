import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  FolderKanban,
  Pencil,
  Plus,
  Search,
  Target,
  Trash2,
  X,
  Star,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import './Manage.css';

const initialProjects = [
  {
    id: 'computer-science',
    name: 'Computer Science',
    color: '#8086d4',
    subjects: [
      { id: 'algorithms', name: 'Algorithms', color: '#8086d4' },
      { id: 'data-structures', name: 'Data Structures', color: '#a18ad8' },
    ],
  },
  {
    id: 'languages',
    name: 'Languages',
    color: '#696fc3',
    subjects: [{ id: 'japanese', name: 'Japanese', color: '#969be4' }],
  },
];

const hasUnmodifiedStarterProjects = (projects) => (
  Array.isArray(projects) &&
  JSON.stringify(projects) === JSON.stringify(initialProjects)
);

const projectColorPresets = [
  { name: 'Indigo', value: '#6D73C8' },
  { name: 'Violet', value: '#8E7CD4' },
  { name: 'Orchid', value: '#B07BC6' },
  { name: 'Rose', value: '#D2779B' },
  { name: 'Coral', value: '#D9896B' },
  { name: 'Amber', value: '#D6A74E' },
  { name: 'Teal', value: '#65A88E' },
  { name: 'Sky', value: '#5C9FB5' },
  { name: 'Moss', value: '#758B6A' },
  { name: 'Slate', value: '#7D8799' },
];

const formatGoalHours = (hours) => {
  const value = Number(hours) || 0;
  if (Number.isInteger(value)) return `${value}h`;
  return `${value.toFixed(2).replace(/0$/, '').replace(/\.$/, '')}h`;
};

const formatDuration = (seconds) => {
  if (seconds > 0 && seconds < 60) return `${Math.floor(seconds)}s`;
  const totalMinutes = Math.floor(Math.max(0, seconds || 0) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
};

const readJson = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
};

const getProjectEntries = (project, entries) => entries.filter((entry) => (
  entry.projectId === project.id || (!entry.projectId && entry.projectName === project.name)
));

const getProjectStats = (project, entries) => {
  const projectEntries = getProjectEntries(project, entries);
  const validEntries = projectEntries.filter((entry) => Number.isFinite(new Date(entry.startedAt).getTime()));
  const days = new Set(validEntries.map((entry) => new Date(entry.startedAt).toDateString()));
  const lastEntry = validEntries.reduce((latest, entry) => (
    !latest || new Date(entry.startedAt).getTime() > new Date(latest.startedAt).getTime() ? entry : latest
  ), null);
  return {
    entries: validEntries,
    seconds: projectEntries.reduce((total, entry) => total + (Number(entry.durationSeconds) || 0), 0),
    sessions: projectEntries.length,
    activeDays: days.size,
    lastStudied: lastEntry ? new Date(lastEntry.startedAt) : null,
  };
};

const ColorPicker = ({ value, label, onChange }) => {
  const [open, setOpen] = useState(false);
  const current = value || projectColorPresets[0].value;

  return (
    <div className="manage-color-control" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button
        type="button"
        className="manage-color-trigger"
        style={{ '--project-color': current }}
        aria-label={`Choose color for ${label}`}
        aria-expanded={open}
        title={`Choose color for ${label}`}
        onClick={() => setOpen((shown) => !shown)}
      >
        <span />
      </button>
      {open && (
        <div className="manage-color-palette" role="group" aria-label={`Color options for ${label}`}>
          <span className="manage-color-palette-title">Choose a color</span>
          <div className="manage-color-swatches">
            {projectColorPresets.map((color) => (
              <button
                key={color.value}
                type="button"
                className={`manage-color-swatch${current.toLowerCase() === color.value.toLowerCase() ? ' selected' : ''}`}
                style={{ '--swatch-color': color.value }}
                aria-label={color.name}
                title={color.name}
                onClick={() => { onChange(color.value); setOpen(false); }}
              />
            ))}
          </div>
          <label className="manage-custom-color">
            <span>Custom color</span>
            <input
              type="color"
              value={current}
              aria-label={`Custom color for ${label}`}
              onChange={(event) => onChange(event.target.value)}
              onBlur={() => setOpen(false)}
            />
          </label>
        </div>
      )}
    </div>
  );
};

const PlanEditor = ({ value, label, onChange }) => {
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const milestones = Array.isArray(value?.milestones) ? value.milestones : [];
  const addMilestone = (event) => {
    event.preventDefault();
    const title = milestoneTitle.trim();
    if (!title) return;
    onChange({ milestones: [...milestones, { id: crypto.randomUUID(), title, completed: false }] });
    setMilestoneTitle('');
  };
  const updateMilestone = (id, changes) => onChange({ milestones: milestones.map((milestone) => milestone.id === id ? { ...milestone, ...changes } : milestone) });

  return (
    <div className="manage-plan-editor" aria-label={`${label} plan`}>
      <label><span>Total time estimate</span><div className="manage-plan-number"><input type="number" min="0" step="0.25" value={value?.estimateHours ?? ''} placeholder="e.g. 40" onChange={(event) => onChange({ estimateHours: event.target.value === '' ? '' : Math.max(0, Number(event.target.value) || 0) })} /><span>hours</span></div></label>
      <label><span>Target date</span><input type="date" value={value?.deadline || ''} onChange={(event) => onChange({ deadline: event.target.value })} /></label>
      <div className="manage-milestone-editor">
        <span className="manage-plan-label">Milestones</span>
        {milestones.map((milestone) => (
          <label className="manage-milestone-row" key={milestone.id}>
            <input type="checkbox" checked={Boolean(milestone.completed)} onChange={(event) => updateMilestone(milestone.id, { completed: event.target.checked })} />
            <span className={milestone.completed ? 'completed' : ''}>{milestone.title}</span>
            <button type="button" aria-label={`Remove milestone ${milestone.title}`} onClick={() => onChange({ milestones: milestones.filter((item) => item.id !== milestone.id) })}><X size={13} /></button>
          </label>
        ))}
        <form className="manage-add-milestone" onSubmit={addMilestone}>
          <input value={milestoneTitle} onChange={(event) => setMilestoneTitle(event.target.value)} placeholder="Add a milestone" aria-label={`Add a milestone to ${label}`} />
          <button type="submit" disabled={!milestoneTitle.trim()}><Plus size={13} /> Add</button>
        </form>
      </div>
    </div>
  );
};

export const ManagePage = ({ user }) => {
  const projectsKey = user?.id ? `studyduel_user_${user.id}_projects` : 'studyduel_demo_projects';
  const entriesKey = user?.id ? `studyduel_user_${user.id}_time_entries` : 'studyduel_demo_time_entries';
  const activeTimerKey = user?.id ? `studyduel_user_${user.id}_active_timer` : 'studyduel_demo_active_timer';

  const [projects, setProjects] = useState(() => {
    const saved = readJson(projectsKey, null);
    // Clear the exact starter template previously written to authenticated
    // accounts, while preserving any projects the user has edited or created.
    if (user && hasUnmodifiedStarterProjects(saved)) return [];
    // Authenticated accounts start with an empty library. Keep sample projects
    // only for the unauthenticated demo experience.
    return Array.isArray(saved) ? saved : (user ? [] : initialProjects);
  });
  const [entries, setEntries] = useState(() => readJson(entriesKey, []));
  const [newProject, setNewProject] = useState('');
  const [newSubject, setNewSubject] = useState({});
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');
  const [view, setView] = useState('active');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [openSubjectPlans, setOpenSubjectPlans] = useState({});
  const [openProjectPlans, setOpenProjectPlans] = useState({});
  const [editingProjectGoals, setEditingProjectGoals] = useState({});
  const [projectPendingDelete, setProjectPendingDelete] = useState(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [collapsedProjectIds, setCollapsedProjectIds] = useState([]);

  useEffect(() => {
    if (!projectPendingDelete) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setProjectPendingDelete(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [projectPendingDelete]);

  useEffect(() => {
    localStorage.setItem(projectsKey, JSON.stringify(projects));
  }, [projectsKey, projects]);

  useEffect(() => {
    const sync = () => setEntries(readJson(entriesKey, []));
    window.addEventListener('storage', sync);
    window.addEventListener('studyduel:timer-storage', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('studyduel:timer-storage', sync);
    };
  }, [entriesKey]);

  const activeProjects = useMemo(() => projects.filter((project) => !project.archived), [projects]);
  const archivedProjects = useMemo(() => projects.filter((project) => project.archived), [projects]);
  const visibleProjects = (view === 'active' ? activeProjects : archivedProjects).filter((project) => (
    project.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  )).sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) || projects.indexOf(a) - projects.indexOf(b));

  const reorderProject = (projectId, direction) => setProjects((items) => {
    const sorted = [...items];
    const index = sorted.findIndex((item) => item.id === projectId);
    let nextIndex = index + direction;
    while (nextIndex >= 0 && nextIndex < sorted.length && Boolean(sorted[nextIndex].archived) !== (view === 'archived')) nextIndex += direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= sorted.length) return items;
    [sorted[index], sorted[nextIndex]] = [sorted[nextIndex], sorted[index]];
    return sorted;
  });
  const moveSelectedProjects = (direction) => setProjects((items) => {
    const selected = new Set(selectedProjectIds);
    const indexes = items.map((project, index) => project.archived === (view === 'archived') ? index : -1).filter((index) => index >= 0);
    const next = [...items];
    const positions = direction < 0 ? indexes : [...indexes].reverse();
    positions.forEach((index, order) => {
      const adjacent = direction < 0 ? indexes[indexes.indexOf(index) - 1] : indexes[indexes.indexOf(index) + 1];
      if (adjacent == null) return;
      if (selected.has(next[index].id) && !selected.has(next[adjacent].id)) [next[index], next[adjacent]] = [next[adjacent], next[index]];
    });
    return next;
  });
  const bulkFavorite = () => {
    const selected = new Set(selectedProjectIds);
    const shouldFavorite = projects.some((project) => selected.has(project.id) && !project.favorite);
    setProjects((items) => items.map((project) => selected.has(project.id) ? { ...project, favorite: shouldFavorite } : project));
  };
  const toggleFavorite = (projectId) => setProjects((items) => items.map((item) => item.id === projectId ? { ...item, favorite: !item.favorite } : item));
  const bulkArchive = () => {
    const selected = new Set(selectedProjectIds);
    const runningTimer = readJson(activeTimerKey, null);
    const blocked = view === 'active' && projects.some((project) => selected.has(project.id) && runningTimer?.projectId === project.id);
    if (blocked) { setNotice('Stop the selected project’s running timer before archiving it.'); return; }
    setProjects((items) => items.map((item) => selected.has(item.id) ? { ...item, archived: view === 'active', archivedAt: view === 'active' ? Date.now() : null } : item));
    setSelectedProjectIds([]);
    setNotice(view === 'active' ? 'Selected projects archived. Restore them from Archived any time.' : 'Selected projects restored.');
  };

  const addProject = (event) => {
    event.preventDefault();
    const name = newProject.trim();
    if (!name) return;
    setProjects((items) => [...items, {
      id: crypto.randomUUID(), name, color: '#8086d4', subjects: [], archived: false,
    }]);
    setNewProject('');
  };

  const addSubject = (event, projectId) => {
    event.preventDefault();
    const name = (newSubject[projectId] || '').trim();
    if (!name) return;
    setProjects((items) => items.map((project) => project.id === projectId ? {
      ...project,
      subjects: [...(project.subjects || []), {
        id: crypto.randomUUID(),
        name,
        color: project.color,
        goals: { daily: 0, weekly: 0, monthly: 0 },
      }],
    } : project));
    setNewSubject((items) => ({ ...items, [projectId]: '' }));
  };

  const beginRename = (type, id, name) => {
    setEditing({ type, id });
    setEditName(name);
  };

  const saveEdit = () => {
    if (!editing || !editName.trim()) return;
    setProjects((items) => items.map((project) => ({
      ...project,
      ...(project.id === editing.id && editing.type === 'project' ? { name: editName.trim() } : {}),
      subjects: (project.subjects || []).map((subject) => (
        subject.id === editing.id && editing.type === 'subject'
          ? { ...subject, name: editName.trim() }
          : subject
      )),
    })));
    setEditing(null);
    setEditName('');
  };

  const setColor = (projectId, subjectId, color) => setProjects((items) => items.map((project) => {
    if (project.id !== projectId) return project;
    if (!subjectId) return { ...project, color };
    return {
      ...project,
      subjects: project.subjects.map((subject) => subject.id === subjectId ? { ...subject, color } : subject),
    };
  }));

  const setSubjectGoal = (projectId, subjectId, period, rawValue) => {
    const max = period === 'daily' ? 24 : period === 'weekly' ? 168 : 744;
    const value = rawValue === '' ? 0 : Math.max(0, Math.min(max, Number(rawValue) || 0));
    setProjects((items) => items.map((project) => project.id !== projectId ? project : {
      ...project,
      subjects: project.subjects.map((subject) => subject.id !== subjectId ? subject : {
        ...subject,
        goals: { daily: 0, weekly: 0, monthly: 0, ...subject.goals, [period]: value },
      }),
    }));
  };

  const projectGoalTotals = (project) => (project.subjects || []).reduce((totals, subject) => ({
    daily: totals.daily + (Number(subject.goals?.daily) || 0),
    weekly: totals.weekly + (Number(subject.goals?.weekly) || 0),
    monthly: totals.monthly + (Number(subject.goals?.monthly) || 0),
  }), { daily: 0, weekly: 0, monthly: 0 });

  const toggleArchive = (project) => {
    if (!project.archived) {
      const runningTimer = readJson(activeTimerKey, null);
      if (runningTimer?.projectId === project.id) {
        setNotice('Stop this project’s running timer before archiving it.');
        return;
      }
    }
    setNotice('');
    setProjects((items) => items.map((item) => item.id === project.id ? {
      ...item,
      archived: !item.archived,
      ...(item.archived ? { archivedAt: null } : { archivedAt: Date.now() }),
    } : item));
  };

  const deleteProject = () => {
    if (!projectPendingDelete) return;
    setProjects((items) => items.filter((item) => item.id !== projectPendingDelete.id));
    setProjectPendingDelete(null);
  };

  const deleteSubject = (projectId, subjectId) => setProjects((items) => items.map((project) => (
    project.id === projectId
      ? { ...project, subjects: project.subjects.filter((subject) => subject.id !== subjectId) }
      : project
  )));

  return (
    <main className="manage-module-container">
      {projectPendingDelete && (
        <div
          className="manage-delete-backdrop"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setProjectPendingDelete(null); }}
        >
          <section
            className="manage-delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="manage-delete-title"
            aria-describedby="manage-delete-description"
          >
            <div className="manage-delete-icon"><Trash2 size={19} strokeWidth={1.8} /></div>
            <span className="manage-delete-eyebrow">REMOVE PROJECT</span>
            <h2 id="manage-delete-title">Delete “{projectPendingDelete.name}”?</h2>
            <p id="manage-delete-description">
              This removes the project and its subprojects from your library. All recorded time entries will remain in your history.
            </p>
            <div className="manage-delete-actions">
              <button type="button" className="manage-delete-cancel" autoFocus onClick={() => setProjectPendingDelete(null)}>
                Keep project
              </button>
              <button type="button" className="manage-delete-confirm" onClick={deleteProject}>
                <Trash2 size={14} /> Delete project
              </button>
            </div>
          </section>
        </div>
      )}
      <header className="manage-page-header">
        <div>
          <div className="manage-eyebrow"><FolderKanban size={14} /> WORKSPACE</div>
          <h1>Project library</h1>
          <p>Shape your study plan, set targets, and keep completed projects within reach.</p>
        </div>
        <div className="manage-header-stats">
          <span><strong>{activeProjects.length}</strong> active</span>
          <span><strong>{archivedProjects.length}</strong> archived</span>
        </div>
      </header>

      <section className="manage-library-card" aria-label="Project management">
        <div className="manage-library-toolbar">
          <div className="manage-view-tabs" role="tablist" aria-label="Project status">
            <button type="button" role="tab" aria-selected={view === 'active'} className={view === 'active' ? 'selected' : ''} onClick={() => { setView('active'); setSelectedProjectIds([]); setNotice(''); }}>
              Active <span>{activeProjects.length}</span>
            </button>
            <button type="button" role="tab" aria-selected={view === 'archived'} className={view === 'archived' ? 'selected' : ''} onClick={() => { setView('archived'); setSelectedProjectIds([]); setNotice(''); }}>
              <Archive size={14} /> Archived <span>{archivedProjects.length}</span>
            </button>
          </div>
          <label className="manage-search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a project" aria-label="Find a project" />
          </label>
        </div>

        {selectedProjectIds.length > 0 && <div className="manage-bulk-toolbar" role="region" aria-label="Selected project actions">
          <span>{selectedProjectIds.length} selected</span><button type="button" onClick={() => moveSelectedProjects(-1)}><ArrowUp size={14} /> Move up</button><button type="button" onClick={() => moveSelectedProjects(1)}><ArrowDown size={14} /> Move down</button><button type="button" onClick={bulkFavorite}><Star size={14} /> Favorite</button><button type="button" onClick={bulkArchive}><Archive size={14} /> {view === 'active' ? 'Archive' : 'Restore'} selected</button><button type="button" onClick={() => setSelectedProjectIds([])}>Clear</button>
        </div>}

        {view === 'active' && (
          <form className="manage-create-project" onSubmit={addProject}>
            <div className="manage-create-icon"><Plus size={18} /></div>
            <input value={newProject} onChange={(event) => setNewProject(event.target.value)} placeholder="Add a project, e.g. Biology or Thesis" aria-label="New project name" />
            <button type="submit" disabled={!newProject.trim()}><Plus size={15} /> Create project</button>
          </form>
        )}
        {notice && <p className="manage-notice" role="status">{notice}</p>}

        {!visibleProjects.length ? (
          <div className="manage-empty-state">
            <div className="manage-empty-icon">{view === 'active' ? <Target size={20} /> : <Archive size={20} />}</div>
            <strong>{search ? 'No matching projects' : view === 'active' ? 'Create your first study project' : 'Nothing archived yet'}</strong>
            <p>{search ? 'Try another project name.' : view === 'active' ? 'Add a project or study subject to start tracking your focus time.' : 'When a project is complete, archive it to keep its study history.'}</p>
          </div>
        ) : (
          <div className="manage-project-list">
            {visibleProjects.map((project) => {
              const totals = projectGoalTotals(project);
              const stats = getProjectStats(project, entries);
              const subjects = project.subjects || [];
              const subjectTotals = new Map();
              stats.entries.forEach((entry) => {
                const key = entry.subjectId || entry.subjectName || '__unassigned';
                const currentSubject = subjects.find((subject) => subject.id === entry.subjectId);
                const current = subjectTotals.get(key) || { name: currentSubject?.name || entry.subjectName || 'No subproject', seconds: 0, sessions: 0 };
                current.seconds += Number(entry.durationSeconds) || 0;
                current.sessions += 1;
                subjectTotals.set(key, current);
              });
              subjects.forEach((subject) => {
                if (!subjectTotals.has(subject.id)) subjectTotals.set(subject.id, { name: subject.name, seconds: 0, sessions: 0 });
              });
              const breakdown = Array.from(subjectTotals.values()).sort((a, b) => b.seconds - a.seconds);

              return (
                <article className={`manage-project-card${project.archived ? ' is-archived' : ''}`} key={project.id}>
                  <div className="manage-project-card-top">
                    <label className="manage-project-check" aria-label={`Select ${project.name}`}><input className="manage-project-select" type="checkbox" checked={selectedProjectIds.includes(project.id)} aria-label={`Select ${project.name}`} onChange={(event) => setSelectedProjectIds((current) => event.target.checked ? [...current, project.id] : current.filter((id) => id !== project.id))} /><span aria-hidden="true"><Check size={12} strokeWidth={3} /></span></label>
                    <span className="manage-project-color" style={{ '--project-color': project.color || '#8086d4' }} />
                    <div className="manage-project-name-block">
                      {editing?.id === project.id && editing.type === 'project' ? (
                        <form className="manage-rename-form" onSubmit={(event) => { event.preventDefault(); saveEdit(); }}>
                          <input value={editName} onChange={(event) => setEditName(event.target.value)} aria-label="Project name" autoFocus />
                          <button type="submit" aria-label="Save project name"><Check size={15} /></button>
                          <button type="button" aria-label="Cancel rename" onClick={() => setEditing(null)}><X size={15} /></button>
                        </form>
                      ) : (
                        <>
                          <h2>{project.name}</h2>
                          <span>{subjects.length} {subjects.length === 1 ? 'subproject' : 'subprojects'}{project.archived ? ' · Archived' : ''}</span>
                        </>
                      )}
                    </div>
                    {!project.archived && <ColorPicker value={project.color} label={project.name} onChange={(color) => setColor(project.id, null, color)} />}
                    <div className="manage-card-actions">
                      <button type="button" title={project.favorite ? 'Remove from favorites' : 'Add to favorites'} aria-label={`${project.favorite ? 'Remove' : 'Add'} ${project.name} ${project.favorite ? 'from' : 'to'} favorites`} aria-pressed={Boolean(project.favorite)} onClick={() => toggleFavorite(project.id)}><Star size={15} fill={project.favorite ? 'currentColor' : 'none'} /></button>
                      <button type="button" title="Move up" aria-label={`Move ${project.name} up`} onClick={() => reorderProject(project.id, -1)}><ArrowUp size={14} /></button>
                      <button type="button" title="Move down" aria-label={`Move ${project.name} down`} onClick={() => reorderProject(project.id, 1)}><ArrowDown size={14} /></button>
                      <button type="button" title={collapsedProjectIds.includes(project.id) ? 'Show details' : 'Hide details'} aria-label={`${collapsedProjectIds.includes(project.id) ? 'Show' : 'Hide'} details for ${project.name}`} aria-expanded={!collapsedProjectIds.includes(project.id)} onClick={() => setCollapsedProjectIds((current) => current.includes(project.id) ? current.filter((id) => id !== project.id) : [...current, project.id])}><ChevronDown size={15} className={collapsedProjectIds.includes(project.id) ? '' : 'is-open'} /></button>
                      {!project.archived && <button type="button" title="Rename project" aria-label={`Rename ${project.name}`} onClick={() => beginRename('project', project.id, project.name)}><Pencil size={15} /></button>}
                      <button type="button" title={project.archived ? 'Restore project' : 'Archive project'} aria-label={`${project.archived ? 'Restore' : 'Archive'} ${project.name}`} onClick={() => toggleArchive(project)}>
                        {project.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                      </button>
                      <button type="button" title="Delete project" aria-label={`Delete ${project.name}`} onClick={() => setProjectPendingDelete(project)}><Trash2 size={15} /></button>
                    </div>
                  </div>

                  {collapsedProjectIds.includes(project.id) ? null : project.archived ? (
                    <div className="manage-archive-content">
                      <div className="manage-archive-metrics">
                        <div><Clock3 size={15} /><span>Total studied</span><strong>{formatDuration(stats.seconds)}</strong></div>
                        <div><FolderKanban size={15} /><span>Sessions</span><strong>{stats.sessions}</strong></div>
                        <div><CalendarDays size={15} /><span>Active days</span><strong>{stats.activeDays}</strong></div>
                        <div><Target size={15} /><span>Last studied</span><strong>{stats.lastStudied ? stats.lastStudied.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No sessions'}</strong></div>
                      </div>
                      <div className="manage-archive-breakdown">
                        <div className="manage-breakdown-heading"><span>Subproject</span><span>Sessions</span><span>Total time</span></div>
                        {breakdown.map((item) => (
                          <div className="manage-breakdown-row" key={item.name}>
                            <strong>{item.name}</strong><span>{item.sessions}</span><span>{formatDuration(item.seconds)}</span>
                          </div>
                        ))}
                        {!breakdown.length && <p>No time entries have been recorded for this project.</p>}
                        <div className="manage-breakdown-total"><strong>Project total</strong><strong>{stats.sessions} sessions</strong><strong>{formatDuration(stats.seconds)}</strong></div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="manage-project-goals" aria-label={`${project.name} combined goals`}>
                        <span>Combined goals</span>
                        <strong>{formatGoalHours(totals.daily)} <small>/ day</small></strong>
                        <strong>{formatGoalHours(totals.weekly)} <small>/ week</small></strong>
                        <strong>{formatGoalHours(totals.monthly)} <small>/ month</small></strong>
                        <button type="button" className="manage-inline-toggle" aria-expanded={!!editingProjectGoals[project.id]} onClick={() => setEditingProjectGoals((items) => ({ ...items, [project.id]: !items[project.id] }))}>
                          <Pencil size={13} /> {editingProjectGoals[project.id] ? 'Done' : 'Edit goals'}
                        </button>
                        <button type="button" className="manage-inline-toggle" aria-expanded={!!openProjectPlans[project.id]} onClick={() => setOpenProjectPlans((items) => ({ ...items, [project.id]: !items[project.id] }))}>
                          Plan <ChevronDown size={14} className={openProjectPlans[project.id] ? 'is-open' : ''} />
                        </button>
                      </div>
                      {openProjectPlans[project.id] && <PlanEditor
                        value={project}
                        label={project.name}
                        onChange={(changes) => setProjects((items) => items.map((item) => item.id === project.id ? { ...item, ...changes } : item))}
                      />}
                      <div className={`manage-subprojects${editingProjectGoals[project.id] ? ' is-editing-goals' : ''}`}>
                        <div className="manage-subproject-table-head"><span>Subproject</span>{editingProjectGoals[project.id] && <><span>Daily</span><span>Weekly</span><span>Monthly</span></>}<span aria-label="Actions" /></div>
                        {subjects.map((subject) => (
                          <div className="manage-subproject-row" key={subject.id}>
                            <span className="manage-subproject-name">
                              <ColorPicker value={subject.color || project.color} label={subject.name} onChange={(color) => setColor(project.id, subject.id, color)} />
                              {editing?.id === subject.id && editing.type === 'subject' ? (
                                <form className="manage-rename-form" onSubmit={(event) => { event.preventDefault(); saveEdit(); }}>
                                  <input value={editName} onChange={(event) => setEditName(event.target.value)} aria-label="Subproject name" autoFocus />
                                  <button type="submit" aria-label="Save subproject name"><Check size={14} /></button>
                                  <button type="button" aria-label="Cancel rename" onClick={() => setEditing(null)}><X size={14} /></button>
                                </form>
                              ) : <span>{subject.name}</span>}
                            </span>
                            {editingProjectGoals[project.id] && ['daily', 'weekly', 'monthly'].map((period) => (
                              <label className="manage-goal-input-wrap" key={period}>
                                <input type="number" min="0" max={period === 'daily' ? 24 : period === 'weekly' ? 168 : 744} step="0.25" value={subject.goals?.[period] ?? 0} onChange={(event) => setSubjectGoal(project.id, subject.id, period, event.target.value)} aria-label={`${period} goal hours for ${subject.name}`} />
                                <span>h</span>
                              </label>
                            ))}
                            <div className="manage-card-actions compact">
                              <button type="button" title={openSubjectPlans[subject.id] ? 'Hide plan' : 'Edit estimate, deadline, and milestones'} aria-label={`${openSubjectPlans[subject.id] ? 'Hide' : 'Edit'} plan for ${subject.name}`} onClick={() => setOpenSubjectPlans((items) => ({ ...items, [subject.id]: !items[subject.id] }))}><Target size={14} /></button>
                              <button type="button" title="Rename subproject" aria-label={`Rename ${subject.name}`} onClick={() => beginRename('subject', subject.id, subject.name)}><Pencil size={14} /></button>
                              <button type="button" title="Delete subproject" aria-label={`Delete ${subject.name}`} onClick={() => deleteSubject(project.id, subject.id)}><Trash2 size={14} /></button>
                            </div>
                            {openSubjectPlans[subject.id] && <div className="manage-subproject-plan"><PlanEditor value={subject} label={subject.name} onChange={(changes) => setProjects((items) => items.map((item) => item.id !== project.id ? item : { ...item, subjects: item.subjects.map((child) => child.id === subject.id ? { ...child, ...changes } : child) }))} /></div>}
                          </div>
                        ))}
                        {!subjects.length && <p className="manage-no-subprojects">Add a subproject to define goals for this project.</p>}
                        <form className="manage-add-subproject" onSubmit={(event) => addSubject(event, project.id)}>
                          <Plus size={15} />
                          <input value={newSubject[project.id] || ''} onChange={(event) => setNewSubject((items) => ({ ...items, [project.id]: event.target.value }))} placeholder={`Add a subproject to ${project.name}`} aria-label={`New subproject for ${project.name}`} />
                          <button type="submit" disabled={!(newSubject[project.id] || '').trim()}>Add subproject</button>
                        </form>
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
};
