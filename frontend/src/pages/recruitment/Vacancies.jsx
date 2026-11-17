// UC-09 | FR-9 | Recruitment Officer | API: GET/POST/PATCH /vacancies, POST /vacancies/:id/close (BR-12, NFR-9)
import { useState } from 'react';
import { vacancies } from '../../api/endpoints';
import DataTable from '../../components/DataTable';
import FormField from '../../components/FormField';
import Modal, { ConfirmDialog } from '../../components/Modal';
import Mono from '../../components/Mono';
import PageHeader from '../../components/PageHeader';
import StatCard, { StatRow } from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { useToast } from '../../components/Toast';
import { changedFields, showServerErrors } from '../../lib/forms';
import { date } from '../../lib/format';
import { DEPARTMENTS, HINTS, LABELS, VACANCY_STATUSES } from '../../lib/labels';
import useAsync from '../../lib/useAsync';
import { notBlank, positiveInt, validate } from '../../lib/validators';

const FIELDS = ['job_title', 'department', 'positions', 'qualifications'];

function VacancyForm({ vacancy, onSaved, onCancel }) {
  const toast = useToast();
  const isNew = !vacancy;
  const initial = isNew
    ? { job_title: '', department: '', positions: '1', qualifications: '' }
    : { job_title: vacancy.job_title, department: vacancy.department, positions: String(vacancy.positions), qualifications: vacancy.qualifications, vacancy_status: vacancy.vacancy_status };
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    // BR-12: title, department, positions >= 1 and qualifications are required
    const fe = validate(form, {
      job_title: notBlank(LABELS.job_title, 100),
      department: (v) => (DEPARTMENTS.includes(v) ? '' : 'Choose an existing department'),
      positions: positiveInt(LABELS.positions, 1),
      qualifications: notBlank(LABELS.qualifications, 300),
    });
    setErrors(fe);
    if (Object.keys(fe).length) return;
    setBusy(true);
    try {
      if (isNew) {
        const res = await vacancies.create({ ...form, job_title: form.job_title.trim(), qualifications: form.qualifications.trim(), positions: Number(form.positions) });
        toast.push({ tone: 'ok', text: `Vacancy ${res.data.vacancy_id} created (Open).` });
      } else {
        const changes = changedFields(initial, form, [...FIELDS, 'vacancy_status']);
        if ('positions' in changes) changes.positions = Number(changes.positions);
        if (!Object.keys(changes).length) return onCancel();
        await vacancies.update(vacancy.vacancy_id, changes);
        toast.push({ tone: 'ok', text: `Vacancy ${vacancy.vacancy_id} updated.` });
      }
      onSaved();
    } catch (err) {
      showServerErrors(err, setErrors, toast, [...FIELDS, 'vacancy_status']);
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      {!isNew && (
        <p>
          <Mono>{vacancy.vacancy_id}</Mono> · posted {date(vacancy.posted_date)}
        </p>
      )}
      <FormField label={LABELS.job_title} error={errors.job_title} required>
        <input className="input" name="job_title" maxLength={100} value={form.job_title} onChange={set} />
      </FormField>
      <FormField label={LABELS.department} hint={HINTS.department} error={errors.department} required>
        <select className="select" name="department" value={form.department} onChange={set}>
          <option value="">Choose a department</option>
          {DEPARTMENTS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </FormField>
      <FormField label={LABELS.positions} hint={HINTS.positions} error={errors.positions} required>
        <input className="input mono" type="number" min={1} step={1} name="positions" value={form.positions} onChange={set} />
      </FormField>
      <FormField label={LABELS.qualifications} hint={`Up to 300 characters. ${form.qualifications.length}/300`} error={errors.qualifications} required>
        <textarea className="textarea" name="qualifications" maxLength={300} value={form.qualifications} onChange={set} />
      </FormField>
      {!isNew && (
        <FormField label={LABELS.vacancy_status} hint="Use “Close vacancy” in the list to close it" error={errors.vacancy_status}>
          <select className="select" name="vacancy_status" value={form.vacancy_status} onChange={set}>
            {VACANCY_STATUSES.filter((s) => s !== 'Closed').map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </FormField>
      )}
      <div className="form-actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Saving…' : isNew ? 'Create vacancy' : 'Save changes'}
        </button>
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function Vacancies() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const { data, error, loading, reload } = useAsync(async () => (await vacancies.list({ status })).data, [status]);
  const all = useAsync(async () => (await vacancies.list()).data, []);
  const [dialog, setDialog] = useState(null); // { vacancy } (null vacancy = new)
  const [closing, setClosing] = useState(null);
  const [busy, setBusy] = useState(false);

  const count = (s) => (all.data ? all.data.filter((v) => v.vacancy_status === s).length : '—');
  const refresh = () => {
    reload();
    all.reload();
  };

  const close = async () => {
    setBusy(true);
    try {
      await vacancies.close(closing.vacancy_id);
      toast.push({ tone: 'ok', text: `Vacancy ${closing.vacancy_id} closed.` });
      setClosing(null);
      refresh();
    } catch (err) {
      toast.push({ tone: 'bad', text: err.message });
      setClosing(null);
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'vacancy_id', label: LABELS.vacancy_id, mono: true },
    { key: 'job_title', label: LABELS.job_title },
    { key: 'department', label: LABELS.department },
    { key: 'positions', label: LABELS.positions, align: 'right', mono: true },
    { key: 'qualifications', label: LABELS.qualifications, wrap: true },
    { key: 'vacancy_status', label: LABELS.vacancy_status, render: (r) => <StatusBadge value={r.vacancy_status} /> },
    { key: 'posted_date', label: LABELS.posted_date, render: (r) => date(r.posted_date) },
    {
      key: 'actions',
      label: <span className="visually-hidden">Actions</span>,
      align: 'right',
      render: (r) =>
        r.vacancy_status === 'Closed' ? (
          <span className="muted small">Closed</span>
        ) : (
          <span style={{ display: 'inline-flex', gap: 4 }}>
            <button type="button" className="btn btn--ghost" onClick={() => setDialog({ vacancy: r })} aria-label={`Edit ${r.vacancy_id}`}>
              Edit
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setClosing(r)} aria-label={`Close ${r.vacancy_id}`}>
              Close vacancy
            </button>
          </span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Vacancies"
        subtitle="Create, update and close job vacancies."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setDialog({ vacancy: null })}>
            New vacancy
          </button>
        }
      />
      <StatRow>
        <StatCard label="Open" mono loading={all.loading} value={count('Open')} />
        <StatCard label="On Hold" mono loading={all.loading} value={count('On Hold')} />
        <StatCard label="Closed" mono loading={all.loading} value={count('Closed')} />
      </StatRow>
      <section className="card card--flush">
        <div className="toolbar" style={{ padding: 16 }}>
          <FormField label={LABELS.vacancy_status}>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {VACANCY_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </FormField>
        </div>
        <DataTable
          caption="Vacancies"
          columns={columns}
          rows={data || []}
          loading={loading}
          error={error}
          onRetry={reload}
          empty="No vacancies yet"
          rowKey={(r) => r.vacancy_id}
        />
      </section>

      <Modal open={Boolean(dialog)} title={dialog && dialog.vacancy ? 'Edit vacancy' : 'New vacancy'} onClose={() => setDialog(null)}>
        {dialog && (
          <VacancyForm
            vacancy={dialog.vacancy}
            onSaved={() => {
              setDialog(null);
              refresh();
            }}
            onCancel={() => setDialog(null)}
          />
        )}
      </Modal>

      <ConfirmDialog open={Boolean(closing)} title="Close vacancy?" confirmLabel="Close vacancy" tone="danger" busy={busy} onConfirm={close} onCancel={() => setClosing(null)}>
        {closing && (
          <p>
            Close <Mono>{closing.vacancy_id}</Mono> — <strong>{closing.job_title}</strong> ({closing.department})? New candidates can no longer be added to a closed vacancy.
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}
