'use strict';
// UC-19 | FR-19 | Process 0.4.3 | BR-29 | NFR-19 — printable offer letter (DS-30 Offer Letter).
// One fixed template; every value comes from the stored OFFER row (plus candidate name and
// vacancy department), never from the request.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });

function longDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/**
 * @param {object} o offer_id, candidate_name, offer_position, department, offered_salary,
 *                   joining_date, offer_issue_date, offer_status
 */
function renderOfferLetter(o) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Offer Letter ${esc(o.offer_id)}</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; color: #111; background: #fff; margin: 0; }
  .page { max-width: 720px; margin: 40px auto; padding: 48px; border: 1px solid #ccc; line-height: 1.6; }
  h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: 0.5px; }
  .org { color: #444; margin-bottom: 32px; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 24px; font-size: 14px; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0 24px; }
  th, td { text-align: left; padding: 8px 10px; border: 1px solid #ccc; font-size: 15px; }
  th { width: 38%; background: #f4f4f4; }
  .sign { margin-top: 48px; }
  @media print { .page { border: none; margin: 0; } }
</style>
</head>
<body>
<div class="page">
  <h1>Offer of Employment</h1>
  <div class="org">Office Employee Management System</div>
  <div class="meta"><span>Offer ID: <strong>${esc(o.offer_id)}</strong></span><span>Date: ${esc(longDate(o.offer_issue_date))}</span></div>
  <p>Dear ${esc(o.candidate_name)},</p>
  <p>We are pleased to offer you the position of <strong>${esc(o.offer_position)}</strong> in the
     <strong>${esc(o.department)}</strong> department, on the terms set out below.</p>
  <table>
    <tr><th>Position</th><td>${esc(o.offer_position)}</td></tr>
    <tr><th>Department</th><td>${esc(o.department)}</td></tr>
    <tr><th>Offered salary</th><td>${esc(inr.format(Number(o.offered_salary)))}</td></tr>
    <tr><th>Joining date</th><td>${esc(longDate(o.joining_date))}</td></tr>
    <tr><th>Offer issue date</th><td>${esc(longDate(o.offer_issue_date))}</td></tr>
    <tr><th>Offer status</th><td>${esc(o.offer_status)}</td></tr>
  </table>
  <p>Please confirm your acceptance of this offer before your joining date.</p>
  <div class="sign">
    <p>Yours sincerely,</p>
    <p><strong>Recruitment Officer</strong><br>Office Employee Management System</p>
  </div>
</div>
</body>
</html>
`;
}

module.exports = { renderOfferLetter, esc };
