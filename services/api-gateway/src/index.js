'use strict';

const { PubSub } = require('@google-cloud/pubsub');
const { createApp } = require('./app');
const db = require('./db');
const log = require('./logger');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    log.error(`missing required env var ${name}`);
    process.exit(1);
  }
  return value;
}

const port = Number(requireEnv('PORT'));
const planningTopicName = requireEnv('PUBSUB_TOPIC_PLANNING');

// Project ID and credentials come from the Cloud Run metadata server (ADC).
const pubsub = new PubSub();
const planningTopic = pubsub.topic(planningTopicName);

const app = createApp({ planningTopic });
const server = app.listen(port, () => {
  log.info('api-gateway listening', { port, planningTopic: planningTopicName });
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info('shutting down', { signal });

  server.close();
  let exitCode = 0;
  try {
    await db.close();
  } catch (err) {
    log.error('db close failed', { err });
    exitCode = 1;
  }
  try {
    await pubsub.close();
  } catch (err) {
    log.error('pubsub close failed', { err });
    exitCode = 1;
  }
  process.exit(exitCode);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
