import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  cp, lstat, mkdir, mkdtemp, readFile, readlink, realpath, rename, rm, symlink, writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { supportsNodeRuntime } from '../lib/diagnostics.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('versionと4ホストready diagnosticsがmanifestに一致してexit 0になる', async (t) => {
  const home = await mkdtemp(path.join(tmpdir(), 'unai-diagnostics-ready-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  await projectAllHarnesses(home, path.join(root, 'skills/unai'));
  const cli = path.join(root, 'bin/unai.mjs');
  assert.equal(execFileSync(process.execPath, [cli, '--version'], { encoding: 'utf8' }), '0.6.0\n');
  const run = spawnSync(process.execPath, [cli, 'factory-diagnostics', '--json'], {
    encoding: 'utf8', env: homeEnvironment(home),
  });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stderr, '');
  const result = JSON.parse(run.stdout);
  assert.deepEqual(result, {
    schema: 'unai.native_factory_diagnostics.v2',
    product: { name: 'unai', version: '0.6.0' },
    checks: {
      manifest_consistency: 'pass',
      node_runtime: 'pass',
      skill_bundle: 'pass',
      skill_projections: {
        claude: 'ready', codex: 'ready', grok: 'ready', cursor: 'ready',
      },
    },
    overall: 'ready',
  });
  assert.equal(JSON.stringify(result).includes(root), false);
  assert.equal(JSON.stringify(result).includes(home), false);
});

test('node_runtimeはpackage enginesの下限をそのまま使う', () => {
  assert.equal(supportsNodeRuntime('22.12.9', '>=22.13'), false);
  assert.equal(supportsNodeRuntime('22.13.0', '>=22.13'), true);
  assert.equal(supportsNodeRuntime('23.0.0', '>=22.13'), true);
  assert.equal(supportsNodeRuntime('invalid', '>=22.13'), false);
  assert.equal(supportsNodeRuntime('22.13.0', '^22.13'), false);
});

test('skill bundle欠損はCLI実起動でnot_ready JSONとexit 1になる', async (t) => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'unai-diagnostics-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  await makeDiagnosticsClone(fixture);
  const home = path.join(fixture, 'home');
  await projectAllHarnesses(home, path.join(fixture, 'skills/unai'));
  const run = spawnSync(process.execPath, [path.join(fixture, 'bin/unai.mjs'),
    'factory-diagnostics', '--json'], {
    encoding: 'utf8', env: homeEnvironment(home),
  });
  assert.equal(run.status, 1);
  assert.equal(run.stderr, '');
  const result = JSON.parse(run.stdout);
  assert.equal(result.checks.skill_bundle, 'fail');
  assert.equal(result.overall, 'not_ready');
});

test('文章の配布物はSKILL.md一枚でreadyになる', async (t) => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'unai-single-skill-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  await makeDiagnosticsClone(fixture);
  const source = path.join(fixture, 'skills/unai');
  await mkdir(source, { recursive: true });
  await cp(path.join(root, 'skills/unai/SKILL.md'), path.join(source, 'SKILL.md'));
  const home = path.join(fixture, 'home');
  await projectAllHarnesses(home, source);
  const run = spawnSync(process.execPath, [path.join(fixture, 'bin/unai.mjs'),
    'factory-diagnostics', '--json'], { encoding: 'utf8', env: homeEnvironment(home) });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout).overall, 'ready');
});

test('不正引数はJSONを出さずusageとexit 2を返す', () => {
  const run = spawnSync(process.execPath, [path.join(root, 'bin/unai.mjs'),
    'factory-diagnostics', '--yaml'], { encoding: 'utf8' });
  assert.equal(run.status, 2);
  assert.equal(run.stdout, '');
  assert.equal(
    run.stderr,
    'usage: unai --version | unai factory-diagnostics --json [--profile official|legacy]\n',
  );
});

test('projection diagnosticsは4ホストのmissing・stale・conflictを型付きで返す', async (t) => {
  const home = await mkdtemp(path.join(tmpdir(), 'unai-diagnostics-not-ready-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const source = path.join(root, 'skills/unai');
  const targets = harnessSkillTargets(home);

  await mkdir(targets.codex, { recursive: true });
  await writeFile(path.join(targets.codex, 'stale.txt'), 'old bundle\n');
  await mkdir(path.dirname(targets.grok), { recursive: true });
  await writeFile(targets.grok, 'not a skill directory\n');
  const otherBundle = path.join(home, 'other-unai');
  await cp(source, otherBundle, { recursive: true });
  await mkdir(path.dirname(targets.cursor), { recursive: true });
  await symlink(otherBundle, targets.cursor, process.platform === 'win32' ? 'junction' : 'dir');

  const run = spawnSync(process.execPath, [path.join(root, 'bin/unai.mjs'),
    'factory-diagnostics', '--json'], {
    encoding: 'utf8', env: homeEnvironment(home),
  });
  assert.equal(run.status, 1, run.stderr);
  assert.equal(run.stderr, '');
  const result = JSON.parse(run.stdout);
  assert.deepEqual(result.checks.skill_projections, {
    claude: 'missing', codex: 'stale', grok: 'conflict', cursor: 'conflict',
  });
  assert.equal(result.overall, 'not_ready');
});

test('projection diagnosticsはbundleと完全一致する実体copyもreadyとする', async (t) => {
  const home = await mkdtemp(path.join(tmpdir(), 'unai-diagnostics-copy-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const source = path.join(root, 'skills/unai');
  for (const target of Object.values(harnessSkillTargets(home))) {
    await mkdir(path.dirname(target), { recursive: true });
    await cp(source, target, { recursive: true });
  }

  const run = spawnSync(process.execPath, [path.join(root, 'bin/unai.mjs'),
    'factory-diagnostics', '--json'], {
    encoding: 'utf8', env: homeEnvironment(home),
  });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout).checks.skill_projections, {
    claude: 'ready', codex: 'ready', grok: 'ready', cursor: 'ready',
  });
});

test('SKILL.mdが古い配布copyを検出し、更新後にreadyへ戻る', async (t) => {
  const home = await mkdtemp(path.join(tmpdir(), 'unai-prose-update-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const targets = harnessSkillTargets(home);
  const source = path.join(root, 'skills/unai');
  const entries = Object.entries(targets);
  for (const [, target] of entries) {
    await mkdir(path.dirname(target), { recursive: true });
    await cp(source, target, { recursive: true });
    await writeFile(path.join(target, 'SKILL.md'), '旧版の文章規範\n');
  }
  const cli = path.join(root, 'bin/unai.mjs');
  const options = { encoding: 'utf8', env: homeEnvironment(home) };
  const before = spawnSync(process.execPath, [cli, 'factory-diagnostics', '--json'], options);
  assert.equal(before.status, 1, before.stderr);
  assert.deepEqual(JSON.parse(before.stdout).checks.skill_projections, {
    claude: 'stale', codex: 'stale', grok: 'stale', cursor: 'stale',
  });
  for (const [, target] of entries) {
    await cp(path.join(source, 'SKILL.md'), path.join(target, 'SKILL.md'));
  }
  const after = spawnSync(process.execPath, [cli, 'factory-diagnostics', '--json'], options);
  assert.equal(after.status, 0, after.stderr);
  assert.equal(JSON.parse(after.stdout).overall, 'ready');
});

test('Codexの公式面とlegacy面が同居すれば同じbundle内容でもconflictになる', async (t) => {
  const home = await mkdtemp(path.join(tmpdir(), 'unai-diagnostics-codex-duplicate-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const source = path.join(root, 'skills/unai');
  await projectAllHarnesses(home, source);
  const legacyTarget = path.join(home, '.codex/skills/unai');
  await mkdir(path.dirname(legacyTarget), { recursive: true });
  await cp(source, legacyTarget, { recursive: true });

  const run = spawnSync(process.execPath, [path.join(root, 'bin/unai.mjs'),
    'factory-diagnostics', '--json'], {
    encoding: 'utf8', env: homeEnvironment(home),
  });
  assert.equal(run.status, 1, run.stderr);
  assert.equal(JSON.parse(run.stdout).checks.skill_projections.codex, 'conflict');

  if (process.platform !== 'win32') {
    const install = spawnSync('bash', [path.join(root, 'install.sh')], {
      encoding: 'utf8', env: homeEnvironment(home),
    });
    assert.equal(install.status, 1);
    assert.doesNotMatch(install.stdout, /完了。4ホスト/u);
    assert.equal((await lstat(legacyTarget)).isDirectory(), true);
  }
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
  const legacyDiagnostics = JSON.parse(execFileSync(
    path.join(home, '.local/bin/unai'),
    ['factory-diagnostics', '--json', '--profile', 'legacy'],
    { env, encoding: 'utf8' },
  ));
  assert.equal(legacyDiagnostics.checks.skill_projections.codex, 'ready');

  execFileSync('bash', [path.join(root, 'install.sh')], { env, stdio: 'pipe' });
  assert.equal((await lstat(path.join(home, '.agents/skills/unai'))).isSymbolicLink(), true);
  await assert.rejects(lstat(path.join(home, '.codex/skills/unai')), { code: 'ENOENT' });

  const cli = path.join(home, '.local/bin/unai');
  assert.equal((await lstat(cli)).isSymbolicLink(), true);
  assert.equal(execFileSync(cli, ['--version'], { env, encoding: 'utf8' }), '0.6.0\n');
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

  const blocked = spawnSync('bash', [path.join(root, 'install.sh')], {
    env, encoding: 'utf8',
  });
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /install projectionがreadyではない/u);
  const blockedDiagnostics = JSON.parse(blocked.stdout.split('\n')
    .find((line) => line.startsWith('{"schema":"unai.native_factory_diagnostics.v2"')));
  assert.equal(blockedDiagnostics.checks.skill_projections.codex, 'conflict');
  assert.equal(blockedDiagnostics.overall, 'not_ready');
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
  const blockedMigration = spawnSync('bash', [path.join(versionB, 'install.sh')], {
    env, encoding: 'utf8',
  });
  assert.equal(blockedMigration.status, 1);
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

  const blocked = spawnSync('pwsh', ['-NoProfile', '-File', path.join(root, 'install.ps1')], {
    env, encoding: 'utf8',
  });
  assert.equal(blocked.status, 1);
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

test('PowerShell installerはdangling Codex面を修復し、dangling反対面は非0にする', async (t) => {
  if (process.platform !== 'win32') {
    t.skip('Windows installer test');
    return;
  }
  const home = await mkdtemp(path.join(tmpdir(), 'unai-install-dangling-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  const officialTarget = path.join(home, '.agents/skills/unai');
  const missingOfficialSource = path.join(home, 'missing-official-source');
  await mkdir(missingOfficialSource, { recursive: true });
  await mkdir(path.dirname(officialTarget), { recursive: true });
  await symlink(missingOfficialSource, officialTarget, 'junction');
  await rm(missingOfficialSource, { recursive: true, force: true });

  execFileSync('pwsh', ['-NoProfile', '-File', path.join(root, 'install.ps1')], {
    env,
    stdio: 'pipe',
  });
  assert.equal(
    normalizeWindowsPath(await realpath(officialTarget)),
    normalizeWindowsPath(await realpath(path.join(root, 'skills/unai'))),
  );

  const legacyTarget = path.join(home, '.codex/skills/unai');
  const missingLegacySource = path.join(home, 'missing-legacy-source');
  await mkdir(missingLegacySource, { recursive: true });
  await mkdir(path.dirname(legacyTarget), { recursive: true });
  await symlink(missingLegacySource, legacyTarget, 'junction');
  await rm(missingLegacySource, { recursive: true, force: true });

  const blocked = spawnSync('pwsh', ['-NoProfile', '-File', path.join(root, 'install.ps1')], {
    env, encoding: 'utf8',
  });
  assert.equal(blocked.status, 1);
  const diagnostics = JSON.parse(blocked.stdout.split(/\r?\n/u)
    .find((line) => line.startsWith('{"schema":"unai.native_factory_diagnostics.v2"')));
  assert.equal(diagnostics.checks.skill_projections.codex, 'conflict');
  assert.equal((await lstat(legacyTarget)).isSymbolicLink(), true);
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
  const versionASkill = normalizeWindowsPath(await realpath(path.join(versionA, 'skills/unai')));
  const versionBSkill = normalizeWindowsPath(await realpath(path.join(versionB, 'skills/unai')));
  const versionBSource = normalizeWindowsPath(await realpath(versionB));
  const env = { ...process.env, HOME: home, USERPROFILE: home };

  execFileSync('pwsh', [
    '-NoProfile', '-File', path.join(versionA, 'install.ps1'), '-Profile', 'legacy',
  ], { env, stdio: 'pipe' });
  const blockedMigration = spawnSync(
    'pwsh', ['-NoProfile', '-File', path.join(versionB, 'install.ps1')],
    { env, encoding: 'utf8' },
  );
  assert.equal(blockedMigration.status, 1);
  assert.equal(
    normalizeWindowsPath(await realpath(path.join(home, '.codex/skills/unai'))),
    versionASkill,
  );
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
  assert.equal(normalizeWindowsPath(await realpath(skill)), versionBSkill);
  assert.match(await readFile(cli, 'utf8'), new RegExp(escapeRegExp(versionBSource), 'iu'));

  execFileSync('pwsh', ['-NoProfile', '-File', path.join(versionA, 'install.ps1'), '-Uninstall'], {
    env,
    stdio: 'pipe',
  });
  assert.equal(normalizeWindowsPath(await realpath(skill)), versionBSkill);
  assert.match(await readFile(cli, 'utf8'), new RegExp(escapeRegExp(versionBSource), 'iu'));

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
    cp(path.join(root, 'lib'), path.join(destination, 'lib'), { recursive: true }),
    cp(path.join(root, '.claude-plugin'), path.join(destination, '.claude-plugin'), { recursive: true }),
    cp(path.join(root, 'package.json'), path.join(destination, 'package.json')),
  ]);
  return destination;
}

async function makeDiagnosticsClone(destination) {
  const files = [
    '.claude-plugin/plugin.json',
    '.claude-plugin/marketplace.json',
    'package.json',
    'bin/unai.mjs',
    'lib/diagnostics.mjs',
  ];
  await Promise.all(files.map(async (file) => {
    const target = path.join(destination, file);
    await mkdir(path.dirname(target), { recursive: true });
    await cp(path.join(root, file), target);
  }));
}

function harnessSkillTargets(home, profile = 'official') {
  return {
    claude: path.join(home, '.claude/skills/unai'),
    codex: path.join(home, profile === 'legacy' ? '.codex/skills/unai' : '.agents/skills/unai'),
    grok: path.join(home, '.grok/skills/unai'),
    cursor: path.join(home, '.cursor/skills/unai'),
  };
}

async function projectAllHarnesses(home, source, profile = 'official') {
  for (const target of Object.values(harnessSkillTargets(home, profile))) {
    await mkdir(path.dirname(target), { recursive: true });
    await symlink(source, target, process.platform === 'win32' ? 'junction' : 'dir');
  }
}

function homeEnvironment(home) {
  return { ...process.env, HOME: home, USERPROFILE: home };
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
