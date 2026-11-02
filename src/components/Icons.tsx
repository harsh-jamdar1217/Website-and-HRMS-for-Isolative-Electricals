/** Small line icons used across the public site. Decorative: always aria-hidden. */
type P = { className?: string };
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const IconArrow = ({ className = "h-5 w-5" }: P) => (<svg {...base} className={className}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const IconBolt = ({ className = "h-6 w-6" }: P) => (<svg {...base} className={className}><path d="M13 2 4.5 13.5H11L10 22l9-12h-6.5z" /></svg>);
export const IconLayers = ({ className = "h-6 w-6" }: P) => (<svg {...base} className={className}><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5M3 17.5l9 5 9-5" /></svg>);
export const IconGauge = ({ className = "h-6 w-6" }: P) => (<svg {...base} className={className}><path d="M4 18a8.5 8.5 0 1 1 16 0" /><path d="m12 18 4-6" /><circle cx="12" cy="18" r="1.2" /></svg>);
export const IconCheck = ({ className = "h-6 w-6" }: P) => (<svg {...base} className={className}><path d="M12 3 4 6v5.5c0 4.6 3.2 8.3 8 9.5 4.8-1.2 8-4.9 8-9.5V6l-8-3Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>);
export const IconUsers = ({ className = "h-6 w-6" }: P) => (<svg {...base} className={className}><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.4c2 .8 3.4 2.7 3.4 5.6" /></svg>);
export const IconPhone = ({ className = "h-5 w-5" }: P) => (<svg {...base} className={className}><path d="M6.5 3h3l1.5 4-2 1.5a11 11 0 0 0 5.5 5.5L16 12l4 1.5v3a2.5 2.5 0 0 1-2.7 2.5A15 15 0 0 1 4 5.7 2.5 2.5 0 0 1 6.5 3Z" /></svg>);
export const IconMail = ({ className = "h-5 w-5" }: P) => (<svg {...base} className={className}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></svg>);
export const IconPin = ({ className = "h-5 w-5" }: P) => (<svg {...base} className={className}><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.4" /></svg>);
export const IconClock = ({ className = "h-5 w-5" }: P) => (<svg {...base} className={className}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
