/**
 * Scanning animation: a dotted wave of eight-pointed stars sweeping over the photo.
 * The star is the ashtakona - two interlaced squares - carved into Mughal jaali screens and
 * drawn in rangoli and kolam.
 */
const COUNT = 24;

export function HeritageStar({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="-12 -12 24 24" className={className} aria-hidden="true">
      <rect x="-7.2" y="-7.2" width="14.4" height="14.4" rx="0.6" />
      <rect x="-7.2" y="-7.2" width="14.4" height="14.4" rx="0.6" transform="rotate(45)" />
      <circle r="3.1" className="star-eye" />
      <circle r="1.3" />
    </svg>
  );
}

export default function StarWave() {
  return (
    <div className="star-sweep" aria-hidden="true">
      <div className="star-row">
        {Array.from({ length: COUNT }, (_, i) => (
          <span
            key={i}
            className={`star-dot ${i % 3 === 1 ? 'star-dot-gold' : ''}`}
            style={{ left: `${((i + 0.5) / COUNT) * 100}%`, animationDelay: `${-i * 0.11}s` }}
          >
            <HeritageStar />
          </span>
        ))}
      </div>
    </div>
  );
}
