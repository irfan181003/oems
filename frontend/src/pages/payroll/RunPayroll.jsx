// UC-12, UC-14 | FR-12, FR-14 | Payroll Officer | API: POST /payroll/run (BR-16..BR-19, BR-28; DE-074, DE-075; ASSUMPTION A-9)
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { payroll } from '../../api/endpoints';
import DataTable from '../../components/DataTable';
import FormField from '../../components/FormField';
import { ConfirmDialog } from '../../components/Modal';
import Mono from '../../components/Mono';
import PageHeader from '../../components/PageHeader';
import StatCard, { StatRow } from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { ErrorState } from '../../components/States';
import { useToast } from '../../components/Toast';
import { fieldErrors } from '../../api/client';
import { period } from '../../lib/format';
import { HINTS, LABELS } from '../../lib/labels';
import { daysInMonth, monthBounds, prevPeriod, serverNow, addDays } from '../../lib/serverDate';
import useAsync from '../../lib/useAsync';
import useSalaryEmployees, { nameOf } from '../../lib/useSalaryEmployees';
import { money, payPeriod as payPeriodRule } from '../../lib/validators';

/** Monday–Friday count of a month: a suggestion for Working Days (the officer can change it). */
function weekdayCount(p) {
  const { from, to } = monthBounds(p);
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (dow !== 0 && dow !== 6) n += 1;
  }
  return n;
}

const newLine = () => ({ employee_id: '', allowances: '0', other_deductions: '0' });

export default function RunPayroll() {
  const toast = useToast();
  const now = useAsync(() => serverNow(), []);
  const emps = useSalaryEmployees();
  const [form, setForm] = useState({ pay_period: '', working_days: '' });
  const [mode, setMode] = useState('all'); // 'all' | 'lines'
  const [lines, setLines] = useState([newLine()]);
  const [errors, setErrors] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  // Default: the previous month (the usual payroll month), with its weekday count as Working Days
  useEffect(() => {
    if (now.data && !form.pay_period) {
      const p = prevPeriod(now.data.period);
      setForm({ pay_period: p, working_days: String(weekdayCount(p)) });
    }
  }, [now.data, form.pay_period]);

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const setLine = (i, k, v) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  const check = () => {
    const fe = {};
    const pp = payPeriodRule(form.pay_period);
    if (pp) fe.pay_period = pp;
    else if (now.data && form.pay_period > now.data.period) fe.pay_period = 'Pay Period must not be in the future'; // DE-074
    const wd = Number(form.working_days);
    if (!pp) {
      const max = daysInMonth(form.pay_period);
      if (!/^\d+$/.test(form.working_days) || wd < 1 || wd > max) fe.working_days = `Between 1 and ${max}`; // DE-075
    }
    if (mode === 'lines') {
      const seen = new Set();
      lines.forEach((l, i) => {
        if (!l.employee_id) fe[`lines.${i}.employee_id`] = 'Choose an employee';
        else if (seen.has(l.employee_id)) fe[`lines.${i}.employee_id`] = 'Employee already listed';
        seen.add(l.employee_id);
        const a = money(LABELS.allowances)(l.allowances);
        if (a) fe[`lines.${i}.allowances`] = a;
        const o = money(LABELS.other_deductions)(l.other_deductions);
        if (o) fe[`lines.${i}.other_deductions`] = o;
      });
    }
    return fe;
  };

  const review = (e) => {
    e.preventDefault();
    const fe = check();
    setErrors(fe);
    if (!Object.keys(fe).length) setConfirming(true);
  };

  const run = async () => {
    setBusy(true);
    try {
      const body = { pay_period: form.pay_period, working_days: Number(form.working_days) };
      if (mode === 'lines') {
        body.lines = lines.map((l) => ({ employee_id: l.employee_id, allowances: l.allowances.trim(), other_deductions: l.other_deductions.trim() }));
      }
      const res = await payroll.run(body);
      setResult(res.data);
      toast.push({ tone: res.data.failed.length ? 'warn' : 'ok', text: res.response_message });
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.push({ tone: 'bad', text: err.message });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  if (now.error) return <ErrorState error={now.error} onRetry={now.reload} />;

  const name = (id) => nameOf(emps.data, id);
  const resultColumns = [
    { key: 'employee_id', label: LABELS.employee_id, mono: true },
    { key: 'name', label: LABELS.employee_name, render: (r) => name(r.employee_id) || '—' },
    { key: 'payroll_id', label: LABELS.payroll_id, mono: true, render: (r) => r.payroll_id || '—' },
    { key: 'reason', label: 'Reason', wrap: true, render: (r) => r.reason || '—' },
  ];

  return (
    <>
      <PageHeader
        title="Run Payroll"
        subtitle="Collect attendance and approved leave, calculate salaries (Proposed formula, BR-17) and store one payroll line per employee for the pay period."
      />
      <form className="card form" onSubmit={review} noValidate style={{ maxWidth: 'none' }}>
        <div className="form-grid" style={{ maxWidth: 560 }}>
          <FormField label={LABELS.pay_period} hint={HINTS.pay_period} error={errors.pay_period} required>
            <input className="input mono" type="month" name="pay_period" max={now.data ? now.data.period : undefined} value={form.pay_period} onChange={set} />
          </FormField>
          <FormField label={LABELS.working_days} hint={form.pay_period && !payPeriodRule(form.pay_period) ? `1 to ${daysInMonth(form.pay_period)}; Mon–Fri in ${period(form.pay_period)}: ${weekdayCount(form.pay_period)}` : HINTS.working_days} error={errors.working_days} required>
            <input className="input mono" type="number" min={1} max={31} name="working_days" value={form.working_days} onChange={set} />
          </FormField>
        </div>

        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 8 }}>
          <legend className="field__label" style={{ marginBottom: 8 }}>
            Employees
          </legend>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="radio" name="mode" value="all" checked={mode === 'all'} onChange={() => setMode('all')} />
            Every Active employee, with no allowances or other deductions
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="radio" name="mode" value="lines" checked={mode === 'lines'} onChange={() => setMode('lines')} />
            Selected employees, with Allowances and Other Deductions
          </label>
        </fieldset>

        {mode === 'lines' && (
          <div style={{ display: 'grid', gap: 12 }}>
            {lines.map((l, i) => (
              <div key={i} className="toolbar" style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 8 }}>
                <FormField label={`Employee ${i + 1}`} error={errors[`lines.${i}.employee_id`]}>
                  <select className="select" value={l.employee_id} onChange={(e) => setLine(i, 'employee_id', e.target.value)} disabled={emps.loading}>
                    <option value="">Choose an employee</option>
                    {(emps.data || []).map((e) => (
                      <option key={e.employee_id} value={e.employee_id}>
                        {e.employee_id} · {e.employee_name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label={`${LABELS.allowances} (₹)`} hint={HINTS.allowances} error={errors[`lines.${i}.allowances`]}>
                  <input className="input mono" inputMode="decimal" value={l.allowances} onChange={(e) => setLine(i, 'allowances', e.target.value)} />
                </FormField>
                <FormField label={`${LABELS.other_deductions} (₹)`} hint={HINTS.other_deductions} error={errors[`lines.${i}.other_deductions`]}>
                  <input className="input mono" inputMode="decimal" value={l.other_deductions} onChange={(e) => setLine(i, 'other_deductions', e.target.value)} />
                </FormField>
                <button type="button" className="btn btn--ghost" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} disabled={lines.length === 1} aria-label={`Remove employee ${i + 1}`}>
                  Remove
                </button>
              </div>
            ))}
            <div>
              <button type="button" className="btn" onClick={() => setLines((ls) => [...ls, newLine()])}>
                Add employee
              </button>
            </div>
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn--primary btn--lg" disabled={busy || now.loading}>
            Run payroll…
          </button>
        </div>
      </form>

      {result && (
        <section className="card" aria-labelledby="result-h" aria-live="polite">
          <h2 id="result-h" className="card__title">
            Result for {period(result.pay_period)} ·{' '}
            {result.status === 'Processed' ? <StatusBadge value="Processed" /> : <span className="badge badge--neutral">{result.status}</span>}
          </h2>
          <StatRow>
            <StatCard label={LABELS.employees_processed} mono value={result.employees_processed} />
            <StatCard label="Skipped (line already exists, BR-19)" mono value={result.skipped.length} />
            <StatCard label="Failed" mono value={result.failed.length} />
            <StatCard label={LABELS.working_days} mono value={result.working_days} />
          </StatRow>
          {result.failed.length > 0 && (
            <>
              <h3 style={{ margin: '24px 0 8px' }}>Failed — not stored</h3>
              <DataTable caption="Failed employees" columns={resultColumns} rows={result.failed} rowKey={(r) => r.employee_id} />
            </>
          )}
          {result.skipped.length > 0 && (
            <>
              <h3 style={{ margin: '24px 0 8px' }}>Skipped — existing line kept</h3>
              <DataTable caption="Skipped employees" columns={resultColumns} rows={result.skipped} rowKey={(r) => r.employee_id} />
            </>
          )}
          {result.processed.length > 0 && (
            <>
              <h3 style={{ margin: '24px 0 8px' }}>Processed</h3>
              <DataTable caption="Processed employees" columns={resultColumns.slice(0, 3)} rows={result.processed} rowKey={(r) => r.employee_id} />
            </>
          )}
          <div className="form-actions" style={{ marginTop: 16 }}>
            <Link className="btn" to="/payroll/records">
              View payroll records
            </Link>
            <Link className="btn" to="/payroll/payslips">
              Generate payslips
            </Link>
          </div>
        </section>
      )}

      <ConfirmDialog open={confirming} title="Run payroll?" confirmLabel="Run payroll" busy={busy} onConfirm={run} onCancel={() => setConfirming(false)}>
        <p>
          Run payroll for <strong>{period(form.pay_period)}</strong> (<Mono>{form.pay_period}</Mono>) with <Mono>{form.working_days}</Mono> working days for{' '}
          {mode === 'all' ? <strong>every Active employee</strong> : <strong>{lines.length} selected employee(s)</strong>}? Stored amounts cannot be edited
          afterwards; employees who already have a line for this period are skipped.
        </p>
      </ConfirmDialog>
    </>
  );
}
