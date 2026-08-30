import { useState, useEffect, useRef } from 'react';

// Hook to manage Web Speech API voice input.
// Returns { listening, transcript, startListening, stopListening }
export default function useVoiceInput() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Web Speech API not supported in this browser');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += transcriptPart;
        else interim += transcriptPart;
      }
      setTranscript(final || interim);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
  }, []);

  const startListening = () => {
    if (recognitionRef.current && !listening) {
      setTranscript('');
      recognitionRef.current.start();
      setListening(true);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && listening) {
      recognitionRef.current.stop();
    }
  };

  return { listening, transcript, startListening, stopListening };
}
