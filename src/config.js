'use strict';

const crypto = require('crypto');

// No credential is needed: the session cookie is signed with a key made at start.
function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT) || 3000,
    databaseUrl: env.DATABASE_URL || 'postgres://app:app@localhost:5432/app',
    signingSecret: crypto.randomBytes(32).toString('hex'),
  };
}

module.exports = { loadConfig };
