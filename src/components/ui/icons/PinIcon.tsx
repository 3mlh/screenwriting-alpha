import type { CSSProperties } from 'react'

export function PinIcon({
  size = 16,
  className,
  style,
}: {
  size?: number
  className?: string
  style?: CSSProperties
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={{ transform: 'rotate(32deg)', ...style }}
    >
      <path d="M9 5.5h6" />
      <path d="M10 5.5v5l-2.5 2.5" />
      <path d="M14 5.5v5l2.5 2.5" />
      <path d="M7.5 13h9" />
      <path d="M12 13v7" />
    </svg>
  )
}
