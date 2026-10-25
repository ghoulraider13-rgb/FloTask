import { useState, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { playGentleChime } from '../utils/audioHelpers';
import { safeUuid } from '../utils/taskHelpers';

/**
 * HydrationTracker — Monochrome Glyph inspired hydration tracking.
 * Features:
 * - Segmented circular progress (14 discrete LED-style segments)
 * - Vertical fluid chamber meter
 * - Circadian taper timeline
 * - Quick dose matrix (tactile mechanical grid)
 * - Historical packets log
 * - Cut-off countdown banner
 */
const QUICK_AMOUNTS = [250, 500, 200, 350]; // ml - matching Stitch: H2O, Electrolytes, Chrono-Tea, Amino Boost
const QUICK_LABELS = ['H2O', 'ION', 'THEA', 'BCAA'];
const QUICK_ICONS = ['water_drop', 'electric_bolt', 'local_cafe', 'science'];
const QUICK_COLORS = ['#00dbe9', '#fe9800', '#ffb4ab', '#00dbe9']; // tertiary, secondary, primary, tertiary
const DEFAULT_GOAL = 2800; // ml - matching Stitch

// Monochrome Glyph color tokens
const COLORS = {
  surface: '#121414',
  'surface-dim': '#121414',
  'surface-bright': '#383939',
  'surface-container-lowest': '#0d0e0f',
  'surface-container-low': '#1b1c1c',
  'surface-container': '#1f2020',
  'surface-container-high': '#292a2a',
  'surface-container-highest': '#343535',
  'on-surface': '#e3e2e2',
  'on-surface-variant': '#a0a0a0',
  outline: '#555555',
  'outline-variant': '#333333',
  primary: '#ffffff',
  'on-primary': '#000000',
  'primary-container': '#e0e0e0',
  secondary: '#cccccc',
  'on-secondary': '#000000',
  'secondary-container': '#aaaaaa',
  tertiary: '#ffffff',
  'on-tertiary': '#000000',
  'tertiary-container': '#e0e0e0',
  error: '#ffffff',
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Segmented Circular Progress (14 discrete segments)
function SegmentedCircularProgress({ progress, size = 200, strokeWidth = 8, color, trackColor, children, className = '' }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const segments = 14;
  const activeSegments = Math.round((progress / 100) * segments);

  return (
    <svg width={size} height={size} className={className} style={{ transform: 'rotate(-90deg)' }}>
      <g>
        {Array.from({ length: segments }, (_, i) => {
          const angle = (i / segments) * 360;
          const isActive = i < activeSegments;
          const segmentColor = isActive ? color : trackColor;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segmentColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${circumference / segments} ${circumference}`}
              strokeDashoffset={- (circumference / segments) * i}
              style={{
                transition: 'stroke 0.3s ease',
                filter: isActive ? `drop-shadow(0 0 4px ${color})` : 'none',
              }}
            />
          );
        })}
      </g>
      {children && (
        <g style={{ transform: 'rotate(90deg)' }}>
          <foreignObject x={0} y={0} width={size} height={size}>
            <div className="flex items-center justify-center" style={{ width: size, height: size }}>
              {children}
            </div>
          </foreignObject>
        </g>
      )}
    </svg>
  );
}

// Glass Card Component
function GlassCard({ children, className = '', variant = 'default', glow = false, style = {} }) {
  const baseStyles = {
    background: variant === 'elevated'
      ? 'rgba(25, 28, 28, 0.85)'
      : 'rgba(19, 30, 53, 0.65)',
    backdropFilter: 'blur(20px)',
    border: `1px solid ${glow ? COLORS.primary : COLORS.outline}`,
    borderRadius: '1rem',
    boxShadow: glow
      ? `0 0 20px -4px ${COLORS.primary}40, 0 8px 28px -4px rgba(0,0,0,0.5)`
      : '0 8px 28px -4px rgba(0,0,0,0.5)',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
  };
  return (
    <div
      className={`flex flex-col ${className}`}
      style={{
        ...baseStyles,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Quick Dose Pill Component (Tactile Mechanical Grid)
function QuickDosePill({ amount, label, icon, color, isSelected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative p-4 rounded-xl text-left flex flex-col justify-between h-32 transition-colors duration-75 overflow-hidden"
      style={{
        background: isSelected ? 'rgba(255, 180, 171, 0.12)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isSelected ? COLORS.primary : COLORS.outline}`,
      }}
    >
      <div className="flex justify-between items-start w-full">
        <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)', color: isSelected ? color : COLORS['on-surface-variant'] }}>
          <span className="material-symbols-outlined text-[16px]">{icon}</span>
        </div>
        <span className="font-label-sm text-label-sm" style={{ color: isSelected ? COLORS['on-surface'] : COLORS['on-surface-variant'] }}>
          #{label}
        </span>
      </div>
      <div className="flex flex-col">
        <span className="font-label-sm text-label-sm uppercase whitespace-normal break-all leading-tight" style={{ color: COLORS['on-surface-variant'] }}>
          {label === 'H2O' ? 'PURE WATER' : label === 'ION' ? 'ELECTROLYTES' : label === 'THEA' ? 'CHRONO-TEA' : 'AMINO BOOST'
          }</span>
        <span className="font-title-md text-title-md" style={{ color: isSelected ? color : COLORS['on-surface'], textShadow: isSelected ? `0 0 8px ${color}80` : 'none' }}>
          +{amount} ML
        </span>
      </div>
    </button>
  );
}

// History Entry Component
function HistoryEntry({ entry, onDelete, index }) {
  return (
    <div
      className="flex items-center justify-between p-3 rounded transition-all"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${COLORS.outline}`,
        animation: 'smoothFadeIn 0.2s ease-out forwards',
        animationDelay: `${index * 30}ms`,
        opacity: 0,
      }}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${COLORS.outline}`,
        }}>
          <span className="material-symbols-outlined text-[20px]" style={{ color: COLORS['on-surface'] }}>
            water_drop
          </span>
        </div>
        <div>
          <div className="text-sm font-semibold" style={{ color: COLORS['on-surface'] }}>
            {entry.amount} ml
          </div>
          <div className="text-xs" style={{ color: COLORS['on-surface-variant'] }}>
            {fmtTime(entry.time)}
          </div>
        </div>
      </div>
      <button
        onClick={() => onDelete(entry.id)}
        className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${COLORS.outline}`,
          color: COLORS['on-surface-variant'],
        }}
        aria-label={`Remove ${entry.amount} ml`}
      >
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
}

export default function HydrationTracker() {
  const [goal, setGoal] = useLocalStorage('hydration-goal', DEFAULT_GOAL);
  const [intake, setIntake] = useLocalStorage('hydration-intake', []);
  const [customAmount, setCustomAmount] = useState('');
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');
  const [lastAdded, setLastAdded] = useState(null);

  // Today's entries (filtered by date key)
  const today = todayKey();
  const todayEntries = intake.filter(
    (e) => (e.date || today) === today
  );
  const totalToday = todayEntries.reduce((sum, e) => sum + e.amount, 0);
  const progress = Math.min(100, (totalToday / goal) * 100);
  const remaining = Math.max(0, goal - totalToday);

  const addIntake = useCallback((amount) => {
    if (!amount || amount <= 0) return;
    playGentleChime();
    const entry = {
      id: safeUuid ? safeUuid() : `h_${Date.now()}`,
      amount,
      date: today,
      time: new Date().toISOString(),
    };
    setIntake((prev) => [entry, ...prev]);
    setLastAdded(amount);
    setTimeout(() => setLastAdded(null), 800);
  }, [today, setIntake]);

  const handleQuickAdd = (ml) => () => addIntake(ml);

  const handleCustomAdd = (e) => {
    e.preventDefault();
    const amt = parseInt(customAmount, 10);
    if (!amt || amt <= 0) return;
    addIntake(amt);
    setCustomAmount('');
  };

  const handleDelete = (id) => {
    playGentleChime();
    setIntake((prev) => prev.filter((e) => e.id !== id));
  };

  const handleGoalSave = (e) => {
    e.preventDefault();
    const g = parseInt(goalDraft, 10);
    if (!g || g <= 0) return;
    setGoal(g);
    setShowGoalForm(false);
    setGoalDraft('');
  };

  const resetGoal = () => {
    playGentleChime();
    setGoal(DEFAULT_GOAL);
    setShowGoalForm(false);
    setGoalDraft('');
  };

  // Cut-off countdown (20:30 cutoff)
  const now = new Date();
  const cutoff = new Date();
  cutoff.setHours(20, 30, 0, 0);
  let cutoffDiff = cutoff - now;
  if (cutoffDiff < 0) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(20, 30, 0, 0);
    cutoffDiff = tomorrow - now;
  }
  const cutoffHours = Math.floor(cutoffDiff / (1000 * 60 * 60));
  const cutoffMinutes = Math.floor((cutoffDiff % (1000 * 60 * 60)) / (1000 * 60));
  const cutoffSeconds = Math.floor((cutoffDiff % (1000 * 60)) / 1000);
  const cutoffStr = `${String(cutoffHours).padStart(2, '0')}:${String(cutoffMinutes).padStart(2, '0')}:${String(cutoffSeconds).padStart(2, '0')}`;

  // Weekly stats
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekEntries = intake.filter(e => new Date(e.date) >= weekAgo);
  const weekTotal = weekEntries.reduce((sum, e) => sum + e.amount, 0);
  const weekAvg = weekEntries.length > 0 ? Math.round(weekTotal / 7) : 0;

  return (
    <div className="flex flex-col relative h-full" style={{ background: COLORS['surface-container-lowest'], minHeight: '100%' }}>
      {/* Ambient background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255,180,171,0.08) 0%, transparent 70%),
            radial-gradient(ellipse 60% 40% at 0% 100%, rgba(0,219,233,0.04) 0%, transparent 60%)
          `,
        }}
      />

      <div className="relative z-10 flex flex-col h-full p-4 sm:p-6 gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold tracking-widest uppercase" style={{ color: COLORS['on-surface-variant'] }}>
              HYDRA-04
            </h2>
            <p className="text-xs mt-1" style={{ color: COLORS['on-surface-variant'] }}>
              MODULE // HYDRATION TRACKER
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              playGentleChime();
              setShowGoalForm((v) => !v);
              setGoalDraft(String(goal));
            }}
            className="text-xs font-mono px-3 py-1.5 rounded-full transition-colors"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${COLORS.outline}`,
              color: COLORS['on-surface-variant'],
            }}
            title="Edit daily goal"
          >
            Goal: {goal} ml
          </button>
        </div>

        {/* Goal form (inline, toggles open) */}
        {showGoalForm && (
          <form onSubmit={handleGoalSave} className="flex flex-col sm:flex-row items-end gap-3 transition-all duration-300">
            <div className="flex-1">
              <label className="text-xs font-medium tracking-wider uppercase mb-1.5 block" style={{ color: COLORS['on-surface-variant'] }}>
                Daily Goal (ml)
              </label>
              <input
                type="number"
                min={200}
                max={10000}
                step={50}
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border transition-all text-sm"
                style={{
                  background: 'rgba(13,14,15,0.6)',
                  borderColor: COLORS.primary,
                  color: COLORS['on-surface'],
                  outline: 'none',
                }}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!goalDraft}
                className="px-6 py-3 rounded-xl font-semibold tracking-wide transition-colors"
                style={{
                  background: 'linear-gradient(135deg, #ffffff, #e0e0e0)',
                  color: COLORS['on-primary'],
                  boxShadow: '0 0 12px rgba(255,255,255,0.2)',
                }}
              >
                SET
              </button>
              <button
                type="button"
                onClick={resetGoal}
                className="px-6 py-3 rounded-xl font-medium transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${COLORS.outline}`,
                  color: COLORS['on-surface-variant'],
                }}
              >
                RESET
              </button>
            </div>
          </form>
        )}

        {/* TOP TELEMETRY STATUS BAR */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
            <span className="font-label-sm text-label-sm uppercase tracking-widest" style={{ color: COLORS['on-surface-variant'] }}>
              MODULE // HYDRA-04
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-0.5 rounded" style={{ background: COLORS['surface-container-high'] }}>
            <span className="material-symbols-outlined text-secondary text-[13px]">bolt</span>
            <span className="font-label-sm text-label-sm tracking-wider" style={{ color: COLORS['on-surface'] }}>
              SYSTEM: OPTIMAL
            </span>
          </div>
        </div>

        {/* CORE METRIC READOUT PANEL */}
        <GlassCard className="p-6" glow={progress >= 100}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-label-sm text-label-sm uppercase tracking-widest" style={{ color: COLORS['on-surface-variant'] }}>
                INTAKE TOTAL
              </span>
              <span className="font-label-sm text-label-sm" style={{ color: COLORS['on-surface'] }}>
                #01
              </span>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: COLORS['surface-container-highest'] }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS.secondary }}></span>
              <span className="font-label-sm text-label-sm tracking-widest" style={{ color: COLORS['on-surface-variant'] }}>
                {Math.round(progress)}%
              </span>
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-4">
            <div className="flex items-baseline gap-1">
              <span className="font-headline-xl" style={{ fontSize: '44px', fontWeight: 700, color: COLORS['on-surface'] }}>
                {totalToday.toLocaleString()}
              </span>
              <span className="font-label-md text-label-md" style={{ color: COLORS['on-surface-variant'] }}>
                / {goal.toLocaleString()}
              </span>
            </div>
            <span className="font-label-md text-label-md uppercase" style={{ color: COLORS['on-surface-variant'] }}>
              ML_NET
            </span>
          </div>

          {/* TACTILE SEGMENTED GAUGE STRIP */}
          <div className="flex flex-col gap-1.5 mt-4">
            <div className="grid grid-cols-14 gap-1 w-full h-3">
              {Array.from({ length: 14 }, (_, i) => (
                <div
                  key={i}
                  className="h-full rounded-none"
                  style={{
                    background: i < Math.round(progress / 100 * 14)
                      ? (i < 7 ? COLORS['on-surface'] : COLORS['on-surface-variant'])
                      : COLORS['surface-container-highest'],
                  }}
                />
              ))}
            </div>
            <div className="flex justify-between font-label-sm text-label-sm" style={{ color: COLORS['on-surface-variant'] }}>
              <span>0000</span>
              <span>{Math.floor(goal / 4).toLocaleString()}</span>
              <span>{Math.floor(goal / 2).toLocaleString()}</span>
              <span>{goal.toLocaleString()}</span>
            </div>
          </div>
        </GlassCard>

        {/* GLYPH TANK & CIRCADIAN TAPER SPLIT */}
        <div className="grid grid-cols-12 gap-4 items-stretch">
          {/* VERTICAL FLUID CHAMBER (Hardware column meter) */}
          <div className="col-span-5" style={{ background: COLORS['surface-container-low'], borderRadius: '1rem', border: `1px solid ${COLORS.outline}`, padding: '1.5rem' }}>
            <div className="flex items-center justify-between mb-4">
              <span className="font-label-sm text-label-sm tracking-wider" style={{ color: COLORS['on-surface-variant'] }}>
                CHAMBER
              </span>
              <span className="material-symbols-outlined" style={{ color: COLORS['on-surface-variant'] }}>
                graphic_eq
              </span>
            </div>
            {/* Segmented Vertical Bar Stack */}
            <div className="flex flex-col-reverse gap-1 py-1 w-full items-center flex-1">
              {Array.from({ length: 12 }, (_, i) => (
                <div
                  key={i}
                  className="w-full h-1.5"
                  style={{
                    background: i < Math.round(progress / 100 * 12)
                      ? (i < 7 ? COLORS['on-surface'] : COLORS['on-surface-variant'])
                      : COLORS['surface-container-highest'],
                  }}
                />
              ))}
            </div>
            <div className="flex flex-col gap-0.5 items-center">
              <span className="font-label-sm text-label-sm" style={{ color: COLORS['on-surface-variant'] }}>
                LEVEL
              </span>
              <span className="font-title-md text-title-md" style={{ color: COLORS['on-surface'] }}>
                {Math.round(progress)}%
              </span>
            </div>
          </div>

          {/* CIRCADIAN FLUID TIMELINE CARD */}
          <div className="col-span-7" style={{ background: COLORS['surface-container-low'], borderRadius: '1rem', border: `1px solid ${COLORS.outline}`, padding: '1.5rem' }}>
            <div className="flex items-center justify-between mb-4">
              <span className="font-label-sm text-label-sm tracking-wider" style={{ color: COLORS['on-surface-variant'] }}>
                CIRCADIAN TAPER
              </span>
              <div className="w-2 h-2 rounded-full" style={{ background: COLORS.secondary }}></div>
            </div>
            {/* Step SVG Line Diagram */}
            <div className="w-full py-1">
              <svg className="w-full h-14 overflow-visible" fill="none" viewBox="0 0 160 55">
                {/* Baseline and sleep boundary */}
                <line stroke={COLORS['surface-container-highest']} strokeDasharray="2 2" strokeWidth="1" x1="0" x2="160" y1="48" y2="48" />
                <line stroke={COLORS['on-surface']} strokeDasharray="1 3" strokeOpacity="0.4" strokeWidth="1" x1="120" x2="120" y1="0" y2="52" />
                {/* Stepped Intakes Curve */}
                <polyline
                  points="0,45 25,45 25,32 50,32 50,22 80,22 80,14 105,14 105,38 120,48 160,48"
                  stroke={COLORS['on-surface']}
                  strokeLinejoin="miter"
                  strokeWidth="2"
                />
                {/* Current Position Beacon */}
                <circle cx="105" cy="14" r="3" fill={COLORS['on-surface']} />
                <circle cx="105" cy="14" r="6" stroke={COLORS['on-surface']} strokeOpacity="0.4" strokeWidth="1" fill="none" />
              </svg>
            </div>
            <div className="flex items-center justify-between font-label-sm text-label-sm" style={{ color: COLORS['on-surface-variant'] }}>
              <span>08:00</span>
              <span className="text-secondary tracking-widest font-bold">20:30 CUTOFF</span>
              <span>23:00</span>
            </div>
          </div>
        </div>

        {/* CUT-OFF COUNTDOWN TELEMETRY BANNER */}
        <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: COLORS['surface-container'], border: `1px solid ${COLORS.outline}` }}>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary text-[24px]">bedtime</span>
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm uppercase tracking-widest" style={{ color: COLORS['on-surface-variant'] }}>
                HYDRA-HALT PROTOCOL
              </span>
              <span className="font-body-sm text-body-sm" style={{ color: COLORS['on-surface'] }}>
                Fluid taper active before delta sleep
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="font-label-sm text-label-sm" style={{ color: COLORS['on-surface-variant'] }}>
              T-MINUS
            </span>
            <span className="font-title-md text-title-md tracking-tight" style={{ color: COLORS['on-surface'] }}>
              {cutoffStr}
            </span>
          </div>
        </div>

        {/* QUICK LOG MATRIX: TACTILE MECHANICAL GRID */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-2">
            <span className="font-label-sm text-label-sm uppercase tracking-widest" style={{ color: COLORS['on-surface-variant'] }}>
              TACTILE DOSING MATRIX
            </span>
            <span className="font-label-sm text-label-sm" style={{ color: COLORS['on-surface-variant'], opacity: 0.6 }}>
              [ TAP TO REGISTER ]
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {QUICK_AMOUNTS.map((ml, i) => (
              <QuickDosePill
                key={ml}
                amount={ml}
                label={QUICK_LABELS[i]}
                icon={QUICK_ICONS[i]}
                color={QUICK_COLORS[i]}
                isSelected={lastAdded === ml}
                onClick={handleQuickAdd(ml)}
              />
            ))}
          </div>
        </div>

        {/* Custom Amount */}
        <form onSubmit={handleCustomAdd} className="flex gap-3">
          <div className="flex-1 relative">
            <label className="text-xs font-medium tracking-wider uppercase mb-1.5 block" style={{ color: COLORS['on-surface-variant'] }}>
              Custom Amount (ml)
            </label>
            <input
              type="number"
              min={50}
              max={2000}
              step={10}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder="Enter ml"
              className="w-full px-4 py-3 rounded-lg border transition-all text-sm"
              style={{
                background: 'rgba(13,14,15,0.6)',
                borderColor: COLORS.outline,
                color: COLORS['on-surface'],
                outline: 'none',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!customAmount}
            className="px-8 py-3 rounded-xl font-semibold tracking-wide transition-colors self-end"
            style={{
              background: 'linear-gradient(135deg, #ffffff, #e0e0e0)',
              color: COLORS['on-primary'],
              boxShadow: '0 0 12px rgba(255,255,255,0.2)',
              opacity: customAmount ? 1 : 0.5,
            }}
          >
            ADD
          </button>
        </form>

        {/* Today's Entries */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-label-sm text-label-sm uppercase tracking-widest" style={{ color: COLORS['on-surface-variant'] }}>
              HISTORICAL PACKETS
            </h3>
            <span className="font-label-sm text-label-sm" style={{ color: COLORS['on-surface-variant'] }}>
              LATEST {todayEntries.length}
            </span>
          </div>

          {todayEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center" style={{ color: COLORS['on-surface-variant'] }}>
              <span className="material-symbols-outlined text-6xl mb-4" style={{ opacity: 0.3 }}>
                water_drop
              </span>
              <p className="text-sm">No water logged yet</p>
              <p className="text-xs mt-1">Tap a quick dose or enter a custom amount</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {todayEntries.map((e, index) => (
                <HistoryEntry key={e.id} entry={e} onDelete={handleDelete} index={index} />
              ))}
            </div>
          )}
        </GlassCard>

        {/* Weekly Summary Card */}
        <GlassCard className="p-6" variant="elevated">
          <h3 className="font-label-sm text-label-sm uppercase tracking-widest mb-4" style={{ color: COLORS['on-surface-variant'] }}>
            WEEKLY OVERVIEW
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${COLORS.outline}` }}>
              <div className="text-2xl font-mono tabular-nums font-bold" style={{ color: COLORS['on-surface'] }}>
                {weekTotal.toLocaleString()}
              </div>
              <div className="text-xs tracking-wider uppercase mt-1" style={{ color: COLORS['on-surface-variant'] }}>
                Total this week
              </div>
            </div>
            <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${COLORS.outline}` }}>
              <div className="text-2xl font-mono tabular-nums font-bold" style={{ color: COLORS['on-surface-variant'] }}>
                {weekAvg.toLocaleString()}
              </div>
              <div className="text-xs tracking-wider uppercase mt-1" style={{ color: COLORS['on-surface-variant'] }}>
                Daily average
              </div>
            </div>
            <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${COLORS.outline}` }}>
              <div className="text-2xl font-mono tabular-nums font-bold" style={{ color: COLORS['on-surface'] }}>
                {weekEntries.length}
              </div>
              <div className="text-xs tracking-wider uppercase mt-1" style={{ color: COLORS['on-surface-variant'] }}>
                Log entries
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}