import React, { useEffect, useState } from 'react';
import { FolderKanban, Plus, Pencil, Trash2, Check, X } from 'lucide-react';

const initialProjects = [
  { id: 'computer-science', name: 'Computer Science', color: '#f97316', subjects: [
    { id: 'algorithms', name: 'Algorithms', color: '#3b82f6' },
    { id: 'data-structures', name: 'Data Structures', color: '#8b5cf6' },
  ] },
  { id: 'languages', name: 'Languages', color: '#10b981', subjects: [
    { id: 'japanese', name: 'Japanese', color: '#eab308' },
  ] },
];

const loadProjects = () => {
  try {
    const saved = JSON.parse(localStorage.getItem('studyduel_demo_projects') || 'null');
    return Array.isArray(saved) ? saved : initialProjects;
  } catch {
    return initialProjects;
  }
};

export const DemoManagePanel = () => {
  const [projects, setProjects] = useState(loadProjects);
  const [newProject, setNewProject] = useState('');
  const [newSubject, setNewSubject] = useState({});
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');

  useEffect(() => localStorage.setItem('studyduel_demo_projects', JSON.stringify(projects)), [projects]);

  const addProject = (event) => {
    event.preventDefault();
    const name = newProject.trim();
    if (!name) return;
    setProjects((items) => [...items, { id: crypto.randomUUID(), name, color: '#f97316', subjects: [] }]);
    setNewProject('');
  };

  const addSubject = (event, projectId) => {
    event.preventDefault();
    const name = (newSubject[projectId] || '').trim();
    if (!name) return;
    setProjects((items) => items.map((project) => project.id === projectId
      ? { ...project, subjects: [...project.subjects, { id: crypto.randomUUID(), name, color: project.color }] }
      : project));
    setNewSubject((items) => ({ ...items, [projectId]: '' }));
  };

  const saveEdit = () => {
    if (!editing || !editName.trim()) return;
    setProjects((items) => items.map((project) => ({
      ...project,
      ...(project.id === editing.id && editing.type === 'project' ? { name: editName.trim() } : {}),
      subjects: project.subjects.map((subject) => subject.id === editing.id && editing.type === 'subject' ? { ...subject, name: editName.trim() } : subject),
    })));
    setEditing(null);
  };

  const setColor = (projectId, subjectId, color) => setProjects((items) => items.map((project) => {
    if (project.id !== projectId) return project;
    if (!subjectId) return { ...project, color };
    return { ...project, subjects: project.subjects.map((subject) => subject.id === subjectId ? { ...subject, color } : subject) };
  }));

  const removeProject = (projectId) => setProjects((items) => items.filter((project) => project.id !== projectId));
  const removeSubject = (projectId, subjectId) => setProjects((items) => items.map((project) => project.id === projectId
    ? { ...project, subjects: project.subjects.filter((subject) => subject.id !== subjectId) }
    : project));

  const renderName = (item, type) => editing?.id === item.id ? (
    <span className="manage-inline-edit"><input autoFocus value={editName} onChange={(event) => setEditName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && saveEdit()} aria-label={`Rename ${type}`} /><button type="button" onClick={saveEdit} aria-label="Save name"><Check size={15} /></button><button type="button" onClick={() => setEditing(null)} aria-label="Cancel rename"><X size={15} /></button></span>
  ) : <strong>{item.name}</strong>;

  return (
    <section className="demo-manage-card" aria-labelledby="demo-manage-title">
      <header className="manage-heading">
        <div className="header-title-group"><FolderKanban className="section-icon" size={20} /><div><h2 id="demo-manage-title">Projects &amp; subjects</h2><p>Keep your study areas organized. Changes are saved in this browser for the demo.</p></div></div>
        <span className="manage-count">{projects.length} projects</span>
      </header>
      <div className="manage-project-list">
        {projects.map((project) => (
          <article className="manage-project" key={project.id}>
            <div className="manage-project-heading">
              <span className="manage-color-wrap"><input type="color" value={project.color} onChange={(event) => setColor(project.id, null, event.target.value)} aria-label={`Color for ${project.name}`} /></span>
              {renderName(project, 'project')}
              <span className="manage-item-count">{project.subjects.length} {project.subjects.length === 1 ? 'subject' : 'subjects'}</span>
              <div className="manage-row-actions">
                <button type="button" onClick={() => { setEditing({ id: project.id, type: 'project' }); setEditName(project.name); }} aria-label={`Rename ${project.name}`}><Pencil size={15} /></button>
                <button type="button" onClick={() => removeProject(project.id)} aria-label={`Delete ${project.name}`}><Trash2 size={15} /></button>
              </div>
            </div>
            <div className="manage-subjects">
              {project.subjects.map((subject) => (
                <div className="manage-subject-row" key={subject.id}>
                  <span className="manage-color-wrap"><input type="color" value={subject.color} onChange={(event) => setColor(project.id, subject.id, event.target.value)} aria-label={`Color for ${subject.name}`} /></span>
                  {renderName(subject, 'subject')}
                  <span className="manage-item-count">Subject</span>
                  <div className="manage-row-actions">
                    <button type="button" onClick={() => { setEditing({ id: subject.id, type: 'subject' }); setEditName(subject.name); }} aria-label={`Rename ${subject.name}`}><Pencil size={14} /></button>
                    <button type="button" onClick={() => removeSubject(project.id, subject.id)} aria-label={`Delete ${subject.name}`}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
              <form className="manage-add-subject" onSubmit={(event) => addSubject(event, project.id)}>
                <input value={newSubject[project.id] || ''} onChange={(event) => setNewSubject((items) => ({ ...items, [project.id]: event.target.value }))} placeholder="Add a subject" aria-label={`New subject for ${project.name}`} />
                <button type="submit" aria-label={`Add subject to ${project.name}`}><Plus size={16} /> Add subject</button>
              </form>
            </div>
          </article>
        ))}
        {projects.length === 0 && <div className="manage-empty">No projects yet. Add one below to get started.</div>}
      </div>
      <form className="manage-add-project" onSubmit={addProject}>
        <input value={newProject} onChange={(event) => setNewProject(event.target.value)} placeholder="New project name" aria-label="New project name" />
        <button type="submit"><Plus size={16} /> Add project</button>
      </form>
    </section>
  );
};
