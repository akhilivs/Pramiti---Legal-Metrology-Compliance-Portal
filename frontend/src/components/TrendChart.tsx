'use client';
import { useState } from 'react';
import type { Stats } from '@/lib/api';

/** 14-day stacked bars: non-compliant (bottom) + other inspections (top). */
export default function TrendChart({ daily }: { daily: Stats['daily'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560;
  const H = 180;
  const pad = { l: 28, r: 8, t: 12, b: 26 };
  const max = Math.max(4, ...daily.map((d) => d.scans));
  const step = Math.ceil(max / 4);
  const top = step * 4;
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const slot = innerW / daily.length;
  const bw = Math.min(22, slot * 0.6);
  const y = (v: number) => pad.t + innerH - (v / top) * innerH;
  const fmt = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--chart-b)' }} /> Non-compliant
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--chart-a)' }} /> Other inspections
        </span>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Inspections per day over the last 14 days">
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <line x1={pad.l} x2={W - pad.r} y1={y(step * i)} y2={y(step * i)} stroke="var(--sand)" strokeWidth="1" />
              <text x={pad.l - 6} y={y(step * i) + 3.5} textAnchor="end" fontSize="10" fill="var(--muted)">
                {step * i}
              </text>
            </g>
          ))}
          {daily.map((d, i) => {
            const cx = pad.l + slot * i + slot / 2;
            const bad = d.non_compliant;
            const other = d.scans - bad;
            const yBad = y(bad);
            const yAll = y(d.scans);
            const showLabel = (daily.length - 1 - i) % 2 === 0;
            return (
              <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={pad.l + slot * i} y={pad.t} width={slot} height={innerH} fill={hover === i ? 'var(--parchment)' : 'transparent'} />
                {bad > 0 && (
                  <rect x={cx - bw / 2} y={yBad} width={bw} height={y(0) - yBad} rx={other > 0 ? 0 : 4} fill="var(--chart-b)" />
                )}
                {other > 0 && (
                  <path
                    // rounded top only; 2px surface gap above the lower segment
                    d={(() => {
                      const x0 = cx - bw / 2;
                      const x1 = cx + bw / 2;
                      const yb = bad > 0 ? yBad - 2 : y(0);
                      const r = Math.min(4, (yb - yAll) / 2);
                      return `M${x0},${yb} V${yAll + r} Q${x0},${yAll} ${x0 + r},${yAll} H${x1 - r} Q${x1},${yAll} ${x1},${yAll + r} V${yb} Z`;
                    })()}
                    fill="var(--chart-a)"
                  />
                )}
                {showLabel && (
                  <text x={cx} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">
                    {fmt(d.date)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-sand bg-paper px-3 py-2 text-xs shadow-lg"
            style={{ left: `${((pad.l + slot * hover + slot / 2) / W) * 100}%` }}
          >
            <p className="font-semibold text-ink">{fmt(daily[hover].date)}</p>
            <p className="text-ink-soft">{daily[hover].scans} inspections</p>
            <p className="text-ink-soft">{daily[hover].non_compliant} non-compliant</p>
          </div>
        )}
      </div>
      <div className="sr-only">
        <table>
          <caption>Inspections per day</caption>
          <thead>
            <tr>
              <th>Date</th>
              <th>Inspections</th>
              <th>Non-compliant</th>
            </tr>
          </thead>
          <tbody>
            {daily.map((d) => (
              <tr key={d.date}>
                <td>{d.date}</td>
                <td>{d.scans}</td>
                <td>{d.non_compliant}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
