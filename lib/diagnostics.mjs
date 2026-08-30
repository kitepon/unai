import {
  lstat, readFile, readdir, readlink, realpath,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const REQUIRED_SKILL_FILES = Object.freeze([
  'skills/unai/SKILL.md',
  'skills/unai/references/core-pass.md',
  'skills/unai/references/domains/chat-replies.md',
  'skills/unai/references/voice-profile.md',
]);

const HARNESS_TARGETS = Object.freeze({
  claude: ['.claude', 'skills', 'unai'],
  codex: ['.agents', 'skills', 'unai'],
  grok: ['.grok', 'skills', 'unai'],
  cursor: ['.cursor', 'skills', 'unai'],
});

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function statusOf(operation) {
  try {
    return await operation() ? 'pass' : 'fail';
  } catch {
    return 'fail';
  }
}

function comparablePath(value) {
  const normalized = path.normalize(value);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

async function directoryEntries(root, relative = '') {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true });
  const result = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      result.push({ path: child, type: 'directory' });
      result.push(...await directoryEntries(root, child));
    } else if (entry.isFile()) {
      result.push({ path: child, type: 'file', content: await readFile(path.join(root, child)) });
    } else if (entry.isSymbolicLink()) {
      result.push({ path: child, type: 'link', target: await readlink(path.join(root, child)) });
    } else {
      result.push({ path: child, type: 'other' });
    }
  }
  return result;
}

async function isExactBundleCopy(target, source) {
  try {
    const [targetEntries, sourceEntries] = await Promise.all([
      directoryEntries(target),
      directoryEntries(source),
    ]);
    if (targetEntries.length !== sourceEntries.length) return false;
    return targetEntries.every((entry, index) => {
      const sourceEntry = sourceEntries[index];
      return entry.path === sourceEntry.path
        && entry.type === sourceEntry.type
        && (entry.type !== 'file' || entry.content.equals(sourceEntry.content))
        && (entry.type !== 'link' || entry.target === sourceEntry.target);
    });
  } catch {
    return false;
  }
}

export async function projectionStatus(target, source) {
  let targetStat;
  try {
    targetStat = await lstat(target);
  } catch (error) {
    return error?.code === 'ENOENT' ? 'missing' : 'conflict';
  }

  if (targetStat.isSymbolicLink()) {
    try {
      const [actual, expected] = await Promise.all([realpath(target), realpath(source)]);
      return comparablePath(actual) === comparablePath(expected) ? 'ready' : 'conflict';
    } catch {
      return 'stale';
    }
  }
  if (!targetStat.isDirectory()) return 'conflict';
  return await isExactBundleCopy(target, source) ? 'ready' : 'stale';
}

export function harnessTargets(home = os.homedir(), profile = 'official') {
  if (profile !== 'official' && profile !== 'legacy') {
    throw new Error('unai_profile_invalid');
  }
  const targets = Object.fromEntries(Object.entries(HARNESS_TARGETS).map(([name, parts]) => (
    [name, path.join(home, ...parts)]
  )));
  if (profile === 'legacy') targets.codex = path.join(home, '.codex', 'skills', 'unai');
  return targets;
}

function oppositeCodexTarget(home, profile) {
  return path.join(
    home,
    profile === 'official' ? '.codex' : '.agents',
    'skills',
    'unai',
  );
}

export function supportsNodeRuntime(version, engine) {
  const versionMatch = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/u.exec(version);
  const engineMatch = /^>=(\d+)\.(\d+)(?:\.(\d+))?$/u.exec(engine);
  if (!versionMatch || !engineMatch) return false;

  const current = versionMatch.slice(1, 4).map(Number);
  const minimum = [engineMatch[1], engineMatch[2], engineMatch[3] ?? '0'].map(Number);
  for (let index = 0; index < current.length; index += 1) {
    if (current[index] !== minimum[index]) return current[index] > minimum[index];
  }
  return true;
}

export async function productVersion(root) {
  const plugin = await readJson(path.join(root, '.claude-plugin/plugin.json'));
  if (plugin?.name !== 'unai' || typeof plugin.version !== 'string'
    || !/^\d+\.\d+\.\d+$/u.test(plugin.version)) {
    throw new Error('unai_manifest_invalid');
  }
  return plugin.version;
}

export async function diagnose(root, { home = os.homedir(), profile = 'official' } = {}) {
  let version = 'unknown';
  const manifestConsistency = await statusOf(async () => {
    const [plugin, marketplace] = await Promise.all([
      readJson(path.join(root, '.claude-plugin/plugin.json')),
      readJson(path.join(root, '.claude-plugin/marketplace.json')),
    ]);
    const marketplacePlugin = marketplace?.plugins?.find((entry) => entry?.name === 'unai');
    version = plugin?.version ?? 'unknown';
    return plugin?.name === 'unai'
      && typeof plugin.version === 'string'
      && /^\d+\.\d+\.\d+$/u.test(plugin.version)
      && marketplace?.name === 'unai'
      && marketplace?.metadata?.version === plugin.version
      && marketplacePlugin?.source === './';
  });
  const nodeRuntime = await statusOf(async () => {
    const packageManifest = await readJson(path.join(root, 'package.json'));
    return supportsNodeRuntime(process.versions.node, packageManifest?.engines?.node);
  });
  const skillBundle = await statusOf(async () => {
    await Promise.all(REQUIRED_SKILL_FILES.map((file) => readFile(path.join(root, file), 'utf8')));
    return true;
  });
  const sourceBundle = path.join(root, 'skills', 'unai');
  const targets = harnessTargets(home, profile);
  const skillProjections = Object.fromEntries(await Promise.all(
    Object.entries(targets).map(async ([name, target]) => (
      [name, await projectionStatus(target, sourceBundle)]
    )),
  ));
  const oppositeCodexStatus = await projectionStatus(
    oppositeCodexTarget(home, profile),
    sourceBundle,
  );
  if (oppositeCodexStatus !== 'missing') skillProjections.codex = 'conflict';
  const checks = {
    manifest_consistency: manifestConsistency,
    node_runtime: nodeRuntime,
    skill_bundle: skillBundle,
    skill_projections: skillProjections,
  };
  const baseChecksReady = [manifestConsistency, nodeRuntime, skillBundle]
    .every((status) => status === 'pass');
  const projectionsReady = Object.values(skillProjections)
    .every((status) => status === 'ready');
  return {
    schema: 'unai.native_factory_diagnostics.v2',
    product: { name: 'unai', version },
    checks,
    overall: baseChecksReady && projectionsReady ? 'ready' : 'not_ready',
  };
}
