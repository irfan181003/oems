import Skeleton from './Skeleton';

/** A stat card: label, value (monospace for money / counts / IDs when mono), optional hint. */
export default function StatCard({ label, value, hint, mono = false, loading = false }) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      {loading ? (
        <Skeleton width="60%" height={22} />
      ) : (
        <span className={`stat__value${mono ? ' mono' : ''}`}>{value ?? '—'}</span>
      )}
      {hint && <span className="stat__hint">{hint}</span>}
    </div>
  );
}

export function StatRow({ children }) {
  return <div className="stats">{children}</div>;
}
