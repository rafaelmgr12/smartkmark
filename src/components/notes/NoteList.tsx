import { useState } from 'react';
import SearchInput from '../ui/SearchInput';
import NoteCard from './NoteCard';
import type { Note } from '../../types';

interface NoteListProps {
  title: string;
  notes: Note[];
  selectedNoteId: string | null;
  onNoteSelect: (noteId: string) => void;
}

export default function NoteList({
  title,
  notes,
  selectedNoteId,
  onNoteSelect,
}: NoteListProps) {
  const [search, setSearch] = useState('');

  const filtered = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.body.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-r border-slate-700/50 bg-slate-850">
      {/* Header */}
      <div className="border-b border-slate-700/50 px-4 pt-4 pb-3">
        <h2 className="text-base font-bold text-slate-200">{title}</h2>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search..."
          className="mt-3"
        />
      </div>

      {/* Note cards */}
      <div className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
        {filtered.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-slate-600">
            No notes found.
          </p>
        ) : (
          filtered.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              active={note.id === selectedNoteId}
              onClick={() => onNoteSelect(note.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
