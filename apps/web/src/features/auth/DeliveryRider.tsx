export function DeliveryRider({ scenery = false }: { scenery?: boolean }) {
  return <svg className="delivery-illustration" viewBox="0 0 560 360" width="560" height="360" fill="none"
    aria-hidden="true" focusable="false">
    {scenery && <g stroke="#d7c8ee" strokeWidth="2" strokeLinecap="round">
      <path d="M25 284V158h68v126m-54-105h12m14 0h12m-38 23h12m14 0h12M106 284V113h82v171m-67-149h13m20 0h15m-48 27h13m20 0h15m-48 27h13m20 0h15M391 284V155h58v129m15 0V107h59v177M405 174h30m-30 24h30m43-70h30m-30 26h30m-30 26h30" />
      <path d="M30 95h46m-23-15h44m323-19h63m-43 17h65M18 300h522" />
      <path d="M350 130c16-22 31-39 31-54a30 30 0 0 0-60 0c0 15 15 32 29 54Z" fill="#e4d8f6" />
      <circle cx="351" cy="76" r="10" fill="#f7f2ff" />
    </g>}
    <ellipse cx="284" cy="302" rx="173" ry="13" fill="#ddd0ef" opacity=".65" />
    <g className="delivery-rider-body">
      <path d="M109 271h-28m36-18H70m46 36H95" stroke="#bba0de" strokeWidth="5" strokeLinecap="round" />
      <g className="delivery-wheel delivery-wheel-back">
        <circle cx="178" cy="277" r="36" fill="#30233e" /><circle cx="178" cy="277" r="24" fill="#faf7ff" />
        <path d="M178 255v44m-22-22h44m-37-15 30 30m-30 0 30-30" stroke="#bca8d7" strokeWidth="3" />
        <circle cx="178" cy="277" r="7" fill="#6d28d9" />
      </g>
      <g className="delivery-wheel delivery-wheel-front">
        <circle cx="398" cy="277" r="36" fill="#30233e" /><circle cx="398" cy="277" r="24" fill="#faf7ff" />
        <path d="M398 255v44m-22-22h44m-37-15 30 30m-30 0 30-30" stroke="#bca8d7" strokeWidth="3" />
        <circle cx="398" cy="277" r="7" fill="#6d28d9" />
      </g>
      <path d="M144 245c0-18 14-34 34-34h61l35 38h64l-2 27H218c-13-44-57-48-74-12v-19Z" fill="#7c3aed" />
      <path d="M165 215h75l14 14h-93" fill="#a78bfa" />
      <path d="m337 273 28-93h29l26 59c-25-8-47 2-55 34h-28Z" fill="#6d28d9" />
      <path d="m365 180 8-21h-25" stroke="#30233e" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M380 187h19l4 11h-26" fill="#f1eafa" /><path d="m382 211 13 31" stroke="#a78bfa" strokeWidth="5" strokeLinecap="round" />
      <path d="M221 204h59" stroke="#30233e" strokeWidth="12" strokeLinecap="round" />
      <rect x="129" y="143" width="100" height="67" rx="8" fill="#e0b887" />
      <path d="M129 158h100M176 143v67" stroke="#bb8e5d" strokeWidth="2" />
      <path d="M169 143h17v31l-9-5-8 5v-31Z" fill="#6d28d9" />
      <rect x="143" y="180" width="22" height="15" rx="2" fill="#f9ecd9" />
      <path d="m257 175 41 16-23 38 40 19" stroke="#30233e" strokeWidth="23" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m310 247 23 5" stroke="#faf7ff" strokeWidth="11" strokeLinecap="round" />
      <path d="m255 122-20 52c-3 10 3 21 14 23l31 6 17-58-42-23Z" fill="#7c3aed" />
      <path d="m267 137 28 34 41-4" stroke="#8b5cf6" strokeWidth="19" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m334 167 15-4" stroke="#e6b298" strokeWidth="11" strokeLinecap="round" />
      <path d="m266 113-5 17 18 6 3-23" fill="#d8997d" />
      <path d="M250 88c0-18 12-28 29-25 17 3 24 15 20 34l-4 15c-3 11-20 12-31 3-8-7-14-16-14-27Z" fill="#efc0a4" />
      <path d="m300 92 6 10h-10" fill="#efc0a4" /><circle cx="289" cy="88" r="2.5" fill="#30233e" />
      <path d="M246 87c-7-27 7-45 31-45 21 0 32 13 32 36l-29-2-14 15-20-4Z" fill="#6d28d9" />
      <path d="M263 44c12-6 25-1 31 10" stroke="#a78bfa" strokeWidth="6" strokeLinecap="round" />
      <path d="m280 76 34 3" stroke="#30233e" strokeWidth="6" strokeLinecap="round" />
      <path d="m253 91 12 16" stroke="#4c1d95" strokeWidth="4" strokeLinecap="round" />
    </g>
  </svg>
}
