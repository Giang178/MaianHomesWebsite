import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import ActivityPage from './page';

vi.mock('@/features/system/activity/ActivityPanel', () => ({
  ActivityPanel: () => <div>activity-panel</div>,
}));

describe('activity route', () => {
  it('renders the shared activity panel without redirecting away from the activity page', () => {
    render(<ActivityPage/>);
    expect(screen.getByText('activity-panel')).toBeInTheDocument();
  });
});
