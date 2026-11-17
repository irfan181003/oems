// Money, IDs and times are always IBM Plex Mono with tabular figures (§2, §5)
export default function Mono({ children, className = '' }) {
  return <span className={`mono ${className}`.trim()}>{children}</span>;
}
