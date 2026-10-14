'use client';

import { useEffect } from 'react';
import { X, Calendar, DollarSign } from 'lucide-react';
import WorkspaceConsultationForm from './WorkspaceConsultationForm';

interface OfficeConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
  buildingName: string;
  type?: 'DAT_LICH' | 'BAO_GIA';
}

export default function OfficeConsultationModal({
  isOpen,
  onClose,
  buildingName,
  type = 'DAT_LICH',
}: OfficeConsultationModalProps) {
  // Close on Escape key and prevent body scroll when modal is open
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

  const isBooking = type === 'DAT_LICH';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-sm overflow-y-auto animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-[440px] bg-white rounded-2xl border border-zinc-200 shadow-2xl p-4 sm:p-5 my-auto overflow-hidden animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer z-10"
          aria-label="Đóng biểu mẫu"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="mb-3 space-y-1 pr-7">
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200/60 text-[#b84518] text-[10px] font-bold uppercase tracking-wider">
            {isBooking ? (
              <>
                <Calendar className="w-3 h-3" />
                <span>Đặt Lịch Khảo Sát Thực Tế</span>
              </>
            ) : (
              <>
                <DollarSign className="w-3 h-3" />
                <span>Nhận Bảng Báo Giá Chi Tiết</span>
              </>
            )}
          </div>

          <h3 className="text-base sm:text-lg font-bold font-serif text-zinc-900 leading-snug">
            {isBooking ? 'Đặt Lịch Xem Tòa Nhà' : 'Yêu Cầu Báo Giá Tòa Nhà'}{' '}
            <span className="text-[#b84518] block sm:inline">{buildingName}</span>
          </h3>
        </div>

        {/* Embedded Consultation Form */}
        <div className="max-h-[85vh] overflow-y-auto no-scrollbar pr-1">
          <WorkspaceConsultationForm
            source="OFFICE"
            theme="light"
            hideHeader={true}
            isEmbedded={true}
            initialBuilding={buildingName}
            prefillBuildingName={buildingName}
            onSuccess={() => {
              // Auto close modal after successful submission with brief delay
              setTimeout(() => {
                onClose();
              }, 2500);
            }}
          />
        </div>
      </div>
    </div>
  );
}
