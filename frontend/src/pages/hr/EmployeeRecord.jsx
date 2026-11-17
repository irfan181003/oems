// UC-07 | FR-7 | HR Manager | API: GET /employees/:id, PATCH /employees/:id
// Edit one field at a time; every change stores Last Updated By / Timestamp (BR-11, NFR-7).
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { employees } from '../../api/endpoints';
import FormField from '../../components/FormField';
import { ConfirmDialog } from '../../components/Modal';
import Mono from '../../components/Mono';
import PageHeader from '../../components/PageHeader';
import Skeleton from '../../components/Skeleton';
import StatCard, { StatRow } from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { ErrorState } from '../../components/States';
import { useToast } from '../../components/Toast';
import { fieldErrors } from '../../api/client';
import { date, dateTime, inr, orDash } from '../../lib/format';
import { GENDERS, HINTS, LABELS } from '../../lib/labels';
import { serverNow } from '../../lib/serverDate';
import useAsync from '../../lib/useAsync';
import EmployeeInput from './EmployeeInput';
import { EDITABLE_FIELDS, ageRule, rules } from './employeeFields';

const display = (field, value) => {
  switch (field) {
    case 'date_of_birth':
    case 'date_of_joining':
      return date(value);
    case 'basic_salary':
      return <Mono>{inr(value)}</Mono>;
    case 'gender':
      return (GENDERS.find((g) => g.value === value) || {}).label || orDash(value);
    case 'employment_status':
      return <StatusBadge value={value} />;
    case 'contact_number':
    case 'bank_account':
      return <Mono>{value}</Mono>;
    default:
      return orDash(value);
  }
};

export default function EmployeeRecord() {
  const { id } = useParams();
  const toast = useToast();
  const now = useAsync(() => serverNow(), []);
  const { data: emp, error, loading, reload } = useAsync(async () => (await employees.get(id)).data, [id]);
  const [editing, setEditing] = useState(null); // field name
  const [value, setValue] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState(false);

  const startEdit = (field) => {
    setEditing(field);
    setValue(emp[field] === null || emp[field] === undefined ? '' : String(emp[field]));
    setFieldError('');
  };

  const save = async () => {
    const v = typeof value === 'string' ? value.trim() : value;
    const merged = { ...emp, [editing]: v };
    const today = now.data && now.data.today;
    const rule = [].concat(rules(today)[editing]);
    // A new Date of Birth is also checked against the stored Date of Joining (18-years rule)
    const msg =
      rule.map((r) => r(v, merged)).find(Boolean) ||
      (editing === 'date_of_birth' ? ageRule(today)(merged.date_of_joining, merged) : '');
    if (msg) {
      setFieldError(msg);
      return;
    }
    if (String(v) === String(emp[editing] ?? '')) {
      setEditing(null);
      return;
    }
    setBusy(true);
    try {
      await employees.update(id, { [editing]: v });
      toast.push({ tone: 'ok', text: `${LABELS[editing]} updated.` });
      setEditing(null);
      setConfirmStatus(false);
      reload();
    } catch (err) {
      setConfirmStatus(false);
      const fe = fieldErrors(err);
      setFieldError(fe[editing] || Object.values(fe)[0] || err.message);
    } finally {
      setBusy(false);
    }
  };

  const onSave = (e) => {
    e.preventDefault();
    if (editing === 'employment_status' && value !== emp.employment_status) setConfirmStatus(true);
    else save();
  };

  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <>
      <PageHeader
        title={emp ? emp.employee_name : 'Employee record'}
        subtitle={
          emp ? (
            <>
              <Mono>{emp.employee_id}</Mono> · {emp.designation}, {emp.department}
            </>
          ) : (
            'Loading…'
          )
        }
        actions={
          <Link className="btn" to="/hr/employees">
            ← Employees
          </Link>
        }
      />
      <StatRow>
        <StatCard label={LABELS.employment_status} loading={loading} value={emp && <StatusBadge value={emp.employment_status} />} />
        <StatCard label={LABELS.record_created_date} loading={loading} value={emp && date(emp.record_created_date)} />
        <StatCard label={LABELS.last_updated_by} loading={loading} mono value={emp ? orDash(emp.last_updated_by) : '—'} />
        <StatCard label={LABELS.last_updated_ts} loading={loading} value={emp ? dateTime(emp.last_updated_ts) : '—'} />
      </StatRow>

      <section className="card card--flush">
        {loading || !emp ? (
          <div style={{ padding: 24, display: 'grid', gap: 12 }}>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} height={16} />
            ))}
          </div>
        ) : (
          <div className="table-wrap" style={{ maxHeight: 'none' }}>
            <table className="table">
              <caption className="visually-hidden">Employee record fields</caption>
              <thead>
                <tr>
                  <th scope="col">Field</th>
                  <th scope="col">Value</th>
                  <th scope="col" className="num">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">{LABELS.employee_id}</th>
                  <td className="mono">{emp.employee_id}</td>
                  <td className="num muted small">System generated</td>
                </tr>
                {EDITABLE_FIELDS.map((f) =>
                  editing === f ? (
                    <tr key={f}>
                      <th scope="row">{LABELS[f]}</th>
                      <td colSpan={2} className="wrap" style={{ padding: 12 }}>
                        <form className="toolbar" onSubmit={onSave} noValidate>
                          <FormField label={`New ${LABELS[f]}`} hint={HINTS[f]} error={fieldError}>
                            <EmployeeInput field={f} value={value} onChange={(e) => setValue(e.target.value)} today={now.data && now.data.today} autoFocus />
                          </FormField>
                          <button type="submit" className="btn btn--primary" disabled={busy}>
                            {busy ? 'Saving…' : 'Save'}
                          </button>
                          <button type="button" className="btn" onClick={() => setEditing(null)} disabled={busy}>
                            Cancel
                          </button>
                        </form>
                      </td>
                    </tr>
                  ) : (
                    <tr key={f}>
                      <th scope="row">{LABELS[f]}</th>
                      <td className={f === 'address' ? 'wrap' : undefined}>{display(f, emp[f])}</td>
                      <td className="num">
                        <button type="button" className="btn btn--ghost" onClick={() => startEdit(f)} disabled={Boolean(editing)} aria-label={`Edit ${LABELS[f]}`}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmStatus}
        title="Change employment status?"
        confirmLabel={`Set to ${value}`}
        tone={value === 'Active' ? 'primary' : 'danger'}
        busy={busy}
        onConfirm={save}
        onCancel={() => setConfirmStatus(false)}
      >
        {emp && (
          <p>
            Change the Employment Status of <strong>{emp.employee_name}</strong> (<Mono>{emp.employee_id}</Mono>) from{' '}
            <strong>{emp.employment_status}</strong> to <strong>{value}</strong>? The change is recorded with your Employee ID.
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}
