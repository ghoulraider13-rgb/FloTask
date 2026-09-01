import { useRef, useState, useEffect, useCallback } from 'react';
import { playMechanicalClick } from '../utils/audioHelpers';

const COLORS = ['#ffffff', '#22d3ee', '#a3e635', '#f472b6', '#fbbf24'];
const WIDTHS = [2, 4, 8];
const MAX_UNDO = 12;

/**
 * Freehand sketch surface for the scratchpad.
 * On INSERT the canvas is exported as a transparent PNG and
 * injected into the rich editor as an inline image.
 */
export default function DrawPad({ onInsert, onCancel }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPtRef = useRef(null);
  const undoStackRef = useRef([]);
  const sizeRef = useRef({ w: 0, h: 0 });

  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const [erasing, setErasing] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [canUndo, setCanUndo] = useState(false);

  // ── Canvas sizing (crisp on HiDPI, ink preserved across resizes) ──
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = canvas.parentElement;
    const resize = () => {
      const rect = wrapper.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return;
      const dpr = window.devicePixelRatio || 1;

      // Preserve existing ink: copy to an offscreen canvas first
      let off = null;
      if (canvas.width > 0 && sizeRef.current.w > 0) {
        off = document.createElement('canvas');
        off.width = canvas.width;
        off.height = canvas.height;
        off.getContext('2d').drawImage(canvas, 0, 0);
      }

      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (off) ctx.drawImage(off, 0, 0, sizeRef.current.w, sizeRef.current.h);
      sizeRef.current = { w: rect.width, h: rect.height };
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, []);

  // Esc closes the draw tool
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const getPt = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const snapshot = useCallback(() => {
    const canvas = canvasRef.current;
    const stack = undoStackRef.current;
    if (stack.length >= MAX_UNDO) stack.shift();
    stack.push(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height));
    setCanUndo(true);
  }, []);

  const strokeTo = (pt) => {
    const ctx = canvasRef.current.getContext('2d');
    const last = lastPtRef.current;
    if (!last) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = erasing ? width * 4 : width;
    ctx.strokeStyle = color;
    ctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    lastPtRef.current = pt;
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    snapshot();
    drawingRef.current = true;
    const pt = getPt(e);
    lastPtRef.current = pt;

    // Seed dot so single taps leave a mark
    const ctx = canvasRef.current.getContext('2d');
    ctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, (erasing ? width * 4 : width) / 2, 0, Math.PI * 2);
    ctx.fill();

    setHasInk(true);
  };

  const handlePointerMove = (e) => {
    if (!drawingRef.current) return;
    strokeTo(getPt(e));
  };

  const endStroke = () => {
    drawingRef.current = false;
    lastPtRef.current = null;
  };

  const handleUndo = () => {
    playMechanicalClick();
    const stack = undoStackRef.current;
    const snap = stack.pop();
    if (!snap) return;
    const canvas = canvasRef.current;
    canvas.getContext('2d').putImageData(snap, 0, 0);
    setCanUndo(stack.length > 0);
    if (stack.length === 0) setHasInk(false);
  };

  const handleClear = () => {
    playMechanicalClick();
    snapshot();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    setHasInk(false);
  };

  const handleInsert = () => {
    if (!hasInk) return;
    playMechanicalClick();
    onInsert(canvasRef.current.toDataURL('image/png'));
  };

  return (
    <div className="flex flex-col flex-1 min-h-[220px]">
      {/* ── Tool row ────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 px-5 py-2 border-b border-gray-800 flex-wrap">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => { playMechanicalClick(); setColor(c); setErasing(false); }}
            className={`w-5 h-5 rounded-full border transition-all duration-150 ${
              color === c && !erasing ? 'border-white scale-110' : 'border-gray-700 hover:border-gray-400'
            }`}
            style={{ backgroundColor: c }}
            title={`Pen ${c}`}
          />
        ))}
        <div className="w-px h-5 bg-gray-800 mx-1" />
        {WIDTHS.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => { playMechanicalClick(); setWidth(w); setErasing(false); }}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-all duration-200 ${
              width === w && !erasing ? 'bg-surface-3' : 'hover:bg-surface-3'
            }`}
            title={`Stroke ${w}px`}
          >
            <span
              className="rounded-full bg-gray-300"
              style={{ width: w + 2, height: w + 2, backgroundColor: color }}
            />
          </button>
        ))}
        <div className="w-px h-5 bg-gray-800 mx-1" />
        <button
          type="button"
          onClick={() => { playMechanicalClick(); setErasing((v) => !v); }}
          className={`px-2 h-7 rounded-md text-[9px] font-bold tracking-widest transition-all duration-200 ${
            erasing ? 'bg-white text-black' : 'text-gray-500 hover:text-white hover:bg-surface-3'
          }`}
          title="Eraser"
        >
          ERASE
        </button>
        <button
          type="button"
          onClick={handleUndo}
          disabled={!canUndo}
          className="px-2 h-7 rounded-md text-[9px] font-bold tracking-widest text-gray-500 hover:text-white hover:bg-surface-3 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Undo last stroke"
        >
          UNDO
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="px-2 h-7 rounded-md text-[9px] font-bold tracking-widest text-gray-500 hover:text-red-400 hover:bg-surface-3 transition-all duration-200"
          title="Clear canvas"
        >
          CLEAR
        </button>
      </div>

      {/* ── Canvas ──────────────────────────────────────────────── */}
      <div
        className="relative flex-1 min-h-[180px] max-h-[400px]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255, 255, 255, 0.06) 1px, transparent 1px)',
          backgroundSize: '14px 14px',
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair"
          style={{ touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
        />
      </div>

      {/* ── Actions ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800">
        <span className="text-[10px] text-gray-600 font-mono">SKETCH → PNG → NOTE</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { playMechanicalClick(); onCancel(); }}
            className="btn-pill px-4 py-1.5 text-[10px] text-gray-400 hover:text-white"
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={handleInsert}
            disabled={!hasInk}
            className="btn-pill px-5 py-1.5 text-[10px] bg-white text-black font-bold hover:bg-gray-200 border-transparent disabled:opacity-30 disabled:cursor-not-allowed"
          >
            INSERT
          </button>
        </div>
      </div>
    </div>
  );
}
