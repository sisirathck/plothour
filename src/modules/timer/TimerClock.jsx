import React, { useEffect, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';

/* ── Minimalist Horology Dial Artwork (Halo & Precision Guides) ── */
export const HorologyArt = ({ isRunning }) => {
  return (
    <svg
      className={`horology-halo-svg${isRunning ? ' is-active' : ''}`}
      viewBox="0 0 460 460"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="haloAmbientGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--sd-coral)" stopOpacity="0.12" />
          <stop offset="65%" stopColor="var(--sd-coral)" stopOpacity="0.02" />
          <stop offset="100%" stopColor="var(--sd-coral)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Atmospheric radial ambient light */}
      <circle cx="230" cy="230" r="225" fill="url(#haloAmbientGlow)" />

      {/* Outer guide ring with fine dashes */}
      <circle
        cx="230"
        cy="230"
        r="215"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.75"
        strokeDasharray="2 6"
        opacity="0.22"
        className="halo-orbit outer"
      />

      {/* Inner guide ring */}
      <circle
        cx="230"
        cy="230"
        r="185"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.16"
        className="halo-orbit inner"
      />

      {/* Cardinal crosshair tick extensions */}
      <line x1="230" y1="6" x2="230" y2="24" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
      <line x1="230" y1="436" x2="230" y2="454" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
      <line x1="6" y1="230" x2="24" y2="230" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
      <line x1="436" y1="230" x2="454" y2="230" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />

      {/* Cardinal Degree labels */}
      <text x="230" y="36" textAnchor="middle" className="halo-deg-label" opacity="0.4">
        000°
      </text>
      <text x="424" y="233" textAnchor="start" className="halo-deg-label" opacity="0.4">
        090°
      </text>
      <text x="230" y="430" textAnchor="middle" className="halo-deg-label" opacity="0.4">
        180°
      </text>
      <text x="36" y="233" textAnchor="end" className="halo-deg-label" opacity="0.4">
        270°
      </text>
    </svg>
  );
};

/* ── Swiss Luxury Analogue Clock (Idle State) ── */
export const AnalogueClockFace = ({ now }) => {
  const canvasRef = useRef(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 2;
    const S = 280;
    canvas.width = S * dpr;
    canvas.height = S * dpr;
    canvas.style.width = `${S}px`;
    canvas.style.height = `${S}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const isDark = theme === 'dark';
    const darkAccent = '#62b08f';
    const accentColor = isDark ? darkAccent : '#8086d4';
    const cx = S / 2;
    const cy = S / 2;
    const R = S / 2 - 12;

    ctx.clearRect(0, 0, S, S);

    // 1. Dial Physical Case & Subtle Shadow
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);

    if (isDark) {
      // Obsidian titanium gradient
      const dialGrad = ctx.createRadialGradient(cx, cy - 20, 10, cx, cy, R);
      dialGrad.addColorStop(0, '#22262b');
      dialGrad.addColorStop(0.68, '#131619');
      dialGrad.addColorStop(1, '#0b0d12');
      ctx.fillStyle = dialGrad;
      ctx.fill();

      // Outer bezel ring
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      // Porcelain luxury white gradient
      const dialGrad = ctx.createRadialGradient(cx, cy - 30, 20, cx, cy, R);
      dialGrad.addColorStop(0, '#ffffff');
      dialGrad.addColorStop(1, '#f8f8fb');
      ctx.fillStyle = dialGrad;
      ctx.fill();

      // Outer bezel ring
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();

    // 2. Bezel Inner Track
    ctx.beginPath();
    ctx.arc(cx, cy, R - 8, 0, Math.PI * 2);
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 3. 60 Minute / Hour Marks
    for (let i = 0; i < 60; i++) {
      const a = (i * 6 - 90) * (Math.PI / 180);
      const isHour = i % 5 === 0;
      const isCardinal = i % 15 === 0;

      const len = isCardinal ? 12 : isHour ? 9 : 4.5;
      const r1 = R - 10 - len;
      const r2 = R - 10;

      ctx.beginPath();
      ctx.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
      ctx.lineTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a));

      ctx.strokeStyle = isCardinal
        ? (isDark ? '#f9fafb' : '#111827')
        : isHour
        ? (isDark ? 'rgba(255, 255, 255, 0.65)' : 'rgba(17, 24, 39, 0.65)')
        : (isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(17, 24, 39, 0.2)');
      ctx.lineWidth = isCardinal ? 2.2 : isHour ? 1.6 : 1;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // 4. Swiss Hour Numerals: 12, 3, 6, 9
    ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isDark ? '#f9fafb' : '#111827';

    const numRadius = R - 36;
    ctx.fillText('12', cx, cy - numRadius);
    ctx.fillText('3', cx + numRadius, cy);
    ctx.fillText('6', cx, cy + numRadius);
    ctx.fillText('9', cx - numRadius, cy);

    // 5. Time Calculations
    const ms = now.getMilliseconds();
    const sec = now.getSeconds() + ms / 1000;
    const min = now.getMinutes() + sec / 60;
    const hour = (now.getHours() % 12) + min / 60;

    // Helper to draw tapered hands
    const drawHand = (deg, length, width, color, tail = 0) => {
      const a = (deg - 90) * (Math.PI / 180);
      ctx.save();
      ctx.beginPath();
      if (tail > 0) {
        ctx.moveTo(cx - tail * Math.cos(a), cy - tail * Math.sin(a));
      } else {
        ctx.moveTo(cx, cy);
      }
      ctx.lineTo(cx + length * Math.cos(a), cy + length * Math.sin(a));
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    };

    const handPrimary = isDark ? '#f9fafb' : '#111827';

    // Hour hand
    drawHand(hour * 30, R * 0.46, 4.2, handPrimary, 12);
    // Minute hand
    drawHand(min * 6, R * 0.68, 2.8, handPrimary, 16);
    // Second hand (coral needle with counterbalance ring)
    drawHand(sec * 6, R * 0.82, 1.4, accentColor, 24);

    // Second hand counterbalance eyelet
    const secRad = (sec * 6 - 90) * (Math.PI / 180);
    const eyeletX = cx - 14 * Math.cos(secRad);
    const eyeletY = cy - 14 * Math.sin(secRad);
    ctx.beginPath();
    ctx.arc(eyeletX, eyeletY, 3, 0, Math.PI * 2);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Center hub pip
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = accentColor;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? '#0a0e17' : '#ffffff';
    ctx.fill();
  }, [now, theme]);

  return <canvas ref={canvasRef} className="horology-clock-canvas" />;
};

/* ── Precision Chronograph Stopwatch (Active Timer State) ── */
export const StopwatchFace = ({ elapsed, isRunning, targetSeconds, size = 280, compact = false }) => {
  const canvasRef = useRef(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 2;
    const S = size;
    canvas.width = S * dpr;
    canvas.height = S * dpr;
    canvas.style.width = `${S}px`;
    canvas.style.height = `${S}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const isDark = theme === 'dark';
    const darkAccent = '#62b08f';
    const accentColor = isDark ? darkAccent : '#8086d4';
    const cx = S / 2;
    const cy = S / 2;
    const scale = S / 280;
    const R = S / 2 - Math.max(6, 12 * scale);

    ctx.clearRect(0, 0, S, S);

    // 1. Dial Physical Case
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);

    if (isDark) {
      const dialGrad = ctx.createRadialGradient(cx, cy - 20, 10, cx, cy, R);
      dialGrad.addColorStop(0, '#131b2c');
      dialGrad.addColorStop(1, '#0a0e17');
      ctx.fillStyle = dialGrad;
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      const dialGrad = ctx.createRadialGradient(cx, cy - 30, 20, cx, cy, R);
      dialGrad.addColorStop(0, '#ffffff');
      dialGrad.addColorStop(1, '#f8f8fb');
      ctx.fillStyle = dialGrad;
      ctx.fill();

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.09)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();

    // 2. High-Precision 300-Tick Chronometer Scale (1/5 second resolution)
    for (let i = 0; i < 300; i++) {
      const a = (i * 1.2 - 90) * (Math.PI / 180);
      const isSecond = i % 5 === 0;
      const isMajor = i % 25 === 0; // Every 5 seconds

      const len = (isMajor ? 11 : isSecond ? 6 : 3) * scale;
      const r1 = R - 10 - len;
      const r2 = R - 10;

      ctx.beginPath();
      ctx.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
      ctx.lineTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a));

      ctx.strokeStyle = isMajor
        ? (isDark ? '#f9fafb' : '#111827')
        : isSecond
        ? (isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(17, 24, 39, 0.55)')
        : (isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(17, 24, 39, 0.16)');
      ctx.lineWidth = (isMajor ? 1.8 : 1) * Math.max(.72, scale);
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // 3. Chronograph Numbers (05, 10, 15... 60)
    ctx.font = `700 ${Math.max(5.5, 9 * scale)}px -apple-system, BlinkMacSystemFont, "Inter", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isDark ? '#f9fafb' : '#111827';

    for (let s = 5; s <= 60; s += 5) {
      const a = (s * 6 - 90) * (Math.PI / 180);
      const numR = R - 28 * scale;
      const nx = cx + numR * Math.cos(a);
      const ny = cy + numR * Math.sin(a);
      ctx.fillText(String(s).padStart(2, '0'), nx, ny);
    }

    // 4. Elapsed Dynamic Circular Progress Track
    if (elapsed > 0 && targetSeconds > 0) {
      const maxSeconds = targetSeconds;
      const progressFraction = Math.min(1, elapsed / maxSeconds);
      ctx.beginPath();
      ctx.arc(cx, cy, R - 38, -Math.PI / 2, -Math.PI / 2 + progressFraction * Math.PI * 2);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = Math.max(2, 3.5 * scale);
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // 5. Upper 30-Minute Chronograph Sub-Dial
    const subCx = cx;
    const subCy = cy - 46 * scale;
    const subR = 27 * scale;

    ctx.beginPath();
    ctx.arc(subCx, subCy, subR, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)';
    ctx.fill();
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Sub-dial ticks & markers: 0, 10, 20, 30
    for (let m = 0; m < 30; m += 5) {
      const sa = (m * 12 - 90) * (Math.PI / 180);
      ctx.beginPath();
      ctx.moveTo(subCx + (subR - 4) * Math.cos(sa), subCy + (subR - 4) * Math.sin(sa));
      ctx.lineTo(subCx + subR * Math.cos(sa), subCy + subR * Math.sin(sa));
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(17, 24, 39, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.font = `600 ${Math.max(4.5, 7 * scale)}px -apple-system, sans-serif`;
    ctx.fillStyle = isDark ? '#f9fafb' : '#111827';
    ctx.fillText('30', subCx, subCy - subR + 8);
    ctx.fillText('15', subCx, subCy + subR - 8);

    // Sub-dial minute needle
    const elapsedMinutes = (elapsed / 60) % 30;
    const subRad = (elapsedMinutes * 12 - 90) * (Math.PI / 180);
    ctx.beginPath();
    ctx.moveTo(subCx, subCy);
    ctx.lineTo(subCx + (subR - 6) * Math.cos(subRad), subCy + (subR - 6) * Math.sin(subRad));
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = Math.max(1, 1.6 * scale);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(subCx, subCy, Math.max(1.5, 2.5 * scale), 0, Math.PI * 2);
    ctx.fillStyle = accentColor;
    ctx.fill();

    // 6. Main Sweeping Chronograph Second Hand
    const secondsInMinute = elapsed % 60;
    const secRad = (secondsInMinute * 6 - 90) * (Math.PI / 180);

    ctx.beginPath();
    // Counterbalance tail
    ctx.moveTo(cx - 22 * scale * Math.cos(secRad), cy - 22 * scale * Math.sin(secRad));
    ctx.lineTo(cx + (R - 12) * Math.cos(secRad), cy + (R - 12) * Math.sin(secRad));
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = Math.max(1.2, 2 * scale);
    ctx.lineCap = 'round';
    ctx.stroke();

    // Counterbalance eyelet
    const tailX = cx - 14 * scale * Math.cos(secRad);
    const tailY = cy - 14 * scale * Math.sin(secRad);
    ctx.beginPath();
    ctx.arc(tailX, tailY, Math.max(1.6, 3 * scale), 0, Math.PI * 2);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = Math.max(1, 1.6 * scale);
    ctx.stroke();

    // Center Chronograph Pivot
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(3.5, 6.5 * scale), 0, Math.PI * 2);
    ctx.fillStyle = accentColor;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(1.5, 2.5 * scale), 0, Math.PI * 2);
    ctx.fillStyle = isDark ? '#0a0e17' : '#ffffff';
    ctx.fill();
  }, [compact, elapsed, isRunning, size, targetSeconds, theme]);

  return <canvas ref={canvasRef} className={`horology-stopwatch-canvas${compact ? ' is-compact' : ''}`} />;
};

/* ── Compact stopwatch for the running-session summary ── */
export const CompactStopwatchFace = ({ elapsed, targetSeconds = 0 }) => {
  const seconds = elapsed % 60;
  const minutes = (elapsed / 60) % 60;
  const secondAngle = seconds * 6;
  const minuteAngle = minutes * 6;
  const progress = targetSeconds > 0 ? Math.min(1, elapsed / targetSeconds) : 0;
  return (
    <svg className="compact-stopwatch" viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <radialGradient id="compactWatchDial" cx="42%" cy="32%" r="72%">
          <stop offset="0" stopColor="var(--sd-bg-surface)" />
          <stop offset="1" stopColor="var(--sd-bg-subtle)" />
        </radialGradient>
        <filter id="compactWatchShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="var(--sd-shadow-color)" floodOpacity=".18" />
        </filter>
      </defs>

      <circle className="compact-stopwatch-case" cx="60" cy="60" r="56" filter="url(#compactWatchShadow)" />
      <circle className="compact-stopwatch-dial" cx="60" cy="60" r="52" />
      {targetSeconds > 0 && (
        <circle
          className="compact-stopwatch-target"
          cx="60"
          cy="60"
          r="53"
          pathLength="1"
          strokeDasharray={`${progress} 1`}
        />
      )}

      <g className="compact-stopwatch-ticks">
        {Array.from({ length: 60 }, (_, index) => (
          <line
            key={index}
            className={index % 5 === 0 ? 'is-major' : ''}
            x1="60"
            y1={index % 5 === 0 ? '12' : '10'}
            x2="60"
            y2="15"
            transform={`rotate(${index * 6} 60 60)`}
          />
        ))}
      </g>

      <text className="compact-stopwatch-mark" x="60" y="23" textAnchor="middle">60</text>
      <text className="compact-stopwatch-mark" x="98" y="63" textAnchor="middle">15</text>
      <text className="compact-stopwatch-mark" x="60" y="102" textAnchor="middle">30</text>
      <text className="compact-stopwatch-mark" x="22" y="63" textAnchor="middle">45</text>

      <line className="compact-stopwatch-minute-hand" x1="60" y1="66" x2="60" y2="35" transform={`rotate(${minuteAngle} 60 60)`} />
      <line className="compact-stopwatch-second-hand" x1="60" y1="72" x2="60" y2="17" transform={`rotate(${secondAngle} 60 60)`} />
      <circle className="compact-stopwatch-hub" cx="60" cy="60" r="4.5" />
      <circle className="compact-stopwatch-pin" cx="60" cy="60" r="1.7" />
    </svg>
  );
};

/* ── Nested study-target progress rings ── */
export const SessionTargetRings = ({ rings = [] }) => {
  const visibleRings = rings.slice(0, 3);
  const radii = visibleRings.length === 1 ? [48] : visibleRings.length === 2 ? [50, 37] : [51, 39, 27];

  return (
    <div className={`session-target-rings ring-count-${visibleRings.length}`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="session-target-rings-plate" cx="60" cy="60" r="56" />
        {visibleRings.map((ring, index) => {
          const radius = radii[index];
          const circumference = 2 * Math.PI * radius;
          const progress = Math.max(0, Math.min(100, ring.progress));
          return (
            <g key={ring.id} className={`session-target-ring session-target-ring-${ring.id}`}>
              <circle className="session-target-ring-track" cx="60" cy="60" r={radius} />
              <circle
                className="session-target-ring-value"
                cx="60"
                cy="60"
                r={radius}
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress / 100)}
              />
            </g>
          );
        })}
      </svg>
      <div className="session-target-ring-key" aria-hidden="true">
        {visibleRings.map((ring) => (
          <span key={ring.id}><i className={`is-${ring.id}`} />{ring.shortLabel}<b>{Math.round(ring.progress)}%</b></span>
        ))}
      </div>
    </div>
  );
};
