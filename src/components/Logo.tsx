/**
 * FieldGrant mark: a seedling growing from open hands. The sprout is the work in the field, the cupped base is the
 * funding that supports it. Also used as the browser icon (src/app/icon.svg keeps the same drawing).
 */
export function Logo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} role="img" aria-label="FieldGrant logo">
      <rect width="32" height="32" rx="8" fill="#0F172A" />
      <path d="M16 22V14" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M16 16.5C16 12.6 12.7 10.4 8.6 10.8C8.4 14.7 11.5 17.2 16 16.5Z" fill="#fff" />
      <path d="M16 13.6C16 9.5 19.3 7.3 23.6 7.7C23.8 11.8 20.6 14.3 16 13.6Z" fill="#fff" fillOpacity=".92" />
      <path d="M7.5 20.5C8.2 25 11.5 27 16 27C20.5 27 23.8 25 24.5 20.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}
