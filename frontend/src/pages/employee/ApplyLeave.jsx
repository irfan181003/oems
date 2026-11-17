// UC-03 | FR-3 | Employee | API: POST /leaves
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { leaves } from '../../api/endpoints';
import FormField from '../../components/FormField';
import Mono from '../../components/Mono';
import PageHeader from '../../components/PageHeader';
import { ErrorState } from '../../components/States';
import { useToast } from '../../components/Toast';
import { showServerErrors } from '../../lib/forms';
import { date } from '../../lib/format';
import { HINTS, LABELS, LEAVE_TYPES } from '../../lib/labels';
import { daysInclusive, serverNow } from '../../lib/serverDate';
import useAsync from '../../lib/useAsync';
import { isoDate, notBlank, required, validate } from '../../lib/validators';

const FIELDS = ['leave_type', 'leave_start', 'leave_end', 'leave_reason'];

export default function ApplyLeave() {
  const toast = useToast();
  const navigate = useNavigate();
  const now = useAsync(() => serverNow(), []);
  const today = now.data && now.data.today;
  const [form, setForm] = useState({ leave_type: '', leave_start: '', leave_end: '', leave_reason: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  // BR-04 all mandatory; BR-05 Leave End Date >= Leave Start Date >= Applied Date (today)
  const check = (v) =>
    validate(v, {
      leave_type: required(LABELS.leave_type),
      leave_start: [isoDate(LABELS.leave_start), (s) => (today && s < today ? `Must not be before today (${date(today)})` : '')],
      leave_end: [isoDate(LABELS.leave_end), (e, all) => (all.leave_start && e < all.leave_start ? 'Must not be before the Leave Start Date' : '')],
      leave_reason: notBlank(LABELS.leave_reason, 200),
    });

  const validDates = !isoDate('')(form.leave_start) && !isoDate('')(form.leave_end) && form.leave_end >= form.leave_start;
  const leaveDays = validDates ? daysInclusive(form.leave_start, form.leave_end) : null;

  const onSubmit = async (e) => {
    e.preventDefault();
    const fe = check(form);
    setErrors(fe);
    if (Object.keys(fe).length) return;
    setBusy(true);
    try {
      const res = await leaves.apply({ ...form, leave_reason: form.leave_reason.trim() });
      toast.push({ tone: 'ok', text: `Leave application ${res.data.leave_id} submitted for ${res.data.leave_days} day(s). Status: Pending.` });
      navigate('/employee/leave');
    } catch (err) {
      showServerErrors(err, setErrors, toast, FIELDS);
      setBusy(false);
    }
  };

  if (now.error) return <ErrorState error={now.error} onRetry={now.reload} />;

  return (
    <>
      <PageHeader title="Apply Leave" subtitle="Your application is sent to the HR Manager for a decision." />
      <form className="card form" onSubmit={onSubmit} noValidate>
        <FormField label={LABELS.leave_type} error={errors.leave_type} required>
          <select className="select" name="leave_type" value={form.leave_type} onChange={set}>
            <option value="">Choose a leave type</option>
            {LEAVE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </FormField>
        <div className="form-grid">
          <FormField label={LABELS.leave_start} hint={HINTS.leave_start} error={errors.leave_start} required>
            <input className="input" type="date" name="leave_start" min={today || undefined} value={form.leave_start} onChange={set} />
          </FormField>
          <FormField label={LABELS.leave_end} hint={HINTS.leave_end} error={errors.leave_end} required>
            <input className="input" type="date" name="leave_end" min={form.leave_start || today || undefined} value={form.leave_end} onChange={set} />
          </FormField>
        </div>
        <div className="readonly-value" aria-live="polite">
          <span>{LABELS.leave_days}:</span> <Mono>{leaveDays ?? '—'}</Mono>
          <span className="small muted">(Leave End Date − Leave Start Date + 1)</span>
        </div>
        <FormField
          label={LABELS.leave_reason}
          hint={`${HINTS.leave_reason}. ${form.leave_reason.length}/200 characters`}
          error={errors.leave_reason}
          required
        >
          <textarea className="textarea" name="leave_reason" maxLength={200} value={form.leave_reason} onChange={set} />
        </FormField>
        <div className="form-actions">
          <button type="submit" className="btn btn--primary" disabled={busy || now.loading}>
            {busy ? 'Submitting…' : 'Submit application'}
          </button>
          <button type="button" className="btn" onClick={() => navigate('/employee/leave')} disabled={busy}>
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}
