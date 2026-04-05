const BLOCK_TAGS = new Set([
  'article',
  'aside',
  'blockquote',
  'div',
  'figcaption',
  'figure',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
]);

function normalizeWhitespace(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
}

function cleanMarkdown(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function wrapWithMarker(value: string, marker: string): string {
  const match = value.match(/^(\s*)([\s\S]*?)(\s*)$/);

  if (!match || !match[2]) {
    return value;
  }

  return `${match[1]}${marker}${match[2]}${marker}${match[3]}`;
}

function escapeInlineCode(value: string): string {
  const marker = value.includes('`') ? '``' : '`';
  return wrapWithMarker(value, marker);
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n+/g, '<br />').trim();
}

function hasInlineStyle(element: Element, property: RegExp): boolean {
  const style = element.getAttribute('style') ?? '';
  return property.test(style.toLowerCase());
}

function isBoldElement(element: Element): boolean {
  const tag = element.tagName.toLowerCase();
  return (
    tag === 'b' ||
    tag === 'strong' ||
    hasInlineStyle(element, /font-weight\s*:\s*(bold|[6-9]00)/)
  );
}

function isItalicElement(element: Element): boolean {
  const tag = element.tagName.toLowerCase();
  return tag === 'i' || tag === 'em' || hasInlineStyle(element, /font-style\s*:\s*italic/);
}

function isStrikeElement(element: Element): boolean {
  const tag = element.tagName.toLowerCase();
  return (
    tag === 'del' ||
    tag === 's' ||
    tag === 'strike' ||
    hasInlineStyle(element, /text-decoration[^;]*line-through/)
  );
}

function isBlockElement(element: Element): boolean {
  return BLOCK_TAGS.has(element.tagName.toLowerCase());
}

function hasBlockChildren(element: Element): boolean {
  return Array.from(element.children).some((child) => isBlockElement(child));
}

function renderTextNode(text: string): string {
  return normalizeWhitespace(text);
}

function renderInline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return renderTextNode(node.textContent ?? '');
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const element = node as Element;
  const tag = element.tagName.toLowerCase();

  if (tag === 'br') {
    return '\n';
  }

  if (tag === 'img') {
    const src = element.getAttribute('src')?.trim();
    const alt = normalizeWhitespace(element.getAttribute('alt') ?? '').trim();
    return src ? `![${alt}](${src})` : alt;
  }

  if (tag === 'pre') {
    return renderCodeBlock(element);
  }

  if ((tag === 'div' || tag === 'p') && hasBlockChildren(element)) {
    return renderBlocks(Array.from(element.childNodes)).join('\n\n');
  }

  let content = Array.from(element.childNodes)
    .map((child) => renderInline(child))
    .join('');

  if (tag === 'a') {
    const href = element.getAttribute('href')?.trim();
    const label = cleanMarkdown(content) || href || '';
    return href ? `[${label}](${href})` : label;
  }

  if (tag === 'code' && element.parentElement?.tagName.toLowerCase() !== 'pre') {
    return escapeInlineCode(cleanMarkdown(content));
  }

  if (isBoldElement(element)) {
    content = wrapWithMarker(content, '**');
  }

  if (isItalicElement(element)) {
    content = wrapWithMarker(content, '*');
  }

  if (isStrikeElement(element)) {
    content = wrapWithMarker(content, '~~');
  }

  return content;
}

function extractCodeBlockLanguage(element: Element): string {
  const candidates = [
    element,
    element.querySelector('code'),
    ...Array.from(element.querySelectorAll('[class],[data-language]')),
  ].filter(Boolean) as Element[];

  for (const candidate of candidates) {
    const className = candidate.getAttribute('class') ?? '';
    const dataLanguage = candidate.getAttribute('data-language') ?? '';
    const combined = `${className} ${dataLanguage}`;
    const match = combined.match(/(?:lang|language)-([a-z0-9_+-]+)/i);

    if (match) {
      return match[1].toLowerCase();
    }
  }

  return '';
}

function renderCodeBlock(element: Element): string {
  const language = extractCodeBlockLanguage(element);
  const code = (element.textContent ?? '').replace(/\r\n?/g, '\n').replace(/\n$/, '');
  return `\`\`\`${language}\n${code}\n\`\`\``;
}

function renderListItem(item: Element, depth: number, index: number, ordered: boolean): string {
  const indent = '  '.repeat(depth);
  const marker = ordered ? `${index}. ` : '- ';
  const continuationIndent = `${indent}${' '.repeat(marker.length)}`;

  const inlineParts: string[] = [];
  const nestedBlocks: string[] = [];

  for (const child of Array.from(item.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const element = child as Element;
      const tag = element.tagName.toLowerCase();

      if (tag === 'ul' || tag === 'ol') {
        const nested = renderList(element, depth + 1);
        if (nested) {
          nestedBlocks.push(nested);
        }
        continue;
      }

      if (isBlockElement(element) && hasBlockChildren(element)) {
        const nested = renderBlocks(Array.from(element.childNodes)).join('\n\n');
        if (nested) {
          inlineParts.push(nested);
        }
        continue;
      }
    }

    inlineParts.push(renderInline(child));
  }

  const main = cleanMarkdown(inlineParts.join(' '));
  const mainLines = main ? main.split('\n') : [''];
  const output = [`${indent}${marker}${mainLines[0]}`.trimEnd()];

  for (const line of mainLines.slice(1)) {
    output.push(`${continuationIndent}${line}`.trimEnd());
  }

  return [...output, ...nestedBlocks].join('\n');
}

function renderList(element: Element, depth = 0): string {
  const ordered = element.tagName.toLowerCase() === 'ol';
  const items = Array.from(element.children)
    .filter((child) => child.tagName.toLowerCase() === 'li')
    .map((child, index) => renderListItem(child, depth, index + 1, ordered))
    .filter(Boolean);

  return items.join('\n');
}

function renderTable(element: Element): string {
  const rows = Array.from(element.querySelectorAll('tr'))
    .map((row) =>
      Array.from(row.children)
        .filter((cell) => ['th', 'td'].includes(cell.tagName.toLowerCase()))
        .map((cell) => escapeTableCell(renderInline(cell)))
    )
    .filter((row) => row.length > 0);

  if (rows.length === 0) {
    return '';
  }

  const header = rows[0];
  const body = rows.slice(1);
  const separator = header.map(() => '---');
  const lines = [
    `| ${header.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...body.map((row) => `| ${row.join(' | ')} |`),
  ];

  return lines.join('\n');
}

function prefixEachLine(value: string, prefix: string): string {
  return value
    .split('\n')
    .map((line) => `${prefix}${line}`.trimEnd())
    .join('\n');
}

function renderBlocks(nodes: Node[]): string[] {
  const blocks: string[] = [];

  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = cleanMarkdown(node.textContent ?? '');
      if (text) {
        blocks.push(text);
      }
      continue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      continue;
    }

    const element = node as Element;
    const tag = element.tagName.toLowerCase();

    switch (tag) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6': {
        const level = Number(tag.slice(1));
        const content = cleanMarkdown(renderInline(element));
        if (content) {
          blocks.push(`${'#'.repeat(level)} ${content}`);
        }
        break;
      }
      case 'blockquote': {
        const content = cleanMarkdown(renderBlocks(Array.from(element.childNodes)).join('\n\n'));
        if (content) {
          blocks.push(prefixEachLine(content, '> '));
        }
        break;
      }
      case 'ul':
      case 'ol': {
        const content = renderList(element);
        if (content) {
          blocks.push(content);
        }
        break;
      }
      case 'pre': {
        blocks.push(renderCodeBlock(element));
        break;
      }
      case 'table': {
        const content = renderTable(element);
        if (content) {
          blocks.push(content);
        }
        break;
      }
      case 'hr':
        blocks.push('---');
        break;
      case 'div':
      case 'section':
      case 'article':
      case 'main':
      case 'header':
      case 'footer':
      case 'aside':
      case 'figure':
      case 'figcaption':
      case 'nav':
      case 'p':
      case 'li':
      case 'tbody':
      case 'thead':
      case 'tfoot':
      case 'tr':
      case 'td':
      case 'th': {
        const childBlocks = hasBlockChildren(element)
          ? renderBlocks(Array.from(element.childNodes))
          : [cleanMarkdown(renderInline(element))];
        blocks.push(...childBlocks.filter(Boolean));
        break;
      }
      default: {
        const content = cleanMarkdown(renderInline(element));
        if (content) {
          blocks.push(content);
        }
      }
    }
  }

  return blocks;
}

export function clipboardHtmlHasMarkdownFormatting(html: string): boolean {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  return Array.from(doc.body.querySelectorAll('*')).some((element) => {
    const tag = element.tagName.toLowerCase();

    return (
      ['a', 'b', 'strong', 'blockquote', 'code', 'del', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'li', 'ol', 'pre', 's', 'strike', 'table', 'ul'].includes(tag) ||
      isBoldElement(element) ||
      isItalicElement(element) ||
      isStrikeElement(element)
    );
  });
}

export function convertHtmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return cleanMarkdown(renderBlocks(Array.from(doc.body.childNodes)).join('\n\n'));
}
