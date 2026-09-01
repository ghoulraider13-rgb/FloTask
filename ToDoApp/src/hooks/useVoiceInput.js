import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Continuous dictation hook matching Windows Voice Typing behavior.
 * Returns a superset of the original API used throughout the app:
 *   - isListening / listening: whether the recognizer is active
 *   - supported: true when SpeechRecognition is available
 *   - error: last error message (if any)
 *   - interimTranscript / finalTranscript / transcript
 *   - startListening / stopListening / toggleListening
 *   - setTranscript: external reset of the accumulated transcript
 */
export default function useVoiceInput() {
  const [isListening, setIsListening] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);

  // Detect support once
  const [supported] = useState(() =>
    Boolean(typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition))
  );

  const recognitionRef = useRef(null);

  // Mirrors isListening without re-running the setup effect. The onend /
  // onerror handlers below must see the CURRENT intent, not the value
  // captured on first render (the effect deps are deliberately []).
  const isListeningRef = useRef(false);

  // Errors that shouldn't kill continuous dictation: Chrome fires these
  // during long sessions and follows up with `end`, which auto-restarts.
  const TRANSIENT_ERRORS = new Set(['no-speech', 'aborted', 'network']);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    // Ensure single global recognizer across hook instances
    if (!window.__globalSpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true; // keep mic open
      rec.interimResults = true;
      rec.lang = 'en-US';
      window.__globalSpeechRecognition = rec;
    }
    const recognition = window.__globalSpeechRecognition;
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript || '';
        if (result.isFinal) final += text + ' ';
        else interim += text;
      }
      if (final) setFinalTranscript((prev) => prev + final);
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      // Transient hiccup mid-dictation: leave isListening alone; the
      // `end` event that follows will auto-restart the recognizer.
      if (TRANSIENT_ERRORS.has(event.error) && isListeningRef.current) return;
      setError(event.error || 'unknown');
      isListeningRef.current = false;
      setIsListening(false);
    };

    recognition.onend = () => {
      // Auto-restart to mimic system-level dictation persistence.
      // Reads the ref so it always sees the user's CURRENT intent.
      if (isListeningRef.current) {
        try { recognition.start(); } catch { /* already started */ }
      }
    };

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
    // Recognizer is a global singleton; handlers only read refs, so the
    // empty dep array (set up once) is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start / stop helpers
  const startListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec || isListeningRef.current) return;
    try {
      rec.start();
      isListeningRef.current = true;
      setIsListening(true);
      setError(null);
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
      setError(e.message || 'start failure');
    }
  }, []);

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec || !isListeningRef.current) return;
    // Flip the ref BEFORE stop() so the onend handler doesn't auto-restart.
    isListeningRef.current = false;
    try { rec.stop(); } catch { /* ignore */ }
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) stopListening();
    else startListening();
  }, [startListening, stopListening]);

  // External reset of transcript
  const setTranscript = useCallback((value) => {
    setFinalTranscript(value);
    setInterimTranscript('');
    setError(null);
  }, []);

  return {
    isListening,
    listening: isListening,
    supported,
    error,
    interimTranscript,
    finalTranscript,
    transcript: finalTranscript + interimTranscript,
    startListening,
    stopListening,
    toggleListening,
    setTranscript,
  };
}
