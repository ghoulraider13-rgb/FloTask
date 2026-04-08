import { useState, useEffect, useRef } from 'react';
import { generateCaptcha } from '../utils/captchaHelpers';
import { heavyMechanicalChime } from '../utils/audioHelpers';

export default function EnforcerModal({ title, subtext, onDismiss }) {
  const [captcha, setCaptcha] = useState(() => generateCaptcha());
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [glitch, setGlitch] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.classList.add('red-alert');
    
    // Start heavy chime loop
    const chime = heavyMechanicalChime();
    
    const handleKey = (e) => { 
      if (e.key === 'Escape') e.preventDefault(); 
    };
    window.addEventListener('keydown', handleKey);
    inputRef.current?.focus();
    
    return () => {
      document.body.style.overflow = '';
      document.documentElement.classList.remove('red-alert');
      chime.stop();
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (captcha.verify(input)) {
      onDismiss();
    } else {
      setError(true);
      setGlitch(true);
      setInput('');
      setTimeout(() => setGlitch(false), 300); // Glitch duration matches CSS
      setCaptcha(generateCaptcha());
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Background shadow box shifted entirely to dark red */}
      <div className="absolute inset-0 bg-black/90 pointer-events-none" />

      <div className={`relative z-10 w-full max-w-lg mx-4 ${glitch ? 'animate-glitch' : 'animate-fade-in'}`}>
        <div className="bg-[#050000] rounded-none p-8 border border-red-500 hover:shadow-[0_0_20px_rgba(255,0,0,0.5)] transition-shadow duration-300">
          
          {/* Warning Icon */}
          <div className="w-16 h-16 rounded-full border border-red-500 flex items-center justify-center mx-auto mb-5 drop-shadow-[0_0_10px_rgba(255,0,0,0.8)]">
            <svg className="w-8 h-8 text-red-500 animate-pulseSlow" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>

          <h2 className="text-3xl font-dotmatrix text-red-500 text-center mb-1 tracking-[0.15em] uppercase drop-shadow-[0_0_5px_rgba(255,0,0,0.8)]">
            THE ENFORCER
          </h2>
          <h3 className="text-md font-dotmatrix text-white text-center mb-1 tracking-widest uppercase">{title}</h3>
          {subtext && <p className="text-xs text-red-300/60 font-mono text-center mb-8">{subtext}</p>}

          <div className="border shadow-[inset_0_0_20px_rgba(255,0,0,0.1)] border-red-900 rounded-none p-5 mb-8 bg-black">
            <p className="text-[10px] text-red-500 font-mono uppercase tracking-[0.2em] mb-3 opacity-80">
              {captcha.instruction}
            </p>
            <div className={`font-dotmatrix text-center py-4 px-4 rounded-none bg-black border border-red-900 shadow-[0_0_10px_rgba(255,0,0,0.1)] ${
              captcha.type === 'phrase' ? 'text-white tracking-widest text-lg' : 'text-white text-3xl font-bold tracking-[0.2em]'
            }`}>
              {captcha.challenge}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(false); }}
              placeholder={captcha.type === 'phrase' ? 'TYPE THE PHRASE' : 'ENTER DECRYPTION KEY'}
              className={`w-full bg-transparent border-t-0 border-x-0 border-b-2 py-3 px-2 outline-none font-dotmatrix text-center text-red-500 text-xl placeholder:text-red-900/40 uppercase tracking-widest ${
                error ? 'border-red-500 animate-pulse' : 'border-red-900 focus:border-red-500 focus:shadow-[0_5px_15px_-5px_rgba(255,0,0,0.3)] transition-all'
              }`}
              autoComplete="off"
              spellCheck="false"
            />
            
            <div className="h-6 flex items-center justify-center mt-2">
              {error && (
                <p className="text-[10px] font-mono text-red-500 animate-glitch uppercase tracking-widest">
                  ACCESS DENIED. SEQUENCE RESET.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!input.trim()}
              className="w-full mt-2 py-4 justify-center bg-transparent border border-red-500 text-red-500 font-dotmatrix uppercase tracking-widest text-lg hover:bg-red-500 hover:text-black hover:shadow-[0_0_15px_rgba(255,0,0,0.5)] transition-all duration-300 disabled:opacity-20 disabled:cursor-not-allowed"
            >
              VERIFY & DISMISS
            </button>
          </form>

          <p className="text-[10px] text-red-900 font-mono text-center mt-6 tracking-widest uppercase">
            SYSTEM LOCKED UNTIL SOLVED
          </p>
        </div>
      </div>
    </div>
  );
}
