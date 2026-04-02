/**
 * Helpers that apply markdown formatting to a textarea selection.
 * Each function receives the textarea element and returns the new
 * { value, selectionStart, selectionEnd } so the caller can update state.
 */

interface TextareaState {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

function getSelection(el: HTMLTextAreaElement): {
  before: string;
  selected: string;
  after: string;
} {
  const { value, selectionStart, selectionEnd } = el;
  return {
    before: value.slice(0, selectionStart),
    selected: value.slice(selectionStart, selectionEnd),
    after: value.slice(selectionEnd),
  };
}

/** Wrap selection with symmetric markers (bold, italic, strikethrough, code) */
export function wrapSelection(
  el: HTMLTextAreaElement,
  marker: string
): TextareaState {
  const { before, selected, after } = getSelection(el);

  // If already wrapped, unwrap
  if (selected.startsWith(marker) && selected.endsWith(marker)) {
    const unwrapped = selected.slice(marker.length, -marker.length);
    return {
      value: before + unwrapped + after,
      selectionStart: before.length,
      selectionEnd: before.length + unwrapped.length,
    };
  }

  const wrapped = `${marker}${selected || 'text'}${marker}`;
  return {
    value: before + wrapped + after,
    selectionStart: before.length + marker.length,
    selectionEnd: before.length + wrapped.length - marker.length,
  };
}

/** Insert a prefix at the beginning of each selected line (lists, headings, quotes) */
export function prefixLines(
  el: HTMLTextAreaElement,
  prefix: string
): TextareaState {
  const { before, selected, after } = getSelection(el);
  const lines = (selected || 'item').split('\n');
  const prefixed = lines.map((line) => `${prefix}${line}`).join('\n');
  return {
    value: before + prefixed + after,
    selectionStart: before.length,
    selectionEnd: before.length + prefixed.length,
  };
}

/** Insert a numbered list */
export function numberedList(el: HTMLTextAreaElement): TextareaState {
  const { before, selected, after } = getSelection(el);
  const lines = (selected || 'item').split('\n');
  const numbered = lines
    .map((line, i) => `${i + 1}. ${line}`)
    .join('\n');
  return {
    value: before + numbered + after,
    selectionStart: before.length,
    selectionEnd: before.length + numbered.length,
  };
}

/** Insert a task list */
export function taskList(el: HTMLTextAreaElement): TextareaState {
  return prefixLines(el, '- [ ] ');
}

/** Insert a link */
export function insertLink(el: HTMLTextAreaElement): TextareaState {
  const { before, selected, after } = getSelection(el);
  const text = selected || 'link text';
  const link = `[${text}](url)`;
  return {
    value: before + link + after,
    selectionStart: before.length + text.length + 3,
    selectionEnd: before.length + text.length + 6,
  };
}

/** Insert an image */
export function insertImage(el: HTMLTextAreaElement): TextareaState {
  const { before, selected, after } = getSelection(el);
  const alt = selected || 'alt text';
  const img = `![${alt}](url)`;
  return {
    value: before + img + after,
    selectionStart: before.length + alt.length + 4,
    selectionEnd: before.length + alt.length + 7,
  };
}

/** Insert a code block */
export function insertCodeBlock(el: HTMLTextAreaElement): TextareaState {
  const { before, selected, after } = getSelection(el);
  const code = selected || 'code';
  const block = `\n\`\`\`\n${code}\n\`\`\`\n`;
  return {
    value: before + block + after,
    selectionStart: before.length + 5,
    selectionEnd: before.length + 5 + code.length,
  };
}

/** Insert a horizontal rule */
export function insertHorizontalRule(el: HTMLTextAreaElement): TextareaState {
  const { before, after } = getSelection(el);
  const hr = '\n---\n';
  return {
    value: before + hr + after,
    selectionStart: before.length + hr.length,
    selectionEnd: before.length + hr.length,
  };
}
