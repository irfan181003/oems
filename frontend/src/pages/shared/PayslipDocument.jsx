// UC-13, UC-11 | FR-13, FR-11 | Employee (own) / Payroll Officer | API: GET /payslips/:id, GET /payslips/:id/download
// Looks like a printed document: letterhead, serif title, two-column earnings/deductions, bold Net Salary row.
// All amounts come from the stored payslip and its payroll line (BR-20).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { payslips } from '../../api/endpoints';
import Mono from '../../components/Mono';
import Skeleton from '../../components/Skeleton';
import { ErrorState } from '../../components/States';
import { useToast } from '../../components/Toast';
import { saveBlob } from '../../lib/download';
import { date, inr, period } from '../../lib/format';
import { LABELS } from '../../lib/labels';
import useAsync from '../../lib/useAsync';

function Line({ label, value, total = false }) {
  return (
    <div className={`doc__line${total ? ' doc__line--total' : ''}`}>
      <span>{label}</span>
      <Mono>{value}</Mono>
    </div>
  );
}

export default function PayslipDocument({ payslipId, backTo, backLabel }) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const { data: p, error, loading, reload } = useAsync(async () => (await payslips.get(payslipId)).data, [payslipId]);

  const download = async () => {
    setDownloading(true);
    try {
      const blob = await payslips.pdf(payslipId);
      saveBlob(blob, `${payslipId}.pdf`);
    } catch (err) {
      toast.push({ tone: 'bad', text: err.message });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <div className="doc-actions no-print">
        <Link className="btn btn--ghost" to={backTo} style={{ marginRight: 'auto' }}>
          ← {backLabel}
        </Link>
        <button type="button" className="btn" onClick={() => window.print()} disabled={!p}>
          Print
        </button>
        <button type="button" className="btn btn--primary" onClick={download} disabled={!p || downloading}>
          {downloading ? 'Preparing PDF…' : 'Download PDF'}
        </button>
      </div>

      {error ? (
        <div className="card">
          <ErrorState error={error} onRetry={reload} />
        </div>
      ) : (
        <article className="doc" aria-busy={loading} aria-label="Payslip">
          <div className="doc__letterhead">
            <div>
              <div className="doc__org">Office Employee Management System</div>
              <div className="doc__org-sub">Payroll · Salary statement</div>
            </div>
            <div className="small muted" style={{ textAlign: 'right' }}>
              {LABELS.payslip_id}
              <br />
              <Mono>{p ? p.payslip_id : payslipId}</Mono>
            </div>
          </div>

          <h1 className="doc__title">Payslip{p ? ` for ${period(p.pay_period)}` : ''}</h1>

          {loading || !p ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <Skeleton height={16} />
              <Skeleton height={16} width="80%" />
              <Skeleton height={120} />
            </div>
          ) : (
            <>
              <dl className="doc__meta">
                <div><dt>{LABELS.employee_id}</dt><dd><Mono>{p.employee_id}</Mono></dd></div>
                <div><dt>{LABELS.employee_name}</dt><dd>{p.employee_name}</dd></div>
                <div><dt>{LABELS.department}</dt><dd>{p.department}</dd></div>
                <div><dt>{LABELS.designation}</dt><dd>{p.designation}</dd></div>
                <div><dt>{LABELS.pay_period}</dt><dd><Mono>{p.pay_period}</Mono></dd></div>
                <div><dt>{LABELS.payroll_id}</dt><dd><Mono>{p.payroll_id}</Mono></dd></div>
                <div><dt>Monthly {LABELS.basic_salary}</dt><dd><Mono>{inr(p.basic_salary)}</Mono></dd></div>
                <div><dt>{LABELS.days_present}</dt><dd><Mono>{p.days_present}</Mono></dd></div>
                <div><dt>Paid leave days</dt><dd><Mono>{p.leave_days}</Mono></dd></div>
                <div><dt>{LABELS.generated_date}</dt><dd>{date(p.generated_date)}</dd></div>
              </dl>

              <div className="doc__cols">
                <section className="doc__col" aria-label="Earnings">
                  <h3>Earnings</h3>
                  <Line label="Earned basic" value={inr(p.earned_basic)} />
                  <Line label={LABELS.allowances} value={inr(p.allowances)} />
                  <Line label={LABELS.gross_salary} value={inr(p.gross_salary)} total />
                </section>
                <section className="doc__col" aria-label="Deductions">
                  <h3>Deductions</h3>
                  <Line label={LABELS.tax_deduction} value={inr(p.tax_deduction)} />
                  <Line label={LABELS.pf_deduction} value={inr(p.pf_deduction)} />
                  <Line label={LABELS.other_deductions} value={inr(p.other_deductions)} />
                  <Line label={LABELS.total_deductions} value={inr(p.total_deductions)} total />
                </section>
              </div>

              <div className="doc__net">
                <span>{LABELS.net_salary}</span>
                <Mono>{inr(p.net_salary)}</Mono>
              </div>

              <p className="doc__foot">
                Earned basic reflects attendance and approved leave for the pay period. This is a system-generated payslip.
              </p>
            </>
          )}
        </article>
      )}
    </>
  );
}
