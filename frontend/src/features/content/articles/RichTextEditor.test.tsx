import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import RichTextEditor from './RichTextEditor';

const mocks = vi.hoisted(() => ({ noticeAdmin: vi.fn() }));
vi.mock('@/components/admin/admin-dialog-service', () => ({ noticeAdmin: mocks.noticeAdmin }));


describe('RichTextEditor', () => {
  it('renders heading typography immediately and reflects the active block', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <RichTextEditor value="<p>Nội dung đang chọn</p>" onChange={onChange} />,
    );

    const paragraph = await waitFor(() => {
      const element = container.querySelector('.ProseMirror p');
      expect(element).toBeTruthy();
      return element as HTMLElement;
    });
    fireEvent.click(paragraph);

    const h2Button = screen.getByRole('button', { name: /H2/ });
    await userEvent.click(h2Button);

    await waitFor(() => {
      expect(container.querySelector('.ProseMirror h2')).toHaveTextContent('Nội dung đang chọn');
      expect(h2Button).toHaveAttribute('aria-pressed', 'true');
    });
    expect(onChange).toHaveBeenCalledWith(expect.stringContaining('<h2'));
  });

  it('creates a paragraph after pressing Enter in a heading', async () => {
    const { container } = render(
      <RichTextEditor value="<h3>Tiêu đề phụ</h3>" onChange={vi.fn()} />,
    );
    const heading = await waitFor(() => container.querySelector('.ProseMirror h3') as HTMLElement);
    const range = document.createRange();
    range.selectNodeContents(heading);
    range.collapse(false);
    const selection = window.getSelection();
    await act(async () => {
      selection?.removeAllRanges();
      selection?.addRange(range);
      heading.dispatchEvent(new Event('focus', { bubbles: true }));
      document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
      fireEvent.keyDown(container.querySelector('.ProseMirror') as HTMLElement, { key: 'Enter', code: 'Enter' });
    });
    await waitFor(() => {
      expect(container.querySelector('.ProseMirror h3')).toHaveTextContent('Tiêu đề phụ');
      expect(container.querySelector('.ProseMirror p')).toBeTruthy();
      expect(screen.getByRole('button', { name: /Đoạn văn bản/ })).toHaveAttribute('aria-pressed', 'true');
    });
  });
  it('reports an inline image upload failure and remains usable', async () => {
    const uploadImage = vi.fn().mockRejectedValue(new Error('upload failed'));
    const { container } = render(<RichTextEditor value="<p>Nội dung</p>" onChange={vi.fn()} uploadImage={uploadImage} />);
    await screen.findByRole('button', { name: /Tải và chèn ảnh/i });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(['image'], 'test.webp', { type: 'image/webp' })] } });
    await waitFor(() => expect(mocks.noticeAdmin).toHaveBeenCalledWith(expect.stringContaining('Tải ảnh'), 'error'));
    expect(screen.getByRole('button', { name: /Tải và chèn ảnh/i })).toBeEnabled();
  });
});
