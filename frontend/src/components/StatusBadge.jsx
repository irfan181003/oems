// Status colours (FRONTEND_PROMPT §2)
const TONES = {
  ok: ['Approved', 'Paid', 'Active', 'Open', 'Selected', 'Accepted', 'Issued', 'Present'],
  warn: ['Pending', 'On Hold', 'Scheduled', 'Processed', 'Half-day'],
  bad: ['Rejected', 'Declined', 'Absent'],
  neutral: ['Closed', 'Resigned', 'Retired', 'Cancelled', 'Completed', 'On Leave'],
};
const TONE_OF = Object.fromEntries(Object.entries(TONES).flatMap(([tone, values]) => values.map((v) => [v, tone])));

export const toneOf = (value) => TONE_OF[value] || 'neutral';

export default function StatusBadge({ value }) {
  if (!value) return null;
  return <span className={`badge badge--${toneOf(value)}`}>{value}</span>;
}
