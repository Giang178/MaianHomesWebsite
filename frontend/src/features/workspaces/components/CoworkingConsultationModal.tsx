'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Phone,
  Mail,
  Users,
  Calendar,
  Sparkles,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Armchair,
  Tag,
} from 'lucide-react';
import { workspacesApi } from '../api';
import { SeatType, PricingPlan } from '../types';

export interface ConsultationSelectedItem {
  type: 'SEAT' | 'PLAN' | 'GENERAL';
  title: string;
  subtitle?: string;
  price?: string;
  code?: string;
}

interface CoworkingConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItem?: ConsultationSelectedItem | null;
  seatTypes?: SeatType[];
  pricingPlans?: PricingPlan[];
}

export default function CoworkingConsultationModal({
  isOpen,
  onClose,
  selectedItem,
  seatTypes = [],
  pricingPlans = [],
}: CoworkingConsultationModalProps) {
  const [formData, setFormData] = useState({
    customer_name: '',
    phone: '',
    email: '',
    seat_count: '1',
    expected_date: '',
    interest_item: selectedItem?.title || '',
    note: '',
    consent: true,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successReference, setSuccessReference] = useState<string | null>(null);

  // Update interest item when selectedItem changes
  useEffect(() => {
    if (selectedItem?.title) {
      setFormData((prev) => ({
        ...prev,
        interest_item: selectedItem.title,
      }));
    }
  }, [selectedItem]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formData.customer_name.trim()) {
      setErrorMessage('Vui lòng nhập họ và tên của bạn.');
      return;
    }

    const cleanPhone = formData.phone.replace(/[^\d+]/g, '');
    if (!cleanPhone || cleanPhone.length < 9) {
      setErrorMessage('Vui lòng nhập số điện thoại liên hệ hợp lệ.');
      return;
    }

    setIsLoading(true);

    try {
      const noteLines: string[] = [];
      if (selectedItem?.type === 'SEAT') {
        noteLines.push(`[TƯ VẤN LOẠI CHỖ NGỒI: ${formData.interest_item || selectedItem.title}]`);
        if (selectedItem.price) noteLines.push(`Chi phí tham khảo: ${selectedItem.price}`);
      } else if (selectedItem?.type === 'PLAN') {
        noteLines.push(`[TƯ VẤN GÓI CƯỚC: ${formData.interest_item || selectedItem.title}]`);
        if (selectedItem.code) noteLines.push(`Mã gói: ${selectedItem.code}`);
        if (selectedItem.price) noteLines.push(`Đơn giá: ${selectedItem.price}`);
      } else {
        noteLines.push(`[YÊU CẦU TƯ VẤN & THAM QUAN CO-WORKING]`);
        if (formData.interest_item) noteLines.push(`Quan tâm: ${formData.interest_item}`);
      }

      if (formData.seat_count) {
        noteLines.push(`Số lượng chỗ ngồi dự kiến: ${formData.seat_count}`);
      }
      if (formData.expected_date) {
        noteLines.push(`Thời điểm dự kiến bắt đầu: ${formData.expected_date}`);
      }
      if (formData.note.trim()) {
        noteLines.push(`Ghi chú thêm: ${formData.note.trim()}`);
      }

      const res = await workspacesApi.submitLead({
        customer_name: formData.customer_name.trim(),
        phone: cleanPhone,
        email: formData.email.trim() || undefined,
        source: 'COWORKING',
        form_id: 'coworking-consultation-modal',
        page_url: typeof window !== 'undefined' ? window.location.pathname : undefined,
        note: noteLines.join('\n'),
        consent: formData.consent,
      });

      setSuccessReference((res as { reference_id?: string })?.reference_id || 'OK');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể gửi yêu cầu lúc này. Vui lòng thử lại.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetAndClose = () => {
    setSuccessReference(null);
    setErrorMessage('');
    setFormData({
      customer_name: '',
      phone: '',
      email: '',
      seat_count: '1',
      expected_date: '',
      interest_item: selectedItem?.title || '',
      note: '',
      consent: true,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleResetAndClose();
        }
      }}
    >
      <div className="relative w-full max-w-[440px] bg-white rounded-2xl shadow-2xl border border-[#E8E0D8] overflow-hidden text-[#2D1B14] animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Decorative Golden Line */}
        <div className="h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent w-full shrink-0" />

        {/* Close Button */}
        <button
          type="button"
          onClick={handleResetAndClose}
          aria-label="Đóng popup"
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900 transition-colors flex items-center justify-center cursor-pointer shadow-xs"
        >
          <X className="w-4 h-4" />
        </button>

        {successReference ? (
          /* SUCCESS VIEW */
          <div className="p-5 sm:p-6 text-center space-y-4 my-auto">
            <div className="w-12 h-12 rounded-full bg-amber-50 border-2 border-[#D4AF37] flex items-center justify-center mx-auto text-[#AA820A] shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-bold font-serif text-[#2D1B14]">
                Tiếp Nhận Thành Công!
              </h3>
              <p className="text-xs text-zinc-600 font-light leading-relaxed max-w-sm mx-auto">
                Cảm ơn quý khách đã quan tâm đến dịch vụ Co-working Space tại Maian Homes.
                Chuyên viên tư vấn sẽ liên hệ lại với quý khách trong vòng 15 phút.
              </p>
              {successReference !== 'OK' && (
                <p className="text-xs text-[#AA820A] font-mono pt-0.5">
                  Mã tiếp nhận: #{successReference}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleResetAndClose}
              className="w-full py-2.5 px-4 rounded-lg font-bold text-xs uppercase tracking-wider bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] text-[#1A1612] hover:shadow-md transition-all cursor-pointer shadow-sm"
            >
              HOÀN TẤT & ĐÓNG
            </button>
          </div>
        ) : (
          /* FORM VIEW */
          <div className="overflow-y-auto p-4 sm:p-5 space-y-3.5 no-scrollbar">
            {/* Modal Header */}
            <div className="pr-7 space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#FAF6EE] border border-[#D4AF37]/40 text-[#AA820A] text-[10px] font-bold uppercase tracking-wider">
                <Sparkles className="w-3 h-3" />
                <span>
                  {selectedItem?.type === 'SEAT'
                    ? 'Tư vấn chỗ ngồi'
                    : selectedItem?.type === 'PLAN'
                    ? 'Tư vấn gói cước'
                    : 'Tư vấn Co-working'}
                </span>
              </div>

              <h3 className="text-base sm:text-lg font-bold font-serif text-[#2D1B14] leading-snug">
                {selectedItem?.title
                  ? `Nhận Tư Vấn: ${selectedItem.title}`
                  : 'Đăng Ký Tham Quan & Báo Giá'}
              </h3>

              {/* Price / Info Tag */}
              {selectedItem?.price && (
                <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#AA820A] bg-amber-50/80 px-2 py-0.5 rounded-md border border-amber-200/60">
                  <Tag className="w-3 h-3" />
                  <span>
                    {selectedItem.type === 'SEAT' ? 'Chi phí tham khảo: ' : 'Mức giá: '}
                    <strong className="text-amber-900">{selectedItem.price}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                {errorMessage}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Họ và tên */}
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-zinc-700 font-semibold mb-1">
                  Họ và tên <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    placeholder="Nguyễn Văn A"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    className="w-full pl-9 pr-3.5 py-2 rounded-lg bg-zinc-50 border border-zinc-200 focus:border-[#D4AF37] focus:bg-white focus:outline-none text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors"
                  />
                </div>
              </div>

              {/* Số điện thoại & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-zinc-700 font-semibold mb-1">
                    Số điện thoại <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="tel"
                      required
                      placeholder="090 123 4567"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full pl-9 pr-3.5 py-2 rounded-lg bg-zinc-50 border border-zinc-200 focus:border-[#D4AF37] focus:bg-white focus:outline-none text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-zinc-700 font-semibold mb-1">
                    Email (tùy chọn)
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      placeholder="example@company.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-9 pr-3.5 py-2 rounded-lg bg-zinc-50 border border-zinc-200 focus:border-[#D4AF37] focus:bg-white focus:outline-none text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Dịch vụ / Gói quan tâm & Số lượng chỗ */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] uppercase tracking-wider text-zinc-700 font-semibold mb-1">
                    Dịch vụ / Loại chỗ
                  </label>
                  <div className="relative">
                    <Armchair className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={formData.interest_item}
                      onChange={(e) => setFormData({ ...formData, interest_item: e.target.value })}
                      className="w-full pl-9 pr-3.5 py-2 rounded-lg bg-zinc-50 border border-zinc-200 focus:border-[#D4AF37] focus:bg-white focus:outline-none text-xs sm:text-sm text-zinc-900 transition-colors appearance-none"
                    >
                      {selectedItem?.title && (
                        <option value={selectedItem.title}>{selectedItem.title}</option>
                      )}
                      <optgroup label="Hình thức chỗ ngồi">
                        {seatTypes
                          .filter((st) => st.status !== 'INACTIVE')
                          .map((st) => (
                            <option key={st.id || st.code} value={st.name}>
                              {st.name} {st.reference_price ? `(${st.reference_price})` : ''}
                            </option>
                          ))}
                      </optgroup>
                      <optgroup label="Gói cước linh hoạt">
                        {pricingPlans
                          .filter((p) => p.status !== 'HIDDEN')
                          .map((p) => (
                            <option key={p.id || p.code} value={p.name}>
                              {p.name}
                            </option>
                          ))}
                      </optgroup>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-zinc-700 font-semibold mb-1">
                    Số chỗ
                  </label>
                  <div className="relative">
                    <Users className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={formData.seat_count}
                      onChange={(e) => setFormData({ ...formData, seat_count: e.target.value })}
                      className="w-full pl-9 pr-3.5 py-2 rounded-lg bg-zinc-50 border border-zinc-200 focus:border-[#D4AF37] focus:bg-white focus:outline-none text-xs sm:text-sm text-zinc-900 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Thời điểm bắt đầu dự kiến */}
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-zinc-700 font-semibold mb-1">
                  Thời điểm bắt đầu dự kiến
                </label>
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Ví dụ: Trong tuần này / Đầu tháng tới..."
                    value={formData.expected_date}
                    onChange={(e) => setFormData({ ...formData, expected_date: e.target.value })}
                    className="w-full pl-9 pr-3.5 py-2 rounded-lg bg-zinc-50 border border-zinc-200 focus:border-[#D4AF37] focus:bg-white focus:outline-none text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors"
                  />
                </div>
              </div>

              {/* Ghi chú thêm */}
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-zinc-700 font-semibold mb-1">
                  Ghi chú hoặc yêu cầu riêng
                </label>
                <textarea
                  rows={2}
                  placeholder="Yêu cầu về phòng họp, thời gian làm việc hoặc hẹn giờ tham quan..."
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-50 border border-zinc-200 focus:border-[#D4AF37] focus:bg-white focus:outline-none text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors resize-none"
                />
              </div>

              {/* Consent checkbox */}
              <div className="flex items-start gap-2 pt-0.5">
                <input
                  type="checkbox"
                  id="modal-consent"
                  checked={formData.consent}
                  onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                  className="mt-0.5 rounded text-[#AA820A] focus:ring-[#D4AF37] border-zinc-300 accent-[#AA820A] cursor-pointer"
                />
                <label htmlFor="modal-consent" className="text-[11px] text-zinc-500 leading-normal cursor-pointer">
                  Tôi đồng ý để Maian Homes liên hệ tư vấn và gửi báo giá ưu đãi qua thông tin đã cung cấp.
                </label>
              </div>

              {/* Submit Button */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 sm:py-3 px-4 rounded-lg font-bold text-xs uppercase tracking-wider bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] text-[#1A1612] hover:shadow-md disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#1A1612]" />
                      <span>Đang gửi thông tin...</span>
                    </>
                  ) : (
                    <>
                      <span>GỬI YÊU CẦU TƯ VẤN</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
