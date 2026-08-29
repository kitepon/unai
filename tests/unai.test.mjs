import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { lstat, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { diagnose } from '../lib/diagnostics.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('versionとnative diagnosticsがmanifestに一致する', async () => {
  const cli = path.join(root, 'bin/unai.mjs');
  assert.equal(execFileSync(process.execPath, [cli, '--version'], { encoding: 'utf8' }), '0.2.0\n');
  const result = JSON.parse(execFileSync(
    process.execPath, [cli, 'factory-diagnostics', '--json'], { encoding: 'utf8' },
  ));
  assert.deepEqual(result, {
    schema: 'unai.native_factory_diagnostics.v1',
    product: { name: 'unai', version: '0.2.0' },
    checks: { manifest_consistency: 'pass', node_runtime: 'pass', skill_bundle: 'pass' },
    overall: 'ready',
  });
  assert.equal(JSON.stringify(result).includes(root), false);
});

test('skill bundle欠損はnot_readyと非0終了になる', async (t) => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'unai-diagnostics-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  await mkdir(path.join(fixture, '.claude-plugin'), { recursive: true });
  await mkdir(path.join(fixture, 'skills/unai'), { recursive: true });
  await Promise.all([
    writeJsonFixture(path.join(fixture, '.claude-plugin/plugin.json'), { name: 'unai', version: '0.2.0' }),
    writeJsonFixture(path.join(fixture, '.claude-plugin/marketplace.json'), {
      name: 'unai', metadata: { version: '0.2.0' }, plugins: [{ name: 'unai', source: './' }],
    }),
  ]);
  const result = await diagnose(fixture);
  assert.equal(result.checks.skill_bundle, 'fail');
  assert.equal(result.overall, 'not_ready');
});

test('bash installerは隔離HOMEへskillとCLIを冪等配置して外せる', async (t) => {
  if (process.platform === 'win32') return;
  const home = await mkdtemp(path.join(tmpdir(), 'unai-install-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  await Promise.all(['.claude', '.codex', '.agents', '.grok', '.cursor'].map((dir) => (
    mkdir(path.join(home, dir), { recursive: true })
  )));
  const env = { ...process.env, HOME: home };
  execFileSync('bash', [path.join(root, 'install.sh')], { env, stdio: 'pipe' });
  execFileSync('bash', [path.join(root, 'install.sh')], { env, stdio: 'pipe' });
  for (const host of ['.claude', '.codex', '.agents', '.grok', '.cursor']) {
    assert.equal((await lstat(path.join(home, host, 'skills/unai'))).isSymbolicLink(), true);
  }
  const cli = path.join(home, '.local/bin/unai');
  assert.equal((await lstat(cli)).isSymbolicLink(), true);
  assert.equal(execFileSync(cli, ['--version'], { env, encoding: 'utf8' }), '0.2.0\n');
  execFileSync('bash', [path.join(root, 'install.sh'), '--uninstall'], { env, stdio: 'pipe' });
  assert.equal(spawnSync(cli, ['--version'], { env }).status, null);
});

async function writeJsonFixture(file, value) {
  await writeFile(file, `${JSON.stringify(value)}\n`);
}
