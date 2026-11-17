// The right control for each EMPLOYEE field (shared by Register Employee and the Employee record editor)
import { DEPARTMENTS, EMPLOYMENT_STATUSES, GENDERS } from '../../lib/labels';

export default function EmployeeInput({ field, value, onChange, today, autoFocus }) {
  const common = { name: field, value: value ?? '', onChange, autoFocus };
  switch (field) {
    case 'gender':
      return (
        <select className="select" {...common}>
          <option value="">Choose</option>
          {GENDERS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      );
    case 'department':
      return (
        <select className="select" {...common}>
          <option value="">Choose a department</option>
          {DEPARTMENTS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      );
    case 'employment_status':
      return (
        <select className="select" {...common}>
          {EMPLOYMENT_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      );
    case 'date_of_birth':
      return <input className="input" type="date" max={today || undefined} {...common} />;
    case 'date_of_joining':
      return <input className="input" type="date" {...common} />;
    case 'address':
      return <textarea className="textarea" maxLength={200} {...common} />;
    case 'contact_number':
      return <input className="input mono" inputMode="numeric" maxLength={10} {...common} />;
    case 'bank_account':
      return <input className="input mono" inputMode="numeric" maxLength={18} {...common} />;
    case 'basic_salary':
      return <input className="input mono" inputMode="decimal" placeholder="0.00" {...common} />;
    case 'email':
      return <input className="input" type="email" maxLength={100} {...common} />;
    case 'employee_name':
      return <input className="input" maxLength={100} {...common} />;
    case 'designation':
      return <input className="input" maxLength={50} {...common} />;
    default:
      return <input className="input" {...common} />;
  }
}
