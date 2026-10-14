import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import ProjectForm, {clampAmenityCoordinate, DEFAULT_FORM, nextAmenityNumber} from './ProjectEditor';

describe('ProjectForm close behavior', () => {
  it('closes a new untouched project without submitting or marking it dirty', async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    const onDirtyChange = vi.fn();

    render(
      <ProjectForm
        initialData={DEFAULT_FORM}
        onSubmit={onSubmit}
        isSubmitting={false}
        isEdit={false}
        onDirtyChange={onDirtyChange}
        onClose={onClose}
      />,
    );

    await userEvent.click(screen.getByRole('button', {name: 'Thoát trình tạo dự án'}));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onDirtyChange).not.toHaveBeenCalled();
  });

  it('returns to a clean state after entered content is completely removed', async () => {
    const onClose = vi.fn();
    const onDirtyChange = vi.fn();

    render(
      <ProjectForm
        initialData={DEFAULT_FORM}
        onSubmit={vi.fn()}
        isSubmitting={false}
        isEdit={false}
        onDirtyChange={onDirtyChange}
        onClose={onClose}
      />,
    );

    const nameInput = screen.getByPlaceholderText('Grand Riverside Villas');
    await userEvent.type(nameInput, 'Dự án thử');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    await userEvent.clear(nameInput);
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    await userEvent.click(screen.getByRole('button', {name: 'Thoát trình tạo dự án'}));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('reports dirty state after commit without updating the parent during render', async () => {
    const onDirtyChange = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <ProjectForm
        initialData={DEFAULT_FORM}
        onSubmit={vi.fn()}
        isSubmitting={false}
        isEdit={false}
        onDirtyChange={onDirtyChange}
      />,
    );

    await userEvent.type(screen.getByPlaceholderText('Grand Riverside Villas'), 'Dự án mới');

    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('Cannot update a component');
    consoleError.mockRestore();
  });
});
describe('Amenity editor helpers', () => {
  it('keeps map coordinates within the 0-100 percentage range', () => {
    expect(clampAmenityCoordinate('')).toBeUndefined();
    expect(clampAmenityCoordinate('-5')).toBe(0);
    expect(clampAmenityCoordinate('42.56')).toBe(42.6);
    expect(clampAmenityCoordinate('120')).toBe(100);
  });

  it('reuses the first available pin number without creating duplicates', () => {
    expect(nextAmenityNumber([{number: 1}, {number: 3}])).toBe(2);
    expect(nextAmenityNumber([{number: 1}, {number: 2}, {number: 3}])).toBe(4);
    expect(nextAmenityNumber([])).toBe(1);
    expect(nextAmenityNumber(undefined)).toBe(1);
    expect(nextAmenityNumber([{number: undefined}, {number: 0}])).toBe(1);
  });
});
