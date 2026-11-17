// UC-17 (includes UC-02, UC-12, UC-15) | FR-17 | Finance Manager | API: GET /reports/financial?report_type&from_date&to_date&department
// BR-23, NFR-17. Only Processed/Paid payroll lines whose pay period falls in the range; attendance totals for the range.
import { useEffect, useState } from 'react';
import { fieldErrors } from '../../api/client';
import { reports } from '../../api/endpoints';
import DataTable from '../../components/DataTable';
import FormField from '../../components/FormField';
import Mono from '../../components/Mono';
import PageHeader from '../../components/PageHeader';
import StatCard, { StatRow } from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { ErrorState } from '../../components/States';
import { dateTime, inr, period } from '../../lib/format';
import { DEPARTMENTS, FINANCIAL_REPORT_TYPES, LABELS } from '../../lib/labels';
import { monthBounds, prevPeriod, serverNow } from '../../lib/serverDate';
import { fromNotAfterTo } from '../../lib/validators';

const deptColumns = [
  { key: 'department', label: LABELS.department },
  { key: 'employees_paid', label: 'Employees paid', align: 'right', mono: true },
  { key: 'department_total_gross', label: 'Total Gross', align: 'right', mono: true, render: (r) => inr(r.department_total_gross) },
  { key: 'department_total_deductions', label: 'Total Deductions', align: 'right', mono: true, render: (r) => inr(r.department_total_deductions) },
  { key: 'department_total_net', label: 'Total Net', align: 'right', mono: true, render: (r) => inr(r.department_total_net) },
  { key: 'days_present', label: LABELS.days_present, align: 'right', mono: true },
];
const lineColumns = [
  { key: 'payroll_id', label: LABELS.payroll_id, mono: true },
  { key: 'employee', label: 'Employee', render: (r) => <>{r.employee_name} <span className="mono muted">{r.employee_id}</span></> },
  { key: 'department', label: LABELS.department },
  { key: 'pay_period', label: LABELS.pay_period, mono: true, render: (r) => period(r.pay_period) },
  { key: 'gross_salary', label: LABELS.gross_salary, align: 'right', mono: true, render: (r) => inr(r.gross_salary) },
  { key: 'total_deductions', label: LABELS.total_deductions, align: 'right', mono: true, render: (r) => inr(r.total_deductions) },
  { key: 'net_salary', label: LABELS.net_salary, align: 'right', mono: true, render: (r) => inr(r.net_salary) },
  { key: 'payroll_status', label: LABELS.payroll_status, render: (r) => <StatusBadge value={r.payroll_status} /> },
];

export default function FinancialReport() {
  const [form, setForm] = useState({ report_type: 'Financial', from_date: '', to_date: '', department: '' });
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ report: null, error: null, loading: false });
  const [nowError, setNowError] = useState(null);

  // Default period: the previous (last complete) month on the server clock
  useEffect(() => {
    serverNow()
      .then((n) => {
        const m = monthBounds(prevPeriod(n.period));
        setForm((f) => ({ ...f, from_date: m.from, to_date: m.to }));
      })
      .catch(setNowError);
  }, []);

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const generate = async (e) => {
    e && e.preventDefault();
    const fe = {};
    if (!form.from_date) fe.from_date = 'From Date is required';
    if (!form.to_date) fe.to_date = 'To Date is required';
    const order = fromNotAfterTo(form.from_date, form.to_date);
    if (order) fe.to_date = order;
    setErrors(fe);
    if (Object.keys(fe).length) return;
    setState({ report: null, error: null, loading: true });
    try {
      const res = await reports.financial(form);
      setState({ report: res.data, error: null, loading: false });
    } catch (err) {
      setErrors(fieldErrors(err));
      setState({ report: null, error: err, loading: false });
    }
  };

  const r = state.report;
  if (nowError) return <ErrorState error={nowError} />;

  return (
    <>
      <PageHeader
        title="Financial / Payroll Report"
        subtitle="Payroll cost by department from Processed and Paid payroll lines, with attendance totals for the same period."
        actions={
          <button type="button" className="btn" onClick={() => window.print()} disabled={!r}>
            Print
          </button>
        }
      />
      <section className="card no-print">
        <form className="toolbar" onSubmit={generate} noValidate>
          <FormField label={LABELS.report_type}>
            <select className="select" name="report_type" value={form.report_type} onChange={set}>
              {FINANCIAL_REPORT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </FormField>
          <FormField label={LABELS.from} error={errors.from_date}>
            <input className="input" type="date" name="from_date" value={form.from_date} onChange={set} />
          </FormField>
          <FormField label={LABELS.to} error={errors.to_date}>
            <input className="input" type="date" name="to_date" value={form.to_date} onChange={set} />
          </FormField>
          <FormField label={LABELS.department} error={errors.department}>
            <select className="select" name="department" value={form.department} onChange={set}>
              <option value="">All departments</option>
              {DEPARTMENTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </FormField>
          <button type="submit" className="btn btn--primary" disabled={state.loading || !form.from_date}>
            {state.loading ? 'Generating…' : 'Generate report'}
          </button>
        </form>
        <p className="small muted" style={{ marginTop: 8 }}>
          Payroll: one row per payroll line plus department totals. Financial: department totals only.
        </p>
      </section>

      {state.error && !Object.keys(errors).length && (
        <div className="card">
          <ErrorState error={state.error} onRetry={generate} />
        </div>
      )}

      {(r || state.loading) && (
        <>
          <section className="card" aria-busy={state.loading} aria-labelledby="fin-title">
            <h2 id="fin-title" style={{ fontSize: 'var(--fs-28)' }}>
              {r ? r.report_title : 'Generating report…'}
            </h2>
            {r && (
              <p className="muted small" style={{ marginTop: 4 }}>
                {LABELS.generated_ts}: <Mono>{dateTime(r.generated_ts)}</Mono> · Pay periods included:{' '}
                {r.pay_periods.length ? r.pay_periods.map((p) => <Mono key={p}>{period(p)} </Mono>) : 'none'} · Payroll lines: <Mono>{r.payroll_lines}</Mono>
              </p>
            )}
          </section>
          <StatRow>
            <StatCard label={LABELS.total_payroll_cost} mono loading={state.loading} value={r && inr(r.total_payroll_cost)} hint="Sum of Gross Salary" />
            <StatCard label={LABELS.total_deductions} mono loading={state.loading} value={r && inr(r.total_deductions)} />
            <StatCard label={`Total ${LABELS.net_salary}`} mono loading={state.loading} value={r && inr(r.total_net)} />
            <StatCard label={`${LABELS.days_present} (attendance)`} mono loading={state.loading} value={r && r.total_days_present} hint="UC-02 attendance totals" />
          </StatRow>
          <section className="card card--flush" aria-labelledby="dept-h">
            <h2 id="dept-h" className="card__title" style={{ padding: '16px 16px 0' }}>
              By department
            </h2>
            <DataTable caption="Department totals" columns={deptColumns} rows={r ? r.departments : []} loading={state.loading} empty="No processed payroll in this period" rowKey={(x) => x.department} />
          </section>
          {r && r.rows && (
            <section className="card card--flush" aria-labelledby="lines-h">
              <h2 id="lines-h" className="card__title" style={{ padding: '16px 16px 0' }}>
                Payroll lines
              </h2>
              <DataTable caption="Payroll lines" columns={lineColumns} rows={r.rows} empty="No payroll lines in this period" rowKey={(x) => x.payroll_id} />
            </section>
          )}
        </>
      )}
    </>
  );
}
