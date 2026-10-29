const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const parse = (value, fallback) => {
  try { return JSON.parse(value); } catch { return fallback; }
};

const dateValue = (value) => {
  if (!value) return null;
  const date = typeof value === 'number' ? new Date(value) : new Date(String(value).length === 10 ? `${value}T12:00:00Z` : value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
};

const timestampValue = (value) => {
  if (!value) return null;
  const date = typeof value === 'number' ? new Date(value) : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

const scopedKey = (userId, suffix) => `studyduel_user_${userId}_${suffix}`;

async function syncProjects(client, userId, raw) {
  const projects = parse(raw, []);
  if (!Array.isArray(projects)) return;

  for (let projectIndex = 0; projectIndex < projects.length; projectIndex += 1) {
    const project = projects[projectIndex];
    if (!UUID.test(project?.id || '') || !String(project?.name || '').trim()) continue;
    const createdAt = timestampValue(project.createdAt || project.created_at);
    await client.query(
      `INSERT INTO projects
         (id, user_id, name, color, sort_order, archived_at, created_at, updated_at, start_date, deadline, favorite)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::timestamptz,now()),now(),$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET
         name=EXCLUDED.name, color=EXCLUDED.color, sort_order=EXCLUDED.sort_order,
         archived_at=EXCLUDED.archived_at, updated_at=now(), start_date=EXCLUDED.start_date,
         deadline=EXCLUDED.deadline, favorite=EXCLUDED.favorite
       WHERE projects.user_id=EXCLUDED.user_id`,
      [project.id, userId, String(project.name).trim(), project.color || null, projectIndex,
        project.archived ? (timestampValue(project.archivedAt) || new Date().toISOString()) : null,
        createdAt, dateValue(project.startDate) || dateValue(createdAt), dateValue(project.endDate || project.deadline), Boolean(project.favorite)]
    );

    const subjects = Array.isArray(project.subjects) ? project.subjects : [];
    for (let subjectIndex = 0; subjectIndex < subjects.length; subjectIndex += 1) {
      const subject = subjects[subjectIndex];
      if (!UUID.test(subject?.id || '') || !String(subject?.name || '').trim()) continue;
      const subjectCreatedAt = timestampValue(subject.createdAt || subject.created_at);
      await client.query(
        `INSERT INTO subprojects
           (id, project_id, name, color, sort_order, archived_at, created_at, updated_at, start_date, deadline, estimate_seconds)
         VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::timestamptz,now()),now(),$8,$9,$10)
         ON CONFLICT (id) DO UPDATE SET
           name=EXCLUDED.name, color=EXCLUDED.color, sort_order=EXCLUDED.sort_order,
           archived_at=EXCLUDED.archived_at, updated_at=now(), start_date=EXCLUDED.start_date,
           deadline=EXCLUDED.deadline, estimate_seconds=EXCLUDED.estimate_seconds
         WHERE subprojects.project_id=EXCLUDED.project_id`,
        [subject.id, project.id, String(subject.name).trim(), subject.color || null, subjectIndex,
          subject.archived ? (timestampValue(subject.archivedAt) || new Date().toISOString()) : null,
          subjectCreatedAt, dateValue(subject.startDate) || dateValue(subjectCreatedAt) || dateValue(project.startDate) || dateValue(createdAt),
          dateValue(subject.endDate || subject.deadline), subject.estimateHours === '' || subject.estimateHours == null ? null : Math.round(Math.max(0, Number(subject.estimateHours) || 0) * 3600)]
      );

      for (const cadence of ['daily', 'weekly', 'monthly']) {
        await client.query(
          `INSERT INTO subproject_goals (subproject_id, cadence, target_hours)
           VALUES ($1,$2,$3) ON CONFLICT (subproject_id,cadence) DO UPDATE
           SET target_hours=EXCLUDED.target_hours, updated_at=now()`,
          [subject.id, cadence, Math.max(0, Number(subject.goals?.[cadence]) || 0)]
        );
      }
      await client.query('DELETE FROM subproject_study_days WHERE subproject_id=$1', [subject.id]);
      for (const weekday of [...new Set(Array.isArray(subject.studyDays) ? subject.studyDays : [])]) {
        if (Number.isInteger(weekday) && weekday >= 0 && weekday <= 6) {
          await client.query('INSERT INTO subproject_study_days (subproject_id, weekday) VALUES ($1,$2) ON CONFLICT DO NOTHING', [subject.id, weekday]);
        }
      }
      await client.query('DELETE FROM milestones WHERE subproject_id=$1', [subject.id]);
      const milestones = Array.isArray(subject.milestones) ? subject.milestones : [];
      for (let index = 0; index < milestones.length; index += 1) {
        const milestone = milestones[index];
        if (!String(milestone?.title || '').trim()) continue;
        await client.query(
          `INSERT INTO milestones (id, subproject_id, title, completed, sort_order)
           VALUES (COALESCE($1::uuid,gen_random_uuid()),$2,$3,$4,$5)`,
          [UUID.test(milestone.id || '') ? milestone.id : null, subject.id, String(milestone.title).trim(), Boolean(milestone.completed), index]
        );
      }
    }
  }
}

async function syncTimeEntries(client, userId, raw) {
  const entries = parse(raw, []);
  if (!Array.isArray(entries)) return;
  for (const entry of entries) {
    if (!UUID.test(entry?.id || '') || !UUID.test(entry?.projectId || '')) continue;
    const startedAt = timestampValue(entry.startedAt);
    const endedAt = timestampValue(entry.endedAt);
    if (!startedAt || !endedAt || new Date(endedAt) <= new Date(startedAt)) continue;
    const project = await client.query('SELECT 1 FROM projects WHERE id=$1 AND user_id=$2', [entry.projectId, userId]);
    // Session history intentionally outlives a deleted project. Reconstruct an
    // archived tombstone from the denormalized labels retained on the entry so
    // the history remains relational without putting the project back in the UI.
    if (!project.rows.length) {
      await client.query(
        `INSERT INTO projects (id,user_id,name,color,archived_at,created_at,start_date)
         VALUES ($1,$2,$3,$4,now(),$5,$6) ON CONFLICT DO NOTHING`,
        [entry.projectId, userId, String(entry.projectName || 'Deleted project').trim() || 'Deleted project', entry.color || null, startedAt, dateValue(startedAt)]
      );
    }
    let subjectId = UUID.test(entry.subjectId || '') ? entry.subjectId : null;
    if (subjectId) {
      const subject = await client.query('SELECT 1 FROM subprojects WHERE id=$1 AND project_id=$2', [subjectId, entry.projectId]);
      if (!subject.rows.length) {
        await client.query(
          `INSERT INTO subprojects (id,project_id,name,color,archived_at,created_at,start_date)
           VALUES ($1,$2,$3,$4,now(),$5,$6) ON CONFLICT DO NOTHING`,
          [subjectId, entry.projectId, String(entry.subjectName || 'Deleted subproject').trim() || 'Deleted subproject', entry.color || null, startedAt, dateValue(startedAt)]
        );
      }
    }
    await client.query(
      `INSERT INTO time_entries (id,user_id,project_id,subproject_id,started_at,ended_at,note,source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET started_at=EXCLUDED.started_at, ended_at=EXCLUDED.ended_at,
         note=EXCLUDED.note, updated_at=now() WHERE time_entries.user_id=EXCLUDED.user_id`,
      [entry.id, userId, entry.projectId, subjectId,
        startedAt, endedAt, entry.note || null, entry.source === 'manual' ? 'manual' : 'timer']
    );
  }
}

async function syncActiveTimer(client, userId, raw) {
  const timer = parse(raw, null);
  if (!timer || !UUID.test(timer.projectId || '') || !timestampValue(timer.startedAt)) {
    await client.query('DELETE FROM active_timers WHERE user_id=$1', [userId]);
    return;
  }
  const project = await client.query('SELECT 1 FROM projects WHERE id=$1 AND user_id=$2', [timer.projectId, userId]);
  if (!project.rows.length) return;
  let subjectId = UUID.test(timer.subjectId || '') ? timer.subjectId : null;
  if (subjectId) {
    const subject = await client.query('SELECT 1 FROM subprojects WHERE id=$1 AND project_id=$2', [subjectId, timer.projectId]);
    if (!subject.rows.length) subjectId = null;
  }
  await client.query(
    `INSERT INTO active_timers (user_id,project_id,subproject_id,started_at,note)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT(user_id) DO UPDATE SET
       project_id=EXCLUDED.project_id,subproject_id=EXCLUDED.subproject_id,
       started_at=EXCLUDED.started_at,note=EXCLUDED.note`,
    [userId, timer.projectId, subjectId, timestampValue(timer.startedAt), timer.note || null]
  );
}

async function upsertJson(client, table, column, userId, value) {
  await client.query(
    `INSERT INTO ${table} (user_id,${column}) VALUES ($1,$2::jsonb)
     ON CONFLICT (user_id) DO UPDATE SET ${column}=${table === 'user_preferences' && column === 'preferences' ? `${table}.${column} || EXCLUDED.${column}` : `EXCLUDED.${column}`}, updated_at=now()`,
    [userId, JSON.stringify(value)]
  );
}

export async function syncWorkspaceProjection(client, userId, items, onlyKey = null) {
  const get = (suffix) => items[scopedKey(userId, suffix)];
  const matches = (suffix) => !onlyKey || onlyKey === scopedKey(userId, suffix);

  if (matches('projects') && get('projects') != null) await syncProjects(client, userId, get('projects'));
  if (matches('time_entries') && get('time_entries') != null) await syncTimeEntries(client, userId, get('time_entries'));
  if (matches('active_timer') && get('active_timer') != null) {
    const authoritative=await client.query('SELECT 1 FROM active_timers WHERE user_id=$1',[userId]);
    if(!authoritative.rows.length) await syncActiveTimer(client,userId,get('active_timer'));
  }
  if (matches('preferences') && get('preferences') != null) await upsertJson(client, 'user_preferences', 'preferences', userId, parse(get('preferences'), {}));
  if (matches('theme') && get('theme') != null) await client.query(`INSERT INTO user_preferences (user_id,theme) VALUES ($1,$2) ON CONFLICT(user_id) DO UPDATE SET theme=EXCLUDED.theme,updated_at=now()`, [userId, get('theme')]);
  if (matches('theme_mode') && get('theme_mode') != null) await client.query(`INSERT INTO user_preferences (user_id,theme_mode) VALUES ($1,$2) ON CONFLICT(user_id) DO UPDATE SET theme_mode=EXCLUDED.theme_mode,updated_at=now()`, [userId, get('theme_mode')]);
  if (matches('dashboard_preferences') && get('dashboard_preferences') != null) await upsertJson(client, 'dashboard_preferences', 'layout', userId, parse(get('dashboard_preferences'), {}));
  for (const suffix of ['dashboard_preferences_range_v2', 'dashboard_preferences_range_v3']) {
    if (matches(suffix) && get(suffix) != null) await client.query(`INSERT INTO dashboard_preferences (user_id,date_range) VALUES ($1,$2) ON CONFLICT(user_id) DO UPDATE SET date_range=EXCLUDED.date_range,updated_at=now()`, [userId, get(suffix)]);
  }
  for (const suffix of ['compare_profiles', 'compare_profiles_selected']) {
    if (matches(suffix) && get(suffix) != null) await upsertJson(client, 'compare_preferences', 'selected_profile_ids', userId, parse(get(suffix), []));
  }
  if (matches('compare_profile_colors') && get('compare_profile_colors') != null) await upsertJson(client, 'compare_preferences', 'profile_colors', userId, parse(get('compare_profile_colors'), {}));
  if (matches('compare_details') && get('compare_details') != null) await upsertJson(client, 'compare_preferences', 'details', userId, parse(get('compare_details'), {}));
  if (matches('reminders') && get('reminders') != null) await upsertJson(client, 'user_reminders', 'configuration', userId, parse(get('reminders'), {}));

  if (matches('reminders_fired') && get('reminders_fired') != null) {
    for (const key of parse(get('reminders_fired'), [])) {
      if (typeof key === 'string') await client.query('INSERT INTO reminder_deliveries (user_id,reminder_key) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, key]);
    }
  }
  if (matches('session_activity') && get('session_activity') != null) {
    const activity = parse(get('session_activity'), []);
    if (Array.isArray(activity)) for (let index = 0; index < activity.length; index += 1) {
      const item = activity[index];
      const key = String(item?.id || item?.at || item?.timestamp || index);
      await client.query(
        `INSERT INTO session_activity (user_id,activity_key,payload,occurred_at)
         VALUES ($1,$2,$3::jsonb,COALESCE($4::timestamptz,now())) ON CONFLICT(user_id,activity_key)
         DO UPDATE SET payload=EXCLUDED.payload,occurred_at=EXCLUDED.occurred_at`,
        [userId, key, JSON.stringify(item), timestampValue(item?.at || item?.timestamp)]
      );
    }
  }
  if (matches('study_streak') && get('study_streak') != null) {
    const streak = parse(get('study_streak'), {});
    await client.query(
      `INSERT INTO user_streaks (user_id,current_streak,longest_streak,calculated_through)
       VALUES ($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET
       current_streak=EXCLUDED.current_streak,longest_streak=EXCLUDED.longest_streak,
       calculated_through=EXCLUDED.calculated_through,updated_at=now()`,
      [userId, Math.max(0, Number(streak.currentStreak) || 0), Math.max(0, Number(streak.longestStreak) || 0), dateValue(streak.lastStudyDate)]
    );
  }
}

export async function backfillWorkspaceProjections(client) {
  const result = await client.query('SELECT user_id,data FROM user_workspace_state');
  for (const row of result.rows) {
    try {
      await client.query('BEGIN');
      await syncWorkspaceProjection(client, row.user_id, row.data || {});
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`[Workspace projection] Could not backfill user ${row.user_id}:`, error.message);
    }
  }
}
