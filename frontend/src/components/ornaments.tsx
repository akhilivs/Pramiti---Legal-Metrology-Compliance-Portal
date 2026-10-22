/*
  Original heritage ornaments drawn as inline SVG.
  (The State Emblem of India is intentionally NOT used - its use is restricted by law.)
*/

type SvgProps = { className?: string; title?: string };

/** Portal mark: a tula (balance scale) inside a sixteen-petal lotus ring. */
export function Emblem({ className = 'h-12 w-12', title = 'Pramiti' }: SvgProps) {
  const petals = Array.from({ length: 16 }, (_, i) => i * 22.5);
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label={title}>
      <circle cx="32" cy="32" r="31" fill="var(--paper)" stroke="var(--gold)" strokeWidth="1.2" />
      <g fill="var(--saffron)" fillOpacity="0.85">
        {petals.map((a) => (
          <path key={a} d="M32 3.5c2.6 3 2.6 6.4 0 9.2-2.6-2.8-2.6-6.2 0-9.2z" transform={`rotate(${a} 32 32)`} />
        ))}
      </g>
      <circle cx="32" cy="32" r="18.5" fill="var(--navy)" />
      <circle cx="32" cy="32" r="16.6" fill="none" stroke="var(--gold-soft)" strokeWidth="0.7" strokeDasharray="1.4 1.6" />
      {/* tula */}
      <g stroke="#fff" strokeWidth="1.4" strokeLinecap="round" fill="none">
        <path d="M32 21.5v17" />
        <path d="M22.5 25.5h19" />
        <path d="M24 25.5l-3.6 7.2M24 25.5l3.6 7.2M40 25.5l-3.6 7.2M40 25.5l3.6 7.2" strokeWidth="0.9" />
        <path d="M27.5 41.5h9" />
      </g>
      <path d="M19.8 32.7h8.4a4.2 4.2 0 0 1-8.4 0zM35.8 32.7h8.4a4.2 4.2 0 0 1-8.4 0z" fill="var(--gold-soft)" />
      <circle cx="32" cy="20.6" r="1.6" fill="var(--saffron)" />
    </svg>
  );
}

/** Rangoli-style rosette used as a large faint watermark. */
export function Rosette({ className = '' }: SvgProps) {
  const n = 24;
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="0.8">
        <circle cx="100" cy="100" r="96" />
        <circle cx="100" cy="100" r="88" strokeDasharray="2 4" />
        {Array.from({ length: n }, (_, i) => (
          <path
            key={`p${i}`}
            d="M100 14c10 14 10 30 0 44-10-14-10-30 0-44z"
            transform={`rotate(${(360 / n) * i} 100 100)`}
          />
        ))}
        <circle cx="100" cy="100" r="40" />
        {Array.from({ length: 12 }, (_, i) => (
          <path
            key={`q${i}`}
            d="M100 60c6 8 6 16 0 24-6-8-6-16 0-24z"
            transform={`rotate(${30 * i} 100 100)`}
          />
        ))}
        <circle cx="100" cy="100" r="12" />
        <circle cx="100" cy="100" r="4" fill="currentColor" />
      </g>
    </svg>
  );
}

/**
 * Pramiti wordmark - the name in Baloo 2 with its Devanagari form, nothing else.
 * (प्रमिति: "valid knowledge, true measure")
 */
export function Wordmark({ size = 'md', light = false, className = '' }: { size?: 'sm' | 'md' | 'lg'; light?: boolean; className?: string }) {
  const latin = { sm: 'text-[1.6rem]', md: 'text-[2rem] sm:text-[2.25rem]', lg: 'text-[2.6rem]' }[size];
  const deva = { sm: 'text-[1rem]', md: 'text-[1.2rem] sm:text-[1.3rem]', lg: 'text-[1.5rem]' }[size];
  return (
    <span className={`inline-flex items-baseline gap-2 ${className}`} aria-label="Pramiti">
      <span className={`wordmark ${latin} ${light ? 'text-white' : 'text-indigo'}`}>Pramiti</span>
      <span className={`wordmark ${deva} ${light ? 'text-gold-soft' : 'text-saffron'}`} aria-hidden="true">
        प्रमिति
      </span>
    </span>
  );
}

/** Small lotus used in section dividers. */
export function Lotus({ className = 'h-5 w-8' }: SvgProps) {
  return (
    <svg viewBox="0 0 40 24" className={className} aria-hidden="true">
      <g fill="var(--saffron)">
        <path d="M20 2c4 5 4 12 0 18-4-6-4-13 0-18z" />
        <path d="M20 20c-2-6-7-11-13-12 1 7 6 11 13 12z" fillOpacity="0.75" />
        <path d="M20 20c2-6 7-11 13-12-1 7-6 11-13 12z" fillOpacity="0.75" />
        <path d="M20 21c-5-2-11-3-17-1 5 3 11 3 17 1zM20 21c5-2 11-3 17-1-5 3-11 3-17 1z" fillOpacity="0.45" />
      </g>
    </svg>
  );
}

export function Divider({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-hidden="true">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-soft to-gold-soft" />
      <Lotus />
      <span className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-soft to-gold-soft" />
    </div>
  );
}

/** Corner flourish (like a carved toran corner) for framed cards. */
export function Corner({ className = '' }: SvgProps) {
  return (
    <svg viewBox="0 0 40 40" className={`h-8 w-8 ${className}`} aria-hidden="true">
      <g fill="none" stroke="var(--gold)" strokeWidth="1" strokeOpacity="0.7">
        <path d="M2 38V10a8 8 0 0 1 8-8h28" />
        <path d="M6 38V14a8 8 0 0 1 8-8h24" strokeOpacity="0.4" />
        <path d="M10 10c4 0 6 2 6 6-4 0-6-2-6-6z" fill="var(--saffron)" fillOpacity="0.35" />
      </g>
    </svg>
  );
}

export function FramedCorners() {
  return (
    <>
      <Corner className="pointer-events-none absolute left-1 top-1" />
      <Corner className="pointer-events-none absolute right-1 top-1 rotate-90" />
      <Corner className="pointer-events-none absolute bottom-1 right-1 rotate-180" />
      <Corner className="pointer-events-none absolute bottom-1 left-1 -rotate-90" />
    </>
  );
}
