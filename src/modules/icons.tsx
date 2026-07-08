type IconProps = { className?: string }

const base = {
  viewBox: '0 0 24 24',
  width: 18,
  height: 18,
  fill: 'none',
} as const

export function EligibilityIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path
        d="M12 2l7 3v6c0 4.97-3.05 9.28-7 10.5-3.95-1.22-7-5.53-7-10.5V5l7-3z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function PriorAuthIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="5" y="3.5" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 3.5V2h6v1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.5 12l2.2 2.2L15.5 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CodingIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M9 8l-5 4 5 4M15 8l5 4-5 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ClaimsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M3 11l17-8-6 17-3-7-8-2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

export function ARDenialIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="4.5" y="3.5" width="15" height="17" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16" r="0.9" fill="currentColor" />
    </svg>
  )
}

export function AppealsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M12 3v18M6 7l-3 5a3 3 0 006 0l-3-5zM18 7l-3 5a3 3 0 006 0l-3-5z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 21h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4.5 7h15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

export function PerformanceIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M4 20V10M11 20V4M18 20v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
