// Routes (FRONTEND_PROMPT §4). Every role subtree is guarded by <RequireRole>, so another role's URL shows 403.
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import RequireRole from './auth/RequireRole';
import AppLayout from './layout/AppLayout';
import { ROLES, homeFor } from './layout/menu';
import LoginPage from './pages/LoginPage';
import AccessDenied from './pages/AccessDenied';
import NotFound from './pages/NotFound';
import Pending from './pages/Pending';

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
          <Route index element={<Pending title="Dashboard" phase={2} />} />
          <Route path="attendance" element={<Pending title="Attendance" phase={2} />} />
          <Route path="leave/new" element={<Pending title="Apply Leave" phase={2} />} />
          <Route path="leave" element={<Pending title="My Leaves" phase={2} />} />
          <Route path="profile" element={<Pending title="My Profile" phase={2} />} />
          <Route path="salary" element={<Pending title="My Salary" phase={2} />} />
          <Route path="payslips/:payslip_id" element={<Pending title="Payslip" phase={2} />} />
        </Route>

        {/* HR Manager — UC-02, UC-04, UC-06, UC-07, UC-11, UC-16, UC-20 */}
        <Route path="hr" element={only(ROLES.HR)}>
          <Route index element={<Navigate to="employees" replace />} />
          <Route path="employees" element={<Pending title="Employees" phase={3} />} />
          <Route path="employees/new" element={<Pending title="Register Employee" phase={3} />} />
          <Route path="employees/:id" element={<Pending title="Employee Record" phase={3} />} />
          <Route path="attendance" element={<Pending title="Attendance" phase={3} />} />
          <Route path="leaves" element={<Pending title="Leave Review" phase={3} />} />
          <Route path="retirement" element={<Pending title="Retirement Plans" phase={3} />} />
          <Route path="salary" element={<Pending title="Salary View" phase={3} />} />
          <Route path="reports" element={<Pending title="HR Reports" phase={3} />} />
        </Route>

        {/* Recruitment Officer — UC-09, UC-10, UC-19 (+ candidates, A-3) */}
        <Route path="recruitment" element={only(ROLES.RECRUITMENT)}>
          <Route index element={<Navigate to="vacancies" replace />} />
          <Route path="vacancies" element={<Pending title="Vacancies" phase={4} />} />
          <Route path="candidates" element={<Pending title="Candidates" phase={4} />} />
          <Route path="interviews" element={<Pending title="Interviews" phase={4} />} />
          <Route path="offers" element={<Pending title="Offers" phase={4} />} />
          <Route path="offers/:offer_id/letter" element={<Pending title="Offer Letter" phase={4} />} />
        </Route>

        {/* Payroll Officer — UC-11, UC-12, UC-13, UC-14, UC-15 */}
        <Route path="payroll" element={only(ROLES.PAYROLL)}>
          <Route index element={<Navigate to="run" replace />} />
          <Route path="run" element={<Pending title="Run Payroll" phase={5} />} />
          <Route path="records" element={<Pending title="Payroll Records" phase={5} />} />
          <Route path="payslips" element={<Pending title="Payslips" phase={5} />} />
          <Route path="payslips/:payslip_id" element={<Pending title="Payslip" phase={5} />} />
          <Route path="salary" element={<Pending title="Salary View" phase={5} />} />
        </Route>

        {/* Finance Manager — UC-11, UC-17 */}
        <Route path="finance" element={only(ROLES.FINANCE)}>
          <Route index element={<Navigate to="salary" replace />} />
          <Route path="salary" element={<Pending title="Salary View" phase={5} />} />
          <Route path="reports" element={<Pending title="Financial / Payroll Report" phase={5} />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
