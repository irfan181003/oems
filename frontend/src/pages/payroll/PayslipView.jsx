// UC-13 | FR-13 | Payroll Officer | API: GET /payslips/:id, GET /payslips/:id/download
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import PayslipDocument from '../shared/PayslipDocument';

export default function PayslipView() {
  const { payslip_id: payslipId } = useParams();
  useEffect(() => {
    document.title = `Payslip ${payslipId} · OEMS`;
  }, [payslipId]);
  return <PayslipDocument payslipId={payslipId} backTo="/payroll/payslips" backLabel="Payslips" />;
}
