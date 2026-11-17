// UC-19 | FR-19 | Recruitment Officer | API: GET/POST /offers, PATCH /offers/:id/status (BR-14, BR-28, NFR-19)
// Only candidates whose LATEST interview is Selected and who have no offer yet can be chosen (BR-14). Candidates
// have no status of their own, so eligibility is worked out from GET /interviews and GET /offers; the backend
// still enforces BR-14 (409).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { interviews, offers } from '../../api/endpoints';
import DataTable from '../../components/DataTable';
import FormField, { ReadOnlyField } from '../../components/FormField';
import LoadWarning from '../../components/LoadWarning';
import Modal from '../../components/Modal';
import Mono from '../../components/Mono';
import PageHeader from '../../components/PageHeader';
import StatCard, { StatRow } from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { useToast } from '../../components/Toast';
import { showServerErrors } from '../../lib/forms';
import { date, inr } from '../../lib/format';
import { HINTS, LABELS, OFFER_STATUSES } from '../../lib/labels';
import { serverNow } from '../../lib/serverDate';
import useAsync from '../../lib/useAsync';
import { isoDate, money, required, validate } from '../../lib/validators';

/** Latest interview per candidate by date, time, ID (same order as the backend's BR-14 check). */
function latestByCandidate(list) {
  const latest = new Map();
  for (const i of list) {
    const key = `${i.interview_date} ${i.interview_time} ${i.interview_id}`;
    const cur = latest.get(i.candidate_id);
    if (!cur || key > cur.key) latest.set(i.candidate_id, { key, interview: i });
  }
  return [...latest.values()].map((x) => x.interview);
}

function OfferForm({ eligible, today, onSaved, onCancel }) {
  const toast = useToast();
  const [form, setForm] = useState({ candidate_id: '', offered_salary: '', joining_date: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const chosen = eligible.find((i) => i.candidate_id === form.candidate_id);

  const submit = async (e) => {
    e.preventDefault();
    const fe = validate(form, {
      candidate_id: required('Candidate'),
      offered_salary: money(LABELS.offered_salary, { positive: true }),
      joining_date: [isoDate(LABELS.joining_date), (v) => (today && v <= today ? `Must be after the Offer Issue Date (${date(today)})` : '')],
    });
    setErrors(fe);
    if (Object.keys(fe).length) return;
    setBusy(true);
    try {
      // offer_position is not sent: the backend takes it from the vacancy's job title (DE-068)
      const res = await offers.create({ candidate_id: form.candidate_id, offered_salary: form.offered_salary.trim(), joining_date: form.joining_date });
      toast.push({ tone: 'ok', text: `Offer ${res.data.offer_id} issued to ${res.data.candidate_name}.` });
      onSaved(res.data);
    } catch (err) {
      showServerErrors(err, setErrors, toast, ['candidate_id', 'offered_salary', 'joining_date']);
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <FormField label="Selected candidate" hint="Candidates whose latest interview is Selected and who have no offer yet" error={errors.candidate_id} required>
        <select className="select" name="candidate_id" value={form.candidate_id} onChange={set}>
          <option value="">Choose a candidate</option>
          {eligible.map((i) => (
            <option key={i.candidate_id} value={i.candidate_id}>
              {i.candidate_id} · {i.candidate_name} — {i.job_title}
            </option>
          ))}
        </select>
      </FormField>
      <ReadOnlyField label={LABELS.offer_position}>{chosen ? chosen.job_title : 'Taken from the vacancy'}</ReadOnlyField>
      <FormField label={`${LABELS.offered_salary} (₹)`} hint={HINTS.offered_salary} error={errors.offered_salary} required>
        <input className="input mono" inputMode="decimal" name="offered_salary" placeholder="0.00" value={form.offered_salary} onChange={set} />
      </FormField>
      <FormField label={LABELS.joining_date} hint={HINTS.joining_date} error={errors.joining_date} required>
        <input className="input" type="date" name="joining_date" min={today || undefined} value={form.joining_date} onChange={set} />
      </FormField>
      <div className="form-actions">
        <button type="submit" className="btn btn--primary" disabled={busy || !eligible.length}>
          {busy ? 'Generating…' : 'Generate offer'}
        </button>
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
      {!eligible.length && <p className="alert alert--info">No candidate is eligible: set an interview to Selected on the Interviews page first.</p>}
    </form>
  );
}

function StatusForm({ offer, onSaved, onCancel }) {
  const toast = useToast();
  const [status, setStatus] = useState(offer.offer_status);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (status === offer.offer_status) return onCancel();
    setBusy(true);
    try {
      await offers.setStatus(offer.offer_id, status);
      toast.push({ tone: 'ok', text: `Offer ${offer.offer_id} is now ${status}.` });
      onSaved();
    } catch (err) {
      toast.push({ tone: 'bad', text: err.message });
      setBusy(false);
    }
  };
  return (
    <form className="form" onSubmit={submit}>
      <p>
        <Mono>{offer.offer_id}</Mono> · {offer.candidate_name} — {offer.offer_position}
      </p>
      <FormField label={LABELS.offer_status}>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          {OFFER_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </FormField>
      <div className="form-actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save status'}
        </button>
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function Offers() {
  const now = useAsync(() => serverNow(), []);
  const ivs = useAsync(async () => (await interviews.list()).data, []);
  const { data, error, loading, reload } = useAsync(async () => (await offers.list()).data, []);
  const [dialog, setDialog] = useState(null); // { mode: 'new' } | { mode: 'status', offer }

  const offered = new Set((data || []).map((o) => o.candidate_id));
  const eligible = latestByCandidate(ivs.data || []).filter((i) => i.interview_status === 'Selected' && !offered.has(i.candidate_id));
  const count = (s) => (data ? data.filter((o) => o.offer_status === s).length : '—');
  const refresh = () => {
    reload();
    ivs.reload();
  };

  const columns = [
    { key: 'offer_id', label: LABELS.offer_id, mono: true },
    { key: 'candidate', label: 'Candidate', render: (r) => <>{r.candidate_name} <span className="mono muted">{r.candidate_id}</span></> },
    { key: 'offer_position', label: LABELS.offer_position },
    { key: 'department', label: LABELS.department },
    { key: 'offered_salary', label: LABELS.offered_salary, align: 'right', mono: true, render: (r) => inr(r.offered_salary) },
    { key: 'joining_date', label: LABELS.joining_date, render: (r) => date(r.joining_date) },
    { key: 'offer_issue_date', label: LABELS.offer_issue_date, render: (r) => date(r.offer_issue_date) },
    { key: 'offer_status', label: LABELS.offer_status, render: (r) => <StatusBadge value={r.offer_status} /> },
    {
      key: 'actions',
      label: <span className="visually-hidden">Actions</span>,
      align: 'right',
      render: (r) => (
        <span style={{ display: 'inline-flex', gap: 4 }}>
          <Link className="btn btn--ghost" to={`/recruitment/offers/${r.offer_id}/letter`}>
            Offer letter
          </Link>
          <button type="button" className="btn btn--ghost" onClick={() => setDialog({ mode: 'status', offer: r })} aria-label={`Change status of ${r.offer_id}`}>
            Status
          </button>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Offers"
        subtitle="Generate offer letters for selected candidates."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setDialog({ mode: 'new' })} disabled={ivs.loading || loading || now.loading}>
            New offer
          </button>
        }
      />
      <LoadWarning errors={[now.error]} onRetry={now.reload} what="The server date" />
      <StatRow>
        <StatCard label="Eligible candidates" mono loading={ivs.loading || loading} value={ivs.data && data ? eligible.length : '—'} hint="Latest interview Selected, no offer yet" />
        <StatCard label="Issued" mono loading={loading} value={count('Issued')} />
        <StatCard label="Accepted" mono loading={loading} value={count('Accepted')} />
        <StatCard label="Declined" mono loading={loading} value={count('Declined')} />
      </StatRow>
      <section className="card card--flush">
        <DataTable
          caption="Offers"
          columns={columns}
          rows={data || []}
          loading={loading}
          error={error || ivs.error}
          onRetry={refresh}
          empty="No offers yet"
          rowKey={(r) => r.offer_id}
        />
      </section>
      <Modal open={Boolean(dialog)} title={dialog && dialog.mode === 'status' ? 'Update offer status' : 'New offer'} onClose={() => setDialog(null)}>
        {dialog && dialog.mode === 'new' && (
          <OfferForm
            eligible={eligible}
            today={now.data && now.data.today}
            onSaved={() => {
              setDialog(null);
              refresh();
            }}
            onCancel={() => setDialog(null)}
          />
        )}
        {dialog && dialog.mode === 'status' && (
          <StatusForm
            offer={dialog.offer}
            onSaved={() => {
              setDialog(null);
              reload();
            }}
            onCancel={() => setDialog(null)}
          />
        )}
      </Modal>
    </>
  );
}
