// Employee options for pickers on HR Manager screens (GET /employees is HR-only).
import { employees } from '../api/endpoints';
import useAsync from './useAsync';

export default function useEmployees() {
  return useAsync(async () => (await employees.list()).data, []);
}

/** "EMP00005 · Sneha Das" (+ status when not Active) */
export const employeeOption = (e) =>
  `${e.employee_id} · ${e.employee_name}${e.employment_status && e.employment_status !== 'Active' ? ` (${e.employment_status})` : ''}`;
