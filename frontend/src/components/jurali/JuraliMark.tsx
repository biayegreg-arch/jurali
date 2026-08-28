// Jurali brand icon + wordmark. `tone="default"` (dark-green circle, dark
// text) is for light backgrounds; `tone="inverted"` (cream circle, cream
// text) mirrors the brand kit's "logo-horizontal-clair" variant for
// bg-primary panels. The wordmark uses the app's real heading font
// (font-headings) rather than the brand SVG's own <text> element, which
// styles itself via a `jurali-word` CSS class this app never defines.
export interface JuraliMarkProps {
  tone?: 'default' | 'inverted';
  /** Icon-only when false — for tight spaces (e.g. the receipt mark). */
  withWordmark?: boolean;
  size?: number;
  /** Tailwind text-size class for the wordmark (font-size isn't inherited from the icon). */
  textSize?: string;
  className?: string;
}

const CIRCLE_FILL = {
  default: '#2A5738',
  inverted: '#F2EDE4',
} as const;

const STROKE_COLOR = {
  default: '#F2EDE4',
  inverted: '#2A5738',
} as const;

const TEXT_CLASS = {
  default: 'text-primary',
  inverted: 'text-primary-foreground',
} as const;

export function JuraliMark({
  tone = 'default',
  withWordmark = true,
  size = 28,
  textSize = 'text-2xl',
  className = '',
}: JuraliMarkProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        role="img"
        aria-label="Jurali"
        className="flex-shrink-0"
      >
        <circle cx="32" cy="32" r="28" fill={CIRCLE_FILL[tone]} />
        <path
          d="M39 17 V35 a9 9 0 0 1 -18 0"
          stroke={STROKE_COLOR[tone]}
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="39" cy="46" r="4" fill="#E0A03A" />
      </svg>
      {withWordmark && (
        <span className={`font-headings font-bold ${textSize} ${TEXT_CLASS[tone]}`}>Jurali</span>
      )}
    </span>
  );
}
