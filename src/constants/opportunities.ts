export const OPPORTUNITY_STAGES = [
  'Lead',
  'Qualification',
  'Proposal',
  'Negotiation',
  'Closed Won',
  'Closed Lost'
] as const;

export const OPPORTUNITY_TYPES = [
  'New Business',
  'Upsell',
  'Renewal'
] as const;

export const LEAD_SOURCES = [
  'Website',
  'Outbound Efforts',
  'Referral',
  'Partner',
  'Email Campaign',
  'Cold Call',
  'Event/Conference',
  'Other'
] as const;

export const CURRENCIES = [
  'EUR',
  'USD',
  'AED',
  'GBP',
  'INR',
  'SGD',
  'YEN',
  'AUD',
  'Other'
] as const;

export const DOCUMENT_TYPES = [
  'Proposal',
  'Contract',
  'Supporting Material'
] as const;

export const DOCUMENT_STATUSES = [
  'Uploaded',
  'Signed',
  'Pending'
] as const;

export type OpportunityStage = typeof OPPORTUNITY_STAGES[number];
export type OpportunityType = typeof OPPORTUNITY_TYPES[number];
export type LeadSource = typeof LEAD_SOURCES[number];
export type Currency = typeof CURRENCIES[number];
export type DocumentType = typeof DOCUMENT_TYPES[number];
export type DocumentStatus = typeof DOCUMENT_STATUSES[number];