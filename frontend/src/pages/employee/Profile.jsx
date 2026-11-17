// UC-05 | FR-5 | Employee | API: GET /profile/me, PATCH /profile/me
// BR-08: only Contact Number, Email Address and Residential Address can be changed.
import { useEffect, useState } from 'react';
import { profile } from '../../api/endpoints';
import FormField, { ReadOnlyField } from '../../components/FormField';
import PageHeader from '../../components/PageHeader';
import Skeleton from '../../components/Skeleton';
import { ErrorState } from '../../components/States';
import { useToast } from '../../components/Toast';
import { changedFields, showServerErrors } from '../../lib/forms';
import { HINTS, LABELS } from '../../lib/labels';
import useAsync from '../../lib/useAsync';
import { contactNumber, email, notBlank, validate } from '../../lib/validators';

const EDITABLE = ['contact_number', 'email', 'address'];

export default function Profile() {
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(async () => (await profile.get()).data, []);
  const [form, setForm] = useState({ contact_number: '', email: '', address: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setForm({ contact_number: data.contact_number, email: data.email, address: data.address });
  }, [data]);

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const changes = data ? changedFields(data, form, EDITABLE) : {};
  const dirty = Object.keys(changes).length > 0;

  const onSubmit = async (e) => {
    e.preventDefault();
    const fe = validate(form, {
      contact_number: contactNumber,
      email,
      address: notBlank(LABELS.address, 200),
    });
    setErrors(fe);
    if (Object.keys(fe).length || !dirty) return;
    setBusy(true);
    try {
      await profile.update(changes); // only the changed, permitted fields
      toast.push({ tone: 'ok', text: 'Profile updated.' });
      setErrors({});
      reload();
    } catch (err) {
      showServerErrors(err, setErrors, toast, EDITABLE);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <>
      <PageHeader title="My Profile" subtitle="You can update your contact details. Other details are maintained by the HR Manager." />
      <section className="card">
        <h2 className="card__title">Employee details</h2>
        {loading ? (
          <Skeleton height={40} />
        ) : (
          <div className="form-grid">
            <ReadOnlyField label={LABELS.employee_id} mono>
              {data.employee_id}
            </ReadOnlyField>
            <ReadOnlyField label={LABELS.employee_name}>{data.employee_name}</ReadOnlyField>
            <ReadOnlyField label={LABELS.department}>{data.department}</ReadOnlyField>
            <ReadOnlyField label={LABELS.designation}>{data.designation}</ReadOnlyField>
          </div>
        )}
      </section>
      <form className="card form" onSubmit={onSubmit} noValidate style={{ maxWidth: 'none' }}>
        <h2 className="card__title">Contact details</h2>
        <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FormField label={LABELS.contact_number} hint={HINTS.contact_number} error={errors.contact_number} required>
            <input className="input mono" name="contact_number" inputMode="numeric" maxLength={10} autoComplete="tel" value={form.contact_number} onChange={set} disabled={loading} />
          </FormField>
          <FormField label={LABELS.email} hint={HINTS.email} error={errors.email} required>
            <input className="input" type="email" name="email" autoComplete="email" value={form.email} onChange={set} disabled={loading} />
          </FormField>
          <FormField label={LABELS.address} hint={HINTS.address} error={errors.address} required>
            <textarea className="textarea" name="address" maxLength={200} autoComplete="street-address" value={form.address} onChange={set} disabled={loading} />
          </FormField>
          <div className="form-actions">
            <button type="submit" className="btn btn--primary" disabled={busy || loading || !dirty}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || !dirty}
              onClick={() => {
                setForm({ contact_number: data.contact_number, email: data.email, address: data.address });
                setErrors({});
              }}
            >
              Discard
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
