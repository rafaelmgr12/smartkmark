import type { NoteMeta, NoteTag } from '../types';

export interface QuickOpenResult {
  note: NoteMeta;
  matchedTags: NoteTag[];
  score: number;
}

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

function tagScore(tags: NoteTag[], query: string) {
  const matchedTags = tags.filter((tag) =>
    tag.label.toLowerCase().includes(query)
  );

  return {
    matchedTags,
    score: matchedTags.reduce((sum, tag) => {
      const label = tag.label.toLowerCase();
      return sum + (label === query ? 180 : label.startsWith(query) ? 140 : 110);
    }, 0),
  };
}

function titleScore(title: string, query: string) {
  const normalized = title.toLowerCase();

  if (normalized === query) {
    return 320;
  }

  if (normalized.startsWith(query)) {
    return 240;
  }

  if (normalized.includes(query)) {
    return 170;
  }

  return 0;
}

function notebookScore(notebookId: string, query: string) {
  const normalized = notebookId.toLowerCase();

  if (normalized === query) {
    return 90;
  }

  if (normalized.startsWith(query)) {
    return 60;
  }

  if (normalized.includes(query)) {
    return 30;
  }

  return 0;
}

export function searchQuickOpenResults(
  notes: NoteMeta[],
  query: string,
  limit = 10
): QuickOpenResult[] {
  const normalizedQuery = normalizeQuery(query);

  if (!normalizedQuery) {
    return [...notes]
      .sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      )
      .slice(0, limit)
      .map((note) => ({
        note,
        matchedTags: [],
        score: 0,
      }));
  }

  return notes
    .map((note) => {
      const title = titleScore(note.title, normalizedQuery);
      const notebook = notebookScore(note.notebookId, normalizedQuery);
      const tags = tagScore(note.tags, normalizedQuery);
      const score = title + notebook + tags.score;

      return {
        note,
        matchedTags: tags.matchedTags,
        score,
      };
    })
    .filter((result) => result.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return (
        new Date(right.note.updatedAt).getTime() -
        new Date(left.note.updatedAt).getTime()
      );
    })
    .slice(0, limit);
}
