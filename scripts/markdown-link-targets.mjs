import { parseFragment } from 'parse5';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { parseSrcset } from 'srcset';
import { unified } from 'unified';

const markdownParser = unified().use(remarkParse).use(remarkGfm);

export function markdownLinkTargets(markdown) {
  if (typeof markdown !== 'string') throw new TypeError('markdown must be a string');

  const targets = [];
  visit(markdownParser.parse(markdown));
  return targets;

  function visit(node) {
    if (
      (node.type === 'link' || node.type === 'image' || node.type === 'definition')
      && typeof node.url === 'string'
    ) {
      targets.push({ raw: node.url, line: node.position?.start?.line ?? 1 });
    } else if (node.type === 'html' && typeof node.value === 'string') {
      targets.push(...htmlLinkTargets(node.value, node.position?.start?.line ?? 1));
    }

    if (Array.isArray(node.children)) {
      for (const child of node.children) visit(child);
    }
  }
}

export function relativeMarkdownLinkTargets(markdown) {
  const targets = [];
  for (const link of markdownLinkTargets(markdown)) {
    let target = link.raw.trim();
    if (
      target.length === 0
      || target === '...'
      || target.startsWith('#')
      || target.startsWith('/')
      || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(target)
    ) continue;

    target = target.split(/[?#]/u, 1)[0];
    if (target.length === 0) continue;

    try {
      targets.push({ ...link, target: decodeURIComponent(target) });
    } catch {
      throw new TypeError(`Markdown target has invalid percent encoding: ${target}`);
    }
  }
  return targets;
}

function htmlLinkTargets(html, firstLine) {
  const fragment = parseFragment(html, { sourceCodeLocationInfo: true });
  const targets = [];
  visit(fragment);
  return targets;

  function visit(node) {
    if (node.tagName === 'a' || node.tagName === 'img' || node.tagName === 'source') {
      const line = firstLine + (node.sourceCodeLocation?.startLine ?? 1) - 1;
      for (const attribute of node.attrs ?? []) {
        if (node.tagName === 'a' && attribute.name === 'href') {
          targets.push({ raw: attribute.value, line });
        } else if (
          (node.tagName === 'img' || node.tagName === 'source')
          && attribute.name === 'src'
        ) {
          targets.push({ raw: attribute.value, line });
        } else if (
          (node.tagName === 'img' || node.tagName === 'source')
          && attribute.name === 'srcset'
        ) {
          for (const candidate of parseSrcset(attribute.value, { strict: true })) {
            targets.push({ raw: candidate.url, line });
          }
        }
      }
    }

    for (const child of node.childNodes ?? []) visit(child);
  }
}
