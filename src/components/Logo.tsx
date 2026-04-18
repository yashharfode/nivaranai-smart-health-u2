export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-label="NivaranAI logo">
      <defs>
        <linearGradient
          id="nivaran-grad"
          x1="0"
          y1="0"
          x2="32"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="oklch(0.55 0.055 195)" />
          <stop offset="100%" stopColor="oklch(0.42 0.045 200)" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="28" height="28" rx="9" fill="url(#nivaran-grad)" />
      <path
        d="M10 22 L10 12 L16 18.5 L16 10 M22 12 L22 22"
        stroke="oklch(0.99 0.005 80)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="22" cy="9" r="1.3" fill="oklch(0.99 0.005 80)" />
    </svg>
  );
}
