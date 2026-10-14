import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import ChatWindow from './ChatWindow';

vi.mock('@/features/inquiries/api', () => ({
  submitPublicLead: vi.fn().mockResolvedValue({ success: true, lead_id: 'lead-test-123' }),
}));

function streamResponse(events: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(events.join('')));
      controller.close();
    },
  });
  return new Response(body, {status: 200, headers: {'Content-Type': 'text/event-stream'}});
}

describe('ChatWindow grounded SSE UX', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => vi.restoreAllMocks());

  it('renders language badge, verified sources and restart control', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([
      'event: meta\ndata: {"language":"en","status":"ok","grounded":true}\n\n',
      'event: message\ndata: {"content":"Verified project answer"}\n\n',
      'event: sources\ndata: {"items":[{"title":"The Privé","url":"/du_an/the-prive","type":"project"}]}\n\n',
      'event: done\ndata: {"status":"ok"}\n\n',
    ])));
    render(<ChatWindow isOpen onClose={vi.fn()} phone="0969 895 059" />);
    fireEvent.change(screen.getByLabelText('Tin nhắn cho Mái Đỏ'), {target: {value: 'What projects are available?'}});
    fireEvent.submit(screen.getByRole('button', {name: 'Gửi'}).closest('form')!);

    expect(await screen.findByText(/EN/)).toBeInTheDocument();
    expect(await screen.findByText('Verified project answer')).toBeInTheDocument();
    expect(await screen.findByRole('link', {name: 'The Privé'})).toHaveAttribute('href', '/du_an/the-prive');
    expect(screen.getByRole('button', {name: 'Start over'})).toBeInTheDocument();
  });

  it('marks a network failure unavailable and keeps the hotline action', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(<ChatWindow isOpen onClose={vi.fn()} phone="0969 895 059" />);
    fireEvent.change(screen.getByLabelText('Tin nhắn cho Mái Đỏ'), {target: {value: 'Xin chào'}});
    fireEvent.submit(screen.getByRole('button', {name: 'Gửi'}).closest('form')!);
    await waitFor(() => expect(screen.getByText('Tạm gián đoạn')).toBeInTheDocument());
    expect(screen.getByRole('link', {name: 'Gọi hotline'})).toHaveAttribute('href', 'tel:0969 895 059');
  });
  it('keeps the chatbot online when verified knowledge is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([
      'event: meta\ndata: {"language":"vi","status":"fallback","grounded":false,"reason":"knowledge_missing"}\n\n',
      'event: message\ndata: {"content":"Chưa có dữ liệu đã xác minh."}\n\n',
      'event: done\ndata: {"status":"fallback"}\n\n',
    ])));
    render(<ChatWindow isOpen onClose={vi.fn()} phone="0969 895 059" />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, {target: {value: 'Thông tin chưa xuất bản'}});
    fireEvent.submit(input.closest('form')!);

    expect(await screen.findByText('Chưa có dữ liệu đã xác minh.')).toBeInTheDocument();
    expect(screen.getByText(/trực tuyến/i)).toBeInTheDocument();
  });
  it('shows a clear rate-limit message for HTTP 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', {status: 429})));
    render(<ChatWindow isOpen onClose={vi.fn()} phone="0969 895 059" />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, {target: {value: 'Xin chào'}});
    fireEvent.submit(input.closest('form')!);

    expect(await screen.findByText(/gửi quá nhiều tin nhắn/i)).toBeInTheDocument();
    expect(screen.getByText(/tạm gián đoạn/i)).toBeInTheDocument();
  });

  it('disables browser autocomplete and suggestions on form and input', () => {
    const {rerender} = render(<ChatWindow isOpen onClose={vi.fn()} phone="0969 895 059" />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    const form = input.closest('form') as HTMLFormElement;

    expect(form).toHaveAttribute('autocomplete', 'off');
    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(input).toHaveAttribute('autocorrect', 'off');
    expect(input).toHaveAttribute('autocapitalize', 'off');
    expect(input).toHaveAttribute('spellcheck', 'false');
    expect(input).toHaveAttribute('data-lpignore', 'true');

    fireEvent.change(input, {target: {value: 'Câu hỏi chưa gửi'}});
    expect(input.value).toBe('Câu hỏi chưa gửi');

    // Close and reopen chat
    rerender(<ChatWindow isOpen={false} onClose={vi.fn()} phone="0969 895 059" />);
    rerender(<ChatWindow isOpen={true} onClose={vi.fn()} phone="0969 895 059" />);
    const reopenedInput = screen.getByRole('textbox') as HTMLInputElement;
    expect(reopenedInput.value).toBe('');
  });

  it('renders quick prompt chips and clicking one sends a chat message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([
      'event: message\ndata: {"content":"Đây là danh sách dự án nổi bật."}\n\n',
      'event: done\ndata: {"status":"ok"}\n\n',
    ])));
    render(<ChatWindow isOpen onClose={vi.fn()} phone="0969 895 059" />);

    const chip = screen.getByRole('button', {name: 'Dự án đang mở bán'});
    expect(chip).toBeInTheDocument();
    fireEvent.click(chip);

    expect(await screen.findByText('Đây là danh sách dự án nổi bật.')).toBeInTheDocument();
  });

  it('allows opening lead capture form, validating, and submitting successfully', async () => {
    const {submitPublicLead} = await import('@/features/inquiries/api');
    const mockSubmit = vi.mocked(submitPublicLead);
    mockSubmit.mockResolvedValueOnce({success: true, lead_id: 'lead-test-123'});

    render(<ChatWindow isOpen onClose={vi.fn()} phone="0969 895 059" />);

    // Click the quick lead CTA button
    const ctaBtn = screen.getByRole('button', {name: /Nhận tư vấn & Báo giá/i});
    fireEvent.click(ctaBtn);

    expect(screen.getByText('Nhận tư vấn từ chuyên viên')).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/họ và tên/i);
    const phoneInput = screen.getByLabelText(/số điện thoại/i);
    const submitBtn = screen.getByRole('button', {name: 'Gửi yêu cầu tư vấn'});

    // Test invalid phone validation
    fireEvent.change(nameInput, {target: {value: 'Nguyễn Văn Test'}});
    fireEvent.change(phoneInput, {target: {value: '123'}});
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Số điện thoại không hợp lệ/i)).toBeInTheDocument();
    expect(mockSubmit).not.toHaveBeenCalled();

    // Test valid phone submission
    fireEvent.change(phoneInput, {target: {value: '0987654321'}});
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({
        customer_name: 'Nguyễn Văn Test',
        phone: '0987654321',
        form_id: 'maya-chat-lead',
        source: 'WEBSITE',
        type: 'BUY',
        consent: true,
      }));
    });

    expect(await screen.findByText(/Cảm ơn Quý khách Nguyễn Văn Test!/i)).toBeInTheDocument();
  });

  it('displays high-intent suggested action button and pre-fills lead note on click', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([
      'event: meta\ndata: {"status":"ok","high_intent":true,"suggested_action":{"type":"lead_capture","label":"Nhận bảng giá & chính sách chiết khấu","note":"Báo giá căn hộ The Privé"}}\n\n',
      'event: message\ndata: {"content":"Giá dự kiến từ 50 triệu/m2."}\n\n',
      'event: sources\ndata: {"items":[{"title":"Báo cáo thị trường BĐS","url":"/tin-tuc/bao-cao-thi-truong","type":"article"}]}\n\n',
      'event: done\ndata: {"status":"ok"}\n\n',
    ])));
    render(<ChatWindow isOpen onClose={vi.fn()} phone="0969 895 059" />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, {target: {value: 'Giá căn hộ The Privé bao nhiêu?'}});
    fireEvent.submit(input.closest('form')!);

    const actionBtn = await screen.findByRole('button', {name: /Nhận bảng giá & chính sách chiết khấu/i});
    expect(actionBtn).toBeInTheDocument();

    // Verify article source is displayed with "Tin tức" badge
    expect(await screen.findByText('Tin tức')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Báo cáo thị trường BĐS'})).toHaveAttribute('href', '/tin-tuc/bao-cao-thi-truong');

    // Click suggested action
    fireEvent.click(actionBtn);

    expect(screen.getByText('Nhận tư vấn từ chuyên viên')).toBeInTheDocument();
    const noteInput = screen.getByLabelText(/Dự án \/ Nhu cầu quan tâm/i) as HTMLInputElement;
    expect(noteInput.value).toBe('Báo giá căn hộ The Privé');
  });
});


