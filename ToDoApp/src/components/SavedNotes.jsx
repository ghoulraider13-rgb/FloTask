import { useState } from 'react';

export default function SavedNotes({ notes, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [openNoteId, setOpenNoteId] = useState(null);

  if (notes.length === 0) return null;

  return (
    <div className="nothing-card p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <span className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-gray-500 tracking-[0.2em] uppercase">
            SAVED NOTES
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-4 text-gray-400 font-mono">
            {notes.length}
          </span>
        </span>
        <svg
          className={`w-3.5 h-3.5 text-gray-600 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 max-h-64 overflow-y-auto animate-fade-in">
          {notes.map((note) => {
            const isOpen = openNoteId === note.id;
            const date = new Date(note.createdAt).toLocaleString([], {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            });

            return (
              <div key={note.id} className="rounded-xl bg-surface-3 border border-gray-800 overflow-hidden">
                <button
                  onClick={() => setOpenNoteId(isOpen ? null : note.id)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-surface-4 transition-colors"
                >
                  <svg
                    className={`w-2.5 h-2.5 text-gray-600 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`}
                    fill="currentColor" viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span className="text-xs text-gray-400 truncate flex-1 font-mono">
                    {note.preview || '(Empty note)'}
                  </span>
                  <span className="text-[10px] text-gray-700 font-mono flex-shrink-0">{date}</span>
                </button>

                {isOpen && (
                  <div className="px-3 pb-3 animate-fade-in">
                    <div
                      className="rich-editor-preview text-xs text-gray-400 leading-relaxed bg-surface-2 rounded-lg p-3 max-h-48 overflow-y-auto"
                      dangerouslySetInnerHTML={{ __html: note.content }}
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={() => onDelete(note.id)}
                        className="text-[10px] text-gray-600 hover:text-red-400 transition-colors font-mono uppercase tracking-wider"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
