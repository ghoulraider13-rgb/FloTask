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
      setError(event.error || 'unknown');
      setIsListening(false);
    };

    recognition.onend = () => {
      // Auto-restart to mimic system-level dictation persistence
      if (isListening) {
        try { recognition.start(); } catch { /* ignore */ }
      }
    };

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

  // Start / stop helpers
  const startListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec || isListening) return;
    try { rec.start(); setIsListening(true); setError(null); } catch (e) {
      console.error('Failed to start speech recognition:', e);
      setError(e.message || 'start failure');
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec || !isListening) return;
    try { rec.stop(); } catch (e) {/* ignore */}
    setIsListening(false);
  }, [isListening]);

  const toggleListening = useCallback(() => {
    if (isListening) stopListening(); else startListening();
  }, [isListening, startListening, stopListening]);

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


