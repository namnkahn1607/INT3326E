export function CustomerBackdrop() {
  return <div className="pf-customer-backdrop" aria-hidden="true">
    <svg className="pf-backdrop-route pf-backdrop-route--top" viewBox="0 0 600 120" fill="none">
      <path d="M30 80H200Q220 80 220 60V40Q220 20 240 20H570" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 8" />
      <circle cx="30" cy="80" r="5" fill="white" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="570" cy="20" r="5" fill="white" stroke="currentColor" strokeWidth="1.5" />
      <g className="pf-backdrop-parcel pf-backdrop-parcel--top" strokeLinecap="round" strokeLinejoin="round">
        <path d="m0-16 14 8V8L0 16l-14-8V-8L0-16Z" fill="white" stroke="currentColor" strokeWidth="1.5" />
        <path d="m-14-8 14 8 14-8M0 0v16M-7-12l14 8v7" stroke="var(--pf-primary-accent)" strokeWidth="1.5" />
      </g>
    </svg>
    <svg className="pf-backdrop-route pf-backdrop-route--side" viewBox="0 0 40 600" fill="none">
      <path d="M20 0V600" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 10" />
      <g className="pf-backdrop-parcel pf-backdrop-parcel--side" strokeLinecap="round" strokeLinejoin="round">
        <rect x="-10" y="-11" width="20" height="22" rx="3" fill="white" stroke="currentColor" strokeWidth="1.5" />
        <path d="M-3-11v8h6v-8M-5 6h5" stroke="var(--pf-primary-accent)" strokeWidth="1.5" />
      </g>
    </svg>
  </div>
}
