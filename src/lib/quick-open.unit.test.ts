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

  it('ranks exact title matches ahead of notebook matches', () => {
    const results = searchQuickOpenResults(
      [
        ...NOTES,
        {
          id: '3',
          title: 'Backend Overview',
          notebookId: 'API',
          tags: [],
          pinned: false,
          status: 'active',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-04T00:00:00.000Z',
        },
      ],
      'api'
    );

    expect(results.map((result) => result.note.id)).toEqual(['1', '3']);
  });

  it('limits the result size', () => {
    const results = searchQuickOpenResults(
      [
        ...NOTES,
        {
          id: '3',
          title: 'API',
          notebookId: 'Backend',
          tags: [],
          pinned: false,
          status: 'active',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-04T00:00:00.000Z',
        },
      ],
      'api',
      1
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.note.id).toBe('1');
  });
});
