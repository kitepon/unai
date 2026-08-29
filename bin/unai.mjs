#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { diagnose, productVersion } from '../lib/diagnostics.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

try {
  if (args.length === 1 && args[0] === '--version') {
    process.stdout.write(`${await productVersion(root)}\n`);
  } else if (args.length === 2 && args[0] === 'factory-diagnostics' && args[1] === '--json') {
    const result = await diagnose(root);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.overall !== 'ready') process.exitCode = 1;
  } else {
    process.stderr.write('usage: unai --version | unai factory-diagnostics --json\n');
    process.exitCode = 2;
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'unai_cli_failed'}\n`);
  process.exitCode = 1;
}
