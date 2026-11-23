interface BrandLogoProps {
  className?: string;
}

export default function BrandLogo({ className }: BrandLogoProps) {
  return (
    <svg
      className={className}
      viewBox="64 82 604 588"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <g className="brand-logo-accent" strokeWidth="14">
        <path d="M77 220 193.2 95H526.5L644 220" />
        <path d="M193.2 95 243 216.5 360 95 427.5 222" />
        <path d="M526.5 95 474.5 222" />
        <path d="M280 551 360 656.5 440 551" />
        <path d="M323 551 335 600M390.5 551 378.5 600" />
        <path strokeWidth="17" d="M306.5 481A56 56 0 0 0 413 481" />
        <path strokeWidth="30" d="M327 263V434M392 263V434" />
      </g>
      <g stroke="currentColor" strokeWidth="25">
        <path d="M93 445.5V261H115.3A49.2 49.2 0 0 1 115.3 359.5H93" />
        <path d="M175.8 445.5 221.7 260.5 273.4 445.5M192.1 379H254.9" />
        <path d="M514 281C505 268 495 261 481 261 462 261 449 279 449 302 449 326 465 340 488 352 508 363 518 382 518 405 518 431 502 446 480 446 465 446 453 438 446 424" />
        <path d="M551.8 445.5 597 260.5 648.4 445.5M568.1 379H629.9" />
      </g>
    </svg>
  );
}
