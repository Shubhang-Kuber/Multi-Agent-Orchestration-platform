'use strict';

// Placeholder. The real implementation (Cloud SQL via Auth Proxy Unix socket,
// pg Pool) is written by hand. Routes depend only on this interface.

/**
 * @param {string} text  parameterized SQL ($1, $2, ...)
 * @param {Array} [params]
 * @returns {Promise<{rows: Array<object>, rowCount: number}>}
 */
async function query(text, params) { // eslint-disable-line no-unused-vars
  // TODO: implement with pg Pool over the Cloud SQL Auth Proxy socket.
  throw new Error('db not implemented');
}

async function close() {
  // TODO: drain and end the pg Pool.
  throw new Error('db not implemented');
}

module.exports = { query, close };
