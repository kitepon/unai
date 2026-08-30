import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflowDir = path.join(root, '.github/workflows');
const checkoutSha = '3d3c42e5aac5ba805825da76410c181273ba90b1';
const setupNodeSha = '820762786026740c76f36085b0efc47a31fe5020';

test('CIは製品repo内の再利用workflowを呼び、Markdown変更も検査する', async () => {
  const entry = await readFile(path.join(workflowDir, 'ci.yml'), 'utf8');
  assert.match(entry, /uses:\s+\.\/\.github\/workflows\/product-full-ci\.yml/u);
  assert.doesNotMatch(entry, /paths-ignore:/u);
  assert.match(
    entry,
    /documentation-command:\s+npm ci --ignore-scripts --no-audit --no-fund && npm run verify:docs/u,
  );

  const names = await readdir(workflowDir);
  assert.ok(names.includes('product-full-ci.yml'));
  assert.equal(names.includes('validate.yml'), false);
});

test('外部actionは既知のv7 commit SHAへ固定する', async () => {
  const workflows = await readWorkflows();
  const externalUses = [...workflows.matchAll(/^\s*-\s+uses:\s+([^\s#]+)/gmu)]
    .map(([, value]) => value)
    .filter((value) => !value.startsWith('./'));

  assert.ok(externalUses.length > 0);
  for (const value of externalUses) {
    assert.match(value, /@[0-9a-f]{40}$/u);
  }
  assert.ok(externalUses.includes(`actions/checkout@${checkoutSha}`));
  assert.ok(externalUses.includes(`actions/setup-node@${setupNodeSha}`));
});

test('製品CIはdotagentsに依存せず、三OSとPowerShell 7を自分で検査する', async () => {
  const reusable = await readFile(path.join(workflowDir, 'product-full-ci.yml'), 'utf8');
  assert.doesNotMatch(reusable, /kitepon\/dotagents|powershell\.exe|cmd\.exe|shell:\s*(?:cmd|powershell)\b/iu);
  for (const os of ['ubuntu-latest', 'macos-latest', 'windows-latest']) {
    assert.match(reusable, new RegExp(escapeRegExp(os), 'u'));
  }
  assert.match(
    reusable,
    /name:\s+Test product and CI contracts on Windows[\s\S]*?if:\s+runner\.os == 'Windows'[\s\S]*?shell:\s+pwsh[\s\S]*?run:\s+node --test tests\/unai\.test\.mjs tests\/ci-contract\.test\.mjs/u,
  );
  assert.match(reusable, /HOME="\$test_home" bash install\.sh/u);
});

test('文書gateは必須入力をclean checkoutで実行する', async () => {
  const reusable = await readFile(path.join(workflowDir, 'product-full-ci.yml'), 'utf8');
  assert.match(
    reusable,
    /documentation-command:[\s\S]*?required:\s+true[\s\S]*?type:\s+string/u,
  );
  assert.match(
    reusable,
    /name:\s+Verify product documentation[\s\S]*?DOCUMENTATION_COMMAND:\s+\$\{\{ inputs\.documentation-command \}\}[\s\S]*?bash -euo pipefail -c "\$DOCUMENTATION_COMMAND"/u,
  );
});

test('manifestの製品版は一致する', async () => {
  const [plugin, marketplace] = await Promise.all([
    readJson(path.join(root, '.claude-plugin/plugin.json')),
    readJson(path.join(root, '.claude-plugin/marketplace.json')),
  ]);
  assert.match(plugin.version, /^\d+\.\d+\.\d+$/u);
  assert.equal(marketplace.metadata.version, plugin.version);
});

async function readWorkflows() {
  const names = (await readdir(workflowDir)).filter((name) => /\.ya?ml$/u.test(name)).sort();
  return (await Promise.all(names.map(async (name) => (
    `# ${name}\n${await readFile(path.join(workflowDir, name), 'utf8')}`
  )))).join('\n');
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
