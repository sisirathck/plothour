import React, { useEffect, useState } from 'react';
import { Check, FolderKanban, Pencil, Plus, Trash2, X } from 'lucide-react';
import './Manage.css';

const initialProjects = [
  {
    id: 'computer-science',
    name: 'Computer Science',
    color: '#f97316',
    subjects: [
      { id: 'algorithms', name: 'Algorithms', color: '#3b82f6' },
      { id: 'data-structures', name: 'Data Structures', color: '#8b5cf6' },
    ],
  },
  {
    id: 'languages',
    name: 'Languages',
    color: '#10b981',
    subjects: [
      { id: 'japanese', name: 'Japanese', color: '#eab308' },
    ],
  },
];

export const ManagePage = ({ user }) => {
  const projectsKey = user?.id ? `studyduel_user_${user.id}_projects` : 'studyduel_demo_projects';

  const [projects, setProjects] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(projectsKey) || 'null');
      return Array.isArray(saved) && saved.length > 0 ? saved : initialProjects;
    } catch {
      return initialProjects;
    }
  });
  const [newProject, setNewProject] = useState('');
  const [newSubject, setNewSubject] = useState({});
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    localStorage.setItem(projectsKey, JSON.stringify(projects));
  }, [projectsKey, projects]);

  const addProject = (event) => {
    event.preventDefault();
    const name = newProject.trim();
    if (!name) return;
    setProjects((items) => [
      ...items,
      { id: crypto.randomUUID(), name, color: '#f97316', subjects: [] },
    ]);
    setNewProject('');
  };

  const addSubject = (event, projectId) => {
    event.preventDefault();
    const name = (newSubject[projectId] || '').trim();
    if (!name) return;
    setProjects((items) =>
      items.map((project) =>
        project.id === projectId
          ? {
              ...project,
              subjects: [
                ...project.subjects,
                { id: crypto.randomUUID(), name, color: project.color },
              ],
            }
          : project
      )
    );
    setNewSubject((items) => ({ ...items, [projectId]: '' }));
  };

  const saveEdit = () => {
    if (!editing || !editName.trim()) return;
    setProjects((items) =>
      items.map((project) => ({
        ...project,
        ...(project.id === editing.id && editing.type === 'project'
          ? { name: editName.trim() }
          : {}),
        subjects: project.subjects.map((subject) =>
          subject.id === editing.id && editing.type === 'subject'
            ? { ...subject, name: editName.trim() }
            : subject
        ),
      }))
    );
    setEditing(null);
  };

  const setColor = (projectId, subjectId, color) =>
    setProjects((items) =>
      items.map((project) => {
        if (project.id !== projectId) return project;
        if (!subjectId) return { ...project, color };
        return {
          ...project,
          subjects: project.subjects.map((subject) =>
            subject.id === subjectId ? { ...subject, color } : subject
          ),
        };
      })
    );

  const deleteProject = (id) => {
    if (!window.confirm('Delete this project and all its subprojects?')) return;
    setProjects((items) => items.filter((p) => p.id !== id));
  };

  const deleteSubject = (projectId, subjectId) => {
    setProjects((items) =>
      items.map((p) =>
        p.id === projectId
          ? { ...p, subjects: p.subjects.filter((s) => s.id !== subjectId) }
          : p
      )
    );
  };

  return (
    <div className="manage-module-container">
      <section className="demo-manage-card" aria-label="Project and Subject Management">
        <div className="manage-heading">
          <div className="manage-heading-title">
            <FolderKanban size={24} color="var(--sd-orange)" />
            <div>
              <h2>Projects & Subjects</h2>
              <p>Organize your study goals, subjects, and color markers.</p>
            </div>
          </div>
          <span className="manage-count">{projects.length} {projects.length === 1 ? 'project' : 'projects'} configured</span>
        </div>

        {/* Create New Project Form */}
        <form className="manage-add-project" onSubmit={addProject}>
          <input
            type="text"
            placeholder="New project name (e.g. Physics, Law, Machine Learning)..."
            value={newProject}
            onChange={(e) => setNewProject(e.target.value)}
          />
          <button type="submit">
            <Plus size={16} />
            <span>Create Project</span>
          </button>
        </form>

        {/* Project & Subject Hierarchy List */}
        {projects.length === 0 ? (
          <div className="manage-empty">
            <p>No projects configured yet. Add your first project above to start tracking time!</p>
          </div>
        ) : (
          <div className="manage-project-list">
            {projects.map((project) => (
              <div key={project.id} className="manage-project">
                <div className="manage-project-heading">
                  <span className="manage-color-wrap">
                    <input
                      type="color"
                      value={project.color || '#f97316'}
                      onChange={(e) => setColor(project.id, null, e.target.value)}
                      title="Change project color"
                    />
                  </span>

                  {editing?.id === project.id && editing.type === 'project' ? (
                    <div className="manage-inline-edit">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                      />
                      <button type="button" onClick={saveEdit} title="Save"><Check size={14} /></button>
                      <button type="button" onClick={() => setEditing(null)} title="Cancel"><X size={14} /></button>
                    </div>
                  ) : (
                    <strong>{project.name}</strong>
                  )}

                  <span className="manage-count">{project.subjects.length} {project.subjects.length === 1 ? 'subject' : 'subjects'}</span>

                  <div className="manage-row-actions">
                    <button
                      type="button"
                      onClick={() => { setEditing({ id: project.id, type: 'project' }); setEditName(project.name); }}
                      title="Rename project"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteProject(project.id)}
                      title="Delete project"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Subprojects / Subjects */}
                <div className="manage-subjects">
                  {project.subjects.map((subject) => (
                    <div key={subject.id} className="manage-subject-row">
                      <span className="manage-color-wrap">
                        <input
                          type="color"
                          value={subject.color || project.color || '#3b82f6'}
                          onChange={(e) => setColor(project.id, subject.id, e.target.value)}
                          title="Change subject color"
                        />
                      </span>

                      {editing?.id === subject.id && editing.type === 'subject' ? (
                        <div className="manage-inline-edit">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            autoFocus
                          />
                          <button type="button" onClick={saveEdit} title="Save"><Check size={14} /></button>
                          <button type="button" onClick={() => setEditing(null)} title="Cancel"><X size={14} /></button>
                        </div>
                      ) : (
                        <span>{subject.name}</span>
                      )}

                      <div className="manage-row-actions">
                        <button
                          type="button"
                          onClick={() => { setEditing({ id: subject.id, type: 'subject' }); setEditName(subject.name); }}
                          title="Rename subject"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSubject(project.id, subject.id)}
                          title="Delete subject"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  <form className="manage-add-subject" onSubmit={(e) => addSubject(e, project.id)}>
                    <input
                      type="text"
                      placeholder={`Add subproject / subject to ${project.name}...`}
                      value={newSubject[project.id] || ''}
                      onChange={(e) => setNewSubject({ ...newSubject, [project.id]: e.target.value })}
                    />
                    <button type="submit">Add Subject</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
