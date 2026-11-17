// UC-11 | FR-11 | HR Manager, Payroll Officer, Finance Manager | API: GET /salary?employee_id&pay_period (BR-15, NFR-11)
// Shared by /hr/salary, /payroll/salary and /finance/salary. No bank data is returned by this endpoint.
import { useState } from 'react';
import { salary } from '../../api/endpoints';
import DataTable from '../../components/DataTable';
import FormField from '../../components/FormField';
import LoadWarning from '../../components/LoadWarning';
import PageHeader from '../../components/PageHeader';
import StatCard, { StatRow } from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { inr, period } from '../../lib/format';
import { LABELS } from '../../lib/labels';
import useAsync from '../../lib/useAsync';
import { payPeriod as payPeriodRule } from '../../lib/validators';
import { fromPaise, toPaise } from '../../lib/money';

const columns = [
  { key: 'employee_id', label: LABELS.employee_id, mono: true },
  { key: 'employee_name', label: LABELS.employee_name },
  { key: 'department', label: LABELS.department },
  { key: 'basic_salary', label: LABELS.basic_salary, align: 'right', mono: true, render: (r) => inr(r.basic_salary) },
  { key: 'pay_period', label: LABELS.pay_period, mono: true, render: (r) => (r.pay_period ? period(r.pay_period) : '—') },
  { key: 'gross_salary', label: LABELS.gross_salary, align: 'right', mono: true, render: (r) => inr(r.gross_salary) },
  { key: 'total_deductions', label: LABELS.total_deductions, align: 'right', mono: true, render: (r) => inr(r.total_deductions) },
  { key: 'net_salary', label: LABELS.net_salary, align: 'right', mono: true, render: (r) => inr(r.net_salary) },
  { key: 'payroll_status', label: LABELS.payroll_status, render: (r) => (r.payroll_status ? <StatusBadge value={r.payroll_status} /> : <span className="muted">Not processed</span>) },
];

/** One row per employee per pay period; employees without payroll lines get one row with the basic salary only. */
function flatten(list) {
  return list.flatMap((e) =>
    e.periods.length
      ? e.periods.map((p) => ({ ...p, employee_id: e.employee_id, employee_name: e.employee_name, department: e.department, basic_salary: e.basic_salary }))
      : [{ employee_id: e.employee_id, employee_name: e.employee_name, department: e.department, basic_salary: e.basic_salary }]
  );
}

export default function SalaryView({ subtitle }) {
  const options = useAsync(async () => (await salary.list()).data, []); // employee picker (works for all three roles)
  const [draft, setDraft] = useState({ employee_id: '', pay_period: '' });
  const [filters, setFilters] = useState(draft);
  const [formError, setFormError] = useState('');
  const { data, error, loading, reload } = useAsync(async () => (await salary.list(filters)).data, [filters.employee_id, filters.pay_period]);

  const rows = data ? flatten(data) : [];
  const lines = rows.filter((r) => r.payroll_id);
  const sum = (k) => fromPaise(lines.reduce((s, r) => s + toPaise(r[k]), 0));

  const set = (e) => setDraft((d) => ({ ...d, [e.target.name]: e.target.value }));
  const submit = (e) => {
    e.preventDefault();
    const msg = draft.pay_period ? payPeriodRule(draft.pay_period) : '';
    setFormError(msg);
    if (!msg) setFilters({ ...draft });
  };

  return (
    <>
      <PageHeader title="Salary View" subtitle={subtitle || 'Basic salary and processed pay periods of employees.'} />
      <LoadWarning errors={[options.error]} onRetry={options.reload} what="The employee list" />
      <section className="card">
        <form className="toolbar" onSubmit={submit} noValidate>
          <FormField label="Employee">
            <select className="select" name="employee_id" value={draft.employee_id} onChange={set} disabled={options.loading}>
              <option value="">All employees</option>
              {(options.data || []).map((e) => (
                <option key={e.employee_id} value={e.employee_id}>
                  {e.employee_id} · {e.employee_name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label={LABELS.pay_period} error={formError}>
            <input className="input" type="month" name="pay_period" value={draft.pay_period} onChange={set} />
          </FormField>
          <button type="submit" className="btn btn--primary">
            Show
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              const empty = { employee_id: '', pay_period: '' };
              setDraft(empty);
              setFilters(empty);
              setFormError('');
            }}
          >
            Clear
          </button>
        </form>
      </section>
      <StatRow>
        <StatCard label="Employees" mono loading={loading} value={data ? data.length : '—'} />
        <StatCard label="Pay period lines" mono loading={loading} value={data ? lines.length : '—'} />
        <StatCard label={`Total ${LABELS.gross_salary}`} mono loading={loading} value={data ? inr(sum('gross_salary')) : '—'} hint={filters.pay_period ? period(filters.pay_period) : 'All periods shown'} />
        <StatCard label={`Total ${LABELS.net_salary}`} mono loading={loading} value={data ? inr(sum('net_salary')) : '—'} />
      </StatRow>
      <section className="card card--flush">
        <DataTable
          caption="Salary of employees"
          columns={columns}
          rows={rows}
          loading={loading}
          error={error}
          onRetry={reload}
          empty="No salary information for these filters"
          rowKey={(r, i) => `${r.employee_id}-${r.payroll_id || i}`}
        />
      </section>
    </>
  );
}
