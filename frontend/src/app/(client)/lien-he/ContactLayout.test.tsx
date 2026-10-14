import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ContactLayout from './ContactLayout';

const mockCreateLeadPublic = vi.fn();

vi.mock('@/features/inquiries/api', () => ({
  submitPublicLead: (payload: unknown) => mockCreateLeadPublic(payload),
}));

vi.mock('@/features/contact/usePublicContactSettings', () => ({
  usePublicContactSettings: () => ({
    contact: {
      phone: '0969105059',
      phone_href: 'tel:0969105059',
      email: 'maianhomes.vn@gmail.com',
      email_href: 'mailto:maianhomes.vn@gmail.com',
      zalo_oa_id: '4085613041166590560',
      zalo_url: 'https://zalo.me/4085613041166590560',
      messenger_url: 'https://m.me/MaianHomes',
    },
    status: 'ready',
  }),
}));

vi.mock('@/features/website/public/site-settings', () => ({
  usePublicSiteSettings: () => ({
    address: 'Số 606/62 đường 3 Tháng 2, Phường Diên Hồng, TP. Hồ Chí Minh',
    footer: { working_hours: 'Thứ Hai – Thứ Bảy: 08:30 – 18:00' },
  }),
}));

const contactProps = {
  interestOptions: ['Mua căn hộ cao cấp', 'Ký gửi Bất động sản', 'Thuê căn hộ / Nhà phố', 'Tư vấn đầu tư dự án'],
  faqs: [{ question: 'Câu hỏi kiểm thử', answer: 'Câu trả lời kiểm thử' }],
};

describe('ContactLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders official contact channels including hotline, email, and Zalo quick chat', () => {
    render(<ContactLayout {...contactProps} />);

    expect(screen.getByRole('heading', { level: 1, name: /LIÊN HỆ MAIAN HOMES/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Số 606\/62 đường 3 Tháng 2/).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Xem chỉ đường Google Maps/i })).toHaveAttribute(
      'href',
      expect.stringContaining('maps.google.com')
    );

    const phoneLink = document.getElementById('contact-link-phone');
    expect(phoneLink).toHaveAttribute('href', 'tel:0969105059');

    const emailLink = document.getElementById('contact-link-email');
    expect(emailLink).toHaveAttribute('href', 'mailto:maianhomes.vn@gmail.com');

    expect(screen.getByRole('link', { name: /Chat Zalo trực tiếp/i })).toHaveAttribute(
      'href',
      'https://zalo.me/4085613041166590560'
    );
  });

  it('allows selecting an interest pill tag', () => {
    render(<ContactLayout {...contactProps} />);

    const optionBtn = screen.getByRole('button', { name: /^Ký gửi Bất động sản$/i });
    fireEvent.click(optionBtn);
    expect(optionBtn).toHaveClass('border-[#D4AF37]');
  });

  it('validates phone number and shows an error message when phone is invalid', async () => {
    render(<ContactLayout {...contactProps} />);

    fireEvent.change(screen.getByLabelText(/Họ và tên/i), { target: { value: 'Nguyễn Văn A' } });
    fireEvent.change(screen.getByLabelText(/Số điện thoại/i), { target: { value: '123' } });
    fireEvent.change(screen.getByLabelText(/Nội dung cần hỗ trợ/i), { target: { value: 'Cần tư vấn căn 2PN' } });

    fireEvent.click(screen.getByRole('button', { name: /Gửi yêu cầu tư vấn ngay/i }));

    await waitFor(() => {
      expect(screen.getByText(/Số điện thoại không hợp lệ/i)).toBeInTheDocument();
    });
    expect(mockCreateLeadPublic).not.toHaveBeenCalled();
  });

  it('submits contact lead successfully and displays confirmation state', async () => {
    mockCreateLeadPublic.mockResolvedValueOnce({ success: true });
    render(<ContactLayout {...contactProps} />);

    fireEvent.change(screen.getByLabelText(/Họ và tên/i), { target: { value: 'Nguyễn Văn A' } });
    fireEvent.change(screen.getByLabelText(/Số điện thoại/i), { target: { value: '0912345678' } });
    fireEvent.change(screen.getByLabelText(/Nội dung cần hỗ trợ/i), { target: { value: 'Cần tư vấn căn hộ' } });

    fireEvent.click(screen.getByRole('button', { name: /Gửi yêu cầu tư vấn ngay/i }));

    await waitFor(() => {
      expect(mockCreateLeadPublic).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_name: 'Nguyễn Văn A',
          phone: '0912345678',
          source: 'WEBSITE',
        })
      );
      expect(screen.getByText(/Đã gửi thành công!/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Gửi yêu cầu tư vấn khác/i }));
    expect(screen.getByLabelText(/Họ và tên/i)).toBeInTheDocument();
  });

  it('expands and collapses FAQ accordion items on click', () => {
    render(<ContactLayout {...contactProps} />);

    const faqBtn = document.getElementById('faq-btn-0');
    expect(faqBtn).toBeInTheDocument();
    expect(faqBtn).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(faqBtn!);
    expect(faqBtn).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(faqBtn!);
    expect(faqBtn).toHaveAttribute('aria-expanded', 'false');
  });
});
