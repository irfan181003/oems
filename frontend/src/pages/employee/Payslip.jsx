// UC-13, UC-11 | FR-13, FR-11 | Employee | API: GET /payslips/:id, GET /payslips/:id/download (own payslip only, A-4)
import { useParams } from 'react-router-dom';
import PayslipDocument from '../shared/PayslipDocument';
import { useEffect } from 'react';

export default function Payslip() {
  const { payslip_id: payslipId } = useParams();
  useEffect(() => {
    document.title = `Payslip ${payslipId} · OEMS`;
  }, [payslipId]);
  return <PayslipDocument payslipId={payslipId} backTo="/employee/salary" backLabel="My Salary" />;
}
