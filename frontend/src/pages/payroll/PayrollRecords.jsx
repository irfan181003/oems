// UC-15, UC-14 | FR-15, FR-14 | Payroll Officer | API: GET /payroll/records?pay_period&employee_id,
// GET /payroll/records/:id, PATCH /payroll/records/:id/status (BR-30; NFR-14 amounts read-only)
import { useState } from 'react';
import { payroll } from '../../api/endpoints';
import DataTable from '../../components/DataTable';
import FormField from '../../components/FormField';
import LoadWarning from '../../components/LoadWarning';
import Modal, { ConfirmDialog } from '../../components/Modal';
import Mono from '../../components/Mono';
import PageHeader from '../../components/PageHeader';
import StatCard, { StatRow } from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { useToast } from '../../components/Toast';
import { date, inr, period } from '../../lib/format';
import { LABELS } from '../../lib/labels';
import { fromPaise, toPaise } from '../../lib/money';
import useAsync from '../../lib/useAsync';
import useSalaryEmployees from '../../lib/useSalaryEmployees';

/** Allowed status changes: Processed -> Paid, Processed <-> On Hold (Paid is final). */
const ACTIONS = {
  Processed: [
    { to: 'Paid', label: 'Mark Paid', tone: 'primary' },
    { to: 'On Hold', label: 'Put On Hold', tone: 'danger' },
  ],
  'On Hold': [{ to: 'Processed', label: 'Release (Processed)', tone: 'primary' }],
  Paid: [],
};

function Detail({ id }) {
  const { data: r, error, loading } = useAsync(async () => (await payroll.record(id)).data, [id]);
  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <p className="alert alert--error">{error.message}</p>;
  const line = (label, value) => (
    <div>
      <dt>{label}</dt>
      <dd>
        <Mono>{value}</Mono>
      </dd>
    </div>
  );
  return (
    <dl className="doc__meta" style={{ gridTemplateColumns: '1fr' }}>
      {line(LABELS.payroll_id, r.payroll_id)}
      <div><dt>Employee</dt><dd>{r.employee_name} <Mono>{r.employee_id}</Mono></dd></div>
      {line(LABELS.pay_period, r.pay_period)}
      {line(LABELS.days_present, r.days_present)}
      {line('Paid leave days', r.leave_days)}
      {line(LABELS.basic_salary, inr(r.basic_salary))}
      {line(LABELS.allowances, inr(r.allowances))}
      {line(LABELS.gross_salary, inr(r.gross_salary))}
      {line(LABELS.tax_deduction, inr(r.tax_deduction))}
      {line(LABELS.pf_deduction, inr(r.pf_deduction))}
      {line(LABELS.total_deductions, inr(r.total_deductions))}
      {line(LABELS.net_salary, inr(r.net_salary))}
      <div><dt>{LABELS.processed_date}</dt><dd>{date(r.processed_date)}</dd></div>
      <div><dt>{LABELS.payroll_status}</dt><dd><StatusBadge value={r.payroll_status} /></dd></div>
    </dl>
  );
}

export default function PayrollRecords() {
  const toast = useToast();
  const emps = useSalaryEmployees();
  const [draft, setDraft] = useState({ pay_period: '', employee_id: '' });
  const [filters, setFilters] = useState(draft);
  const { data, error, loading, reload } = useAsync(async () => (await payroll.records(filters)).data, [filters.pay_period, filters.employee_id]);
  const [detail, setDetail] = useState(null);
  const [change, setChange] = useState(null); // { record, to, label, tone }
  const [busy, setBusy] = useState(false);

  const rows = data || [];
  const sum = (k) => inr(fromPaise(rows.reduce((s, r) => s + toPaise(r[k]), 0)));
  const count = (s) => rows.filter((r) => r.payroll_status === s).length;

  const apply = async () => {
    setBusy(true);
    try {
      await payroll.setStatus(change.record.payroll_id, change.to);
      toast.push({ tone: 'ok', text: `${change.record.payroll_id} is now ${change.to}.` });
      setChange(null);
      reload();
    } catch (err) {
      toast.push({ tone: 'bad', text: err.message });
      setChange(null);
      reload();
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'payroll_id', label: LABELS.payroll_id, mono: true },
    { key: 'employee', label: 'Employee', render: (r) => <>{r.employee_name} <span className="mono muted">{r.employee_id}</span></> },
    { key: 'pay_period', label: LABELS.pay_period, mono: true, render: (r) => period(r.pay_period) },
    { key: 'days_present', label: LABELS.days_present, align: 'right', mono: true },
    { key: 'gross_salary', label: LABELS.gross_salary, align: 'right', mono: true, render: (r) => inr(r.gross_salary) },
    { key: 'total_deductions', label: LABELS.total_deductions, align: 'right', mono: true, render: (r) => inr(r.total_deductions) },
    { key: 'net_salary', label: LABELS.net_salary, align: 'right', mono: true, render: (r) => inr(r.net_salary) },
    { key: 'payroll_status', label: LABELS.payroll_status, render: (r) => <StatusBadge value={r.payroll_status} /> },
    {
      key: 'actions',
      label: <span className="visually-hidden">Actions</span>,
      align: 'right',
      render: (r) => (
        <span style={{ display: 'inline-flex', gap: 4 }}>
          <button type="button" className="btn btn--ghost" onClick={() => setDetail(r.payroll_id)} aria-label={`Details of ${r.payroll_id}`}>
            Details
          </button>
          {ACTIONS[r.payroll_status].map((a) => (
            <button key={a.to} type="button" className="btn btn--ghost" onClick={() => setChange({ record: r, ...a })}>
              {a.label}
            </button>
          ))}
        </span>
      ),
    },
  ];

  const set = (e) => setDraft((d) => ({ ...d, [e.target.name]: e.target.value }));

  return (
    <>
      <PageHeader title="Payroll Records" subtitle="Processed payroll lines. Amounts cannot be edited after processing; only the status changes." />
      <LoadWarning errors={[emps.error]} onRetry={emps.reload} what="The employee list" />
      <section className="card">
        <form
          className="toolbar"
          onSubmit={(e) => {
            e.preventDefault();
            setFilters({ ...draft });
          }}
        >
          <FormField label={LABELS.pay_period}>
            <input className="input mono" type="month" name="pay_period" value={draft.pay_period} onChange={set} />
          </FormField>
          <FormField label="Employee">
            <select className="select" name="employee_id" value={draft.employee_id} onChange={set} disabled={emps.loading}>
              <option value="">All employees</option>
              {(emps.data || []).map((e) => (
                <option key={e.employee_id} value={e.employee_id}>
                  {e.employee_id} · {e.employee_name}
                </option>
              ))}
            </select>
          </FormField>
          <button type="submit" className="btn btn--primary">
            Show
          </button>
        </form>
      </section>
      <StatRow>
        <StatCard label="Payroll lines" mono loading={loading} value={data ? rows.length : '—'} hint={data ? `Processed ${count('Processed')} · Paid ${count('Paid')} · On Hold ${count('On Hold')}` : undefined} />
        <StatCard label={`Total ${LABELS.gross_salary}`} mono loading={loading} value={data ? sum('gross_salary') : '—'} />
        <StatCard label={`Total ${LABELS.total_deductions}`} mono loading={loading} value={data ? sum('total_deductions') : '—'} />
        <StatCard label={`Total ${LABELS.net_salary}`} mono loading={loading} value={data ? sum('net_salary') : '—'} />
      </StatRow>
      <section className="card card--flush">
        <DataTable caption="Payroll records" columns={columns} rows={rows} loading={loading} error={error} onRetry={reload} empty="No payroll records for these filters" rowKey={(r) => r.payroll_id} />
      </section>

      <Modal
        open={Boolean(detail)}
        title="Payroll record"
        onClose={() => setDetail(null)}
        footer={
          <button type="button" className="btn" onClick={() => setDetail(null)}>
            Close
          </button>
        }
      >
        {detail && <Detail id={detail} />}
      </Modal>

      <ConfirmDialog
        open={Boolean(change)}
        title={change ? `${change.label}?` : ''}
        confirmLabel={change ? change.label : ''}
        tone={change ? change.tone : 'primary'}
        busy={busy}
        onConfirm={apply}
        onCancel={() => setChange(null)}
      >
        {change && (
          <p>
            Change <Mono>{change.record.payroll_id}</Mono> for <strong>{change.record.employee_name}</strong> ({period(change.record.pay_period)}, net{' '}
            <Mono>{inr(change.record.net_salary)}</Mono>) from <strong>{change.record.payroll_status}</strong> to <strong>{change.to}</strong>?
            {change.to === 'Paid' && ' Paid is final and cannot be changed again.'}
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}
