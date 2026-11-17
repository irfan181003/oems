// UC-19 | FR-19 | Recruitment Officer | API: GET /offers/:id/letter (HTML, fetched with auth), GET /offers/:id
// BR-29: the letter is rendered by the backend only from the stored OFFER row; shown here in a sandboxed frame.
import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { offers } from '../../api/endpoints';
import DocumentFrame from '../../components/DocumentFrame';
import Mono from '../../components/Mono';
import PageHeader from '../../components/PageHeader';
import Skeleton from '../../components/Skeleton';
import StatusBadge from '../../components/StatusBadge';
import { ErrorState } from '../../components/States';
import useAsync from '../../lib/useAsync';

export default function OfferLetter() {
  const { offer_id: offerId } = useParams();
  const frame = useRef(null);
  const offer = useAsync(async () => (await offers.get(offerId)).data, [offerId]);
  const letter = useAsync(() => offers.letterHtml(offerId), [offerId]);

  useEffect(() => {
    document.title = `Offer letter ${offerId} · OEMS`;
  }, [offerId]);

  const error = offer.error || letter.error;
  const o = offer.data;

  return (
    <>
      <PageHeader
        title="Offer Letter"
        subtitle={
          o ? (
            <>
              <Mono>{o.offer_id}</Mono> · {o.candidate_name} · {o.offer_position} <StatusBadge value={o.offer_status} />
            </>
          ) : (
            <Mono>{offerId}</Mono>
          )
        }
        actions={
          <>
            <Link className="btn btn--ghost" to="/recruitment/offers">
              ← Offers
            </Link>
            <button type="button" className="btn btn--primary" onClick={() => frame.current && frame.current.print()} disabled={!letter.data}>
              Print
            </button>
          </>
        }
      />
      {error ? (
        <div className="card">
          <ErrorState
            error={error}
            onRetry={() => {
              offer.reload();
              letter.reload();
            }}
          />
        </div>
      ) : letter.loading ? (
        <div className="doc" style={{ display: 'grid', gap: 12 }} aria-busy="true">
          <Skeleton height={24} width="50%" />
          <Skeleton height={14} />
          <Skeleton height={14} width="80%" />
          <Skeleton height={160} />
        </div>
      ) : (
        <div style={{ maxWidth: 820, width: '100%', margin: '0 auto' }}>
          <DocumentFrame ref={frame} html={letter.data} title={`Offer letter ${offerId}`} />
        </div>
      )}
    </>
  );
}
