import { useState, useEffect, useRef } from 'react';
import IntensitySelector from './IntensitySelector';
import { playMechanicalClick } from '../utils/audioHelpers';
import { toLocalInputValue } from '../utils/taskHelpers';
import useVoiceInput from '../hooks/useVoiceInput';

export default function AddTaskForm({ onAddTask, onNlmText }) {
  const [title, setTitle] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [reminderDateTime, setReminderDateTime] = useState('');
  const [intensity, setIntensity] = useState('low');
  const [parsing, setParsing] = useState(false);

  const {
    isListening, supported: voiceSupported, error: voiceError,
    interimTranscript, finalTranscript, startListening, stopListening,
  } = useVoiceInput();
  // Updated API: use isListening, startListening, stopListening, toggleListening


  // Live partial transcript feedback in the input while speaking
  useEffect(() => {
    if (isListening && interimTranscript) setTitle(interimTranscript);
  }, [isListening, interimTranscript]);

  const resetFields = () => {
    setTitle('');
    setReminderDateTime('');
    setIntensity('low');
    setShowOptions(false);
  };

  const submitText = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || parsing) return;
    playMechanicalClick();

    // Manual reminder options were explicitly set → create directly (no NLM)
    const manualOptions = showOptions && (reminderDateTime || intensity !== 'low');
    if (manualOptions) {
      onAddTask(trimmed, {
        reminderDateTime: reminderDateTime ? new Date(reminderDateTime).toISOString() : null,
        intensity,
      });
    } else if (onNlmText) {
      // Natural language: "walk the dog tomorrow at 6pm" → parsed by the NLM
      setParsing(true);
      try { await onNlmText(trimmed); } finally { setParsing(false); }
    } else {
      onAddTask(trimmed, {});
    }
    resetFields();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submitText(title);
  };

  // Spoken input → auto-create the task once recognition finalizes
  const lastVoiceSubmitRef = useRef('');
  useEffect(() => {
    if (!finalTranscript) return;
    const t = finalTranscript.trim();
    if (!t || lastVoiceSubmitRef.current === t) return;
    lastVoiceSubmitRef.current = t;
    playMechanicalClick();
    (async () => {
      if (onNlmText) {
        setParsing(true);
        try { await onNlmText(t); } finally { setParsing(false); }
      } else {
        onAddTask(t, {});
      }
      setTitle('');
      setTranscript('');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalTranscript]);

  const toggleVoice = () => {
    playMechanicalClick();
    if (!voiceSupported) return;
    if (isListening) stopListening();
    else startListening();
  };

  const minDateTime = toLocalInputValue(new Date());

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-end gap-3">
        <div className="flex-1 min-w-0 flex items-center gap-2 border-b border-gray-800">
          <input
            id="add-task-input"
            type="text"
            value={isListening ? (title || 'Listening…') : title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={parsing}
            placeholder={parsing ? 'NLM parsing…' : "What needs to be done? e.g. walk the dog tomorrow 6pm"}
            className="nothing-input flex-1 border-none min-w-0"
            autoComplete="off"
          />
          {/* Voice input */}
          <button
            type="button"
            id="voice-add-button"
            onClick={toggleVoice}
            disabled={!voiceSupported}
            className={`p-2.5 rounded-full transition-all duration-200 flex-shrink-0 ${
              isListening
                ? 'bg-white text-black animate-pulse'
                : 'text-gray-600 hover:text-gray-400'
            } ${!voiceSupported ? 'opacity-30 cursor-not-allowed' : ''}`}
            title={voiceSupported
              ? (isListening ? 'Stop — creating task' : 'Speak a task — e.g. “walk the dog tomorrow at 6pm”')
              : 'Voice input not supported in this browser'}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          </button>
          {/* Reminder toggle (manual override) */}
          <button
            type="button"
            onClick={() => { playMechanicalClick(); setShowOptions(!showOptions); }}
            className={`p-2.5 rounded-full transition-all duration-200 flex-shrink-0 ${
              showOptions
                ? 'bg-white text-black'
                : 'text-gray-600 hover:text-gray-400'
            }`}
            title="Manual reminder options (bypass NLM)"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
        <button
          id="add-task-button"
          type="submit"
          disabled={!title.trim() || parsing}
          className="btn-pill px-6 py-2.5 text-[11px] bg-white text-black font-bold hover:bg-gray-200 border-transparent disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
        >
          {parsing ? '···' : '+ ADD'}
        </button>
      </div>

      {voiceError && (
        <p className="text-[10px] text-red-400 font-mono">{voiceError}</p>
      )}

      {showOptions && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 animate-fade-in">
          <input
            type="datetime-local"
            value={reminderDateTime}
            onChange={(e) => setReminderDateTime(e.target.value)}
            min={minDateTime}
            className="nothing-input-bordered flex-1 min-w-[160px] text-xs"
          />
          <IntensitySelector value={intensity} onChange={setIntensity} compact />
        </div>
      )}
    </form>
  );
}
