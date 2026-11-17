// UC-10 | FR-10 | Recruitment Officer | API: GET/POST /interviews, PATCH /interviews/:id (BR-13, NFR-10)
// A clash (same candidate or same venue at the same date and time) returns 409; the backend message is shown
// under the slot fields so the officer can choose another slot.
import { useState } from 'react';
import { ApiError } from '../../api/client';
import { candidates, interviews, vacancies } from '../../api/endpoints';
import DataTable from '../../components/DataTable';
import FormField from '../../components/FormField';
import Modal from '../../components/Modal';
import Mono from '../../components/Mono';
import PageHeader from '../../components/PageHeader';
import StatCard, { StatRow } from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { useToast } from '../../components/Toast';
import { changedFields, showServerErrors } from '../../lib/forms';
import { date, orDash, time } from '../../lib/format';
import { HINTS, INTERVIEW_STATUSES, LABELS } from '../../lib/labels';
import { serverNow } from '../../lib/serverDate';
import useAsync from '../../lib/useAsync';
import { isoDate, maxLen, notBlank, required, validate } from '../../lib/validators';

const SLOT = ['interview_date', 'interview_time', 'interview_venue'];
const FIELDS = ['candidate_id', ...SLOT, 'interviewer_name', 'interview_status'];

function InterviewForm({ interview, candidateList, now, onSaved, onCancel }) {
  const toast = useToast();
  const isNew = !interview;
  const initial = isNew
    ? { candidate_id: '', interview_date: '', interview_time: '', interview_venue: '', interviewer_name: '' }
    : {
        interview_date: interview.interview_date,
        interview_time: time(interview.interview_time),
        interview_venue: interview.interview_venue,
        interviewer_name: interview.interviewer_name || '',
        interview_status: interview.interview_status,
      };
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [clash, setClash] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const slotChanged = isNew || SLOT.some((k) => String(form[k]).trim() !== String(initial[k]));

  // DE-059 / DE-060: not in the past (server clock)
  const notPast = (d, all) => {
    if (!slotChanged || !now || !d || !all.interview_time) return '';
    return `${d} ${all.interview_time}` <= `${now.today} ${now.time}` ? 'The interview date and time must be later than now' : '';
  };

  const submit = async (e) => {
    e.preventDefault();
    setClash('');
    const fe = validate(form, {
      ...(isNew ? { candidate_id: required('Candidate') } : {}),
      interview_date: [isoDate(LABELS.interview_date), notPast],
      interview_time: (v) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(v || '') ? '' : 'Choose a time (hh:mm)'),
      interview_venue: notBlank(LABELS.interview_venue, 150),
      interviewer_name: maxLen(LABELS.interviewer_name, 100),
    });
    setErrors(fe);
    if (Object.keys(fe).length) return;
    setBusy(true);
    try {
      if (isNew) {
        const body = {
          candidate_id: form.candidate_id,
          interview_date: form.interview_date,
          interview_time: form.interview_time,
          interview_venue: form.interview_venue.trim(),
        };
        if (form.interviewer_name.trim()) body.interviewer_name = form.interviewer_name.trim();
        const res = await interviews.create(body);
        toast.push({ tone: 'ok', text: `Interview ${res.data.interview_id} scheduled for ${res.data.candidate_name} on ${date(res.data.interview_date)} at ${time(res.data.interview_time)}.` });
      } else {
        const changes = changedFields(initial, form, [...SLOT, 'interviewer_name', 'interview_status']);
        if ('interviewer_name' in changes && !changes.interviewer_name) changes.interviewer_name = null;
        if (!Object.keys(changes).length) return onCancel();
        await interviews.update(interview.interview_id, changes);
        toast.push({ tone: 'ok', text: `Interview ${interview.interview_id} updated.` });
      }
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setClash(err.message); // BR-13 — "choose another slot"
      else showServerErrors(err, setErrors, toast, FIELDS);
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      {isNew ? (
        <FormField label="Candidate" error={errors.candidate_id} required>
          <select className="select" name="candidate_id" value={form.candidate_id} onChange={set}>
            <option value="">Choose a candidate</option>
            {candidateList.map((c) => (
              <option key={c.candidate_id} value={c.candidate_id}>
                {c.candidate_id} · {c.candidate_name} — {c.job_title}
              </option>
            ))}
          </select>
        </FormField>
      ) : (
        <p>
          <Mono>{interview.interview_id}</Mono> · {interview.candidate_name} (<Mono>{interview.candidate_id}</Mono>) — {interview.job_title}
        </p>
      )}
      <div className="form-grid">
        <FormField label={LABELS.interview_date} hint={HINTS.interview_date} error={errors.interview_date} required>
          <input className="input" type="date" name="interview_date" min={now ? now.today : undefined} value={form.interview_date} onChange={set} />
        </FormField>
        <FormField label={LABELS.interview_time} hint={HINTS.interview_time} error={errors.interview_time} required>
          <input className="input mono" type="time" name="interview_time" value={form.interview_time} onChange={set} />
        </FormField>
      </div>
      <FormField label={LABELS.interview_venue} hint="Room or online meeting link" error={errors.interview_venue} required>
        <input className="input" name="interview_venue" maxLength={150} value={form.interview_venue} onChange={set} />
      </FormField>
      {clash && (
        <div className="alert alert--error" role="alert">
          {clash}
        </div>
      )}
      <FormField label={LABELS.interviewer_name} hint="Optional" error={errors.interviewer_name}>
        <input className="input" name="interviewer_name" maxLength={100} value={form.interviewer_name} onChange={set} />
      </FormField>
      {!isNew && (
        <FormField label={LABELS.interview_status} error={errors.interview_status}>
          <select className="select" name="interview_status" value={form.interview_status} onChange={set}>
            {INTERVIEW_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </FormField>
      )}
      <div className="form-actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Saving…' : isNew ? 'Schedule interview' : 'Save changes'}
        </button>
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function Interviews() {
  const now = useAsync(() => serverNow(), []);
  const vacs = useAsync(async () => (await vacancies.list()).data, []);
  const cands = useAsync(async () => (await candidates.list()).data, []);
  const [filters, setFilters] = useState({ vacancy_id: '', date: '' });
  const { data, error, loading, reload } = useAsync(async () => (await interviews.list(filters)).data, [filters.vacancy_id, filters.date]);
  const [dialog, setDialog] = useState(null); // { interview } (null = new)

  const count = (s) => (data ? data.filter((i) => i.interview_status === s).length : '—');
  const set = (e) => setFilters((f) => ({ ...f, [e.target.name]: e.target.value }));

  const columns = [
    { key: 'interview_id', label: LABELS.interview_id, mono: true },
    { key: 'candidate', label: 'Candidate', render: (r) => <>{r.candidate_name} <span className="mono muted">{r.candidate_id}</span></> },
    { key: 'job_title', label: LABELS.job_title },
    { key: 'interview_date', label: LABELS.interview_date, render: (r) => date(r.interview_date) },
    { key: 'interview_time', label: LABELS.interview_time, mono: true, render: (r) => time(r.interview_time) },
    { key: 'interview_venue', label: LABELS.interview_venue, wrap: true },
    { key: 'interviewer_name', label: LABELS.interviewer_name, render: (r) => orDash(r.interviewer_name) },
    { key: 'interview_status', label: LABELS.interview_status, render: (r) => <StatusBadge value={r.interview_status} /> },
    {
      key: 'actions',
      label: <span className="visually-hidden">Actions</span>,
      align: 'right',
      render: (r) => (
        <button type="button" className="btn btn--ghost" onClick={() => setDialog({ interview: r })} aria-label={`Reschedule or update ${r.interview_id}`}>
          Reschedule / status
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Interviews"
        subtitle="Schedule interviews and record their outcome. A candidate or venue cannot have two interviews at the same date and time."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setDialog({ interview: null })} disabled={cands.loading || now.loading}>
            Schedule interview
          </button>
        }
      />
      <StatRow>
        <StatCard label="Scheduled" mono loading={loading} value={count('Scheduled')} />
        <StatCard label="Selected" mono loading={loading} value={count('Selected')} />
        <StatCard label="Completed" mono loading={loading} value={count('Completed')} />
        <StatCard label="Rejected · Cancelled" mono loading={loading} value={data ? `${count('Rejected')} · ${count('Cancelled')}` : '—'} />
      </StatRow>
      <section className="card card--flush">
        <div className="toolbar" style={{ padding: 16 }}>
          <FormField label="Vacancy">
            <select className="select" name="vacancy_id" value={filters.vacancy_id} onChange={set} disabled={vacs.loading}>
              <option value="">All vacancies</option>
              {(vacs.data || []).map((v) => (
                <option key={v.vacancy_id} value={v.vacancy_id}>
                  {v.vacancy_id} · {v.job_title}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label={LABELS.interview_date}>
            <input className="input" type="date" name="date" value={filters.date} onChange={set} />
          </FormField>
          {(filters.vacancy_id || filters.date) && (
            <button type="button" className="btn btn--ghost" onClick={() => setFilters({ vacancy_id: '', date: '' })}>
              Clear
            </button>
          )}
        </div>
        <DataTable
          caption="Interview schedule"
          columns={columns}
          rows={data || []}
          loading={loading}
          error={error}
          onRetry={reload}
          empty="No interviews scheduled"
          rowKey={(r) => r.interview_id}
        />
      </section>
      <Modal open={Boolean(dialog)} title={dialog && dialog.interview ? 'Reschedule / update interview' : 'Schedule interview'} onClose={() => setDialog(null)}>
        {dialog && (
          <InterviewForm
            interview={dialog.interview}
            candidateList={cands.data || []}
            now={now.data}
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
