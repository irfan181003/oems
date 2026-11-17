// UC-03, UC-04 (status) | FR-3, FR-4 | Employee | API: GET /leaves/me
import { Link } from 'react-router-dom';
import { leaves } from '../../api/endpoints';
import DataTable from '../../components/DataTable';
import PageHeader from '../../components/PageHeader';
import StatCard, { StatRow } from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { date, orDash } from '../../lib/format';
import { LABELS } from '../../lib/labels';
import useAsync from '../../lib/useAsync';

const columns = [
  { key: 'leave_id', label: LABELS.leave_id, mono: true },
  { key: 'leave_type', label: LABELS.leave_type },
  { key: 'leave_start', label: LABELS.leave_start, render: (r) => date(r.leave_start) },
  { key: 'leave_end', label: LABELS.leave_end, render: (r) => date(r.leave_end) },
  { key: 'leave_days', label: LABELS.leave_days, align: 'right', mono: true },
  { key: 'applied_date', label: LABELS.applied_date, render: (r) => date(r.applied_date) },
  { key: 'leave_status', label: LABELS.leave_status, render: (r) => <StatusBadge value={r.leave_status} /> },
  { key: 'decision_date', label: LABELS.decision_date, render: (r) => date(r.decision_date) },
  { key: 'hr_remarks', label: LABELS.hr_remarks, wrap: true, render: (r) => orDash(r.hr_remarks) },
];

export default function MyLeaves() {
  const { data, error, loading, reload } = useAsync(async () => (await leaves.mine()).data, []);
  const count = (s) => (data ? data.filter((l) => l.leave_status === s).length : '—');

  return (
    <>
      <PageHeader
        title="My Leaves"
        subtitle="Your leave applications and the HR Manager's decisions."
        actions={
          <Link className="btn btn--primary" to="/employee/leave/new">
            Apply Leave
          </Link>
        }
      />
      <StatRow>
        <StatCard label="Pending" mono loading={loading} value={count('Pending')} />
        <StatCard label="Approved" mono loading={loading} value={count('Approved')} />
        <StatCard label="Rejected" mono loading={loading} value={count('Rejected')} />
      </StatRow>
      <section className="card card--flush">
        <DataTable
          caption="My leave applications"
          columns={columns}
          rows={data || []}
          loading={loading}
          error={error}
          onRetry={reload}
          empty="No leave applications yet"
          rowKey={(r) => r.leave_id}
        />
      </section>
    </>
  );
}
