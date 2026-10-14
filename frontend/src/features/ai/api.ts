import { apiFetch } from '@/lib/api';

export type AiGenerationEnvelope<T> = {
  status: 'ok' | 'needs_input' | 'unavailable';
  data: T | null;
  warnings: Array<{code: string; message: string}>;
  validation: Record<string, unknown> & {
    schema_valid?: boolean;
    evidence_valid?: boolean;
    complete?: boolean;
    supported_fields?: string[];
    unsupported?: string[];
  };
  generation: {model: string; prompt_version: string; latency_ms: number; repairs: number};
};

export const aiApi = {
  chat: (prompt: string) => apiFetch('/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ prompt })
  }, 'protected'),
  generateSeo: (projectName: string, description: string, source: {location?: string; developer?: string; status?: string; price_range?: string; amenities?: string[]; marketing_tags?: string[]; sources?: Array<{title: string; url: string; publisher?: string}>} = {}) => apiFetch('/ai/seo', {
    method: 'POST',
    body: JSON.stringify({ project_name: projectName, description, ...source })
  }, 'protected'),
  generateArticleSeoGeo: (data: {
    title: string;
    sapo: string;
    slug: string;
    category: string;
    content: string;
    sources: Array<{title: string; url: string; publisher?: string}>;
  }) => apiFetch('/ai/article-seo-geo', {
    method: 'POST',
    body: JSON.stringify(data),
  }, 'protected'),
};
