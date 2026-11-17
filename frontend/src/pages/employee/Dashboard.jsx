// UC-01, UC-02, UC-03 | FR-1, FR-2, FR-3 | Employee | API: GET /attendance/me?from=today&to=today, GET /leaves/me
import { Link } from 'react-router-dom';
import { attendance, leaves } from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';
import PageHeader from '../../components/PageHeader';
import StatCard, { StatRow } from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { ErrorState } from '../../components/States';
import { date, time } from '../../lib/format';
import { serverNow } from '../../lib/serverDate';
import useAsync from '../../lib/useAsync';

export default function Dashboard() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useAsync(async () => {
    const now = await serverNow(); // "today" from the server clock, never the browser
    const [att, lv] = await Promise.all([attendance.mine(now.today, now.today), leaves.mine()]);
    return { today: now.today, record: att.data.records[0] || null, leaves: lv.data };
  }, []);

  const record = data && data.record;
  const pending = data ? data.leaves.filter((l) => l.leave_status === 'Pending').length : 0;

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.name}`}
        subtitle={data ? `Today is ${date(data.today)}` : 'Your attendance and leave at a glance'}
        actions={
          <>
            <Link className="btn btn--primary" to="/employee/attendance">
              {record && !record.checkout_time ? 'Check out' : 'Check in'}
            </Link>
            <Link className="btn" to="/employee/leave/new">
              Apply Leave
            </Link>
          </>
        }
      />
      {error ? (
        <div className="card">
          <ErrorState error={error} onRetry={reload} />
        </div>
      ) : (
        <StatRow>
          <StatCard
            label="Today's attendance"
            loading={loading}
            value={record ? <StatusBadge value={record.att_status} /> : 'Not checked in'}
          />
          <StatCard label="Check-in Time" loading={loading} mono value={record ? time(record.checkin_time) : '—'} />
          <StatCard label="Check-out Time" loading={loading} mono value={record ? time(record.checkout_time) : '—'} />
          <StatCard
            label="Pending leave applications"
            loading={loading}
            mono
            value={pending}
            hint={<Link to="/employee/leave">View my leaves</Link>}
          />
        </StatRow>
      )}
    </>
  );
}
