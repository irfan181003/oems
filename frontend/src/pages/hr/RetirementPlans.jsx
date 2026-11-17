// UC-20 | FR-20 | HR Manager | API: POST /retirement-plans, GET /retirement-plans, PATCH /retirement-plans/:id (BR-24, BR-25, NFR-20)
import { useState } from 'react';
import { retirementPlans } from '../../api/endpoints';
import DataTable from '../../components/DataTable';
import FormField from '../../components/FormField';
import Modal from '../../components/Modal';
import Mono from '../../components/Mono';
import PageHeader from '../../components/PageHeader';
import StatCard, { StatRow } from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { useToast } from '../../components/Toast';
import { changedFields, showServerErrors } from '../../lib/forms';
import { date, inr, orDash } from '../../lib/format';
import { HINTS, LABELS, PLAN_STATUSES, PLAN_TYPES } from '../../lib/labels';
import useAsync from '../../lib/useAsync';
import useEmployees, { employeeOption } from '../../lib/useEmployees';
import { isoDate, maxLen, money, required, validate } from '../../lib/validators';

const PLAN_FIELDS = ['retirement_date', 'plan_type', 'contribution_amount', 'nominee_name'];

/** BR-25: Retirement Date > Date of Joining (client hint; the backend is the real check). */
const afterJoining = (joining) => (v) => (joining && v && v <= joining ? `Must be after the Date of Joining (${date(joining)})` : '');

function PlanForm({ mode, plan, employees, onSaved, onCancel }) {
  const toast = useToast();
  const isNew = mode === 'create';
  const initial = isNew
    ? { employee_id: '', retirement_date: '', plan_type: '', contribution_amount: '', nominee_name: '' }
    : {
        retirement_date: plan.retirement_date,
        plan_type: plan.plan_type,
        contribution_amount: String(plan.contribution_amount),
        nominee_name: plan.nominee_name || '',
        plan_status: plan.plan_status,
      };
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const employeeId = isNew ? form.employee_id : plan.employee_id;
  const emp = employees.find((e) => e.employee_id === employeeId);
  const joining = emp && emp.date_of_joining;

  const submit = async (e) => {
    e.preventDefault();
    const fe = validate(form, {
      ...(isNew ? { employee_id: required('Employee') } : {}),
      retirement_date: [isoDate(LABELS.retirement_date), afterJoining(joining)],
      plan_type: required(LABELS.plan_type),
      contribution_amount: money(LABELS.contribution_amount),
      nominee_name: maxLen(LABELS.nominee_name, 100),
    });
    setErrors(fe);
    if (Object.keys(fe).length) return;
    setBusy(true);
    try {
      if (isNew) {
        const body = { employee_id: form.employee_id, retirement_date: form.retirement_date, plan_type: form.plan_type, contribution_amount: form.contribution_amount.trim() };
        if (form.nominee_name.trim()) body.nominee_name = form.nominee_name.trim();
        const res = await retirementPlans.create(body);
        toast.push({ tone: 'ok', text: `Retirement plan ${res.data.ret_plan_id} created.` });
      } else {
        const original = { ...initial };
        const changes = changedFields(original, form, [...PLAN_FIELDS, 'plan_status']);
        if ('nominee_name' in changes && !changes.nominee_name) changes.nominee_name = null; // clearing the nominee
        if (!Object.keys(changes).length) return onCancel();
        await retirementPlans.update(plan.ret_plan_id, changes);
        toast.push({ tone: 'ok', text: `Retirement plan ${plan.ret_plan_id} updated.` });
      }
      onSaved();
    } catch (err) {
      showServerErrors(err, setErrors, toast, ['employee_id', ...PLAN_FIELDS, 'plan_status']); // e.g. 409 one plan per employee
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit} noValidate id="plan-form">
      {isNew ? (
        <FormField label="Employee" error={errors.employee_id} required>
          <select className="select" name="employee_id" value={form.employee_id} onChange={set}>
            <option value="">Choose an employee</option>
            {employees.map((e) => (
              <option key={e.employee_id} value={e.employee_id}>
                {employeeOption(e)}
              </option>
            ))}
          </select>
        </FormField>
      ) : (
        <p>
          <Mono>{plan.ret_plan_id}</Mono> · {plan.employee_name} (<Mono>{plan.employee_id}</Mono>)
        </p>
      )}
      <FormField label={LABELS.retirement_date} hint={joining ? `${HINTS.retirement_date}: ${date(joining)}` : HINTS.retirement_date} error={errors.retirement_date} required>
        <input className="input" type="date" name="retirement_date" min={joining || undefined} value={form.retirement_date} onChange={set} />
      </FormField>
      <FormField label={LABELS.plan_type} error={errors.plan_type} required>
        <select className="select" name="plan_type" value={form.plan_type} onChange={set}>
          <option value="">Choose a plan type</option>
          {PLAN_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </FormField>
      <FormField label={`${LABELS.contribution_amount} (₹)`} hint={HINTS.contribution_amount} error={errors.contribution_amount} required>
        <input className="input mono" inputMode="decimal" name="contribution_amount" placeholder="0.00" value={form.contribution_amount} onChange={set} />
      </FormField>
      <FormField label={LABELS.nominee_name} hint="Optional" error={errors.nominee_name}>
        <input className="input" name="nominee_name" maxLength={100} value={form.nominee_name} onChange={set} />
      </FormField>
      {!isNew && (
        <FormField label={LABELS.plan_status} error={errors.plan_status}>
          <select className="select" name="plan_status" value={form.plan_status} onChange={set}>
            {PLAN_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </FormField>
      )}
      <div className="form-actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Saving…' : isNew ? 'Create plan' : 'Save changes'}
        </button>
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function RetirementPlans() {
  const emps = useEmployees();
  const { data, error, loading, reload } = useAsync(async () => (await retirementPlans.list()).data, []);
  const [dialog, setDialog] = useState(null); // { mode: 'create' } | { mode: 'edit', plan }

  const withPlan = new Set((data || []).map((p) => p.employee_id));
  const eligible = (emps.data || []).filter((e) => !withPlan.has(e.employee_id)); // one plan per employee (A-1)

  const columns = [
    { key: 'ret_plan_id', label: LABELS.ret_plan_id, mono: true },
    { key: 'employee', label: 'Employee', render: (r) => <>{r.employee_name} <span className="mono muted">{r.employee_id}</span></> },
    { key: 'retirement_date', label: LABELS.retirement_date, render: (r) => date(r.retirement_date) },
    { key: 'plan_type', label: LABELS.plan_type },
    { key: 'contribution_amount', label: LABELS.contribution_amount, align: 'right', mono: true, render: (r) => inr(r.contribution_amount) },
    { key: 'nominee_name', label: LABELS.nominee_name, render: (r) => orDash(r.nominee_name) },
    { key: 'plan_status', label: LABELS.plan_status, render: (r) => <StatusBadge value={r.plan_status} /> },
    {
      key: 'edit',
      label: <span className="visually-hidden">Actions</span>,
      align: 'right',
      render: (r) => (
        <button type="button" className="btn btn--ghost" onClick={() => setDialog({ mode: 'edit', plan: r })} aria-label={`Edit ${r.ret_plan_id}`}>
          Edit
        </button>
      ),
    },
  ];

  const done = () => {
    setDialog(null);
    reload();
  };

  return (
    <>
      <PageHeader
        title="Retirement Plans"
        subtitle="Create and maintain employees' retirement plans. Changes are recorded with your Employee ID."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setDialog({ mode: 'create' })} disabled={emps.loading || loading}>
            New retirement plan
          </button>
        }
      />
      <StatRow>
        <StatCard label="Plans" mono loading={loading} value={data ? data.length : '—'} />
        <StatCard label="Active plans" mono loading={loading} value={data ? data.filter((p) => p.plan_status === 'Active').length : '—'} />
        <StatCard label="Employees without a plan" mono loading={loading || emps.loading} value={emps.data && data ? eligible.length : '—'} />
      </StatRow>
      <section className="card card--flush">
        <DataTable
          caption="Retirement plans"
          columns={columns}
          rows={data || []}
          loading={loading}
          error={error || emps.error}
          onRetry={() => {
            reload();
            emps.reload();
          }}
          empty="No retirement plans yet"
          rowKey={(r) => r.ret_plan_id}
        />
      </section>
      <Modal open={Boolean(dialog)} title={dialog && dialog.mode === 'edit' ? 'Edit retirement plan' : 'New retirement plan'} onClose={() => setDialog(null)}>
        {dialog && (
          <PlanForm mode={dialog.mode} plan={dialog.plan} employees={dialog.mode === 'create' ? eligible : emps.data || []} onSaved={done} onCancel={() => setDialog(null)} />
        )}
      </Modal>
    </>
  );
}
