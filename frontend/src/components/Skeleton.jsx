// Loading placeholders (no spinners)
export default function Skeleton({ width = '100%', height = 12, style }) {
  return <span className="skeleton" style={{ width, height, ...style }} aria-hidden="true" />;
}

/** Skeleton table rows for DataTable. */
export function SkeletonRows({ rows = 5, cols = 4 }) {
  return Array.from({ length: rows }, (_, r) => (
    <tr key={`sk-${r}`} aria-hidden="true">
      {Array.from({ length: cols }, (_, c) => (
        <td key={c}>
          <Skeleton width={`${50 + ((r * 7 + c * 13) % 40)}%`} />
        </td>
      ))}
    </tr>
  ));
}
