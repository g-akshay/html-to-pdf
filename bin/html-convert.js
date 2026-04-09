#!/usr/bin/env node

import { run } from '../src/cli/index.js';

run().catch((err) => {
  // Avoid printing "undefined" for process exit
  if (err && err.message !== 'process.exit called') {
    console.error('\n' + err.message);
    if (process.env.DEBUG) console.error(err.stack);
  }
  process.exit(1);
});
