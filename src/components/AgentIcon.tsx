export default function AgentIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path
        d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
        stroke="currentColor"
        strokeWidth="2.7"
        strokeLinejoin="round"
        strokeLinecap="round"
        transform="translate(0,6) scale(0.6)"
      />
      <path
        d="M18 2 18.92 5.58 22.5 6.5 18.92 7.42 18 11 17.08 7.42 13.5 6.5 17.08 5.58 Z"
        fill="currentColor"
      />
    </svg>
  )
}
