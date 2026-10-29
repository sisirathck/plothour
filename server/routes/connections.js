import { summarizeProfile } from '../../shared/studyMetrics.js';
import { Router } from 'express';
import { randomBytes } from 'crypto';
import { pool, query } from '../db.js';
import { authenticate } from '../middleware.js';

export const connectionsRouter = Router();
connectionsRouter.use(authenticate);

async function getOrCreateInviteCode(userId) {
  const existing = await query('SELECT code FROM user_invite_codes WHERE user_id = $1', [userId]);
  if (existing.rows[0]) return existing.rows[0].code;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = `DUEL-${randomBytes(5).toString('hex').toUpperCase()}`;
    const inserted = await query(
      `INSERT INTO user_invite_codes (user_id, code) VALUES ($1, $2)
       ON CONFLICT DO NOTHING RETURNING code`,
      [userId, code]
    );
    if (inserted.rows[0]) return inserted.rows[0].code;
    const raced = await query('SELECT code FROM user_invite_codes WHERE user_id = $1', [userId]);
    if (raced.rows[0]) return raced.rows[0].code;
  }
  throw new Error('Could not allocate a unique invite code');
}

connectionsRouter.get('/', async (req, res) => {
  try {
    const inviteCode = await getOrCreateInviteCode(req.userId);
    const friends = await query(
      `SELECT u.id, u.display_name, u.email, c.code, f.created_at
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.user_low_id = $1 THEN f.user_high_id ELSE f.user_low_id END
       LEFT JOIN user_invite_codes c ON c.user_id = u.id
       WHERE f.user_low_id = $1 OR f.user_high_id = $1
       ORDER BY lower(u.display_name), u.id`,
      [req.userId]
    );
    return res.json({ inviteCode, connections: friends.rows.map((friend) => ({
      id: friend.id,
      name: friend.display_name,
      email: friend.email,
      code: friend.code,
      createdAt: friend.created_at,
    })) });
  } catch (error) {
    console.error('[Connections GET Error]:', error);
    return res.status(500).json({ error: 'Could not load study partners.' });
  }
});

connectionsRouter.post('/', async (req, res) => {
  const code = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
  if (!/^DUEL-[0-9A-F]{10}$/.test(code)) {
    return res.status(400).json({ error: 'Enter a valid PlotHour invite code.' });
  }
  try {
    const match = await query(
      `SELECT u.id, u.display_name, u.email FROM user_invite_codes c
       JOIN users u ON u.id = c.user_id WHERE c.code = $1`,
      [code]
    );
    const partner = match.rows[0];
    if (!partner) return res.status(404).json({ error: 'No account was found for that invite code.' });
    if (partner.id === req.userId) return res.status(400).json({ error: 'You cannot add your own invite code.' });
    const low = [req.userId, partner.id].sort()[0];
    const high = [req.userId, partner.id].sort()[1];
    await query(
      `INSERT INTO friendships (user_low_id, user_high_id) VALUES ($1, $2)
       ON CONFLICT (user_low_id, user_high_id) DO NOTHING`,
      [low, high]
    );
    return res.status(201).json({ connection: { id: partner.id, name: partner.display_name, email: partner.email, code } });
  } catch (error) {
    console.error('[Connections POST Error]:', error);
    return res.status(500).json({ error: 'Could not connect this study partner.' });
  }
});

connectionsRouter.delete('/:partnerId', async (req,res) => {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM comparison_sharing WHERE (user_id=$1 AND partner_id=$2) OR (user_id=$2 AND partner_id=$1)',[req.userId,req.params.partnerId]);
    await client.query('DELETE FROM friendships WHERE user_low_id=LEAST($1::uuid,$2::uuid) AND user_high_id=GREATEST($1::uuid,$2::uuid)',[req.userId,req.params.partnerId]);
    await client.query('COMMIT');return res.json({success:true});
  }catch{await client.query('ROLLBACK');return res.status(500).json({error:'Could not remove this connection.'});}finally{client.release();}
});

connectionsRouter.get('/comparison', async (req, res) => {
  const ids = [...new Set(String(req.query.profileIds || '').split(',').filter(Boolean))];
  const from = Number(req.query.from);
  const to = Number(req.query.to);
  const previousFrom = Number(req.query.previousFrom);
  const previousTo = Number(req.query.previousTo);
  const recentFrom = Number(req.query.recentFrom);
  const recentTo = Number(req.query.recentTo);
  const weekStartsOn = Number(req.query.weekStartsOn);
  const calendarDays = Number(req.query.calendarDays);
  const rangeType = String(req.query.rangeType || 'custom');
  if (ids.length < 1 || ids.length > 50 || ids.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) || !ids.includes(req.userId)
    || ![from, to].every(Number.isFinite) || from > to
    || ![previousFrom, previousTo].every(Number.isFinite)
    || ![recentFrom, recentTo].every(Number.isFinite) || recentFrom > recentTo
    || !Number.isInteger(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6
    || !Number.isInteger(calendarDays) || calendarDays < 1 || calendarDays > 100000
    || !['today', '7days', 'week', 'month', '30days', '90days', 'all', 'custom'].includes(rangeType)) {
    return res.status(400).json({ error: 'Invalid comparison request.' });
  }
  try {
    const allowed = await query(
      `SELECT id FROM users WHERE id = $1
       UNION SELECT CASE WHEN user_low_id = $1 THEN user_high_id ELSE user_low_id END
       FROM friendships WHERE user_low_id = $1 OR user_high_id = $1`,
      [req.userId]
    );
    const allowedIds = new Set(allowed.rows.map((row) => row.id));
    if (ids.some((id) => !allowedIds.has(id))) return res.status(403).json({ error: 'You can only compare your own profile and connected study partners.' });

    const profiles = await query(
      `SELECT u.id, u.display_name, u.timezone, u.week_starts_on,
              w.data ->> ('studyduel_user_' || u.id::text || '_time_entries') AS entries_json,
              w.data ->> ('studyduel_user_' || u.id::text || '_preferences') AS preferences_json,
              w.data ->> ('studyduel_user_' || u.id::text || '_projects') AS projects_json
       FROM users u LEFT JOIN user_workspace_state w ON w.user_id = u.id
       WHERE u.id = ANY($1::uuid[])`,
      [ids]
    );
    const permissions = await query('SELECT * FROM comparison_sharing WHERE partner_id=$1 AND user_id=ANY($2::uuid[])',[req.userId,ids]);
    const sharingByUser = new Map(permissions.rows.map(row=>[row.user_id,row]));
    const serializedProfiles = profiles.rows.map((profile) => {
      let storedEntries = [];
      let projects = [];
      try { storedEntries = JSON.parse(profile.entries_json || '[]'); } catch {}
      try { projects = JSON.parse(profile.projects_json || '[]'); } catch {}
      const sharing = sharingByUser.get(profile.id);
      const own = profile.id === req.userId;
      const selected = new Set(sharing?.project_ids || []);
      const visibleEntries = (Array.isArray(storedEntries) ? storedEntries : []).filter(entry => own || selected.has(entry.projectId)).map(entry => own || sharing?.share_project_names ? entry : {...entry,projectName:'Shared project',subjectName:''});
      const visibleProjects = (Array.isArray(projects) ? projects : []).filter(project => own || selected.has(project.id));
      return { ...summarizeProfile({id:profile.id,name:profile.display_name,entries:visibleEntries,projects:visibleProjects,timeZone:profile.timezone || 'UTC',start:from,end:to,previousStart:previousFrom,previousEnd:previousTo,range:rangeType,calendarDays,recentStart:recentFrom,recentEnd:recentTo}), weekStartsOn:profile.week_starts_on, sharingLimited:!own, sharedProjectCount: own ? null : selected.size };

    });
    return res.json({ profiles: serializedProfiles });
  } catch (error) {
    console.error('[Comparison Data Error]:', error);
    return res.status(500).json({ error: 'Could not load comparison data.' });
  }
});

connectionsRouter.get('/sharing',async(req,res) => {
  try {
    const [partners,projects,permissions]=await Promise.all([
      query(`SELECT u.id,u.display_name AS name FROM friendships f JOIN users u ON u.id=CASE WHEN f.user_low_id=$1 THEN f.user_high_id ELSE f.user_low_id END WHERE f.user_low_id=$1 OR f.user_high_id=$1`,[req.userId]),
      query('SELECT id,name FROM projects WHERE user_id=$1 AND archived_at IS NULL ORDER BY sort_order,name',[req.userId]),
      query('SELECT partner_id,project_ids,share_project_names FROM comparison_sharing WHERE user_id=$1',[req.userId])
    ]);
    res.json({partners:partners.rows,projects:projects.rows,permissions:permissions.rows});
  } catch {res.status(500).json({error:'Could not load sharing preferences.'});}
});
connectionsRouter.put('/sharing/:partnerId',async(req,res) => {
  const {projectIds,shareProjectNames}=req.body || {};
  if(!Array.isArray(projectIds) || projectIds.length>500 || typeof shareProjectNames!=='boolean' || projectIds.some(id=>typeof id!=='string' || !/^[\da-f-]{36}$/i.test(id))) return res.status(400).json({error:'Choose valid sharing preferences.'});
  try {
    const partner=(await query('SELECT 1 FROM friendships WHERE user_low_id=LEAST($1::uuid,$2::uuid) AND user_high_id=GREATEST($1::uuid,$2::uuid)',[req.userId,req.params.partnerId])).rows.length;
    if(!partner) return res.status(403).json({error:'Connect this person before sharing.'});
    const owned=(await query('SELECT id FROM projects WHERE user_id=$1 AND id=ANY($2::uuid[])',[req.userId,projectIds])).rows;
    if(owned.length!==new Set(projectIds).size) return res.status(400).json({error:'Only your own projects can be shared.'});
    await query(`INSERT INTO comparison_sharing(user_id,partner_id,project_ids,share_project_names) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,partner_id) DO UPDATE SET project_ids=EXCLUDED.project_ids,share_project_names=EXCLUDED.share_project_names,updated_at=now()`,[req.userId,req.params.partnerId,projectIds,shareProjectNames]);
    res.json({saved:true});
  } catch {res.status(500).json({error:'Could not save sharing preferences.'});}
});
