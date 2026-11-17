// Employee options for Payroll Officer / Finance Manager screens.
// GET /employees is HR-only, so these roles use GET /salary (employee_id, name, department, basic salary).
// It has no employment status: a Resigned/Retired employee picked for a payroll run comes back under "failed".
import { salary } from '../api/endpoints';
import useAsync from './useAsync';

export default function useSalaryEmployees() {
  return useAsync(async () => (await salary.list()).data, []);
}

export const nameOf = (list, id) => {
  const e = (list || []).find((x) => x.employee_id === id);
  return e ? e.employee_name : '';
};
