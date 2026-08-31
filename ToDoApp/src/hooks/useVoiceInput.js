import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Web Speech API voice input hook.
 * - `supported`        → false when the browser has no SpeechRecognition (can hide/disable UI)
 * - `listening`        → recognition active
 * - `interimTranscript`→ live partial text (for in-place feedback)
 * - `finalTranscript`  → set once when speech finalizes; consumed by the caller
 * - `error`            → human-readable failure reason (mic denied, etc.)
 */
export default function useVoiceInput() {
  // Feature detection is constant per session — derive once, lazily.
  const [supported] = useState(() =>
    Boolean(typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition))
  );
  const [listening, setListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const part = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) final += part;
        else interim += part;
      }
      if (interim) setInterimTranscript(interim);
      if (final) setFinalTranscript(final.trim());
    };

    recognition.onerror = (event) => {
      const code = event?.error || 'unknown';
      const messages = {
        'not-allowed': 'Microphone access denied — allow the mic in your browser settings',
        'service-not-allowed': 'Speech service blocked by browser settings',
        'no-speech': 'Nothing heard — try speaking again',
        'audio-capture': 'No microphone found',
        network: 'Speech recognition network error',
      };
      setError(messages[code] || `Voice error: ${code}`);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      // Some engines end without flagging isFinal — promote the interim text.
      setInterimTranscript((current) => {
        if (current.trim()) setFinalTranscript((prev) => prev || current.trim());
        return '';
      });
    };

    recognitionRef.current = recognition;
    return () => {
      try { recognition.abort(); } catch { /* already stopped */ }
      recognitionRef.current = null;
    };
  }, []);

  const startListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || listening) return;
    setError(null);
    setInterimTranscript('');
    setFinalTranscript('');
    try {
      recognition.start();
      setListening(true);
    } catch {
      // start() throws InvalidStateError if called mid-shutdown; safe to ignore
      setListening(false);
    }
  }, [listening]);

  const stopListening = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { /* not running */ }
    setListening(false);
  }, []);

  return { listening, supported, interimTranscript, finalTranscript, error, startListening, stopListening };
}
