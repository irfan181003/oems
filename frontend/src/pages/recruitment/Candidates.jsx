// ASSUMPTION A-3 (no flow creates candidates; DD §12 #10) | supports UC-10, UC-19 | Recruitment Officer | API: GET/POST /candidates
import { useState } from 'react';
import { candidates, vacancies } from '../../api/endpoints';
import DataTable from '../../components/DataTable';
import FormField from '../../components/FormField';
import Modal from '../../components/Modal';
import PageHeader from '../../components/PageHeader';
import StatCard, { StatRow } from '../../components/StatCard';
import { useToast } from '../../components/Toast';
import { showServerErrors } from '../../lib/forms';
import { orDash } from '../../lib/format';
import { HINTS, LABELS } from '../../lib/labels';
import useAsync from '../../lib/useAsync';
import { digitsOnly, email, notBlank, required, validate } from '../../lib/validators';

const FIELDS = ['vacancy_id', 'candidate_name', 'candidate_email', 'candidate_phone'];

function CandidateForm({ openVacancies, onSaved, onCancel }) {
  const toast = useToast();
  const [form, setForm] = useState({ vacancy_id: '', candidate_name: '', candidate_email: '', candidate_phone: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const fe = validate(form, {
      vacancy_id: required('Vacancy'),
      candidate_name: notBlank(LABELS.candidate_name, 100),
      candidate_email: email,
      candidate_phone: digitsOnly(LABELS.candidate_phone, 10),
    });
    setErrors(fe);
    if (Object.keys(fe).length) return;
    setBusy(true);
    try {
      const body = { vacancy_id: form.vacancy_id, candidate_name: form.candidate_name.trim(), candidate_email: form.candidate_email.trim() };
      if (form.candidate_phone.trim()) body.candidate_phone = form.candidate_phone.trim();
      const res = await candidates.create(body);
      toast.push({ tone: 'ok', text: `Candidate ${res.data.candidate_id} registered for ${res.data.job_title}.` });
      onSaved();
    } catch (err) {
      showServerErrors(err, setErrors, toast, FIELDS); // e.g. 409 vacancy not Open
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <FormField label="Vacancy" hint="Only Open vacancies accept candidates" error={errors.vacancy_id} required>
        <select className="select" name="vacancy_id" value={form.vacancy_id} onChange={set}>
          <option value="">Choose a vacancy</option>
          {openVacancies.map((v) => (
            <option key={v.vacancy_id} value={v.vacancy_id}>
              {v.vacancy_id} · {v.job_title} ({v.department})
            </option>
          ))}
        </select>
      </FormField>
      <FormField label={LABELS.candidate_name} error={errors.candidate_name} required>
        <input className="input" name="candidate_name" maxLength={100} value={form.candidate_name} onChange={set} />
      </FormField>
      <FormField label={LABELS.candidate_email} hint="A valid e-mail address" error={errors.candidate_email} required>
        <input className="input" type="email" name="candidate_email" maxLength={100} value={form.candidate_email} onChange={set} />
      </FormField>
      <FormField label={LABELS.candidate_phone} hint={HINTS.candidate_phone} error={errors.candidate_phone}>
        <input className="input mono" name="candidate_phone" inputMode="numeric" maxLength={10} value={form.candidate_phone} onChange={set} />
      </FormField>
      <div className="form-actions">
        <button type="submit" className="btn btn--primary" disabled={busy || !openVacancies.length}>
          {busy ? 'Saving…' : 'Register candidate'}
        </button>
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
      {!openVacancies.length && <p className="alert alert--info">There are no Open vacancies. Create a vacancy, or set an On Hold vacancy back to Open.</p>}
    </form>
  );
}

export default function Candidates() {
  const vacs = useAsync(async () => (await vacancies.list()).data, []);
  const [vacancyId, setVacancyId] = useState('');
  const { data, error, loading, reload } = useAsync(async () => (await candidates.list({ vacancy_id: vacancyId })).data, [vacancyId]);
  const [open, setOpen] = useState(false);
  const openVacancies = (vacs.data || []).filter((v) => v.vacancy_status === 'Open');

  const columns = [
    { key: 'candidate_id', label: LABELS.candidate_id, mono: true },
    { key: 'candidate_name', label: LABELS.candidate_name },
    { key: 'candidate_email', label: LABELS.candidate_email },
    { key: 'candidate_phone', label: LABELS.candidate_phone, mono: true, render: (r) => orDash(r.candidate_phone) },
    { key: 'vacancy', label: 'Vacancy', render: (r) => <>{r.job_title} <span className="mono muted">{r.vacancy_id}</span></> },
  ];

  return (
    <>
      <PageHeader
        title="Candidates"
        subtitle="Candidates who applied for vacancies."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setOpen(true)} disabled={vacs.loading}>
            Register candidate
          </button>
        }
      />
      <StatRow>
        <StatCard label="Candidates shown" mono loading={loading} value={data ? data.length : '—'} />
        <StatCard label="Open vacancies" mono loading={vacs.loading} value={vacs.data ? openVacancies.length : '—'} />
      </StatRow>
      <section className="card card--flush">
        <div className="toolbar" style={{ padding: 16 }}>
          <FormField label="Vacancy">
            <select className="select" value={vacancyId} onChange={(e) => setVacancyId(e.target.value)} disabled={vacs.loading}>
              <option value="">All vacancies</option>
              {(vacs.data || []).map((v) => (
                <option key={v.vacancy_id} value={v.vacancy_id}>
                  {v.vacancy_id} · {v.job_title} ({v.vacancy_status})
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <DataTable
          caption="Candidates"
          columns={columns}
          rows={data || []}
          loading={loading}
          error={error}
          onRetry={reload}
          empty="No candidates yet"
          rowKey={(r) => r.candidate_id}
        />
      </section>
      <Modal open={open} title="Register candidate" onClose={() => setOpen(false)}>
        {open && (
          <CandidateForm
            openVacancies={openVacancies}
            onSaved={() => {
              setOpen(false);
              reload();
            }}
            onCancel={() => setOpen(false)}
          />
        )}
      </Modal>
    </>
  );
}
