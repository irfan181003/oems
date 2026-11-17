// UC-13 | FR-13 | Payroll Officer | API: POST /payslips/generate {pay_period, employee_ids?}, GET /payslips?pay_period&employee_id,
// GET /payslips/:id/download (BR-20, BR-21; ASSUMPTION A-9)
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { payslips } from '../../api/endpoints';
import DataTable from '../../components/DataTable';
import FormField from '../../components/FormField';
import Mono from '../../components/Mono';
import PageHeader from '../../components/PageHeader';
import StatCard, { StatRow } from '../../components/StatCard';
import { useToast } from '../../components/Toast';
import { fieldErrors } from '../../api/client';
import { saveBlob } from '../../lib/download';
import { date, inr, period } from '../../lib/format';
import { LABELS } from '../../lib/labels';
import { prevPeriod, serverNow } from '../../lib/serverDate';
import useAsync from '../../lib/useAsync';
import useSalaryEmployees, { nameOf } from '../../lib/useSalaryEmployees';
import { payPeriod as payPeriodRule } from '../../lib/validators';

export default function Payslips() {
  const toast = useToast();
  const emps = useSalaryEmployees();
  const now = useAsync(() => serverNow(), []);
  const [gen, setGen] = useState({ pay_period: '', scope: 'all', employee_ids: [] });
  const [genErrors, setGenErrors] = useState({});
  const [genBusy, setGenBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [filters, setFilters] = useState({ pay_period: '', employee_id: '' });
  const [downloading, setDownloading] = useState('');
  const list = useAsync(async () => (await payslips.list(filters)).data, [filters.pay_period, filters.employee_id]);

  useEffect(() => {
    if (now.data && !gen.pay_period) setGen((g) => ({ ...g, pay_period: prevPeriod(now.data.period) }));
  }, [now.data, gen.pay_period]);

  const toggle = (id) =>
    setGen((g) => ({ ...g, employee_ids: g.employee_ids.includes(id) ? g.employee_ids.filter((x) => x !== id) : [...g.employee_ids, id] }));

  const generate = async (e) => {
    e.preventDefault();
    const fe = {};
    const pp = payPeriodRule(gen.pay_period);
    if (pp) fe.pay_period = pp;
    if (gen.scope === 'some' && !gen.employee_ids.length) fe.employee_ids = 'Choose at least one employee';
    setGenErrors(fe);
    if (Object.keys(fe).length) return;
    setGenBusy(true);
    try {
      const body = { pay_period: gen.pay_period };
      if (gen.scope === 'some') body.employee_ids = gen.employee_ids;
      const res = await payslips.generate(body);
      setResult(res.data);
      toast.push({ tone: res.data.refused.length ? 'warn' : 'ok', text: res.response_message });
      setFilters({ pay_period: gen.pay_period, employee_id: '' });
    } catch (err) {
      setGenErrors(fieldErrors(err));
      toast.push({ tone: 'bad', text: err.message });
    } finally {
      setGenBusy(false);
    }
  };

  const download = async (id) => {
    setDownloading(id);
    try {
      saveBlob(await payslips.pdf(id), `${id}.pdf`);
    } catch (err) {
      toast.push({ tone: 'bad', text: err.message });
    } finally {
      setDownloading('');
    }
  };

  const columns = [
    { key: 'payslip_id', label: LABELS.payslip_id, mono: true },
    { key: 'employee', label: 'Employee', render: (r) => <>{r.employee_name} <span className="mono muted">{r.employee_id}</span></> },
    { key: 'pay_period', label: LABELS.pay_period, mono: true, render: (r) => period(r.pay_period) },
    { key: 'gross_salary', label: LABELS.gross_salary, align: 'right', mono: true, render: (r) => inr(r.gross_salary) },
    { key: 'total_deductions', label: LABELS.total_deductions, align: 'right', mono: true, render: (r) => inr(r.total_deductions) },
    { key: 'net_salary', label: LABELS.net_salary, align: 'right', mono: true, render: (r) => inr(r.net_salary) },
    { key: 'generated_date', label: LABELS.generated_date, render: (r) => date(r.generated_date) },
    {
      key: 'actions',
      label: <span className="visually-hidden">Actions</span>,
      align: 'right',
      render: (r) => (
        <span style={{ display: 'inline-flex', gap: 4 }}>
          <Link className="btn btn--ghost" to={`/payroll/payslips/${r.payslip_id}`}>
            Open
          </Link>
          <button type="button" className="btn btn--ghost" onClick={() => download(r.payslip_id)} disabled={downloading === r.payslip_id} aria-label={`Download PDF of ${r.payslip_id}`}>
            {downloading === r.payslip_id ? 'Preparing…' : 'PDF'}
          </button>
        </span>
      ),
    },
  ];

  const name = (id) => nameOf(emps.data, id);
  const refusedColumns = [
    { key: 'employee_id', label: LABELS.employee_id, mono: true },
    { key: 'name', label: LABELS.employee_name, render: (r) => name(r.employee_id) || '—' },
    { key: 'payroll_id', label: LABELS.payroll_id, mono: true, render: (r) => r.payroll_id || '—' },
    { key: 'reason', label: 'Reason', wrap: true },
  ];

  return (
    <>
      <PageHeader title="Payslips" subtitle="Generate payslips from Processed or Paid payroll lines (BR-21). Amounts are copied unchanged (BR-20)." />

      <form className="card form" onSubmit={generate} noValidate style={{ maxWidth: 'none' }}>
        <h2 className="card__title">Generate payslips</h2>
        <div style={{ maxWidth: 280 }}>
          <FormField label={LABELS.pay_period} error={genErrors.pay_period} required>
            <input className="input mono" type="month" value={gen.pay_period} onChange={(e) => setGen((g) => ({ ...g, pay_period: e.target.value }))} />
          </FormField>
        </div>
        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 8 }}>
          <legend className="field__label" style={{ marginBottom: 8 }}>
            Employees
          </legend>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="radio" name="scope" checked={gen.scope === 'all'} onChange={() => setGen((g) => ({ ...g, scope: 'all' }))} />
            Every payroll line of the pay period
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="radio" name="scope" checked={gen.scope === 'some'} onChange={() => setGen((g) => ({ ...g, scope: 'some' }))} />
            Selected employees
          </label>
        </fieldset>
        {gen.scope === 'some' && (
          <fieldset style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12, margin: 0, display: 'grid', gap: 6, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }} aria-describedby={genErrors.employee_ids ? 'emp-err' : undefined}>
            <legend className="visually-hidden">Choose employees</legend>
            {(emps.data || []).map((e) => (
              <label key={e.employee_id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={gen.employee_ids.includes(e.employee_id)} onChange={() => toggle(e.employee_id)} />
                <Mono>{e.employee_id}</Mono> {e.employee_name}
              </label>
            ))}
          </fieldset>
        )}
        {genErrors.employee_ids && (
          <span className="field__error" id="emp-err">
            {genErrors.employee_ids}
          </span>
        )}
        <div className="form-actions">
          <button type="submit" className="btn btn--primary" disabled={genBusy || now.loading}>
            {genBusy ? 'Generating…' : 'Generate payslips'}
          </button>
        </div>
      </form>

      {result && (
        <section className="card" aria-labelledby="gen-h" aria-live="polite">
          <h2 id="gen-h" className="card__title">
            Payslip generation for {period(result.pay_period)}
          </h2>
          <StatRow>
            <StatCard label={LABELS.payslip_count} mono value={result.payslip_count} hint="New + already existing" />
            <StatCard label="Newly generated" mono value={result.newly_generated} />
            <StatCard label="Already existed" mono value={result.existing.length} />
            <StatCard label="Refused" mono value={result.refused.length} hint="Not Processed/Paid, or no payroll line" />
          </StatRow>
          {result.refused.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <DataTable caption="Refused" columns={refusedColumns} rows={result.refused} rowKey={(r) => r.employee_id} />
            </div>
          )}
        </section>
      )}

      <section className="card card--flush">
        <form
          className="toolbar"
          style={{ padding: 16 }}
          onSubmit={(e) => {
            e.preventDefault();
            list.reload();
          }}
        >
          <FormField label={LABELS.pay_period}>
            <input className="input mono" type="month" value={filters.pay_period} onChange={(e) => setFilters((f) => ({ ...f, pay_period: e.target.value }))} />
          </FormField>
          <FormField label="Employee">
            <select className="select" value={filters.employee_id} onChange={(e) => setFilters((f) => ({ ...f, employee_id: e.target.value }))} disabled={emps.loading}>
              <option value="">All employees</option>
              {(emps.data || []).map((e) => (
                <option key={e.employee_id} value={e.employee_id}>
                  {e.employee_id} · {e.employee_name}
                </option>
              ))}
            </select>
          </FormField>
        </form>
        <DataTable caption="Payslips" columns={columns} rows={list.data || []} loading={list.loading} error={list.error} onRetry={list.reload} empty="No payslips for these filters" rowKey={(r) => r.payslip_id} />
      </section>
    </>
  );
}
