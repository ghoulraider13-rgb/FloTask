import { useState } from 'react';

export default function SavedNotes({ notes, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [openNoteId, setOpenNoteId] = useState(null);

  if (notes.length === 0) {
    return (
      <div className="nothing-card p-4">
        <div className="flex items-center justify-between text-ink-soft">
          <span className="flex items-center gap-2">
            <span className="text-2xs font-bold tracking-caption uppercase">
              SAVED ARCHIVES
            </span>
            <span className="text-3xs px-2 py-0.5 rounded-full bg-surface-3 text-ink-faint font-mono">
              0
            </span>
          </span>
        </div>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="w-10 h-10 rounded-full border border-surface-4 bg-surface-2/60 flex items-center justify-center mb-2.5">
            <svg className="w-4 h-4 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          </div>
          <p className="text-3xs text-ink-soft font-mono font-bold uppercase tracking-wider">ARCHIVE EMPTY</p>
          <p className="text-4xs text-ink-line font-mono mt-0.5">Notes saved from scratchpad appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="nothing-card p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <span className="flex items-center gap-2">
          <span className="text-2xs font-bold text-ink-soft tracking-caption uppercase">
            SAVED ARCHIVES
          </span>
          <span className="text-3xs px-2 py-0.5 rounded-full bg-surface-4 text-ink-tertiary font-mono">
            {notes.length}
          </span>
        </span>
        <svg
          className={`w-3.5 h-3.5 text-ink-faint transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
          {notes.map((note, index) => {
            const isOpen = openNoteId === note.id;
            const date = new Date(note.createdAt).toLocaleString([], {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            });

            return (
              <div key={note.id} style={{ '--stagger-i': index }} className="animate-fade-in rounded-xl bg-surface-3 border border-surface-5 overflow-hidden">
                <button
                  onClick={() => setOpenNoteId(isOpen ? null : note.id)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-surface-4 transition-colors"
                >
                  <svg
                    className={`w-2.5 h-2.5 text-ink-faint transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`}
                    fill="currentColor" viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span className="text-xs text-ink-tertiary truncate flex-1 font-mono">
                    {note.preview || '(Empty note)'}
                  </span>
                  <span className="text-3xs text-ink-line font-mono flex-shrink-0">{date}</span>
                </button>

                {isOpen && (
                  <div className="px-3 pb-3 animate-fade-in">
                    <div
                      className="rich-editor-preview text-xs text-ink-tertiary leading-relaxed bg-surface-2 rounded-lg p-3 max-h-48 overflow-y-auto"
                      dangerouslySetInnerHTML={{ __html: note.content }}
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={() => onDelete(note.id)}
                        className="text-3xs text-ink-faint hover:text-accent-red transition-colors font-mono uppercase tracking-wider"
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
