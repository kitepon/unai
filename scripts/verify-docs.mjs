#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { relativeMarkdownLinkTargets } from './markdown-link-targets.mjs';

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRECTORIES = new Set(['.git', 'node_modules']);

export function verifyDocs(root = DEFAULT_ROOT) {
  const resolvedRoot = resolve(root);
  const markdownFiles = collectMarkdown(resolvedRoot);
  const errors = [];
  let relativeTargetCount = 0;

  for (const file of markdownFiles) {
    const source = readFileSync(file, 'utf8');
    let links;
    try {
      links = relativeMarkdownLinkTargets(source);
    } catch (error) {
      errors.push(`${relative(resolvedRoot, file)}: ${error.message}`);
      continue;
    }

    for (const link of links) {
      relativeTargetCount += 1;
      const target = resolve(dirname(file), link.target);
      const insideRepository = target === resolvedRoot || target.startsWith(`${resolvedRoot}${sep}`);
      if (!insideRepository) {
        errors.push(`${relative(resolvedRoot, file)}:${link.line}: repo外の相対target ${link.raw}`);
      } else if (!existsSync(target)) {
        errors.push(`${relative(resolvedRoot, file)}:${link.line}: link切れ ${link.raw}`);
      }
    }
  }

  return { errors, markdownCount: markdownFiles.length, relativeTargetCount };
}

function collectMarkdown(root) {
  const files = [];
  visit(root);
  return files.sort();

  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && SKIP_DIRECTORIES.has(entry.name)) continue;
      const target = resolve(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile() && extname(entry.name).toLowerCase() === '.md') files.push(target);
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = verifyDocs();
  if (result.errors.length > 0) {
    process.stderr.write(`${result.errors.join('\n')}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(
      `docs verified: ${result.markdownCount} Markdown, ${result.relativeTargetCount} relative targets\n`,
    );
  }
}
