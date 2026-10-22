'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { StateStat } from '@/lib/api';

type Metric = 'rate' | 'total';

// Sequential single-hue ramps (light -> dark)
const RAMPS: Record<Metric, string[]> = {
  rate: ['#f7e6e2', '#eebcb3', '#d9827a', '#b54a43', '#8a1f1d'],
  total: ['#e6e9f4', '#bcc5e2', '#8494c4', '#4d5f9c', '#22305e'],
};

/**
 * Tile-grid cartogram of India: one equal square per State / UT, placed approximately by geography.
 * Equal tiles keep small states (Goa, Delhi, the North-East) as visible as large ones.
 */
export default function IndiaTileMap({ states }: { states: StateStat[] }) {
  const router = useRouter();
  const [metric, setMetric] = useState<Metric>('rate');
  const [hover, setHover] = useState<StateStat | null>(null);
  const cols = Math.max(...states.map((s) => s.col)) + 1;
  const rows = Math.max(...states.map((s) => s.row)) + 1;
  const size = 58;
  const gap = 5;
  const values = states.map((s) => (metric === 'rate' ? s.rate : s.total)).filter((v): v is number => v != null && v > 0);
  const max = metric === 'rate' ? 100 : Math.max(1, ...values);

  const colour = (s: StateStat) => {
    const v = metric === 'rate' ? s.rate : s.total;
    if (!s.total || v == null) return null;
    const idx = Math.min(4, Math.floor((v / max) * 5 - 1e-9));
    return { fill: RAMPS[metric][Math.max(0, idx)], dark: idx >= 3 };
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-full border border-sand-strong bg-paper p-0.5 text-xs font-semibold" role="group" aria-label="Map metric">
          {(
            [
              ['rate', 'Non-compliance rate'],
              ['total', 'Inspections'],
            ] as [Metric, string][]
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              aria-pressed={metric === m}
              className={`rounded-full px-3 py-1 ${metric === m ? 'bg-navy text-white' : 'text-ink-soft'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>{metric === 'rate' ? '0%' : '0'}</span>
          <span className="flex overflow-hidden rounded">
            {RAMPS[metric].map((c) => (
              <span key={c} className="h-3 w-6" style={{ background: c }} />
            ))}
          </span>
          <span>{metric === 'rate' ? '100%' : max}</span>
          <span className="ml-2 inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm border border-dashed border-sand-strong bg-ivory" /> No data
          </span>
        </div>
      </div>

      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${cols * (size + gap)} ${rows * (size + gap)}`}
          className="mx-auto block w-full max-w-[560px]"
          role="img"
          aria-label="Tile map of Indian states coloured by inspection results"
        >
          {states.map((s) => {
            const c = colour(s);
            const x = s.col * (size + gap);
            const y = s.row * (size + gap);
            return (
              <g
                key={s.code}
                className="cursor-pointer"
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(null)}
                onClick={() => router.push(`/history?state=${s.code}`)}
                role="link"
                aria-label={`${s.name}: ${s.total} inspections, ${s.non_compliant} non-compliant`}
              >
                <rect
                  x={x}
                  y={y}
                  width={size}
                  height={size}
                  rx={7}
                  fill={c?.fill ?? 'var(--ivory)'}
                  stroke={hover?.code === s.code ? 'var(--saffron)' : c ? 'var(--paper)' : 'var(--sand-strong)'}
                  strokeWidth={hover?.code === s.code ? 3 : 1.5}
                  strokeDasharray={c ? undefined : '3 3'}
                />
                <text x={x + size / 2} y={y + 25} textAnchor="middle" fontSize="15" fontWeight="700" fill={c?.dark ? '#fff' : c ? '#2a1f14' : 'var(--ink)'}>
                  {s.code}
                </text>
                <text x={x + size / 2} y={y + 43} textAnchor="middle" fontSize="11" fill={c?.dark ? 'rgba(255,255,255,0.85)' : c ? '#7a6a55' : 'var(--muted)'}>
                  {s.total ? (metric === 'rate' ? `${Math.round(s.rate ?? 0)}%` : s.total) : '–'}
                </text>
              </g>
            );
          })}
        </svg>
        {hover && (
          <div className="pointer-events-none absolute left-2 top-2 rounded-lg border border-sand bg-paper px-3 py-2 text-xs shadow-lg">
            <p className="font-semibold text-ink">{hover.name}</p>
            {hover.total ? (
              <>
                <p className="text-ink-soft">{hover.total} inspections</p>
                <p className="text-ink-soft">
                  {hover.non_compliant} non-compliant ({Math.round(hover.rate ?? 0)}%)
                </p>
                <p className="text-ink-soft">{hover.compliant} compliant</p>
              </>
            ) : (
              <p className="text-muted">No inspections yet</p>
            )}
          </div>
        )}
      </div>
      <p className="mt-2 text-center text-[11px] text-muted">
        Tile map - each square is one State / UT placed approximately by geography (not to scale). Click a state to open its
        inspections.
      </p>
      <div className="sr-only">
        <table>
          <caption>Inspections by state</caption>
          <thead>
            <tr>
              <th>State</th>
              <th>Inspections</th>
              <th>Non-compliant</th>
              <th>Rate</th>
            </tr>
          </thead>
          <tbody>
            {states
              .filter((s) => s.total)
              .map((s) => (
                <tr key={s.code}>
                  <td>{s.name}</td>
                  <td>{s.total}</td>
                  <td>{s.non_compliant}</td>
                  <td>{s.rate}%</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
