// UC-04 | FR-4 | HR Manager | API: GET /leaves?status&employee_id, PATCH /leaves/:id/decision (BR-06, BR-07, NFR-4)
import { useState } from 'react';
import { leaves } from '../../api/endpoints';
import FormField from '../../components/FormField';
import { ConfirmDialog } from '../../components/Modal';
import Mono from '../../components/Mono';
import PageHeader from '../../components/PageHeader';
import Skeleton from '../../components/Skeleton';
import StatusBadge from '../../components/StatusBadge';
import { EmptyState, ErrorState } from '../../components/States';
import { useToast } from '../../components/Toast';
import { date, orDash } from '../../lib/format';
import { LABELS, LEAVE_STATUSES } from '../../lib/labels';
import useAsync from '../../lib/useAsync';
import useEmployees, { employeeOption } from '../../lib/useEmployees';

function LeaveCard({ leave, onDecide }) {
  const [remarks, setRemarks] = useState('');
  const pending = leave.leave_status === 'Pending';
  return (
    <article className="card" aria-labelledby={`lv-${leave.leave_id}`} style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 id={`lv-${leave.leave_id}`}>{leave.employee_name}</h3>
          <span className="small muted">
            <Mono>{leave.employee_id}</Mono> · <Mono>{leave.leave_id}</Mono> · applied {date(leave.applied_date)}
          </span>
        </div>
        <StatusBadge value={leave.leave_status} />
      </div>
      <dl className="doc__meta" style={{ margin: 0 }}>
        <div><dt>{LABELS.leave_type}</dt><dd>{leave.leave_type}</dd></div>
        <div><dt>{LABELS.leave_days}</dt><dd><Mono>{leave.leave_days}</Mono></dd></div>
        <div><dt>{LABELS.leave_start}</dt><dd>{date(leave.leave_start)}</dd></div>
        <div><dt>{LABELS.leave_end}</dt><dd>{date(leave.leave_end)}</dd></div>
      </dl>
      <p>
        <span className="muted">{LABELS.leave_reason}: </span>
        {leave.leave_reason}
      </p>
      {pending ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <FormField label={LABELS.hr_remarks} hint={`Optional, up to 200 characters. ${remarks.length}/200`}>
            <textarea className="textarea" style={{ minHeight: 64 }} maxLength={200} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </FormField>
          <div className="form-actions">
            <button type="button" className="btn btn--primary" onClick={() => onDecide(leave, 'Approved', remarks)}>
              Approve
            </button>
            <button type="button" className="btn btn--danger" onClick={() => onDecide(leave, 'Rejected', remarks)}>
              Reject
            </button>
          </div>
        </div>
      ) : (
        <p className="small">
          <span className="muted">{LABELS.decision_date}:</span> {date(leave.decision_date)} · <span className="muted">{LABELS.approved_by}:</span>{' '}
          <Mono>{orDash(leave.approved_by)}</Mono> · <span className="muted">{LABELS.hr_remarks}:</span> {orDash(leave.hr_remarks)}
        </p>
      )}
    </article>
  );
}

export default function LeaveReview() {
  const toast = useToast();
  const emps = useEmployees();
  const [filters, setFilters] = useState({ status: 'Pending', employee_id: '' });
  const { data, error, loading, reload } = useAsync(async () => (await leaves.review(filters)).data, [filters.status, filters.employee_id]);
  const [pending, setPending] = useState(null); // { leave, decision, remarks }
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      const body = { decision: pending.decision };
      if (pending.remarks.trim()) body.hr_remarks = pending.remarks.trim();
      const res = await leaves.decide(pending.leave.leave_id, body);
      // DS-11 Leave Status Notice
      toast.push({ tone: 'ok', text: `Leave ${res.data.leave_id} ${res.data.leave_status.toLowerCase()} on ${date(res.data.decision_date)}.` });
      setPending(null);
      reload();
    } catch (err) {
      toast.push({ tone: 'bad', text: err.message }); // e.g. 409 already decided (BR-07)
      setPending(null);
      reload();
    } finally {
      setBusy(false);
    }
  };

  const set = (e) => setFilters((f) => ({ ...f, [e.target.name]: e.target.value }));

  return (
    <>
      <PageHeader title="Leave Review" subtitle="Approve or reject leave applications. Decisions are final and recorded with your Employee ID." />
      <section className="card">
        <div className="toolbar">
          <FormField label={LABELS.leave_status}>
            <select className="select" name="status" value={filters.status} onChange={set}>
              {LEAVE_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
              <option value="">All statuses</option>
            </select>
          </FormField>
          <FormField label="Employee">
            <select className="select" name="employee_id" value={filters.employee_id} onChange={set} disabled={emps.loading}>
              <option value="">All employees</option>
              {(emps.data || []).map((e) => (
                <option key={e.employee_id} value={e.employee_id}>
                  {employeeOption(e)}
                </option>
              ))}
            </select>
          </FormField>
          <p className="muted" aria-live="polite" style={{ alignSelf: 'center' }}>
            {data ? `${data.length} application(s)` : ''}
          </p>
        </div>
      </section>

      {error ? (
        <div className="card">
          <ErrorState error={error} onRetry={reload} />
        </div>
      ) : loading ? (
        <div className="card" style={{ display: 'grid', gap: 12 }} aria-busy="true">
          <Skeleton height={18} width="40%" />
          <Skeleton height={14} />
          <Skeleton height={14} width="70%" />
        </div>
      ) : data.length === 0 ? (
        <div className="card">
          <EmptyState title={filters.status === 'Pending' ? 'No pending leave applications' : 'No leave applications yet'} />
        </div>
      ) : (
        data.map((l) => <LeaveCard key={l.leave_id} leave={l} onDecide={(leave, decision, remarks) => setPending({ leave, decision, remarks })} />)
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        title={pending ? `${pending.decision === 'Approved' ? 'Approve' : 'Reject'} leave?` : ''}
        confirmLabel={pending && pending.decision === 'Approved' ? 'Approve' : 'Reject'}
        tone={pending && pending.decision === 'Approved' ? 'primary' : 'danger'}
        busy={busy}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      >
        {pending && (
          <p>
            {pending.decision === 'Approved' ? 'Approve' : 'Reject'} leave <Mono>{pending.leave.leave_id}</Mono> for{' '}
            <strong>{pending.leave.employee_name}</strong>: {pending.leave.leave_type}, {date(pending.leave.leave_start)} – {date(pending.leave.leave_end)} (
            {pending.leave.leave_days} day(s))? This cannot be changed afterwards.
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}
