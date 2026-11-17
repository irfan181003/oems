// UC-01, UC-02 | FR-1, FR-2 | Employee | API: POST /attendance/check-in, POST /attendance/check-out, GET /attendance/me?from&to
import { useEffect, useState } from 'react';
import { attendance } from '../../api/endpoints';
import DataTable from '../../components/DataTable';
import FormField from '../../components/FormField';
import Mono from '../../components/Mono';
import PageHeader from '../../components/PageHeader';
import StatCard, { StatRow } from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { useToast } from '../../components/Toast';
import { date, time } from '../../lib/format';
import { LABELS } from '../../lib/labels';
import { monthBounds, serverNow } from '../../lib/serverDate';
import useAsync from '../../lib/useAsync';
import { fromNotAfterTo } from '../../lib/validators';

const columns = [
  { key: 'att_date', label: LABELS.att_date, render: (r) => date(r.att_date) },
  { key: 'checkin_time', label: LABELS.checkin_time, mono: true, render: (r) => time(r.checkin_time) },
  { key: 'checkout_time', label: LABELS.checkout_time, mono: true, render: (r) => time(r.checkout_time) },
  { key: 'att_status', label: LABELS.att_status, render: (r) => <StatusBadge value={r.att_status} /> },
];

export default function Attendance() {
  const toast = useToast();
  const [range, setRange] = useState(null); // applied {from, to}
  const [draft, setDraft] = useState({ from: '', to: '' });
  const [rangeError, setRangeError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastAction, setLastAction] = useState('');

  // Default range: the current month on the server clock
  const now = useAsync(() => serverNow(), []);
  useEffect(() => {
    if (now.data && !range) {
      const m = monthBounds(now.data.today);
      setRange(m);
      setDraft(m);
    }
  }, [now.data, range]);

  const today = useAsync(async () => {
    const n = await serverNow();
    const res = await attendance.mine(n.today, n.today);
    return res.data.records[0] || null;
  }, []);

  const list = useAsync(async () => (range ? (await attendance.mine(range.from, range.to)).data : null), [range && range.from, range && range.to]);

  const record = today.data;
  const state = !record ? 'in' : !record.checkout_time ? 'out' : 'done';

  const act = async () => {
    setBusy(true);
    try {
      const res = state === 'in' ? await attendance.checkIn() : await attendance.checkOut();
      const r = res.data;
      const msg = state === 'in' ? `Checked in at ${time(r.checkin_time)} (server time)` : `Checked out at ${time(r.checkout_time)} (server time)`;
      setLastAction(msg);
      toast.push({ tone: 'ok', text: msg });
      today.reload();
      list.reload();
    } catch (err) {
      toast.push({ tone: 'bad', text: err.message }); // e.g. BR-01 duplicate check-in, BR-02 check-out rules
      today.reload();
    } finally {
      setBusy(false);
    }
  };

  const applyRange = (e) => {
    e.preventDefault();
    const msg = !draft.from || !draft.to ? 'Choose both dates' : fromNotAfterTo(draft.from, draft.to);
    setRangeError(msg);
    if (!msg) setRange({ ...draft });
  };

  return (
    <>
      <PageHeader title="Attendance" subtitle="Mark your attendance and view your records. Times come from the server clock." />

      <section className="card" aria-labelledby="today-h">
        <h2 id="today-h" className="card__title">
          Today{now.data ? `, ${date(now.data.today)}` : ''}
        </h2>
        <div className="toolbar" style={{ alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={act}
            disabled={busy || today.loading || state === 'done' || Boolean(today.error)}
          >
            {busy ? 'Recording…' : state === 'in' ? 'Check in' : state === 'out' ? 'Check out' : 'Attendance complete'}
          </button>
          <div aria-live="polite">
            {today.loading ? (
              <span className="muted">Loading today&apos;s record…</span>
            ) : record ? (
              <span>
                {LABELS.checkin_time}: <Mono>{time(record.checkin_time)}</Mono>
                {' · '}
                {LABELS.checkout_time}: <Mono>{time(record.checkout_time)}</Mono>
              </span>
            ) : (
              <span className="muted">You have not checked in today.</span>
            )}
            {lastAction && <div className="small muted">{lastAction}</div>}
          </div>
        </div>
      </section>

      <StatRow>
        <StatCard label={LABELS.days_present} mono loading={list.loading} value={list.data ? list.data.summary.days_present : '—'} hint={range ? `${date(range.from)} – ${date(range.to)}` : undefined} />
        <StatCard label="Records in range" mono loading={list.loading} value={list.data ? list.data.records.length : '—'} />
      </StatRow>

      <section className="card card--flush">
        <form className="toolbar" style={{ padding: 16 }} onSubmit={applyRange} noValidate>
          <FormField label={LABELS.from} error={rangeError}>
            <input className="input" type="date" value={draft.from} max={draft.to || undefined} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} />
          </FormField>
          <FormField label={LABELS.to}>
            <input className="input" type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} />
          </FormField>
          <button type="submit" className="btn">
            Show
          </button>
        </form>
        <DataTable
          caption="My attendance"
          columns={columns}
          rows={list.data ? list.data.records : []}
          loading={list.loading || !range}
          error={list.error || now.error}
          onRetry={() => (now.error ? now.reload() : list.reload())}
          empty="No attendance records in this period"
          rowKey={(r) => r.attendance_id}
        />
      </section>
    </>
  );
}
