import { useEffect, useRef } from 'react';

const GRID_SPACING = 14;
const DOT_RADIUS = 0.8;
const REPEL_RADIUS = 120;
const REPEL_STRENGTH = 18;
const SPRING_STIFFNESS = 0.08;
const DAMPING = 0.85;
const DOT_COLOR = 'rgba(255, 255, 255, 0.12)';

export default function ReactiveGrid() {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const dotsRef = useRef([]);
  const rafRef = useRef(null);
  const resizeObserverRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const initDots = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * window.devicePixelRatio;
      canvas.height = h * window.devicePixelRatio;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);

      const cols = Math.ceil(w / GRID_SPACING) + 1;
      const rows = Math.ceil(h / GRID_SPACING) + 1;
      const dots = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const ox = c * GRID_SPACING;
          const oy = r * GRID_SPACING;
          dots.push({ ox, oy, x: ox, y: oy, vx: 0, vy: 0 });
        }
      }
      dotsRef.current = dots;
    };

    initDots();

    const handleMouseMove = (e) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };

    const handleMouseLeave = () => {
      mouseRef.current.x = -9999;
      mouseRef.current.y = -9999;
    };

    const animate = () => {
      const w = parseFloat(canvas.style.width);
      const h = parseFloat(canvas.style.height);
      ctx.clearRect(0, 0, w, h);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const dots = dotsRef.current;
      const rSq = REPEL_RADIUS * REPEL_RADIUS;

      for (let i = 0, len = dots.length; i < len; i++) {
        const dot = dots[i];

        // Repulsion from cursor
        const dx = dot.x - mx;
        const dy = dot.y - my;
        const distSq = dx * dx + dy * dy;

        if (distSq < rSq && distSq > 0.01) {
          const dist = Math.sqrt(distSq);
          const force = (1 - dist / REPEL_RADIUS) * REPEL_STRENGTH;
          dot.vx += (dx / dist) * force;
          dot.vy += (dy / dist) * force;
        }

        // Spring back to origin
        dot.vx += (dot.ox - dot.x) * SPRING_STIFFNESS;
        dot.vy += (dot.oy - dot.y) * SPRING_STIFFNESS;

        // Damping
        dot.vx *= DAMPING;
        dot.vy *= DAMPING;

        // Integrate
        dot.x += dot.vx;
        dot.y += dot.vy;
      }

      // Batch draw
      ctx.fillStyle = DOT_COLOR;
      ctx.beginPath();
      for (let i = 0, len = dots.length; i < len; i++) {
        const dot = dots[i];
        ctx.moveTo(dot.x + DOT_RADIUS, dot.y);
        ctx.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2);
      }
      ctx.fill();

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    // Handle resize
    resizeObserverRef.current = new ResizeObserver(() => {
      initDots();
    });
    resizeObserverRef.current.observe(document.body);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    />
  );
}
