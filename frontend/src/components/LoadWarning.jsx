// Shown when a supporting list (e.g. the employees or vacancies in a picker) could not be loaded,
// so the page never silently shows an empty or disabled control.
export default function LoadWarning({ errors, onRetry, what = 'Some options' }) {
  const err = (errors || []).find(Boolean);
  if (!err) return null;
  return (
    <div className="alert alert--warn" role="alert" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ flex: 1 }}>
        {what} could not be loaded: {err.message}
      </span>
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
