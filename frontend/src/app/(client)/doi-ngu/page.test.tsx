import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ getPublicTeam: vi.fn() }));

vi.mock('@/features/team/api', () => ({
  TeamApiError: class TeamApiError extends Error {
    constructor(
      message: string,
      public status: number,
      public requestId?: string,
    ) {
      super(message);
    }
  },
  getPublicTeam: api.getPublicTeam,
}));

vi.mock('@/features/team/TeamDirectoryClient', () => ({
  TeamDirectoryClient: ({ initialProjectSlug }: { initialProjectSlug: string }) => (
    <div data-testid="team-directory">{initialProjectSlug}</div>
  ),
}));

vi.mock('@/components/system/PublicDataUnavailable', () => ({
  default: ({ title, status, requestId }: { title: string; status?: number; requestId?: string }) => (
    <section>
      <h2>{title}</h2>
      <p>{status} {requestId}</p>
    </section>
  ),
}));

vi.mock('@/components/home/ContactFormSection', () => ({
  default: ({ projects }: { projects: unknown[] }) => (
    <div data-testid="contact-form-section">{projects?.length ?? 0}</div>
  ),
}));

import TeamPage from './page';

describe('TeamPage', () => {
  it('does not turn an upstream outage into a legitimate empty team', async () => {
    const { TeamApiError } = await import('@/features/team/api');
    api.getPublicTeam.mockRejectedValue(new TeamApiError('unavailable', 503, 'req-team-503'));

    render(await TeamPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole('heading', { name: 'Chưa thể tải danh sách đội ngũ' })).toBeInTheDocument();
    expect(screen.getByText(/503/)).toBeInTheDocument();
    expect(screen.getByText(/req-team-503/)).toBeInTheDocument();
    expect(screen.queryByTestId('team-directory')).not.toBeInTheDocument();
  });

  it('preserves the project filter on a successful response', async () => {
    api.getPublicTeam.mockResolvedValue({ data: [], total: 0 });

    render(await TeamPage({ searchParams: Promise.resolve({ project: 'the-prive' }) }));

    expect(screen.getByTestId('team-directory')).toHaveTextContent('the-prive');
  });
});
