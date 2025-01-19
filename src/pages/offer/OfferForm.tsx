import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { OfferFormCreate } from './OfferFormCreate';
import { OfferFormEdit } from './OfferFormEdit';

export function OfferForm() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const opportunityId = searchParams.get('opportunity') || null;

  if (id) {
    return <OfferFormEdit id={id} />;
  }

  return <OfferFormCreate opportunityId={opportunityId} />;
}