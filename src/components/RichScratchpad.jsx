import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-css';
import SavedNotes from './SavedNotes';

import { playMechanicalClick } from '../utils/audioHelpers';

// Map AI priority to intensity levels
const PRIORITY_TO_INTENSITY = { high: 'high', medium: 'medium', low: 'low' };

export default function RichScratchpad({ onAddTask, onAddAlarm }) {
  const [initialHtml] = useState(() => {
    try {
      const stored = window.localStorage.getItem('scratchpad-rich');
      return stored ? JSON.parse(stored) : '';
    } catch { return ''; }
  });
  const [notes, setNotes] = useLocalStorage('saved-notes', []);
  const [isShrinking, setIsShrinking] = useState(false);
  const [processedItems, setProcessedItems] = useLocalStorage('nlm-processed', []);
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState('');

  const editorRef = useRef(null);
  const debounceRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && initialHtml && !editorRef.current.innerHTML) {
      editorRef.current.innerHTML = initialHtml;
    }
  }, [initialHtml]);

  // ── Speech-to-Text Setup ──────────────────────────────────────
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      // Speech detected — kill the silence watchdog
      clearTimeout(silenceTimerRef.current);
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript && editorRef.current) {
        // Append transcribed text as new bullet line
        const br = document.createElement('br');
        const textNode = document.createTextNode('• ' + finalTranscript.trim() + ' ');
        editorRef.current.appendChild(br);
        editorRef.current.appendChild(textNode);
        // Move cursor to end
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
        // Trigger the NLM pipeline via handleInput
        handleInput();
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') {
        setMicError('Could not hear anything, please try again.');
        setTimeout(() => setMicError(''), 4000);
      } else {
        console.warn('Speech recognition error:', event.error);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  const silenceTimerRef = useRef(null);

  const toggleSpeechRecognition = useCallback(async () => {
    playMechanicalClick();
    if (!recognitionRef.current) {
      setMicError('Speech recognition not supported. Please use Chrome or Edge.');
      setTimeout(() => setMicError(''), 4000);
      return;
    }
    if (isListening) {
      clearTimeout(silenceTimerRef.current);
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }
    // Request microphone permission first
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicError('Microphone access required for voice input.');
      setTimeout(() => setMicError(''), 4000);
      return;
    }
    // Silence watchdog: auto-stop after 8s if no speech detected
    silenceTimerRef.current = setTimeout(() => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      setMicError('Could not hear anything, please try again.');
      setTimeout(() => setMicError(''), 4000);
    }, 8000);
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e) {
      clearTimeout(silenceTimerRef.current);
      console.warn('Recognition start error:', e);
    }
  }, [isListening]);

  const parseIntentWithGemini = async (fullText) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      return { tasks: [], alarms: [] };
    }
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      console.log('API CONNECTION STABLE');
      const model = genAI.getGenerativeModel(
        { model: "gemini-3.1-flash-lite-preview" },
        { apiVersion: "v1beta" }
      );
      const prompt = `You are a strict JSON parser and intelligent task prioritization agent. Analyze this text: '${fullText}'. Extract tasks and alarms.
Return ONLY a valid JSON object with the following schema:
{
  "tasks": [{ "title": "string", "priority": "High" | "Medium" | "Low" }],
  "alarms": [{ "label": "string", "time": "HH:MM (24-hour)", "priority": "High" | "Medium" | "Low" }]
}
Rules:
1. If "tonight" or "evening" is mentioned without an exact time, default to "19:00" today.
2. If no clear items exist, return { "tasks": [], "alarms": [] }.
3. Return ONLY valid JSON, no markdown formatting, no backticks.
4. PRIORITY ASSIGNMENT (CRITICAL):
   - "High": Tasks with deadlines (e.g., "due tomorrow", "tonight", "urgent", "ASAP"), time-sensitive activities, health/safety, meetings.
   - "Medium": Tasks with moderate importance, scheduled activities without hard deadlines, regular commitments (e.g., "gym tonight").
   - "Low": Casual notes, ideas, shopping lists, things with no time pressure.
5. Always evaluate semantic urgency from context — "Finish ML lab due tomorrow" is High, "Buy groceries" is Low.`;
      
      const result = await model.generateContent(prompt);
      const output = result.response.text().trim();
      const cleaned = output.replace(/```json/g, "").replace(/```/g, "").trim();
      const data = JSON.parse(cleaned);
      if (data && (data.tasks || data.alarms)) {
          return { tasks: data.tasks || [], alarms: data.alarms || [] };
      }
    } catch(e) {
      console.error("Gemini API Error:", e);
    }
    return { tasks: [], alarms: [] };
  };

  const analyzeNLM = async () => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || editorRef.current.textContent;
    if (text.length < 5) return;

    const intent = await parseIntentWithGemini(text);
    if (intent && (intent.tasks.length > 0 || intent.alarms.length > 0)) {
      let newlyProcessed = [];
      
      intent.tasks.forEach(taskObj => {
        // Support both old format (string) and new format (object with priority)
        const title = typeof taskObj === 'string' ? taskObj : taskObj.title;
        const priority = typeof taskObj === 'string' ? 'medium' : (taskObj.priority || 'Medium').toLowerCase();
        const intensity = PRIORITY_TO_INTENSITY[priority] || 'medium';

        const hash = "TASK:" + title.toLowerCase().trim();
        if (!processedItems.includes(hash)) {
          onAddTask(title, { intensity, reminderDateTime: null, isAgentCreated: true });
          newlyProcessed.push(hash);
        }
      });
      
      intent.alarms.forEach(alarmObj => {
        const hash = "ALARM:" + alarmObj.label.toLowerCase().trim() + alarmObj.time;
        if (!processedItems.includes(hash)) {
          const d = new Date();
          d.setSeconds(0);
          const timeMatch = alarmObj.time.match(/(\d{1,2})(?::(\d{2}))?/i);
          if (timeMatch) {
            d.setHours(parseInt(timeMatch[1], 10), timeMatch[2] ? parseInt(timeMatch[2], 10) : 0);
          } else {
            d.setHours(19, 0); // default fallback
          }
          const priority = (alarmObj.priority || 'Medium').toLowerCase();
          const intensity = PRIORITY_TO_INTENSITY[priority] || 'medium';
          onAddAlarm({ id: crypto.randomUUID(), label: alarmObj.label, dateTime: d.toISOString(), intensity, fired: false, isAgentCreated: true });
          newlyProcessed.push(hash);
        }
      });

      if (newlyProcessed.length > 0) {
        setProcessedItems(prev => [...prev, ...newlyProcessed]);
        const saveIndicator = document.getElementById('save-indicator');
        if (saveIndicator) {
          const prevTx = saveIndicator.textContent;
          saveIndicator.textContent = "Agent Executed Actions";
          saveIndicator.classList.add("text-emerald-400");
          setTimeout(() => {
            if (saveIndicator) {
              saveIndicator.textContent = prevTx;
              saveIndicator.classList.remove("text-emerald-400");
            }
          }, 3000);
        }
      }
    }
  };

  const handleInput = useCallback(() => {
    clearTimeout(debounceRef.current);
    const saveIndicator = document.getElementById('save-indicator');
    if (saveIndicator && saveIndicator.textContent !== "Agent Executed Actions") {
        saveIndicator.textContent = 'saving';
    }
    
    debounceRef.current = setTimeout(() => {
      if (editorRef.current) {
        // NLM processing
        analyzeNLM();

        // Prism Debounced Highlighting
        const codeBlocks = editorRef.current.querySelectorAll('pre code');
        if (codeBlocks.length > 0) {
          codeBlocks.forEach(block => Prism.highlightElement(block));
        }

        window.localStorage.setItem('scratchpad-rich', JSON.stringify(editorRef.current.innerHTML));
      }
      if (saveIndicator && saveIndicator.textContent !== "Agent Executed Actions") {
          saveIndicator.textContent = 'saved';
      }
    }, 2000); // 2 second debounce for NLM API calls
  }, [analyzeNLM]);

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
    // ensure clear space below the block
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

  const hasSpeechSupport = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const toolbarBtns = [
    { cmd: 'bold', label: 'B', cls: 'font-bold' },
    { cmd: 'italic', label: 'I', cls: 'italic' },
    { cmd: 'underline', label: 'U', cls: 'underline' },
    { cmd: 'strikethrough', label: 'S', cls: 'line-through' },
  ];

  return (
    <div className="flex flex-col gap-5 h-full relative">
      <div className={`glass-tile flex flex-col flex-1 transition-all duration-400 ${
        isShrinking ? 'scale-95 opacity-0' : ''
      }`}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-[11px] font-bold text-gray-500 tracking-[0.3em] uppercase font-dotmatrix">SCRATCHPAD</h3>
          <div className="flex items-center gap-1.5">
            <span id="save-indicator" className="text-[9px] text-gray-600 font-mono">
              saved
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 px-5 pb-3 border-b border-gray-800/50">
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

          <div className="w-px h-5 bg-gray-800 mx-1" />

          {/* Microphone — Speech-to-Text */}
          <button
            type="button"
            onClick={toggleSpeechRecognition}
            disabled={!hasSpeechSupport}
            className={`w-8 h-8 rounded-md flex items-center justify-center transition-all duration-200 ${
              isListening
                ? 'bg-white text-black mic-recording'
                : hasSpeechSupport
                  ? 'text-gray-500 hover:text-white hover:bg-surface-3'
                  : 'text-gray-700 cursor-not-allowed opacity-40'
            }`}
            title={hasSpeechSupport ? (isListening ? 'Stop recording' : 'Voice input') : 'Speech recognition not supported'}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          </button>
        </div>

        {/* Mic error banner */}
        {micError && (
          <div className="mx-5 mt-2 px-3 py-2 rounded-sm border border-red-900/60 bg-red-950/30 text-[10px] text-red-400 font-dotmatrix tracking-wider animate-fade-in">
            ⚠ {micError}
          </div>
        )}

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          className="rich-editor flex-1 max-h-[400px] overflow-y-auto"
          data-placeholder="Start typing, paste images, or use the mic to dictate..."
        />

        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-800/50">
          <span className="text-[10px] text-gray-600 font-mono">{wordCount} words</span>
          <button onClick={saveToArchive} className="btn-pill px-6 py-2 text-[10px] bg-white text-black font-bold hover:bg-gray-200 border-transparent font-dotmatrix">
            SAVE TO ARCHIVE
          </button>
        </div>
      </div>

      <SavedNotes notes={notes} onDelete={deleteNote} />
    </div>
  );
}
