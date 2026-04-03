export interface SelectionState {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

function getSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number
): { before: string; selected: string; after: string } {
  return {
    before: value.slice(0, selectionStart),
    selected: value.slice(selectionStart, selectionEnd),
    after: value.slice(selectionEnd),
  };
}

function fromTextarea(el: HTMLTextAreaElement): SelectionState {
  return {
    value: el.value,
    selectionStart: el.selectionStart,
    selectionEnd: el.selectionEnd,
  };
}

function applyFromSelection(
  input: SelectionState,
  transform: (state: SelectionState) => SelectionState
): SelectionState {
  return transform(input);
}

export function wrapSelection(
  input: SelectionState | HTMLTextAreaElement,
  marker: string
): SelectionState {
  const state = input instanceof HTMLTextAreaElement ? fromTextarea(input) : input;
  const { before, selected, after } = getSelection(
    state.value,
    state.selectionStart,
    state.selectionEnd
  );

  if (selected.startsWith(marker) && selected.endsWith(marker)) {
    const unwrapped = selected.slice(marker.length, -marker.length);
    return {
      value: `${before}${unwrapped}${after}`,
      selectionStart: before.length,
      selectionEnd: before.length + unwrapped.length,
    };
  }

  const wrapped = `${marker}${selected || 'text'}${marker}`;
  return {
    value: `${before}${wrapped}${after}`,
    selectionStart: before.length + marker.length,
    selectionEnd: before.length + wrapped.length - marker.length,
  };
}

export function prefixLines(
  input: SelectionState | HTMLTextAreaElement,
  prefix: string
): SelectionState {
  const state = input instanceof HTMLTextAreaElement ? fromTextarea(input) : input;
  const { before, selected, after } = getSelection(
    state.value,
    state.selectionStart,
    state.selectionEnd
  );
  const lines = (selected || 'item').split('\n');
  const prefixed = lines.map((line) => `${prefix}${line}`).join('\n');

  return {
    value: `${before}${prefixed}${after}`,
    selectionStart: before.length,
    selectionEnd: before.length + prefixed.length,
  };
}

export function numberedList(input: SelectionState | HTMLTextAreaElement) {
  const state = input instanceof HTMLTextAreaElement ? fromTextarea(input) : input;
  const { before, selected, after } = getSelection(
    state.value,
    state.selectionStart,
    state.selectionEnd
  );
  const lines = (selected || 'item').split('\n');
  const numbered = lines.map((line, index) => `${index + 1}. ${line}`).join('\n');

  return {
    value: `${before}${numbered}${after}`,
    selectionStart: before.length,
    selectionEnd: before.length + numbered.length,
  };
}

export function taskList(input: SelectionState | HTMLTextAreaElement) {
  return prefixLines(input, '- [ ] ');
}

export function insertLink(input: SelectionState | HTMLTextAreaElement) {
  const state = input instanceof HTMLTextAreaElement ? fromTextarea(input) : input;
  const { before, selected, after } = getSelection(
    state.value,
    state.selectionStart,
    state.selectionEnd
  );
  const text = selected || 'link text';
  const nextValue = `[${text}](url)`;

  return {
    value: `${before}${nextValue}${after}`,
    selectionStart: before.length + text.length + 3,
    selectionEnd: before.length + text.length + 6,
  };
}

export function insertImage(input: SelectionState | HTMLTextAreaElement) {
  const state = input instanceof HTMLTextAreaElement ? fromTextarea(input) : input;
  const { before, selected, after } = getSelection(
    state.value,
    state.selectionStart,
    state.selectionEnd
  );
  const text = selected || 'alt text';
  const nextValue = `![${text}](url)`;

  return {
    value: `${before}${nextValue}${after}`,
    selectionStart: before.length + text.length + 4,
    selectionEnd: before.length + text.length + 7,
  };
}

export function insertCodeBlock(input: SelectionState | HTMLTextAreaElement) {
  const state = input instanceof HTMLTextAreaElement ? fromTextarea(input) : input;
  const { before, selected, after } = getSelection(
    state.value,
    state.selectionStart,
    state.selectionEnd
  );
  const code = selected || 'code';
  const block = `\n\`\`\`ts\n${code}\n\`\`\`\n`;

  return {
    value: `${before}${block}${after}`,
    selectionStart: before.length + 5,
    selectionEnd: before.length + 7,
  };
}

export function insertHorizontalRule(input: SelectionState | HTMLTextAreaElement) {
  const state = input instanceof HTMLTextAreaElement ? fromTextarea(input) : input;
  const { before, after } = getSelection(
    state.value,
    state.selectionStart,
    state.selectionEnd
  );
  const rule = '\n---\n';

  return {
    value: `${before}${rule}${after}`,
    selectionStart: before.length + rule.length,
    selectionEnd: before.length + rule.length,
  };
}

export function insertInlineMath(input: SelectionState | HTMLTextAreaElement) {
  return wrapSelection(input, '$');
}

export function insertMathBlock(input: SelectionState | HTMLTextAreaElement) {
  const state = input instanceof HTMLTextAreaElement ? fromTextarea(input) : input;
  const { before, selected, after } = getSelection(
    state.value,
    state.selectionStart,
    state.selectionEnd
  );
  const block = `\n$$\n${selected || 'E = mc^2'}\n$$\n`;

  return {
    value: `${before}${block}${after}`,
    selectionStart: before.length + 4,
    selectionEnd: before.length + 4 + (selected || 'E = mc^2').length,
  };
}

export function insertCallout(
  input: SelectionState | HTMLTextAreaElement,
  kind: 'NOTE' | 'TIP' | 'WARNING' = 'NOTE'
) {
  const state = input instanceof HTMLTextAreaElement ? fromTextarea(input) : input;
  const { before, selected, after } = getSelection(
    state.value,
    state.selectionStart,
    state.selectionEnd
  );
  const lines = (selected || 'Callout content').split('\n');
  const callout = [`> [!${kind}]`, ...lines.map((line) => `> ${line}`)].join('\n');

  return {
    value: `${before}${callout}${after}`,
    selectionStart: before.length,
    selectionEnd: before.length + callout.length,
  };
}

export function applyMarkdownTransform(
  input: SelectionState,
  transform: (state: SelectionState) => SelectionState
) {
  return applyFromSelection(input, transform);
}
