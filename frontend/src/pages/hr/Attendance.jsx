// UC-02 | FR-2 | HR Manager | API: GET /attendance?employee_id&from&to (BR-03: HR Manager sees all employees)
import { useEffect, useState } from 'react';
import { attendance } from '../../api/endpoints';
import DataTable from '../../components/DataTable';
import FormField from '../../components/FormField';
import LoadWarning from '../../components/LoadWarning';
import Mono from '../../components/Mono';
import PageHeader from '../../components/PageHeader';
import StatCard, { StatRow } from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { date, time } from '../../lib/format';
import { LABELS } from '../../lib/labels';
import { monthBounds, prevPeriod, serverNow } from '../../lib/serverDate';
import useAsync from '../../lib/useAsync';
import useEmployees, { employeeOption } from '../../lib/useEmployees';
import { fromNotAfterTo } from '../../lib/validators';

const recordColumns = [
  { key: 'att_date', label: LABELS.att_date, render: (r) => date(r.att_date) },
  { key: 'employee_id', label: LABELS.employee_id, mono: true },
  { key: 'employee_name', label: LABELS.employee_name },
  { key: 'checkin_time', label: LABELS.checkin_time, mono: true, render: (r) => time(r.checkin_time) },
  { key: 'checkout_time', label: LABELS.checkout_time, mono: true, render: (r) => time(r.checkout_time) },
  { key: 'att_status', label: LABELS.att_status, render: (r) => <StatusBadge value={r.att_status} /> },
];
const summaryColumns = [
  { key: 'employee_id', label: LABELS.employee_id, mono: true },
  { key: 'employee_name', label: LABELS.employee_name },
  { key: 'days_present', label: LABELS.days_present, align: 'right', mono: true },
];

export default function HrAttendance() {
  const emps = useEmployees();
  const now = useAsync(() => serverNow(), []);
  const [draft, setDraft] = useState({ employee_id: '', from: '', to: '' });
  const [query, setQuery] = useState(null);
  const [formError, setFormError] = useState('');

  // Default: the previous month (the last complete month) on the server clock
  useEffect(() => {
    if (now.data && !query) {
      const q = { employee_id: '', ...monthBounds(prevPeriod(now.data.period)) };
      setDraft(q);
      setQuery(q);
    }
  }, [now.data, query]);

  const list = useAsync(async () => (query ? (await attendance.all(query)).data : null), [
    query && query.employee_id,
    query && query.from,
    query && query.to,
  ]);

  const set = (e) => setDraft((d) => ({ ...d, [e.target.name]: e.target.value }));
  const submit = (e) => {
    e.preventDefault();
    const msg = !draft.from || !draft.to ? 'Choose both dates' : fromNotAfterTo(draft.from, draft.to);
    setFormError(msg);
    if (!msg) setQuery({ ...draft });
  };

  const totalPresent = list.data ? list.data.summary.reduce((s, x) => s + x.days_present, 0) : null;

  return (
    <>
      <PageHeader title="Attendance" subtitle="Attendance of all employees for a period." />
      <LoadWarning errors={[emps.error]} onRetry={emps.reload} what="The employee list" />
      <section className="card">
        <form className="toolbar" onSubmit={submit} noValidate>
          <FormField label="Employee">
            <select className="select" name="employee_id" value={draft.employee_id} onChange={set} disabled={emps.loading}>
              <option value="">All employees</option>
              {(emps.data || []).map((e) => (
                <option key={e.employee_id} value={e.employee_id}>
                  {employeeOption(e)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label={LABELS.from} error={formError}>
            <input className="input" type="date" name="from" value={draft.from} onChange={set} />
          </FormField>
          <FormField label={LABELS.to}>
            <input className="input" type="date" name="to" value={draft.to} onChange={set} />
          </FormField>
          <button type="submit" className="btn btn--primary">
            Show
          </button>
        </form>
      </section>

      <StatRow>
        <StatCard label="Attendance records" mono loading={list.loading} value={list.data ? list.data.records.length : '—'} />
        <StatCard label="Employees with records" mono loading={list.loading} value={list.data ? list.data.summary.length : '—'} />
        <StatCard
          label={`Total ${LABELS.days_present}`}
          mono
          loading={list.loading}
          value={totalPresent ?? '—'}
          hint={query ? <>{date(query.from)} – {date(query.to)}</> : undefined}
        />
      </StatRow>

      <section className="card card--flush" aria-labelledby="sum-h">
        <h2 id="sum-h" className="card__title" style={{ padding: '16px 16px 0' }}>
          {LABELS.days_present} by employee
        </h2>
        <DataTable
          caption="Days present by employee"
          columns={summaryColumns}
          rows={list.data ? list.data.summary : []}
          loading={list.loading || !query}
          error={list.error || now.error}
          onRetry={() => (now.error ? now.reload() : list.reload())}
          empty="No attendance in this period"
          rowKey={(r) => r.employee_id}
        />
      </section>

      <section className="card card--flush" aria-labelledby="rec-h">
        <h2 id="rec-h" className="card__title" style={{ padding: '16px 16px 0' }}>
          Attendance records {query && query.employee_id && <Mono>({query.employee_id})</Mono>}
        </h2>
        <DataTable
          caption="Attendance records"
          columns={recordColumns}
          rows={list.data ? list.data.records : []}
          loading={list.loading || !query}
          error={list.error}
          onRetry={list.reload}
          empty="No attendance records in this period"
          rowKey={(r) => r.attendance_id}
        />
      </section>
    </>
  );
}
