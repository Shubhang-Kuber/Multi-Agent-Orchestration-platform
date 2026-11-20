'use strict';

const { Pool } = require('pg');
const { Connector, AuthTypes, IpAddressTypes } = require('@google-cloud/cloud-sql-connector');

let connector = null;
let poolPromise = null; // memoized so concurrent first requests share one init

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`missing required env var ${name}`);
  return v;
}

async function createPool() {
  connector = new Connector();
  // The connector fetches/refreshes the IAM token and handles TLS itself,
  // so there is no DB password anywhere.
  const clientOpts = await connector.getOptions({
    instanceConnectionName: requireEnv('INSTANCE_CONNECTION_NAME'),
    authType: AuthTypes.IAM,
    ipType: IpAddressTypes.PUBLIC,
  });

  const pool = new Pool({
    ...clientOpts,
    user: requireEnv('DB_USER'), // SA email without ".gserviceaccount.com"
    database: requireEnv('DB_NAME'),
    max: 5, // each Cloud Run instance gets its own pool; f1-micro has few connections
  });

  // Without this listener, an error on an idle client crashes the process.
  pool.on('error', (err) => {
    console.error(JSON.stringify({ level: 'error', msg: 'pg pool error', error: err.message }));
  });
  return pool;
}

function getPool() {
  if (!poolPromise) {
    poolPromise = createPool().catch((err) => {
      poolPromise = null; // allow a retry on the next request instead of caching the failure
      throw err;
    });
  }
  return poolPromise;
}

async function query(text, params) {
  const pool = await getPool();
  return pool.query(text, params); // returns {rows, rowCount}
}

async function close() {
  if (!poolPromise) return; // never initialised, nothing to drain
  const pool = await poolPromise;
  poolPromise = null;
  await pool.end();      // drain connections first
  connector.close();     // then stop the connector's token refresh timers
  connector = null;
}

module.exports = { query, close };