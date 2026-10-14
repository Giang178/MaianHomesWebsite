export type ActivityEvent = {
  id: string;
  event_type: string;
  result: string;
  severity: string;
  module: string;
  category?: string;
  occurred_at: string;
  actor?: {
    name?: string;
    email?: string;
    type?: string;
    role?: string;
  };
  actor_name?: string;
  actor_role?: string;
  target?: {
    type?: string;
    id?: string;
    label?: string;
  };
  target_type?: string;
  target_id?: string;
  request?: {
    id?: string;
    session_id?: string;
    ip_address?: string;
    user_agent?: string;
    browser?: string;
    operating_system?: string;
    request_id?: string;
  };
  request_id?: string;
  session_id?: string;
  ip_address?: string;
  change?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    diff?: Record<string, { before?: unknown; after?: unknown }>;
  };
  metadata?: {
    snapshot?: Record<string, unknown>;
    extensions?: Record<string, unknown>;
    [key: string]: unknown;
  };
  actor_email?: string;
  created_at?: string;
};

export type ActivityFilters = {
  q?: string;
  module?: string;
  category?: string;
  event_type?: string;
  result?: string;
  severity?: string;
  start?: string;
  end?: string;
  actor_email?: string;
  target_id?: string;
  target_type?: string;
  ip_address?: string;
  request_id?: string;
  session_id?: string;
  cursor?: string;
  limit?: number;
};

export type ActivityMetadata = {
  modules: { value: string; label: string }[];
  categories: { value: string; label: string }[];
  event_types: { value: string; label: string }[];
  results: { value: string; label: string }[];
  severities: { value: string; label: string }[];
};

export type PurgePreview = {
  cutoff: string;
  eligible_count: number;
  modules: Record<string, number>;
  preview_token: string;
  confirmation_text: string;
};

export type PurgeResult = {
  deleted_count: number;
  cutoff: string;
  message: string;
};
