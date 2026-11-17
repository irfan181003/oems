// UC-11 | FR-11 | Employee | API: GET /salary/me (ASSUMPTION A-4: own salary, payroll lines and payslips only)
import { Link } from 'react-router-dom';
import { salary } from '../../api/endpoints';
import DataTable from '../../components/DataTable';
import PageHeader from '../../components/PageHeader';
import StatCard, { StatRow } from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { inr, period } from '../../lib/format';
import { LABELS } from '../../lib/labels';
import useAsync from '../../lib/useAsync';

export default function MySalary() {
  const { data, error, loading, reload } = useAsync(async () => (await salary.mine()).data, []);
  const slipByPayroll = new Map((data ? data.payslips : []).map((s) => [s.payroll_id, s]));
  const latest = data && data.payroll.length ? data.payroll[0] : null;

  const columns = [
    { key: 'pay_period', label: LABELS.pay_period, render: (r) => <span className="mono">{period(r.pay_period)}</span> },
    { key: 'gross_salary', label: LABELS.gross_salary, align: 'right', mono: true, render: (r) => inr(r.gross_salary) },
    { key: 'total_deductions', label: LABELS.total_deductions, align: 'right', mono: true, render: (r) => inr(r.total_deductions) },
    { key: 'net_salary', label: LABELS.net_salary, align: 'right', mono: true, render: (r) => <strong>{inr(r.net_salary)}</strong> },
    { key: 'payroll_status', label: LABELS.payroll_status, render: (r) => <StatusBadge value={r.payroll_status} /> },
    {
      key: 'payslip',
      label: 'Payslip',
      render: (r) => {
        const slip = slipByPayroll.get(r.payroll_id);
        return slip ? (
          <Link to={`/employee/payslips/${slip.payslip_id}`}>
            View <span className="mono">{slip.payslip_id}</span>
          </Link>
        ) : (
          <span className="muted">Not generated yet</span>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader title="My Salary" subtitle="Your basic salary, processed pay periods and payslips. Only you can see this page." />
      <StatRow>
        <StatCard label={LABELS.basic_salary} mono loading={loading} value={data ? inr(data.basic_salary) : '—'} hint="Monthly" />
        <StatCard
          label={`Latest ${LABELS.net_salary}`}
          mono
          loading={loading}
          value={latest ? inr(latest.net_salary) : '—'}
          hint={latest ? period(latest.pay_period) : 'No pay period processed yet'}
        />
        <StatCard label="Payslips available" mono loading={loading} value={data ? data.payslips.length : '—'} />
      </StatRow>
      <section className="card card--flush">
        <DataTable
          caption="My pay periods"
          columns={columns}
          rows={data ? data.payroll : []}
          loading={loading}
          error={error}
          onRetry={reload}
          empty="No pay periods processed yet"
          rowKey={(r) => r.payroll_id}
        />
      </section>
    </>
  );
}
