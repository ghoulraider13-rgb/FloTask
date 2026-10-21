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

  const getDocHeight = () => Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight,
    window.innerHeight
  );

  const getDocWidth = () => Math.max(
    document.body.scrollWidth,
    document.documentElement.scrollWidth,
    window.innerWidth
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const initDots = () => {
      const w = getDocWidth();
      const h = getDocHeight();
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
      // Convert viewport coordinates to document coordinates
      mouseRef.current.x = e.clientX + window.scrollX;
      mouseRef.current.y = e.clientY + window.scrollY;
    };

    const handleMouseLeave = () => {
      mouseRef.current.x = -9999;
      mouseRef.current.y = -9999;
    };

    const handleScroll = () => {
      // Re-initialize dots when document height changes significantly
      // (debounced via requestAnimationFrame in animate loop)
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

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Handle resize and content changes
    const checkResize = () => {
      const newW = getDocWidth();
      const newH = getDocHeight();
      const curW = parseFloat(canvas.style.width);
      const curH = parseFloat(canvas.style.height);
      if (Math.abs(newW - curW) > 2 || Math.abs(newH - curH) > 2) {
        initDots();
      }
    };

    resizeObserverRef.current = new ResizeObserver(checkResize);
    resizeObserverRef.current.observe(document.body);
    resizeObserverRef.current.observe(document.documentElement);

    // Also check on scroll for dynamic content
    let scrollCheckTimer = null;
    const debouncedCheck = () => {
      clearTimeout(scrollCheckTimer);
      scrollCheckTimer = setTimeout(checkResize, 150);
    };
    window.addEventListener('scroll', debouncedCheck, { passive: true });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', debouncedCheck);
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
      clearTimeout(scrollCheckTimer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    />
  );
}