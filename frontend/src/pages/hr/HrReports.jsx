// UC-16 | FR-16 | HR Manager | API: GET /reports/hr?report_type&from_date&to_date&department (BR-22, NFR-16)
// The report contains no salary or bank data. Every report type needs a valid period (BR-22).
import { useEffect, useState } from 'react';
import { reports } from '../../api/endpoints';
import DataTable from '../../components/DataTable';
import FormField from '../../components/FormField';
import Mono from '../../components/Mono';
import PageHeader from '../../components/PageHeader';
import StatCard, { StatRow } from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { ErrorState } from '../../components/States';
import { date, dateTime } from '../../lib/format';
import { DEPARTMENTS, HR_REPORT_TYPES, LABELS } from '../../lib/labels';
import { monthBounds, prevPeriod, serverNow } from '../../lib/serverDate';
import { fromNotAfterTo } from '../../lib/validators';
import { fieldErrors } from '../../api/client';

const COLUMNS = {
  Attendance: [
    { key: 'employee_id', label: LABELS.employee_id, mono: true },
    { key: 'employee_name', label: LABELS.employee_name },
    { key: 'department', label: LABELS.department },
    { key: 'employment_status', label: LABELS.employment_status, render: (r) => <StatusBadge value={r.employment_status} /> },
    { key: 'days_present', label: LABELS.days_present, align: 'right', mono: true },
  ],
  Leave: [
    { key: 'leave_id', label: LABELS.leave_id, mono: true },
    { key: 'employee_name', label: LABELS.employee_name },
    { key: 'department', label: LABELS.department },
    { key: 'leave_type', label: LABELS.leave_type },
    { key: 'leave_start', label: LABELS.leave_start, render: (r) => date(r.leave_start) },
    { key: 'leave_end', label: LABELS.leave_end, render: (r) => date(r.leave_end) },
    { key: 'leave_days', label: LABELS.leave_days, align: 'right', mono: true },
    { key: 'leave_status', label: LABELS.leave_status, render: (r) => <StatusBadge value={r.leave_status} /> },
  ],
  Headcount: [
    { key: 'department', label: LABELS.department },
    { key: 'headcount', label: 'Active employees', align: 'right', mono: true },
  ],
  Employee: [
    { key: 'employee_id', label: LABELS.employee_id, mono: true },
    { key: 'employee_name', label: LABELS.employee_name },
    { key: 'department', label: LABELS.department },
    { key: 'designation', label: LABELS.designation },
    { key: 'date_of_joining', label: LABELS.date_of_joining, render: (r) => date(r.date_of_joining) },
    { key: 'employment_status', label: LABELS.employment_status, render: (r) => <StatusBadge value={r.employment_status} /> },
  ],
};

function Aggregates({ report }) {
  const a = report.aggregates;
  switch (report.report_type) {
    case 'Attendance':
      return (
        <>
          <StatCard label="Employees in report" mono value={a.employees} />
          <StatCard label={`Total ${LABELS.days_present}`} mono value={a.total_days_present} />
        </>
      );
    case 'Leave':
      return (
        <>
          <StatCard label="Applications" mono value={a.applications} />
          <StatCard label="Pending · Approved · Rejected" mono value={`${a.by_status.Pending} · ${a.by_status.Approved} · ${a.by_status.Rejected}`} />
        </>
      );
    case 'Headcount':
      return <StatCard label="Departments" mono value={a.departments} />;
    case 'Employee':
      return (
        <>
          <StatCard label="Employees" mono value={a.employees} />
          <StatCard label="Active · Resigned · Retired" mono value={`${a.by_status.Active} · ${a.by_status.Resigned} · ${a.by_status.Retired}`} />
        </>
      );
    default:
      return null;
  }
}

export default function HrReports() {
  const [form, setForm] = useState({ report_type: 'Attendance', from_date: '', to_date: '', department: '' });
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
      const res = await reports.hr(form);
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
        title="HR Reports"
        subtitle="Attendance, leave, headcount and employee reports. Salary and bank data are never included."
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
              {HR_REPORT_TYPES.map((t) => (
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
      </section>

      {state.error && !Object.keys(errors).length && (
        <div className="card">
          <ErrorState error={state.error} onRetry={generate} />
        </div>
      )}

      {(r || state.loading) && (
        <section className="card card--flush" aria-busy={state.loading} aria-labelledby="report-title">
          <div style={{ padding: '24px 24px 8px', display: 'grid', gap: 4 }}>
            <h2 id="report-title" style={{ fontSize: 'var(--fs-28)' }}>
              {r ? r.report_title : 'Generating report…'}
            </h2>
            {r && (
              <p className="muted small">
                {LABELS.generated_ts}: <Mono>{dateTime(r.generated_ts)}</Mono> · {LABELS.headcount} (active employees
                {r.department ? ` in ${r.department}` : ''}): <Mono>{r.headcount}</Mono>
              </p>
            )}
          </div>
          {r && (
            <div style={{ padding: '8px 24px 16px' }}>
              <StatRow>
                <StatCard label={LABELS.headcount} mono value={r.headcount} />
                <Aggregates report={r} />
              </StatRow>
            </div>
          )}
          <DataTable
            caption={r ? r.report_title : 'Report'}
            columns={COLUMNS[r ? r.report_type : form.report_type]}
            rows={r ? r.rows : []}
            loading={state.loading}
            empty="No records for this report"
            rowKey={(row, i) => row.leave_id || row.employee_id || row.department || i}
          />
        </section>
      )}
    </>
  );
}
