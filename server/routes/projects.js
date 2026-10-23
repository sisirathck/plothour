import { Router } from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware.js';

export const projectsRouter = Router();

projectsRouter.use(authenticate);

const DEFAULT_SEED_PROJECTS = [
  {
    name: 'Computer Science',
    color: '#f3957f',
    subjects: ['Algorithms', 'Data Structures', 'System Design'],
  },
  {
    name: 'Mathematics',
    color: '#818cf8',
    subjects: ['Calculus III', 'Linear Algebra'],
  },
  {
    name: 'Languages',
    color: '#34d399',
    subjects: ['Japanese', 'German'],
  },
];

async function seedDefaultProjects(userId) {
  for (let i = 0; i < DEFAULT_SEED_PROJECTS.length; i++) {
    const p = DEFAULT_SEED_PROJECTS[i];
    const pRes = await query(
      `INSERT INTO projects (user_id, name, color, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [userId, p.name, p.color, i]
    );
    const projectId = pRes.rows[0].id;
    for (let sIdx = 0; sIdx < p.subjects.length; sIdx++) {
      await query(
        `INSERT INTO subprojects (project_id, name, color, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [projectId, p.subjects[sIdx], p.color, sIdx]
      );
    }
  }
}

/**
 * List all projects for authenticated user
 */
projectsRouter.get('/', async (req, res) => {
  try {
    let result = await query(
      `SELECT p.id, p.name, p.color, p.sort_order, p.archived_at,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', s.id,
                    'name', s.name,
                    'color', s.color,
                    'sort_order', s.sort_order
                  ) ORDER BY s.sort_order, s.created_at
                ) FILTER (WHERE s.id IS NOT NULL AND s.archived_at IS NULL),
                '[]'::json
              ) AS subjects
       FROM projects p
       LEFT JOIN subprojects s ON s.project_id = p.id
       WHERE p.user_id = $1 AND p.archived_at IS NULL
       GROUP BY p.id
       ORDER BY p.sort_order, p.created_at`,
      [req.userId]
    );

    // If new user with no projects, seed default sample projects
    if (result.rows.length === 0) {
      await seedDefaultProjects(req.userId);
      result = await query(
        `SELECT p.id, p.name, p.color, p.sort_order, p.archived_at,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'id', s.id,
                      'name', s.name,
                      'color', s.color,
                      'sort_order', s.sort_order
                    ) ORDER BY s.sort_order, s.created_at
                  ) FILTER (WHERE s.id IS NOT NULL AND s.archived_at IS NULL),
                  '[]'::json
                ) AS subjects
         FROM projects p
         LEFT JOIN subprojects s ON s.project_id = p.id
         WHERE p.user_id = $1 AND p.archived_at IS NULL
         GROUP BY p.id
         ORDER BY p.sort_order, p.created_at`,
        [req.userId]
      );
    }

    return res.json({ projects: result.rows });
  } catch (err) {
    console.error('[Projects GET Error]:', err);
    return res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

/**
 * Create a new project
 */
projectsRouter.post('/', async (req, res) => {
  try {
    const { name, color = '#10b981', subjects = [] } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const pRes = await query(
      `INSERT INTO projects (user_id, name, color)
       VALUES ($1, $2, $3)
       RETURNING id, name, color, sort_order, created_at`,
      [req.userId, name.trim(), color]
    );
    const newProject = pRes.rows[0];
    newProject.subjects = [];

    if (Array.isArray(subjects) && subjects.length > 0) {
      for (let i = 0; i < subjects.length; i++) {
        const subName = typeof subjects[i] === 'string' ? subjects[i] : subjects[i].name;
        if (subName && subName.trim()) {
          const sRes = await query(
            `INSERT INTO subprojects (project_id, name, color, sort_order)
             VALUES ($1, $2, $3, $4)
             RETURNING id, name, color, sort_order`,
            [newProject.id, subName.trim(), color, i]
          );
          newProject.subjects.push(sRes.rows[0]);
        }
      }
    }

    return res.status(201).json({ project: newProject });
  } catch (err) {
    console.error('[Projects POST Error]:', err);
    return res.status(500).json({ error: 'Failed to create project' });
  }
});
