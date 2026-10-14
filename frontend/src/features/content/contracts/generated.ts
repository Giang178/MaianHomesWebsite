/* Generated-contract facade. Keep field names aligned with backend OpenAPI. */
type WorkflowStatus = 'DRAFT' | 'PUBLISHED';
type PublicationStatus =
  | 'NEVER_PUBLISHED'
  | 'PUBLISHED'
  | 'UNPUBLISHED'
  | 'ARCHIVED';
export type ContentAction =
  | 'publish'
  | 'unpublish'
  | 'archive'
  | 'restore';

export interface ValidationIssue {
  code: string;
  field: string;
  message: string;
  group?: 'SEO' | 'GEO' | 'CONTENT' | 'MEDIA';
}

export interface ValidationReport {
  score: number;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface QualitySummary {
  score: number;
  error_count: number;
  warning_count: number;
}

export interface WorkflowFields {
  version: number;
  published_version?: number;
  workflow_status?: WorkflowStatus;
  publication_status?: PublicationStatus;
  rejection_reason?: string | null;
}

export interface TransitionPayload {
  action: ContentAction;
  expected_version: number;
  idempotency_key: string;
  note?: string;
  override_warning_codes?: string[];
}

export interface ArticleSEO {
  meta_title: string;
  meta_description: string;
  canonical_url: string;
}

export interface ArticleGEO {
  answer_summary: string;
  key_facts: string[];
  faqs: Array<{ question: string; answer: string }>;
  sources: Array<{ title: string; url: string; publisher?: string }>;
}
