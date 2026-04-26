import { useEffect } from 'react';

export default function AlarmModal({ title, subtext, onDismiss }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onDismiss} />
      <div className="relative z-10 w-full max-w-md mx-4 animate-fade-in">
        <div className="nothing-card p-8 text-center border-gray-500">
          <div className="w-16 h-16 rounded-full border-2 border-gray-500 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white tracking-wide uppercase mb-1">{title}</h2>
          {subtext && <p className="text-xs text-gray-500 mb-8 tracking-wider">{subtext}</p>}
          <button onClick={onDismiss} className="btn-pill-primary px-10 py-3">
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
}
