import { useRef } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-css';
import SavedNotes from './SavedNotes';

import { playMechanicalClick } from '../utils/audioHelpers';
import { parseActions } from '../utils/nlm';
import DrawPad from './DrawPad';

export default function RichScratchpad({ onNlmActions }) {
  const [initialHtml] = useState(() => {
    try {
      const stored = window.localStorage.getItem('scratchpad-rich');
      return stored ? JSON.parse(stored) : '';
    } catch { return ''; }
  });
  const [notes, setNotes] = useLocalStorage('saved-notes', []);
  const [isShrinking, setIsShrinking] = useState(false);
  const [processedItems, setProcessedItems] = useLocalStorage('nlm-processed', []);
  const processedRef = useRef(processedItems);
  useEffect(() => { processedRef.current = processedItems; }, [processedItems]);

  const editorRef = useRef(null);
  const debounceRef = useRef(null);
  const fileInputRef = useRef(null);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    if (editorRef.current && initialHtml && !editorRef.current.innerHTML) {
      editorRef.current.innerHTML = initialHtml;
    }
  }, [initialHtml]);

  const flashAgentIndicator = useCallback(() => {
    const saveIndicator = document.getElementById('save-indicator');
    if (!saveIndicator) return;
    const prevTx = saveIndicator.textContent;
    saveIndicator.textContent = 'Agent Executed Actions';
    saveIndicator.classList.add('text-emerald-400');
    setTimeout(() => {
      if (saveIndicator) {
        saveIndicator.textContent = prevTx;
        saveIndicator.classList.remove('text-emerald-400');
      }
    }, 3000);
  }, []);

  /**
   * Send the scratchpad text to the NLM and materialize any new
   * tasks/alarms it extracts (deduped by type+title).
   */
  const analyzeNLM = useCallback(async () => {
    if (!editorRef.current) return;
    const text = (editorRef.current.innerText || editorRef.current.textContent || '').trim();
    if (text.length < 5) return;
    try {
      const actions = await parseActions(text);
      const fresh = [];
      actions.forEach((a) => {
        const hash = `${a.type}:${a.title.toLowerCase().trim()}`;
        if (!processedRef.current.includes(hash)) {
          fresh.push({ ...a, hash });
        }
      });
      if (fresh.length > 0) {
        onNlmActions(fresh);
        setProcessedItems((prev) => [...prev, ...fresh.map((f) => f.hash)]);
        flashAgentIndicator();
      }
    } catch (e) {
      console.warn('NLM parse skipped:', e?.message);
    }
  }, [onNlmActions, setProcessedItems, flashAgentIndicator]);

  const handleInput = useCallback(() => {
    clearTimeout(debounceRef.current);
    const saveIndicator = document.getElementById('save-indicator');
    if (saveIndicator && saveIndicator.textContent !== 'Agent Executed Actions') {
      saveIndicator.textContent = 'saving';
    }

    debounceRef.current = setTimeout(() => {
      if (editorRef.current) {
        analyzeNLM(); // debounced NLM processing

        // Prism Debounced Highlighting
        const codeBlocks = editorRef.current.querySelectorAll('pre code');
        if (codeBlocks.length > 0) {
          codeBlocks.forEach((block) => Prism.highlightElement(block));
        }

        window.localStorage.setItem('scratchpad-rich', JSON.stringify(editorRef.current.innerHTML));
      }
      const indicator = document.getElementById('save-indicator');
      if (indicator && indicator.textContent !== 'Agent Executed Actions') {
        indicator.textContent = 'saved';
      }
    }, 2000); // 2 second debounce for NLM API calls
  }, [analyzeNLM]);

  // Insert a sketch PNG into the rich editor at the cursor
  const insertSketch = (dataUrl) => {
    if (!editorRef.current) return;
    const img = document.createElement('img');
    img.src = dataUrl;
    img.style.maxWidth = '100%';
    img.style.borderRadius = '8px';
    img.style.border = '1px solid #333';
    img.alt = 'sketch';
    editorRef.current.focus();
    const sel = window.getSelection();
    if (sel?.rangeCount) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(img);
      range.setStartAfter(img);
      range.collapse(false);
    } else {
      editorRef.current.appendChild(img);
    }
    setDrawing(false);
    handleInput();
  };

  const exec = (cmd, value = null) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const insertCodeBlock = () => {
    const code = prompt('Paste your code:');
    if (!code) return;
    const lang = prompt('Language (js, python, css):', 'js') || 'js';
    const pre = document.createElement('pre');
    pre.className = 'code-block-container';
    const codeEl = document.createElement('code');
    codeEl.className = `language-${lang}`;
    codeEl.textContent = code;
    try { Prism.highlightElement(codeEl); } catch { /* fallback */ }
    pre.appendChild(codeEl);

    const sel = window.getSelection();
    if (sel.rangeCount) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(pre);
      range.collapse(false);
    } else {
      editorRef.current?.appendChild(pre);
    }
    const br = document.createElement('br');
    pre.after(br);

    handleInput();
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) insertImage(file);
        return;
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const sel = window.getSelection();
      const node = sel.anchorNode;
      let parent = node?.parentNode;
      let isCode = false;
      while (parent && parent !== editorRef.current) {
        if (parent.nodeName === 'CODE') { isCode = true; break; }
        parent = parent.parentNode;
      }

      if (isCode) {
        e.preventDefault();
        const textContent = node.nodeValue || node.textContent;
        const currentLine = textContent.slice(0, sel.anchorOffset).split('\n').pop() || '';
        const indentMatch = currentLine.match(/^\s*/);
        const indent = indentMatch ? indentMatch[0] : '';
        document.execCommand('insertText', false, '\n' + indent);
      }
    }
  };

  const insertImage = (file) => {
    if (file.size > 5 * 1024 * 1024) { alert('Image too large (max 5MB)'); return; }
    playMechanicalClick();
    const reader = new FileReader();
    reader.onload = (e) => exec('insertImage', e.target.result);
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) insertImage(file);
    e.target.value = '';
  };

  const saveToArchive = () => {
    playMechanicalClick();
    if (!editorRef.current || !editorRef.current.innerHTML.trim()) return;
    const content = editorRef.current.innerHTML;
    const textPreview = editorRef.current.textContent.slice(0, 120).trim();
    setIsShrinking(true);
    setTimeout(() => {
      setNotes((prev) => [{
        id: crypto.randomUUID(),
        content,
        preview: textPreview || '(Image / Code)',
        createdAt: new Date().toISOString(),
      }, ...prev]);
      editorRef.current.innerHTML = '';
      window.localStorage.setItem('scratchpad-rich', JSON.stringify(''));
      setIsShrinking(false);
    }, 400);
  };

  const deleteNote = (id) => {
    playMechanicalClick();
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const getWordCount = () => {
    const text = editorRef.current?.textContent?.trim() || '';
    return text === '' ? 0 : text.split(/\s+/).length;
  };

  const [wordCount, setWordCount] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setWordCount(getWordCount()), 1000);
    return () => clearInterval(interval);
  }, []);

  const toolbarBtns = [
    { cmd: 'bold', label: 'B', cls: 'font-bold' },
    { cmd: 'italic', label: 'I', cls: 'italic' },
    { cmd: 'underline', label: 'U', cls: 'underline' },
    { cmd: 'strikethrough', label: 'S', cls: 'line-through' },
  ];

  return (
    <div className="flex flex-col gap-5 h-full relative">
      <div className={`nothing-card flex flex-col flex-1 transition-all duration-400 ${isShrinking ? 'scale-95 opacity-0' : ''}`}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-[11px] font-bold text-gray-500 tracking-[0.3em] uppercase">SCRATCHPAD</h3>
          <div className="flex items-center gap-1.5">
            <span id="save-indicator" className="text-[9px] text-gray-600 font-mono">
              saved
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 px-5 pb-3 border-b border-gray-800">
          {toolbarBtns.map(({ cmd, label, cls }) => (
            <button
              key={cmd}
              type="button"
              onClick={() => { playMechanicalClick(); exec(cmd); }}
              className={`w-8 h-8 rounded-md text-xs text-gray-500 hover:text-white hover:bg-surface-3 transition-all duration-200 flex items-center justify-center ${cls}`}
              title={cmd}
            >
              {label}
            </button>
          ))}
          <div className="w-px h-5 bg-gray-800 mx-1" />
          <button type="button" onClick={() => { playMechanicalClick(); exec('formatBlock', '<h3>'); }} className="w-8 h-8 rounded-md text-[10px] font-bold text-gray-500 hover:text-white hover:bg-surface-3 transition-all">H</button>
          <button type="button" onClick={() => { playMechanicalClick(); insertCodeBlock(); }} className="px-2 h-8 rounded-md text-[10px] font-mono text-gray-500 hover:text-white hover:bg-surface-3 transition-all">{'</>'}</button>
          <button type="button" onClick={() => { playMechanicalClick(); fileInputRef.current?.click(); }} className="w-8 h-8 rounded-md text-gray-500 hover:text-white hover:bg-surface-3 flex items-center justify-center">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V5.25a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v14.25a1.5 1.5 0 001.5 1.5z" /></svg>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          <button
            type="button"
            id="scratchpad-draw-button"
            onClick={() => { playMechanicalClick(); setDrawing((v) => !v); }}
            className={`w-8 h-8 rounded-md flex items-center justify-center transition-all duration-200 ${
              drawing
                ? 'bg-white text-black'
                : 'text-gray-500 hover:text-white hover:bg-surface-3'
            }`}
            title={drawing ? 'Close draw tool' : 'Draw a sketch — inserted into the note'}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.65 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
            </svg>
          </button>
        </div>

        {drawing ? (
          <DrawPad onInsert={insertSketch} onCancel={() => setDrawing(false)} />
        ) : (
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            className="rich-editor flex-1 max-h-[400px] overflow-y-auto"
            data-placeholder="Type or draw anything… 'walk the dog tomorrow 6pm' becomes a scheduled task"
          />
        )}

        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-800">
          <span className="text-[10px] text-gray-600 font-mono">{wordCount} words</span>
          <button onClick={saveToArchive} className="btn-pill px-6 py-2 text-[10px] bg-white text-black font-bold hover:bg-gray-200 border-transparent">
            SAVE TO ARCHIVE
          </button>
        </div>
      </div>

      <SavedNotes notes={notes} onDelete={deleteNote} />
    </div>
  );
}
