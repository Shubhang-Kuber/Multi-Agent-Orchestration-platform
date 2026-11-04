'use strict';

const crypto = require('node:crypto');
const express = require('express');
const db = require('./db');
const log = require('./logger');

const MAX_GOAL_LEN = 2000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @param {{ planningTopic: import('@google-cloud/pubsub').Topic }} deps
 */
function createApp({ planningTopic }) {
  const app = express();
  app.use(express.json({ limit: '16kb' }));

  app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.post('/tasks', async (req, res) => {
    const goal = req.body ? req.body.goal : undefined;
    if (typeof goal !== 'string' || goal.trim().length === 0 || goal.length > MAX_GOAL_LEN) {
      return res.status(400).json({
        error: `goal must be a non-empty string of at most ${MAX_GOAL_LEN} characters`,
      });
    }

    const taskId = crypto.randomUUID();
    const traceId = crypto.randomUUID();

    await db.query(
      'INSERT INTO tasks (id, goal, status) VALUES ($1, $2, $3)',
      [taskId, goal, 'pending'],
    );
    log.info('task created', { taskId, traceId });

    try {
      const messageId = await planningTopic.publishMessage({
        json: { taskId, goal, traceId },
        attributes: { traceId, taskId },
      });
      log.info('task published to planning', { taskId, traceId, messageId });
    } catch (err) {
      log.error('publish to planning failed', { taskId, traceId, err });
      try {
        await db.query(
          'UPDATE tasks SET status = $1 WHERE id = $2',
          ['failed', taskId],
        );
      } catch (updateErr) {
        // Task is stuck in 'pending' with no message. Logged loudly; still 500.
        log.error('failed to mark task as failed', { taskId, traceId, err: updateErr });
      }
      return res.status(500).json({ error: 'failed to enqueue task', taskId, traceId });
    }

    return res.status(202).json({ taskId, traceId });
  });

  app.get('/tasks/:id', async (req, res) => {
    const { id } = req.params;
    if (!UUID_RE.test(id)) {
      return res.status(400).json({ error: 'id must be a valid UUID' });
    }

    const taskResult = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (taskResult.rowCount === 0) {
      return res.status(404).json({ error: 'task not found' });
    }

    const subtaskResult = await db.query(
      'SELECT * FROM subtasks WHERE task_id = $1 ORDER BY created_at ASC',
      [id],
    );

    return res.status(200).json({ ...taskResult.rows[0], subtasks: subtaskResult.rows });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'not found' });
  });

  // Express 5 forwards rejected async handlers here. Nothing is swallowed.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
      return res.status(err.status || 400).json({ error: 'invalid request body' });
    }
    log.error('unhandled request error', {
      method: req.method,
      path: req.path,
      err,
    });
    return res.status(500).json({ error: 'internal error' });
  });

  return app;
}

module.exports = { createApp };
