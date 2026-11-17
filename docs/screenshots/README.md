# Screenshots — Office Employee Management System (Group 02)

Captured on 17 Nov 2026 from the seeded demo data (`npm run seed`) in Microsoft Edge at 1280 px wide (the `mobile360_*` files are 360 px wide).
File names start with the use case (`ucXX`), the requirement (`nfr21`, `nfr22`) or the assumption (`a3`) they show.
The checklist is FRONTEND_PROMPT §8 (also in `frontend/README.md`).

## Checklist coverage

| # | Checklist item | File(s) | Status |
|---|---|---|---|
| 1 | Login | `nfr22_login.png` | Covered |
| 2 | Employee dashboard | `uc01_uc02_uc03_employee_dashboard.png` | Covered |
| 3 | Employee attendance | `uc01_uc02_employee_attendance.png` | Covered |
| 4 | Apply leave | `uc03_employee_apply_leave.png` | Covered (empty form) |
| 5 | My leaves | `uc03_uc04_employee_my_leaves.png` | Covered |
| 6 | Profile | `uc05_employee_my_profile.png` | Covered |
| 7 | My salary | `uc11_employee_my_salary.png` | Covered |
| 8 | Payslip | `uc13_employee_payslip.png` | Covered |
| 9 | HR employee list | `uc07_hr_employee_list.png` | Covered |
| 10 | HR register | `uc06_hr_register_employee_form.png` | **Partial**: form only. The one-time temporary-password panel appears only after a real registration. |
| 11 | HR record edit | `uc07_hr_employee_record.png`, `uc07_hr_employee_record_edit.png` | Covered (inline edit open, not saved) |
| 12 | HR leave review | `uc04_hr_leave_review.png`, `uc04_hr_leave_review_approve_confirm.png` | Covered (approve confirmation, not confirmed) |
| 13 | HR retirement plan | `uc20_hr_retirement_plans.png`, `uc20_hr_retirement_plan_edit.png` | Covered (edit dialog, not saved) |
| 14 | HR report | `uc16_hr_report_form.png`, `uc16_hr_report.png` | Covered (Attendance report, Oct 2026) |
| 15 | Recruitment vacancies | `uc09_ro_vacancies.png` | Covered |
| 16 | Interview schedule (incl. conflict message) | `uc10_ro_interview_schedule.png`, `uc10_ro_interview_conflict.png` | Covered (BR-13 409 message) |
| 17 | Offer | `uc19_ro_offers.png`, `uc19_ro_new_offer_dialog.png` | **Partial**: list and New offer dialog; the seed has no eligible candidate, so the dialog shows "No candidate is eligible". |
| 18 | Offer letter | `uc19_ro_offer_letter.png` | Covered |
| 19 | Run payroll result | `uc12_uc14_po_run_payroll_form.png`, `uc12_uc14_po_run_payroll_result.png` | Covered (re-run of Oct 2026: 10 skipped, BR-19). A run that processes new lines is not shown. |
| 20 | Payroll records | `uc15_po_payroll_records.png` | Covered |
| 21 | Payslips | `uc13_po_payslips_list.png`, `uc13_po_payslips_generate_result.png`, `uc13_po_payslip_view.png` | Covered (generate result: 10 already existed) |
| 22 | Finance salary view | `uc11_fm_salary_view.png` | Covered |
| 23 | Financial report | `uc17_fm_report_form.png`, `uc17_fm_financial_report.png` | Covered (Financial type, Oct 2026) |
| 24 | Access-denied page | `nfr21_access_denied.png` | Covered (Employee opening `/hr/employees`) |
| 25 | Session-expiry modal | `nfr22_session_expiry_modal.png` | Covered (taken with `VITE_IDLE_MINUTES=3`) |

## Extra screenshots (not on the checklist)

| File | Shows |
|---|---|
| `uc02_hr_attendance.png` | HR Manager attendance view (UC-02 for all employees) |
| `uc11_hr_salary_view.png`, `uc11_po_salary_view.png` | Salary View for the HR Manager and Payroll Officer |
| `a3_ro_candidates.png` | Candidates (assumption A-3) |
| `general_404_not_found.png` | 404 page |
| `mobile360_uc01_employee_dashboard.png`, `mobile360_nav_menu_open.png`, `mobile360_uc13_employee_payslip.png` | 360 px layout and slide-over menu |

## How to capture the partial items

These need real data changes, so they were not captured automatically:

- **#10 temporary password:**
  1. As EMP00001, open `/hr/employees/new`.
  2. Register a new employee.
  3. Screenshot the "Shown only once" panel.
- **#17 offer for an eligible candidate:**
  1. As EMP00002, on *Interviews*, set INT0000002 (CAN00002) to **Selected**.
  2. On *Offers* → **New offer**, choose CAN00002 and enter a salary and joining date; screenshot the filled form.
  3. Optionally, generate it and screenshot the new letter.
- **#19 processed run (optional):** a run that processes new lines needs a month with no payroll yet. The current month works, but it creates payroll lines.

To return to the original demo data afterwards, stop the backend, then from the project folder run `cd backend && rm -rf data && npm run seed`.
