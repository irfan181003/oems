// UC-07 | FR-7 | HR Manager | API: GET /employees?department&status&q (bank account masked in the list)
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { employees } from '../../api/endpoints';
import DataTable from '../../components/DataTable';
import FormField from '../../components/FormField';
import PageHeader from '../../components/PageHeader';
import StatCard, { StatRow } from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { DEPARTMENTS, EMPLOYMENT_STATUSES, LABELS } from '../../lib/labels';
import useAsync from '../../lib/useAsync';

const columns = [
  {
    key: 'employee_id',
    label: LABELS.employee_id,
    render: (r) => (
      <Link to={`/hr/employees/${r.employee_id}`} className="mono">
        {r.employee_id}
      </Link>
    ),
  },
  { key: 'employee_name', label: LABELS.employee_name },
  { key: 'department', label: LABELS.department },
  { key: 'designation', label: LABELS.designation },
  { key: 'contact_number', label: LABELS.contact_number, mono: true },
  { key: 'email', label: LABELS.email },
  { key: 'employment_status', label: LABELS.employment_status, render: (r) => <StatusBadge value={r.employment_status} /> },
  { key: 'bank_account', label: LABELS.bank_account, mono: true },
];

export default function Employees() {
  const [draft, setDraft] = useState({ q: '', department: '', status: '' });
  const [filters, setFilters] = useState(draft);
  const { data, error, loading, reload } = useAsync(async () => (await employees.list(filters)).data, [
    filters.q,
    filters.department,
    filters.status,
  ]);
  const count = (s) => (data ? data.filter((e) => e.employment_status === s).length : '—');
  const set = (e) => setDraft((d) => ({ ...d, [e.target.name]: e.target.value }));

  return (
    <>
      <PageHeader
        title="Employees"
        subtitle="Search and maintain employee records."
        actions={
          <Link className="btn btn--primary" to="/hr/employees/new">
            Register Employee
          </Link>
        }
      />
      <StatRow>
        <StatCard label="Employees shown" mono loading={loading} value={data ? data.length : '—'} />
        <StatCard label="Active" mono loading={loading} value={count('Active')} />
        <StatCard label="Resigned" mono loading={loading} value={count('Resigned')} />
        <StatCard label="Retired" mono loading={loading} value={count('Retired')} />
      </StatRow>
      <section className="card card--flush">
        <form
          className="toolbar"
          style={{ padding: 16 }}
          onSubmit={(e) => {
            e.preventDefault();
            setFilters({ ...draft, q: draft.q.trim() });
          }}
        >
          <FormField label="Search" hint="Name, e-mail or Employee ID">
            <input className="input" type="search" name="q" maxLength={100} value={draft.q} onChange={set} />
          </FormField>
          <FormField label={LABELS.department}>
            <select className="select" name="department" value={draft.department} onChange={set}>
              <option value="">All departments</option>
              {DEPARTMENTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </FormField>
          <FormField label={LABELS.employment_status}>
            <select className="select" name="status" value={draft.status} onChange={set}>
              <option value="">All statuses</option>
              {EMPLOYMENT_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </FormField>
          <button type="submit" className="btn">
            Apply
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              const empty = { q: '', department: '', status: '' };
              setDraft(empty);
              setFilters(empty);
            }}
          >
            Clear
          </button>
        </form>
        <DataTable
          caption="Employees"
          columns={columns}
          rows={data || []}
          loading={loading}
          error={error}
          onRetry={reload}
          empty="No employees match these filters"
          rowKey={(r) => r.employee_id}
        />
      </section>
    </>
  );
}
