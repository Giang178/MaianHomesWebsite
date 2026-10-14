import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkflowActions from './WorkflowActions';

describe('WorkflowActions', () => {
  it('renders "Xuất bản" for unpublished drafts when user can publish', () => {
    const onAction = vi.fn();
    render(
      <WorkflowActions
        canPublish={true}
        publicationStatus="UNPUBLISHED"
        workflowStatus="DRAFT"
        onAction={onAction}
      />
    );

    const publishBtn = screen.getByRole('button', { name: 'Xuất bản' });
    expect(publishBtn).toBeDefined();
    fireEvent.click(publishBtn);
    expect(onAction).toHaveBeenCalledWith('publish');
  });

  it('renders "Cập nhật xuất bản" and "Gỡ xuất bản" for published projects with pending draft', () => {
    const onAction = vi.fn();
    render(
      <WorkflowActions
        canPublish={true}
        publicationStatus="PUBLISHED"
        workflowStatus="DRAFT"
        onAction={onAction}
      />
    );

    const updateBtn = screen.getByRole('button', { name: 'Cập nhật xuất bản' });
    const unpublishBtn = screen.getByRole('button', { name: 'Gỡ xuất bản' });
    expect(updateBtn).toBeDefined();
    expect(unpublishBtn).toBeDefined();

    fireEvent.click(updateBtn);
    expect(onAction).toHaveBeenCalledWith('publish');

    fireEvent.click(unpublishBtn);
    expect(onAction).toHaveBeenCalledWith('unpublish');
  });

  it('renders only "Gỡ xuất bản" for published projects without pending draft changes', () => {
    const onAction = vi.fn();
    render(
      <WorkflowActions
        canPublish={true}
        publicationStatus="PUBLISHED"
        workflowStatus="PUBLISHED"
        onAction={onAction}
      />
    );

    expect(screen.queryByRole('button', { name: 'Cập nhật xuất bản' })).toBeNull();
    const unpublishBtn = screen.getByRole('button', { name: 'Gỡ xuất bản' });
    expect(unpublishBtn).toBeDefined();
  });
});
