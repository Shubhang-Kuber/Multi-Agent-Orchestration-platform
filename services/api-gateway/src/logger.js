'use strict';

// One JSON object per line on stdout/stderr. Cloud Logging parses `severity`
// and `message` automatically.
function write(severity, message, fields = {}) {
  const entry = { severity, message, time: new Date().toISOString(), ...fields };
  if (fields.err instanceof Error) {
    entry.err = { message: fields.err.message, stack: fields.err.stack };
  }
  const line = JSON.stringify(entry);
  if (severity === 'ERROR') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

module.exports = {
  info: (msg, f) => write('INFO', msg, f),
  warn: (msg, f) => write('WARNING', msg, f),
  error: (msg, f) => write('ERROR', msg, f),
};
