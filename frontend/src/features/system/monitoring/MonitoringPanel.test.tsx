import {render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {monitoringApi} from './api';
import {MonitoringPanel} from './MonitoringPanel';

vi.mock('./api', () => ({monitoringApi: {summary: vi.fn(), timeseries: vi.fn(), run: vi.fn()}}));
vi.mock('@/lib/use-permissions', () => ({usePermissions: () => ({can: () => true})}));

const snapshot = {id: 'health-1', status: 'DEGRADED', generated_at: '2026-07-30T00:00:00Z', checks: [{name: 'database', status: 'HEALTHY' as const, latency_ms: 4, message: 'MongoDB ping ok'}, {name: 'company_email', status: 'DOWN' as const, latency_ms: null, message: 'SMTPException'}]};

describe('MonitoringPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(monitoringApi.summary).mockResolvedValue(snapshot);
    vi.mocked(monitoringApi.timeseries).mockResolvedValue({items: [snapshot]});
  });

  it('renders component failures and the 24-hour history', async () => {
    render(<MonitoringPanel/>);
    expect(await screen.findByText('SMTPException')).toBeInTheDocument();
    expect(screen.getByText('Lịch sử 24 giờ')).toBeInTheDocument();
    expect(screen.getAllByText('Email công ty').length).toBeGreaterThan(0);
    expect(screen.getByText('Hoạt động tốt').parentElement).toHaveClass('whitespace-nowrap');
    expect(screen.getByText('Dữ liệu')).not.toHaveClass('truncate');
    expect(monitoringApi.timeseries).toHaveBeenCalledWith(24);
  });
});
