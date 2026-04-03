import GithubSlugger from 'github-slugger';

export interface MarkdownHeading {
  depth: number;
  text: string;
  id: string;
}

export function extractHeadings(content: string): MarkdownHeading[] {
  const lines = content.split('\n');
  const slugger = new GithubSlugger();
  const headings: MarkdownHeading[] = [];
  let insideFence = false;

  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      insideFence = !insideFence;
      continue;
    }

    if (insideFence) {
      continue;
    }

    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!match) {
      continue;
    }

    const text = match[2].replace(/\[(.*?)\]\(.*?\)/g, '$1').trim();
    if (!text) {
      continue;
    }

    headings.push({
      depth: match[1].length,
      text,
      id: slugger.slug(text),
    });
  }

  return headings;
}

export function getCodeLanguage(className?: string): string {
  if (!className) {
    return 'text';
  }

  const match = /language-([\w-]+)/.exec(className);
  return match?.[1] ?? 'text';
}
