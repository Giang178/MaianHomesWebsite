import type { TeamListResponse, TeamMember } from './types';

const backendUrl = () => {
  const value = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
  return value.endsWith('/') ? value.slice(0, -1) : value;
};

export class TeamApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'TeamApiError';
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new TeamApiError(
      response.status === 404 ? 'Không tìm thấy chuyên gia.' : 'Không thể tải dữ liệu đội ngũ.',
      response.status,
      response.headers.get('x-request-id') || response.headers.get('request-id') || undefined,
    );
  }
  return response.json() as Promise<T>;
}

export async function getPublicTeam(params: {
  q?: string;
  home?: boolean;
  featured?: boolean;
  limit?: number;
  cursor?: string | null;
} = {}): Promise<TeamListResponse> {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (typeof params.home === 'boolean') query.set('home', String(params.home));
  if (typeof params.featured === 'boolean') query.set('featured', String(params.featured));
  query.set('limit', String(params.limit || 24));
  if (params.cursor) query.set('cursor', params.cursor);
  const response = await fetch(`${backendUrl()}/api/public/team?${query}`, {
    cache: 'force-cache',
    next: { revalidate: 300, tags: ['public-team'] },
    signal: AbortSignal.timeout(15000),
  });
  return readResponse<TeamListResponse>(response);
}

export async function getPublicTeamMember(slug: string): Promise<TeamMember> {
  const response = await fetch(`${backendUrl()}/api/public/team/${encodeURIComponent(slug)}`, {
    cache: 'force-cache',
    next: { revalidate: 300, tags: ['public-team', `public-team-${slug}`] },
    signal: AbortSignal.timeout(15000),
  });
  return readResponse<TeamMember>(response);
}
