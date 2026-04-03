import { describe, expect, it } from 'vitest';
import { searchQuickOpenResults } from './quick-open';
import type { NoteMeta } from '../types';

const NOTES: NoteMeta[] = [
  {
    id: '1',
    title: 'API Guide',
    notebookId: 'Backend',
    tags: [{ label: 'api', color: 'blue' }],
    pinned: false,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-03T00:00:00.000Z',
  },
  {
    id: '2',
    title: 'Release Notes',
    notebookId: 'Docs',
    tags: [{ label: 'release', color: 'green' }],
    pinned: false,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  },
];

describe('searchQuickOpenResults', () => {
  it('returns recent notes when query is empty', () => {
    const results = searchQuickOpenResults(NOTES, '');
    expect(results.map((result) => result.note.id)).toEqual(['1', '2']);
  });

  it('matches by note title', () => {
    const results = searchQuickOpenResults(NOTES, 'api');
    expect(results[0]?.note.title).toBe('API Guide');
  });

  it('matches by tags', () => {
    const results = searchQuickOpenResults(NOTES, 'release');
    expect(results[0]?.matchedTags.map((tag) => tag.label)).toEqual(['release']);
  });
});
