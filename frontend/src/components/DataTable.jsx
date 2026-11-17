// Table: 44px rows, light zebra, sticky header, right-aligned numbers, skeleton rows, empty and error states.
import { SkeletonRows } from './Skeleton';
import { EmptyState, ErrorState } from './States';

/**
 * columns: [{ key, label, align: 'right' | 'left', mono, wrap, render: (row) => node }]
 */
export default function DataTable({
  columns,
  rows,
  loading = false,
  error = null,
  onRetry,
  empty = 'No records yet',
  rowKey = (r, i) => i,
  caption,
}) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  const showEmpty = !loading && (!rows || rows.length === 0);
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label={caption || 'Table'} aria-busy={loading}>
      <table className="table">
        {caption && <caption className="visually-hidden">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={c.align === 'right' ? 'num' : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && <SkeletonRows cols={columns.length} />}
          {!loading &&
            rows &&
            rows.map((row, i) => (
              <tr key={rowKey(row, i)}>
                {columns.map((c) => {
                  const cls = [c.align === 'right' && 'num', c.mono && 'mono', c.wrap && 'wrap'].filter(Boolean).join(' ');
                  return (
                    <td key={c.key} className={cls || undefined}>
                      {c.render ? c.render(row) : row[c.key] ?? '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
        </tbody>
      </table>
      {showEmpty && <EmptyState title={empty} />}
    </div>
  );
}
