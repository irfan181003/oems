// Temporary placeholder for screens of later phases (replaced phase by phase; removed in Phase 6)
import PageHeader from '../components/PageHeader';

export default function Pending({ title, phase }) {
  return (
    <>
      <PageHeader title={title} subtitle={`This screen is built in Phase ${phase}.`} />
    </>
  );
}
