'use strict';
// UC-13 | FR-13 | Process 0.6.4 | BR-20 | NFR-13 — payslip PDF with one fixed, readable layout.
// Values come only from the stored PAYSLIP row and its PAYROLL line (DS-43, DS-44).
const PDFDocument = require('pdfkit');

const num = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rupees = (v) => `INR ${num.format(Number(v))}`;

/** @returns {Promise<Buffer>} */
function renderPayslipPdf(p) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Payslip ${p.payslip_id}`, Author: 'OEMS' } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = 50;
    const width = doc.page.width - 100;

    doc.font('Helvetica-Bold').fontSize(18).text('Office Employee Management System', left, 50, { width, align: 'center' });
    doc.font('Helvetica').fontSize(13).text(`Payslip for ${p.pay_period}`, { width, align: 'center' });
    doc.moveDown(1.5);

    const kv = (label, value, y) => {
      doc.font('Helvetica-Bold').fontSize(10).text(label, left, y, { width: 140 });
      doc.font('Helvetica').fontSize(10).text(String(value ?? '-'), left + 140, y, { width: width - 140 });
    };
    let y = doc.y;
    for (const [label, value] of [
      ['Payslip ID', p.payslip_id],
      ['Payroll ID', p.payroll_id],
      ['Employee ID', p.employee_id],
      ['Employee name', p.employee_name],
      ['Department', p.department],
      ['Designation', p.designation],
      ['Pay period', p.pay_period],
      ['Monthly basic salary', rupees(p.basic_salary)],
      ['Days present', p.days_present],
      ['Paid leave days', p.leave_days],
      ['Generated date', p.generated_date],
    ]) {
      kv(label, value, y);
      y += 16;
    }

    // Earnings and deductions table
    y += 14;
    const col = [left, left + width / 2, left + width / 2 + 10];
    const rowH = 20;
    const row = (cells, bold = false) => {
      doc.rect(left, y, width, rowH).stroke('#999999');
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
      doc.text(cells[0], col[0] + 6, y + 6, { width: width / 4 });
      doc.text(cells[1], col[0] + width / 4, y + 6, { width: width / 4 - 10, align: 'right' });
      doc.text(cells[2], col[2], y + 6, { width: width / 4 });
      doc.text(cells[3], col[2] + width / 4 - 10, y + 6, { width: width / 4 - 10, align: 'right' });
      y += rowH;
    };
    row(['Earnings', 'Amount', 'Deductions', 'Amount'], true);
    row(['Earned basic', rupees(p.earned_basic), 'Income tax', rupees(p.tax_deduction)]);
    row(['Allowances', rupees(p.allowances), 'Provident fund', rupees(p.pf_deduction)]);
    row(['', '', 'Other deductions', rupees(p.other_deductions)]);
    row(['Gross salary', rupees(p.gross_salary), 'Total deductions', rupees(p.total_deductions)], true);
    doc.moveTo(col[1], y - rowH * 5).lineTo(col[1], y).stroke('#999999');

    y += 16;
    doc.font('Helvetica-Bold').fontSize(13).text(`Net salary: ${rupees(p.net_salary)}`, left, y, { width, align: 'right' });

    doc.font('Helvetica').fontSize(8).fillColor('#555555')
      .text('Gross salary reflects attendance and approved leave for the pay period. This is a system-generated payslip.', left, doc.page.height - 90, { width, align: 'center' });
    doc.end();
  });
}

module.exports = { renderPayslipPdf };
