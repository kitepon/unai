import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  markdownLinkTargets,
  relativeMarkdownLinkTargets,
} from '../scripts/markdown-link-targets.mjs';
import { verifyDocs } from '../scripts/verify-docs.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('CommonMark/GFM ASTでinline・reference・HTMLのtargetを読む', () => {
  const markdown = [
    '[inline](docs/inline.md)',
    '![reference][asset]',
    '',
    '[asset]: images/reference.png',
    '<a href="docs/html.md">HTML</a>',
    '<img src="images/html.png" srcset="images/one.png 1x, images/two.png 2x">',
  ].join('\n');

  assert.deepEqual(
    markdownLinkTargets(markdown).map(({ raw }) => raw),
    [
      'docs/inline.md',
      'images/reference.png',
      'docs/html.md',
      'images/html.png',
      'images/one.png',
      'images/two.png',
    ],
  );
});

test('code内の見かけのlinkはtargetに数えない', () => {
  const markdown = [
    '`[inline](missing-inline.md)`',
    '',
    '```md',
    '[fenced](missing-fenced.md)',
    '```',
    '',
    '[real](present.md)',
  ].join('\n');

  assert.deepEqual(relativeMarkdownLinkTargets(markdown), [
    { raw: 'present.md', target: 'present.md', line: 7 },
  ]);
});

test('文書gateはreference link切れを検出する', async (context) => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'unai-docs-'));
  context.after(async () => rm(temporaryRoot, { recursive: true, force: true }));
  await mkdir(path.join(temporaryRoot, 'docs'));
  await writeFile(
    path.join(temporaryRoot, 'README.md'),
    '![hero][asset]\n\n[asset]: docs/missing.png\n',
  );

  const result = verifyDocs(temporaryRoot);
  assert.deepEqual(result.errors, ['README.md:3: link切れ docs/missing.png']);
});

test('repoの現行文書は相対targetが閉じている', () => {
  const result = verifyDocs(root);
  assert.ok(result.markdownCount >= 10);
  assert.ok(result.relativeTargetCount > 0);
  assert.deepEqual(result.errors, []);
});
