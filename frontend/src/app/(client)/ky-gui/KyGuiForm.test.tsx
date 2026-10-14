import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import KyGuiForm from './KyGuiForm';

const { createPublicWithImages } = vi.hoisted(() => ({ createPublicWithImages: vi.fn() }));

vi.mock('@/features/website/public/consignments', () => ({ consignmentApi: { createPublicWithImages } }));
vi.mock('@/features/contact/usePublicContactSettings', () => ({
  usePublicContactSettings: () => ({ contact: { phone: '0900000000' } }),
}));

describe('KyGuiForm', () => {
  beforeEach(() => {
    createPublicWithImages.mockReset();
    createPublicWithImages.mockResolvedValue({ id: 'consignment-123' });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn((file: File) => `blob:${file.name}`) });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: vi.fn() });
  });

  it('opens and closes the image standards dialog', () => {
    render(<KyGuiForm />);

    fireEvent.click(screen.getByRole('button', { name: 'Tiêu chuẩn hình ảnh' }));

    expect(screen.getByRole('dialog', { name: 'Tiêu chuẩn hình ảnh' })).toBeVisible();
    expect(screen.getByText(/Hình ảnh KHÔNG chứa thông tin liên hệ/)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Đóng tiêu chuẩn hình ảnh' }));
    expect(screen.queryByRole('dialog', { name: 'Tiêu chuẩn hình ảnh' })).not.toBeInTheDocument();
  });

  it('keeps optional email optional in browser validation', () => {
    render(<KyGuiForm />);
    expect(screen.getByLabelText('Email')).not.toBeRequired();
  });
  it('keeps both customer needs, both prices and sender role', async () => {
    const { container } = render(<KyGuiForm />);

    fireEvent.click(screen.getByRole('radio', { name: 'Bán và cho thuê' }));
    fireEvent.change(screen.getByLabelText('Giá bán mong muốn (Tỷ VNĐ)'), { target: { value: '6.5' } });
    fireEvent.change(screen.getByLabelText('Giá thuê mong muốn (Triệu/tháng)'), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText('Địa chỉ'), { target: { value: '12 Nguyễn Huệ, Quận 1' } });
    fireEvent.change(screen.getByLabelText('Mô tả nhà đất'), { target: { value: 'Căn hộ đầy đủ nội thất' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Người thân' }));
    fireEvent.change(screen.getByLabelText('Họ và tên'), { target: { value: 'Nguyễn Văn Bình' } });
    fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '0909000000' } });

    const files = [1, 2, 3].map((index) => new File(['image'], `both-${index}.jpg`, { type: 'image/jpeg' }));
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi thông tin' }));

    await waitFor(() => expect(createPublicWithImages).toHaveBeenCalledTimes(1));
    expect(createPublicWithImages.mock.calls[0][0]).toMatchObject({
      owner: { role: 'Người thân' },
      property: {
        transaction_type: 'sale_and_rent',
        expected_sale_price: 6_500_000_000,
        expected_rent_price: 25_000_000,
      },
    });
    expect(await screen.findByRole('heading', { name: 'Gửi thông tin thành công' })).toBeVisible();
  });

  it('renders the Rever-style single page form and submits images to CRM', async () => {
    const { container } = render(<KyGuiForm />);

    expect(screen.getByRole('heading', { name: 'Ký gửi nhà đất với Maian Homes' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Cam kết với khách hàng' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Thông tin cơ bản' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Thông tin nhà đất' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Thông tin liên hệ' })).toBeVisible();

    fireEvent.change(screen.getByLabelText('Giá bán mong muốn (Tỷ VNĐ)'), { target: { value: '8.2' } });
    fireEvent.change(screen.getByLabelText('Địa chỉ'), { target: { value: 'Số 1 Đỗ Xuân Hợp, Thủ Đức' } });
    fireEvent.change(screen.getByLabelText('Mô tả nhà đất'), { target: { value: 'Căn hộ 2PN view sông, nội thất đầy đủ' } });
    fireEvent.change(screen.getByLabelText('Họ và tên'), { target: { value: 'Nguyễn Văn An' } });
    fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '0969105059' } });

    const files = [1, 2, 3].map((index) => new File(['image'], `home-${index}.jpg`, { type: 'image/jpeg' }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi thông tin' }));

    await waitFor(() => expect(createPublicWithImages).toHaveBeenCalledTimes(1));
    expect(createPublicWithImages.mock.calls[0][0]).toMatchObject({
      owner: { name: 'Nguyễn Văn An', phone: '0969105059', role: 'Chính chủ' },
      property: {
        project_name: null,
        transaction_type: 'sale',
        expected_price: 8_200_000_000,
        address: 'Số 1 Đỗ Xuân Hợp, Thủ Đức',
        description: 'Căn hộ 2PN view sông, nội thất đầy đủ',
      },
    });
    expect(createPublicWithImages.mock.calls[0][1]).toHaveLength(3);
    expect(createPublicWithImages.mock.calls[0][2]).toEqual(expect.any(String));
    expect(await screen.findByRole('heading', { name: 'Gửi thông tin thành công' })).toBeVisible();
    expect(screen.getByText('consignment-123')).toBeVisible();
  });

  it('reuses one key for a retry and rotates it after the form changes', async () => {
    createPublicWithImages.mockRejectedValue(new Error('Mạng tạm thời gián đoạn'));
    const { container } = render(<KyGuiForm />);

    fireEvent.change(screen.getByLabelText('Giá bán mong muốn (Tỷ VNĐ)'), { target: { value: '8.2' } });
    fireEvent.change(screen.getByLabelText('Địa chỉ'), { target: { value: 'Số 1 Đỗ Xuân Hợp' } });
    fireEvent.change(screen.getByLabelText('Mô tả nhà đất'), { target: { value: 'Căn hộ đầy đủ nội thất' } });
    fireEvent.change(screen.getByLabelText('Họ và tên'), { target: { value: 'Nguyễn Văn An' } });
    fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '0969105059' } });
    const files = [1, 2, 3].map((index) => new File(['image'], `retry-${index}.jpg`, { type: 'image/jpeg' }));
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files } });

    fireEvent.click(screen.getByRole('button', { name: 'Gửi thông tin' }));
    await waitFor(() => expect(createPublicWithImages).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Gửi thông tin' })).toBeEnabled());
    const firstKey = createPublicWithImages.mock.calls[0][2];

    fireEvent.click(screen.getByRole('button', { name: 'Gửi thông tin' }));
    await waitFor(() => expect(createPublicWithImages).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Gửi thông tin' })).toBeEnabled());
    expect(createPublicWithImages.mock.calls[1][2]).toBe(firstKey);

    fireEvent.change(screen.getByLabelText('Họ và tên'), { target: { value: 'Nguyễn Văn Bình' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi thông tin' }));
    await waitFor(() => expect(createPublicWithImages).toHaveBeenCalledTimes(3));
    expect(createPublicWithImages.mock.calls[2][2]).not.toBe(firstKey);
  });
});
