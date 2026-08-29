import { readFile } from 'node:fs/promises';
import path from 'node:path';

const REQUIRED_SKILL_FILES = Object.freeze([
  'skills/unai/SKILL.md',
  'skills/unai/references/core-pass.md',
  'skills/unai/references/domains/chat-replies.md',
  'skills/unai/references/voice-profile.md',
]);

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

export async function productVersion(root) {
  const plugin = await readJson(path.join(root, '.claude-plugin/plugin.json'));
  if (plugin?.name !== 'unai' || typeof plugin.version !== 'string'
    || !/^\d+\.\d+\.\d+$/u.test(plugin.version)) {
    throw new Error('unai_manifest_invalid');
  }
  return plugin.version;
}

export async function diagnose(root) {
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
  const nodeRuntime = Number.parseInt(process.versions.node.split('.')[0], 10) >= 20
    ? 'pass' : 'fail';
  const skillBundle = await statusOf(async () => {
    await Promise.all(REQUIRED_SKILL_FILES.map((file) => readFile(path.join(root, file), 'utf8')));
    return true;
  });
  const checks = {
    manifest_consistency: manifestConsistency,
    node_runtime: nodeRuntime,
    skill_bundle: skillBundle,
  };
  return {
    schema: 'unai.native_factory_diagnostics.v1',
    product: { name: 'unai', version },
    checks,
    overall: Object.values(checks).every((status) => status === 'pass') ? 'ready' : 'not_ready',
  };
}
