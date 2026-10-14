import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ValidationPanel from './ValidationPanel';

describe('ValidationPanel', () => {
  it('shows a human-readable location and repair instruction, then selects the field', () => {
    const onSelectIssue = vi.fn();
    render(
      <ValidationPanel
        report={{
          score: 70,
          errors: [{
            code: 'SOURCE_INVALID',
            field: 'seo_metadata.sources.1',
            message: 'Nguồn phải có tên và URL HTTP(S) hợp lệ.',
            group: 'GEO',
          }],
          warnings: [],
        }}
        resolveLocation={() => ({
          step: 'Bước 10/10 · SEO/GEO',
          control: 'Nguồn tham khảo GEO #2',
        })}
        onSelectIssue={onSelectIssue}
      />,
    );
    expect(screen.getByText(/Vị trí: Bước 10\/10 · SEO\/GEO → Nguồn tham khảo GEO #2/)).toBeVisible();
    expect(screen.getByText(/Cần sửa:/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', {name: /Đi đến Bước 10\/10/}));
    expect(onSelectIssue).toHaveBeenCalledWith('seo_metadata.sources.1');
  });
});
