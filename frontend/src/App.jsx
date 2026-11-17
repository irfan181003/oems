// Routes (FRONTEND_PROMPT §4). Every role subtree is guarded by <RequireRole>, so another role's URL shows 403.
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import RequireRole from './auth/RequireRole';
import AppLayout from './layout/AppLayout';
import { ROLES, homeFor } from './layout/menu';
import LoginPage from './pages/LoginPage';
import AccessDenied from './pages/AccessDenied';
import NotFound from './pages/NotFound';
import EmployeeDashboard from './pages/employee/Dashboard';
import EmployeeAttendance from './pages/employee/Attendance';
import ApplyLeave from './pages/employee/ApplyLeave';
import MyLeaves from './pages/employee/MyLeaves';
import Profile from './pages/employee/Profile';
import MySalary from './pages/employee/MySalary';
import EmployeePayslip from './pages/employee/Payslip';
import Employees from './pages/hr/Employees';
import RegisterEmployee from './pages/hr/RegisterEmployee';
import EmployeeRecord from './pages/hr/EmployeeRecord';
import HrAttendance from './pages/hr/Attendance';
import LeaveReview from './pages/hr/LeaveReview';
import RetirementPlans from './pages/hr/RetirementPlans';
import HrReports from './pages/hr/HrReports';
import SalaryView from './pages/shared/SalaryView';
import Vacancies from './pages/recruitment/Vacancies';
import Candidates from './pages/recruitment/Candidates';
import Interviews from './pages/recruitment/Interviews';
import Offers from './pages/recruitment/Offers';
import OfferLetter from './pages/recruitment/OfferLetter';
import RunPayroll from './pages/payroll/RunPayroll';
import PayrollRecords from './pages/payroll/PayrollRecords';
import Payslips from './pages/payroll/Payslips';
import PayslipView from './pages/payroll/PayslipView';
import FinancialReport from './pages/finance/FinancialReport';

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={homeFor(user.role)} replace />;
}

const only = (role) => (
  <RequireRole roles={[role]}>
    <Outlet />
  </RequireRole>
);

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/403" element={<AccessDenied />} />
      <Route path="/404" element={<NotFound />} />

      <Route
        element={
          <RequireRole>
            <AppLayout />
          </RequireRole>
        }
      >
        <Route index element={<HomeRedirect />} />

        {/* Employee — UC-01, UC-02, UC-03, UC-05, UC-11, UC-13 */}
        <Route path="employee" element={only(ROLES.EMPLOYEE)}>
          <Route index element={<EmployeeDashboard />} />
          <Route path="attendance" element={<EmployeeAttendance />} />
          <Route path="leave/new" element={<ApplyLeave />} />
          <Route path="leave" element={<MyLeaves />} />
          <Route path="profile" element={<Profile />} />
          <Route path="salary" element={<MySalary />} />
          <Route path="payslips/:payslip_id" element={<EmployeePayslip />} />
        </Route>

        {/* HR Manager — UC-02, UC-04, UC-06, UC-07, UC-11, UC-16, UC-20 */}
        <Route path="hr" element={only(ROLES.HR)}>
          <Route index element={<Navigate to="employees" replace />} />
          <Route path="employees" element={<Employees />} />
          <Route path="employees/new" element={<RegisterEmployee />} />
          <Route path="employees/:id" element={<EmployeeRecord />} />
          <Route path="attendance" element={<HrAttendance />} />
          <Route path="leaves" element={<LeaveReview />} />
          <Route path="retirement" element={<RetirementPlans />} />
          <Route path="salary" element={<SalaryView subtitle="Basic salary and processed pay periods of employees (UC-11)." />} />
          <Route path="reports" element={<HrReports />} />
        </Route>

        {/* Recruitment Officer — UC-09, UC-10, UC-19 (+ candidates, A-3) */}
        <Route path="recruitment" element={only(ROLES.RECRUITMENT)}>
          <Route index element={<Navigate to="vacancies" replace />} />
          <Route path="vacancies" element={<Vacancies />} />
          <Route path="candidates" element={<Candidates />} />
          <Route path="interviews" element={<Interviews />} />
          <Route path="offers" element={<Offers />} />
          <Route path="offers/:offer_id/letter" element={<OfferLetter />} />
        </Route>

        {/* Payroll Officer — UC-11, UC-12, UC-13, UC-14, UC-15 */}
        <Route path="payroll" element={only(ROLES.PAYROLL)}>
          <Route index element={<Navigate to="run" replace />} />
          <Route path="run" element={<RunPayroll />} />
          <Route path="records" element={<PayrollRecords />} />
          <Route path="payslips" element={<Payslips />} />
          <Route path="payslips/:payslip_id" element={<PayslipView />} />
          <Route path="salary" element={<SalaryView subtitle="Basic salary and processed pay periods of employees (UC-11)." />} />
        </Route>

        {/* Finance Manager — UC-11, UC-17 */}
        <Route path="finance" element={only(ROLES.FINANCE)}>
          <Route index element={<Navigate to="salary" replace />} />
          <Route path="salary" element={<SalaryView subtitle="Salary information of employees for financial oversight (UC-11)." />} />
          <Route path="reports" element={<FinancialReport />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
