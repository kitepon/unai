import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  cp, lstat, mkdir, mkdtemp, readFile, readlink, realpath, rename, rm, symlink, writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { diagnose } from '../lib/diagnostics.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('versionとnative diagnosticsがmanifestに一致する', async () => {
  const cli = path.join(root, 'bin/unai.mjs');
  assert.equal(execFileSync(process.execPath, [cli, '--version'], { encoding: 'utf8' }), '0.2.1\n');
  const result = JSON.parse(execFileSync(
    process.execPath, [cli, 'factory-diagnostics', '--json'], { encoding: 'utf8' },
  ));
  assert.deepEqual(result, {
    schema: 'unai.native_factory_diagnostics.v1',
    product: { name: 'unai', version: '0.2.1' },
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
    writeJsonFixture(path.join(fixture, '.claude-plugin/plugin.json'), { name: 'unai', version: '0.2.1' }),
    writeJsonFixture(path.join(fixture, '.claude-plugin/marketplace.json'), {
      name: 'unai', metadata: { version: '0.2.1' }, plugins: [{ name: 'unai', source: './' }],
    }),
  ]);
  const result = await diagnose(fixture);
  assert.equal(result.checks.skill_bundle, 'fail');
  assert.equal(result.overall, 'not_ready');
});

test('bash installerは隔離HOMEへskillとCLIを冪等配置して外せる', async (t) => {
  if (process.platform === 'win32') {
    t.skip('POSIX installer test');
    return;
  }
  const home = await mkdtemp(path.join(tmpdir(), 'unai-install-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  await Promise.all(['.claude', '.codex', '.agents', '.grok', '.cursor'].map((dir) => (
    mkdir(path.join(home, dir), { recursive: true })
  )));
  const env = { ...process.env, HOME: home };
  execFileSync('bash', [path.join(root, 'install.sh')], { env, stdio: 'pipe' });
  execFileSync('bash', [path.join(root, 'install.sh')], { env, stdio: 'pipe' });
  for (const host of ['.claude', '.agents', '.grok', '.cursor']) {
    assert.equal((await lstat(path.join(home, host, 'skills/unai'))).isSymbolicLink(), true);
  }
  await assert.rejects(lstat(path.join(home, '.codex/skills/unai')), { code: 'ENOENT' });

  execFileSync('bash', [path.join(root, 'install.sh'), '--profile', 'legacy'], {
    env,
    stdio: 'pipe',
  });
  assert.equal((await lstat(path.join(home, '.codex/skills/unai'))).isSymbolicLink(), true);
  await assert.rejects(lstat(path.join(home, '.agents/skills/unai')), { code: 'ENOENT' });

  execFileSync('bash', [path.join(root, 'install.sh')], { env, stdio: 'pipe' });
  assert.equal((await lstat(path.join(home, '.agents/skills/unai'))).isSymbolicLink(), true);
  await assert.rejects(lstat(path.join(home, '.codex/skills/unai')), { code: 'ENOENT' });

  const cli = path.join(home, '.local/bin/unai');
  assert.equal((await lstat(cli)).isSymbolicLink(), true);
  assert.equal(execFileSync(cli, ['--version'], { env, encoding: 'utf8' }), '0.2.1\n');
  execFileSync('bash', [path.join(root, 'install.sh'), '--uninstall'], { env, stdio: 'pipe' });
  assert.equal(spawnSync(cli, ['--version'], { env }).status, null);
});

test('bash installerは利用者の実体を保護し、退避後の再実行で配置できる', async (t) => {
  if (process.platform === 'win32') {
    t.skip('POSIX installer test');
    return;
  }
  const home = await mkdtemp(path.join(tmpdir(), 'unai-install-conflict-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const skill = path.join(home, '.agents/skills/unai');
  const skillBackup = `${skill}.before-unai`;
  const legacySkill = path.join(home, '.codex/skills/unai');
  const cli = path.join(home, '.local/bin/unai');
  const cliBackup = `${cli}.before-unai`;
  await mkdir(skill, { recursive: true });
  await mkdir(path.dirname(legacySkill), { recursive: true });
  await mkdir(path.dirname(cli), { recursive: true });
  await writeFile(path.join(skill, 'owned.txt'), '利用者の実体\n');
  await symlink(path.join(root, 'skills/unai'), legacySkill);
  await writeFile(cli, '利用者のCLI\n');
  const env = { ...process.env, HOME: home };

  execFileSync('bash', [path.join(root, 'install.sh')], { env, stdio: 'pipe' });
  assert.equal((await lstat(skill)).isSymbolicLink(), false);
  assert.equal(await readFile(path.join(skill, 'owned.txt'), 'utf8'), '利用者の実体\n');
  assert.equal(await readlink(legacySkill), path.join(root, 'skills/unai'));
  assert.equal((await lstat(cli)).isSymbolicLink(), false);
  assert.equal(await readFile(cli, 'utf8'), '利用者のCLI\n');

  await rename(skill, skillBackup);
  await rename(cli, cliBackup);
  execFileSync('bash', [path.join(root, 'install.sh')], { env, stdio: 'pipe' });
  assert.equal((await lstat(skill)).isSymbolicLink(), true);
  await assert.rejects(lstat(legacySkill), { code: 'ENOENT' });
  assert.equal((await lstat(cli)).isSymbolicLink(), true);
  assert.equal(await readFile(path.join(skillBackup, 'owned.txt'), 'utf8'), '利用者の実体\n');
  assert.equal(await readFile(cliBackup, 'utf8'), '利用者のCLI\n');
});

test('bash uninstallはnetworkを使わず、自分のcloneが所有する配線だけを外す', async (t) => {
  if (process.platform === 'win32') {
    t.skip('POSIX installer test');
    return;
  }
  const home = await mkdtemp(path.join(tmpdir(), 'unai-uninstall-offline-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const xdgData = path.join(home, 'xdg-data');
  const installedClone = await makeInstallerClone(xdgData, 'unai');
  await Promise.all(['.claude', '.agents', '.codex', '.grok', '.cursor'].map((dir) => (
    mkdir(path.join(home, dir), { recursive: true })
  )));
  await mkdir(path.join(home, '.agents/skills'), { recursive: true });
  await mkdir(path.join(home, '.local/bin'), { recursive: true });
  const skill = path.join(home, '.agents/skills/unai');
  const cli = path.join(home, '.local/bin/unai');
  await symlink(path.join(installedClone, 'skills/unai'), skill);
  await symlink(path.join(installedClone, 'bin/unai.mjs'), cli);

  const env = { ...process.env, HOME: home, XDG_DATA_HOME: xdgData };
  execFileSync('bash', [path.join(installedClone, 'install.sh'), '--uninstall'], {
    env,
    stdio: 'pipe',
  });
  await assert.rejects(lstat(skill), { code: 'ENOENT' });
  await assert.rejects(lstat(cli), { code: 'ENOENT' });
});

test('古いbash installerのuninstallは別versionが張り直した配線を消さない', async (t) => {
  if (process.platform === 'win32') {
    t.skip('POSIX installer test');
    return;
  }
  const fixture = await mkdtemp(path.join(tmpdir(), 'unai-install-ownership-'));
  const home = path.join(fixture, 'home');
  t.after(() => rm(fixture, { recursive: true, force: true }));
  await Promise.all(['.claude', '.agents', '.codex', '.grok', '.cursor'].map((dir) => (
    mkdir(path.join(home, dir), { recursive: true })
  )));
  const versionA = await makeInstallerClone(fixture, 'version-a');
  const versionB = await makeInstallerClone(fixture, 'version-b');
  const env = { ...process.env, HOME: home };

  execFileSync('bash', [path.join(versionA, 'install.sh'), '--profile', 'legacy'], {
    env,
    stdio: 'pipe',
  });
  execFileSync('bash', [path.join(versionB, 'install.sh')], { env, stdio: 'pipe' });
  assert.equal(await readlink(path.join(home, '.codex/skills/unai')), path.join(versionA, 'skills/unai'));
  await assert.rejects(lstat(path.join(home, '.agents/skills/unai')), { code: 'ENOENT' });
  execFileSync('bash', [path.join(versionA, 'install.sh'), '--uninstall'], {
    env,
    stdio: 'pipe',
  });

  execFileSync('bash', [path.join(versionA, 'install.sh')], { env, stdio: 'pipe' });
  execFileSync('bash', [path.join(versionB, 'install.sh')], { env, stdio: 'pipe' });
  const skill = path.join(home, '.agents/skills/unai');
  const cli = path.join(home, '.local/bin/unai');
  assert.equal(await readlink(skill), path.join(versionB, 'skills/unai'));
  assert.equal(await readlink(cli), path.join(versionB, 'bin/unai.mjs'));

  execFileSync('bash', [path.join(versionA, 'install.sh'), '--uninstall'], {
    env,
    stdio: 'pipe',
  });
  assert.equal(await readlink(skill), path.join(versionB, 'skills/unai'));
  assert.equal(await readlink(cli), path.join(versionB, 'bin/unai.mjs'));

  execFileSync('bash', [path.join(versionB, 'install.sh'), '--uninstall'], {
    env,
    stdio: 'pipe',
  });
  await assert.rejects(lstat(skill), { code: 'ENOENT' });
  await assert.rejects(lstat(cli), { code: 'ENOENT' });
});

test('PowerShell installerは利用者の実体CLIを上書きしない', async (t) => {
  if (process.platform !== 'win32') {
    t.skip('Windows installer test');
    return;
  }
  const home = await mkdtemp(path.join(tmpdir(), 'unai-install-conflict-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const cli = path.join(home, '.local/bin/unai.ps1');
  const cliBackup = `${cli}.before-unai`;
  await mkdir(path.dirname(cli), { recursive: true });
  await writeFile(cli, '利用者のCLI\n');
  const env = { ...process.env, HOME: home, USERPROFILE: home };

  execFileSync('pwsh', ['-NoProfile', '-File', path.join(root, 'install.ps1')], {
    env,
    stdio: 'pipe',
  });
  assert.equal(await readFile(cli, 'utf8'), '利用者のCLI\n');

  await rename(cli, cliBackup);
  execFileSync('pwsh', ['-NoProfile', '-File', path.join(root, 'install.ps1')], {
    env,
    stdio: 'pipe',
  });
  assert.match(await readFile(cli, 'utf8'), /^# unai installer managed wrapper\r?\n/u);
  assert.equal(await readFile(cliBackup, 'utf8'), '利用者のCLI\n');
});

test('PowerShellの公開一行実行相当はPSScriptRootなしで公式面へ配置できる', async (t) => {
  if (process.platform !== 'win32') {
    t.skip('Windows installer test');
    return;
  }
  const home = await mkdtemp(path.join(tmpdir(), 'unai-install-pipe-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  await Promise.all(['.agents', '.codex'].map((dir) => mkdir(path.join(home, dir), { recursive: true })));
  const env = {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    UNAI_INSTALL_SOURCE_DIR: root,
  };
  const installer = path.join(root, 'install.ps1');
  const command = [
    "if ($PSScriptRoot) { throw 'test seam unexpectedly has PSScriptRoot' }",
    `Get-Content -LiteralPath ${quotePowerShell(installer)} -Raw | Invoke-Expression`,
  ].join('; ');

  execFileSync('pwsh', ['-NoProfile', '-Command', command], { env, stdio: 'pipe' });
  const officialSkill = path.join(home, '.agents/skills/unai');
  assert.equal(normalizeWindowsPath(await realpath(officialSkill)), normalizeWindowsPath(
    path.join(root, 'skills/unai'),
  ));
  await assert.rejects(lstat(path.join(home, '.codex/skills/unai')), { code: 'ENOENT' });
  assert.match(
    await readFile(path.join(home, '.local/bin/unai.ps1'), 'utf8'),
    /^# unai installer managed wrapper\r?\n# unai installer source: /u,
  );
});

test('古いPowerShell installerのuninstallは別versionが張り直した配線を消さない', async (t) => {
  if (process.platform !== 'win32') {
    t.skip('Windows installer test');
    return;
  }
  const fixture = await mkdtemp(path.join(tmpdir(), 'unai-install-ownership-'));
  const home = path.join(fixture, 'home');
  t.after(() => rm(fixture, { recursive: true, force: true }));
  await Promise.all(['.agents', '.codex'].map((dir) => mkdir(path.join(home, dir), { recursive: true })));
  const versionA = await makeInstallerClone(fixture, 'version-a');
  const versionB = await makeInstallerClone(fixture, 'version-b');
  const env = { ...process.env, HOME: home, USERPROFILE: home };

  execFileSync('pwsh', [
    '-NoProfile', '-File', path.join(versionA, 'install.ps1'), '-Profile', 'legacy',
  ], { env, stdio: 'pipe' });
  execFileSync('pwsh', ['-NoProfile', '-File', path.join(versionB, 'install.ps1')], {
    env,
    stdio: 'pipe',
  });
  assert.equal(normalizeWindowsPath(await realpath(path.join(home, '.codex/skills/unai'))),
    normalizeWindowsPath(path.join(versionA, 'skills/unai')));
  await assert.rejects(lstat(path.join(home, '.agents/skills/unai')), { code: 'ENOENT' });
  execFileSync('pwsh', ['-NoProfile', '-File', path.join(versionA, 'install.ps1'), '-Uninstall'], {
    env,
    stdio: 'pipe',
  });

  for (const source of [versionA, versionB]) {
    execFileSync('pwsh', ['-NoProfile', '-File', path.join(source, 'install.ps1')], {
      env,
      stdio: 'pipe',
    });
  }
  const skill = path.join(home, '.agents/skills/unai');
  const cli = path.join(home, '.local/bin/unai.ps1');
  assert.equal(normalizeWindowsPath(await realpath(skill)), normalizeWindowsPath(
    path.join(versionB, 'skills/unai'),
  ));
  assert.match(await readFile(cli, 'utf8'), new RegExp(escapeRegExp(normalizeWindowsPath(versionB)), 'iu'));

  execFileSync('pwsh', ['-NoProfile', '-File', path.join(versionA, 'install.ps1'), '-Uninstall'], {
    env,
    stdio: 'pipe',
  });
  assert.equal(normalizeWindowsPath(await realpath(skill)), normalizeWindowsPath(
    path.join(versionB, 'skills/unai'),
  ));
  assert.match(await readFile(cli, 'utf8'), new RegExp(escapeRegExp(normalizeWindowsPath(versionB)), 'iu'));

  execFileSync('pwsh', ['-NoProfile', '-File', path.join(versionB, 'install.ps1'), '-Uninstall'], {
    env,
    stdio: 'pipe',
  });
  await assert.rejects(lstat(skill), { code: 'ENOENT' });
  await assert.rejects(lstat(cli), { code: 'ENOENT' });
});

test('READMEの日英uninstall案内はXDG_DATA_HOMEを尊重する', async () => {
  const expected = 'bash "${XDG_DATA_HOME:-$HOME/.local/share}/unai/install.sh" --uninstall';
  assert.match(await readFile(path.join(root, 'README.md'), 'utf8'), new RegExp(escapeRegExp(expected), 'u'));
  assert.match(await readFile(path.join(root, 'README.en.md'), 'utf8'), new RegExp(escapeRegExp(expected), 'u'));
});

async function makeInstallerClone(parent, name) {
  const destination = path.join(parent, name);
  await mkdir(destination, { recursive: true });
  await Promise.all([
    cp(path.join(root, 'install.sh'), path.join(destination, 'install.sh')),
    cp(path.join(root, 'install.ps1'), path.join(destination, 'install.ps1')),
    cp(path.join(root, 'skills'), path.join(destination, 'skills'), { recursive: true }),
    cp(path.join(root, 'bin'), path.join(destination, 'bin'), { recursive: true }),
  ]);
  return destination;
}

function quotePowerShell(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function normalizeWindowsPath(value) {
  return path.normalize(value).toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

async function writeJsonFixture(file, value) {
  await writeFile(file, `${JSON.stringify(value)}\n`);
}
