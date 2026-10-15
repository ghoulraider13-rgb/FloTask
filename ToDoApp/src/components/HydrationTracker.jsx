import { useState, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { playGentleChime } from '../utils/audioHelpers';
import { safeUuid } from '../utils/taskHelpers';

/**
 * HydrationTracker — SomnaFlow-inspired hydration tracking.
 * Features:
 * - Bioluminescent aqua themed circular progress
 * - Quick-dose pill selectors with glow states
 * - Glassmorphism cards with layered depth
 * - Daily/weekly history with animated entries
 * - Goal setting with atmospheric input
 */

const QUICK_AMOUNTS = [250, 500, 750, 1000]; // ml
const DEFAULT_GOAL = 2000; // ml

// Color tokens (SomnaFlow palette — Hydration, dulled for Nothing-OS harmony)
const COLORS = {
  // Primary: Muted Bioluminescent Aqua
  hydroPrimary: '#00F2FE',
  hydroPrimaryGlow: 'rgba(0, 242, 254, 0.15)',
  hydroPrimaryBorder: 'rgba(0, 242, 254, 0.18)',
  hydroPrimaryDim: '#00C4D6',
  hydroContainer: '#006A70',
  hydroOnContainer: '#002022',
  // Tertiary: Emerald Vitality (for achieved goals)
  vitality: '#10B981',
  vitalityGlow: 'rgba(16, 185, 129, 0.15)',
  // Surface tiers
  surface0: '#0F131D',
  surface1: '#131E35',
  surface2: '#1E2C4A',
  surface3: '#262A34',
  surfaceVariant: '#31353F',
  // Text
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  // Border
  borderSubtle: 'rgba(255,255,255,0.08)',
  borderActive: 'rgba(0,242,254,0.18)',
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// SVG Circular Progress Component
function CircularProgress({ progress, size = 200, strokeWidth = 8, color, trackColor, children, className = '' }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress / 100);
  const gradientId = `hydro-gradient-${color.replace('#', '')}`;

  return (
    <svg width={size} height={size} className={className} style={{ transform: 'rotate(-90deg)' }}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={color} stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Progress */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{
          transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
          filter: `drop-shadow(0 0 8px ${color})`,
        }}
      />
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
function GlassCard({ children, className = '', variant = 'default', glow = false, onClick, style = {} }) {
  const baseStyles = {
    background: variant === 'elevated'
      ? 'rgba(30, 44, 74, 0.85)'
      : 'rgba(19, 30, 53, 0.65)',
    backdropFilter: 'blur(20px)',
    border: `1px solid ${glow ? COLORS.hydroPrimaryBorder : COLORS.borderSubtle}`,
    borderRadius: '1.5rem',
    boxShadow: glow
      ? `0 0 20px -4px ${COLORS.hydroPrimaryGlow}, 0 8px 28px -4px rgba(0,0,0,0.5)`
      : '0 8px 28px -4px rgba(0,0,0,0.5)',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
  };
  return (
    <div
      className={`flex flex-col ${className}`}
      style={{
        ...baseStyles,
        ...style,
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// Quick Dose Pill Component
function QuickDosePill({ amount, isSelected, onClick }) {
  const isActive = isSelected;
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-6 py-3 rounded-full font-semibold text-sm tracking-wide flex items-center gap-2 transition-all duration-300"
      style={{
        background: isActive
          ? 'rgba(0, 242, 254, 0.12)'
          : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isActive ? COLORS.hydroPrimaryBorder : COLORS.borderSubtle}`,
        color: isActive ? COLORS.hydroPrimary : COLORS.textSecondary,
        boxShadow: isActive ? `0 0 12px ${COLORS.hydroPrimaryGlow}` : 'none',
        minWidth: '90px',
      }}
    >
      <span className="text-xs font-mono" style={{ color: isActive ? COLORS.hydroPrimary : COLORS.textMuted }}>
        +{amount}ml
      </span>
      {/* Always reserve space for the indicator to prevent layout shift */}
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{
          background: isActive ? COLORS.hydroPrimary : 'transparent',
          boxShadow: isActive ? `0 0 6px ${COLORS.hydroPrimaryGlow}` : 'none',
          opacity: isActive ? 1 : 0,
        }}
      />
    </button>
  );
}

// History Entry Component
function HistoryEntry({ entry, onDelete, index }) {
  return (
    <div
      className="flex items-center justify-between p-3 rounded-xl transition-all"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${COLORS.borderSubtle}`,
        animation: 'smoothFadeIn 0.2s ease-out forwards',
        animationDelay: `${index * 30}ms`,
        opacity: 0,
      }}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{
          background: `rgba(0, 242, 254, 0.12)`,
          border: `1px solid ${COLORS.hydroPrimaryBorder}`,
        }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: COLORS.hydroPrimary }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.66l.66.66c2.34 2.3 6.34 5.87 6.34 8.68 0 3.32-2.68 6-6 6s-6-2.68-6-6c0-2.81 4-6.38 6-8.68l.66-.66z" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>
            {entry.amount} ml
          </div>
          <div className="text-xs" style={{ color: COLORS.textMuted }}>
            {fmtTime(entry.time)}
          </div>
        </div>
      </div>
      <button
        onClick={() => onDelete(entry.id)}
        className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${COLORS.borderSubtle}`,
          color: COLORS.textMuted,
        }}
        aria-label={`Remove ${entry.amount} ml`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
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
    // Clear lastAdded after animation
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

  // Goal progress color
  const getProgressColor = () => {
    if (progress >= 100) return COLORS.vitality;
    if (progress >= 75) return '#F59E0B';
    return COLORS.hydroPrimary;
  };

  // Weekly stats
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekEntries = intake.filter(e => new Date(e.date) >= weekAgo);
  const weekTotal = weekEntries.reduce((sum, e) => sum + e.amount, 0);
  const weekAvg = weekEntries.length > 0 ? Math.round(weekTotal / 7) : 0;

  return (
    <div className="flex flex-col h-full" style={{ background: COLORS.surface0, minHeight: '100%' }}>
      {/* Ambient background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% 0%, rgba(0,242,254,0.08) 0%, transparent 70%),
            radial-gradient(ellipse 60% 40% at 0% 100%, rgba(16,185,129,0.04) 0%, transparent 60%)
          `,
        }}
      />

      <div className="relative z-10 flex flex-col h-full p-4 sm:p-6 gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold tracking-widest uppercase" style={{ color: COLORS.textSecondary }}>
              HYDRATION TRACKER
            </h2>
            <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
              Daily fluid intake • Quick logging • Weekly trends
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
              border: `1px solid ${COLORS.borderSubtle}`,
              color: COLORS.textSecondary,
            }}
            title="Edit daily goal"
          >
            Goal: {goal} ml
          </button>
        </div>

        {/* Goal form (inline, toggles open) */}
        {showGoalForm && (
          <form onSubmit={handleGoalSave} className="flex flex-col sm:flex-row items-end gap-3 transition-all duration-300" style={{ maxHeight: showGoalForm ? '200px' : '0' }}>
            <div className="flex-1">
              <label className="text-xs font-medium tracking-wider uppercase mb-1.5 block" style={{ color: COLORS.textSecondary }}>
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
                  background: 'rgba(13,20,36,0.6)',
                  borderColor: COLORS.hydroPrimaryBorder,
                  color: COLORS.textPrimary,
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
                  background: `linear-gradient(135deg, ${COLORS.hydroPrimary}, ${COLORS.hydroPrimaryDim})`,
                  color: '#0F131D',
                  boxShadow: `0 0 12px ${COLORS.hydroPrimaryGlow}`,
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
                  border: `1px solid ${COLORS.borderSubtle}`,
                  color: COLORS.textSecondary,
                }}
              >
                RESET
              </button>
            </div>
          </form>
        )}

        {/* Main Progress Card */}
        <GlassCard className="p-6 items-center text-center" glow={progress >= 100} style={{ maxWidth: '400px', margin: '0 auto' }}>
          <div className="mb-4 relative">
            <CircularProgress
              progress={progress}
              size={200}
              strokeWidth={12}
              color={getProgressColor()}
              trackColor={COLORS.borderSubtle}
              className={`filter transition-all duration-500 ${
                progress >= 100 ? `drop-shadow-[0_0_32px_${COLORS.vitalityGlow}]` : `drop-shadow-[0_0_24px_${COLORS.hydroPrimaryGlow}]`
              }`}
            >
              <div className="text-center">
                <div className="font-mono tabular-nums" style={{
                  fontSize: '48px',
                  fontWeight: 700,
                  lineHeight: 1,
                  color: COLORS.textPrimary,
                  textShadow: progress >= 100
                    ? `0 0 12px ${COLORS.vitalityGlow}`
                    : `0 0 12px ${COLORS.hydroPrimaryGlow}`,
                }}>
                  {Math.round(progress)}%
                </div>
                <div className="text-xs mt-1 tracking-wider uppercase" style={{ color: COLORS.textMuted }}>
                  of daily goal
                </div>
              </div>
            </CircularProgress>

            {/* Goal met animation — smooth glow, no jarring pulse */}
            {progress >= 100 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-60">
                <div className="w-32 h-32 rounded-full" style={{
                  background: `radial-gradient(circle, ${COLORS.vitalityGlow} 0%, transparent 70%)`,
                  animation: 'smoothPulse 1.5s ease-in-out infinite',
                }} />
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-6 text-center">
            <div>
              <div className="text-2xl font-mono tabular-nums" style={{ color: COLORS.textPrimary }}>
                {totalToday.toLocaleString()}
              </div>
              <div className="text-xs tracking-wider uppercase" style={{ color: COLORS.textMuted }}>
                consumed
              </div>
            </div>
            <div className="w-px h-8" style={{ background: `linear-gradient(180deg, transparent, ${COLORS.borderSubtle}, transparent)` }} />
            <div>
              <div className={`text-2xl font-mono tabular-nums transition-all duration-500 ${
                progress >= 100 ? 'text-green-400' : 'text-cyan-400'
              }`} style={{
                color: progress >= 100 ? COLORS.vitality : COLORS.hydroPrimary,
                textShadow: progress >= 100
                  ? `0 0 12px ${COLORS.vitalityGlow}`
                  : `0 0 12px ${COLORS.hydroPrimaryGlow}`,
              }}>
                {progress >= 100 ? '✓' : remaining.toLocaleString()}
              </div>
              <div className="text-xs tracking-wider uppercase" style={{ color: COLORS.textMuted }}>
                {progress >= 100 ? 'GOAL MET' : 'remaining'}
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Quick Dose Selectors */}
        <GlassCard className="p-6">
          <h3 className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: COLORS.textSecondary }}>
            QUICK LOG
          </h3>
          <div className="flex flex-wrap gap-3 justify-center">
            {QUICK_AMOUNTS.map((ml) => (
              <QuickDosePill
                key={ml}
                amount={ml}
                isSelected={lastAdded === ml}
                onClick={handleQuickAdd(ml)}
              />
            ))}
          </div>
        </GlassCard>

        {/* Custom Amount */}
        <form onSubmit={handleCustomAdd} className="flex gap-3">
          <div className="flex-1 relative">
            <label className="text-xs font-medium tracking-wider uppercase mb-1.5 block" style={{ color: COLORS.textSecondary }}>
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
                background: 'rgba(13,20,36,0.6)',
                borderColor: COLORS.borderSubtle,
                color: COLORS.textPrimary,
                outline: 'none',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!customAmount}
            className="px-8 py-3 rounded-xl font-semibold tracking-wide transition-colors self-end"
            style={{
              background: `linear-gradient(135deg, ${COLORS.hydroPrimary}, ${COLORS.hydroPrimaryDim})`,
              color: '#0F131D',
              boxShadow: `0 0 12px ${COLORS.hydroPrimaryGlow}`,
              opacity: customAmount ? 1 : 0.5,
            }}
          >
            ADD
          </button>
        </form>

        {/* Today's Entries */}
        <GlassCard className="p-6 flex-1 min-h-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold tracking-widest uppercase" style={{ color: COLORS.textSecondary }}>
              TODAY'S LOG
            </h3>
            <span className="text-xs font-mono px-2 py-1 rounded-full" style={{
              background: 'rgba(0,242,254,0.12)',
              color: COLORS.hydroPrimary,
              border: `1px solid ${COLORS.hydroPrimaryBorder}`,
            }}>
              {todayEntries.length} entr{todayEntries.length !== 1 ? 'ies' : 'y'}
            </span>
          </div>

          {todayEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center" style={{ color: COLORS.textMuted }}>
              <svg className="w-12 h-12 mb-4 opacity-30" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.66l.66.66c2.34 2.3 6.34 5.87 6.34 8.68 0 3.32-2.68 6-6 6s-6-2.68-6-6c0-2.81 4-6.38 6-8.68l.66-.66z" />
              </svg>
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
          <h3 className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: COLORS.textSecondary }}>
            WEEKLY OVERVIEW
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-xl" style={{ background: 'rgba(0,242,254,0.08)', border: `1px solid ${COLORS.hydroPrimaryBorder}` }}>
              <div className="text-2xl font-mono tabular-nums font-bold" style={{ color: COLORS.hydroPrimary }}>
                {weekTotal.toLocaleString()}
              </div>
              <div className="text-xs tracking-wider uppercase mt-1" style={{ color: COLORS.textMuted }}>
                Total this week
              </div>
            </div>
            <div className="p-4 rounded-xl" style={{ background: 'rgba(16,185,129,0.08)', border: `1px solid rgba(16,185,129,0.25)` }}>
              <div className="text-2xl font-mono tabular-nums font-bold" style={{ color: COLORS.vitality }}>
                {weekAvg.toLocaleString()}
              </div>
              <div className="text-xs tracking-wider uppercase mt-1" style={{ color: COLORS.textMuted }}>
                Daily average
              </div>
            </div>
            <div className="p-4 rounded-xl" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)' }}>
              <div className="text-2xl font-mono tabular-nums font-bold" style={{ color: '#8B5CF6' }}>
                {weekEntries.length}
              </div>
              <div className="text-xs tracking-wider uppercase mt-1" style={{ color: COLORS.textMuted }}>
                Log entries
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}