'use client';

import { ArrowRight, Check, Sparkles, Tag } from 'lucide-react';
import { PricingPlan } from '../types';

interface CoworkingPricingProps {
  plans: PricingPlan[];
  onSelectPlan?: (plan: PricingPlan) => void;
}

export default function CoworkingPricing({
  plans = [],
  onSelectPlan,
}: CoworkingPricingProps) {
  const activePlans = plans
    .filter((p) => p.status === 'ACTIVE')
    .sort((a, b) => a.display_order - b.display_order);

  if (activePlans.length === 0) return null;

  const formatPrice = (price: number | null | undefined, currency: string) => {
    if (price === null || price === undefined || price <= 0) {
      return null;
    }
    return new Intl.NumberFormat('vi-VN').format(price) + (currency === 'VND' ? ' đ' : ` ${currency}`);
  };

  const getBillingPeriodLabel = (period: string) => {
    switch (period?.toUpperCase()) {
      case 'NGAY':
        return '/ ngày';
      case 'TUAN':
        return '/ tuần';
      case 'THANG':
        return '/ tháng';
      case 'NAM':
        return '/ năm';
      default:
        return '';
    }
  };

  return (
    <section className="py-12 lg:py-16 px-4 sm:px-6 lg:px-8 bg-white text-[#2D1B14]">
      <div className="max-w-7xl mx-auto space-y-8 lg:space-y-10">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 text-xs sm:text-sm lg:text-base uppercase font-bold tracking-[0.15em] text-[#AA820A]">
            <Tag className="w-4 h-4 lg:w-5 lg:h-5" />
            <span>Bảng giá & Gói dịch vụ</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold font-serif text-[#2D1B14] tracking-[-0.015em] leading-[1.25]">
            Gói Thuê Linh Hoạt – Minh Bạch Chi Phí
          </h2>
          <p className="text-sm sm:text-base text-zinc-600 font-light leading-[1.65] tracking-[0.01em]">
            Chọn gói thuê phù hợp nhất với tiến độ dự án và kế hoạch phát triển của bạn. Tất cả quyền lợi tiện ích đều được ghi nhận minh bạch.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {activePlans.map((plan) => {
            const priceFormatted = formatPrice(plan.price, plan.currency);
            const isFeatured = Boolean(plan.is_featured);
            const badgeText = plan.badge?.trim() || (isFeatured ? 'Phổ biến nhất' : '');
            const hasBadge = Boolean(badgeText);

            return (
              <div
                key={plan.id || plan._id || plan.code}
                className={`relative rounded-2xl overflow-hidden p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 ${
                  isFeatured || hasBadge
                    ? 'bg-gradient-to-b from-[#FFFDF9] to-[#FAF5EB] border-2 border-[#D4AF37] shadow-md -translate-y-1.5'
                    : 'bg-white border border-[#E8E0D8] hover:border-[#D4AF37]/50 hover:-translate-y-1 shadow-xs hover:shadow-md'
                }`}
              >
                {/* Popular / Custom Badge */}
                {hasBadge && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] text-[#1A1612] text-[11px] font-extrabold uppercase tracking-widest py-1 px-3 rounded-bl-xl shadow-xs flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#1A1612]" />
                    <span>{badgeText}</span>
                  </div>
                )}

                <div className="space-y-5">
                  {/* Seat Type / Category */}
                  {plan.seat_type_name && (
                    <span className="text-xs uppercase tracking-wider text-[#AA820A] font-semibold block">
                      {plan.seat_type_name}
                    </span>
                  )}

                  {/* Plan Name */}
                  <h3 className="text-xl font-bold font-serif text-[#2D1B14] leading-[1.3]">
                    {plan.name}
                  </h3>

                  {/* Description */}
                  <p className="text-xs sm:text-sm text-zinc-600 font-normal leading-[1.65] min-h-[40px]">
                    {plan.description}
                  </p>

                  {/* Price Section */}
                  <div className="py-4 border-y border-[#E8E0D8]">
                    {priceFormatted ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl sm:text-3xl font-extrabold text-[#AA820A] tracking-tight">
                          {priceFormatted}
                        </span>
                        <span className="text-xs text-zinc-500 font-medium">
                          {getBillingPeriodLabel(plan.billing_period)}
                        </span>
                      </div>
                    ) : (
                      <div className="py-1">
                        <span className="text-xl font-bold text-[#AA820A]">
                          Nhận báo giá
                        </span>
                        <p className="text-[11px] text-zinc-500">Liên hệ trực tiếp theo nhu cầu</p>
                      </div>
                    )}

                    {plan.duration && (
                      <p className="text-xs text-zinc-500 mt-1">
                        Thời hạn: {plan.duration}
                      </p>
                    )}
                  </div>

                  {/* Benefits */}
                  <div className="space-y-3">
                    <span className="text-xs uppercase tracking-wider text-zinc-500 font-semibold block">
                      Quyền lợi đi kèm:
                    </span>
                    <ul className="space-y-2.5">
                      {plan.benefits.map((benefit, bIdx) => (
                        <li key={bIdx} className="flex items-start gap-2.5 text-xs sm:text-sm text-zinc-700 font-normal">
                          <Check className="w-4 h-4 text-[#AA820A] shrink-0 mt-0.5" />
                          <span className="leading-[1.5]">{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Extra fees note */}
                  {plan.extra_fees?.trim() && (
                    <p className="text-[11px] text-zinc-400 italic pt-2 border-t border-zinc-100">
                      {plan.extra_fees.trim().startsWith('*') ? plan.extra_fees.trim() : `* ${plan.extra_fees.trim()}`}
                    </p>
                  )}
                </div>

                {/* CTA Button */}
                <div className="pt-6 sm:pt-7">
                  <button
                    onClick={() => {
                      if (onSelectPlan) {
                        onSelectPlan(plan);
                      } else if (typeof document !== 'undefined') {
                        const el = document.getElementById('dat-lich');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    className={`w-full py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-xs ${
                      isFeatured
                        ? 'bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] text-[#1A1612] hover:shadow-[0_0_20px_rgba(212,175,55,0.4)]'
                        : 'bg-[#FAF6EE] hover:bg-[#D4AF37] text-[#AA820A] hover:text-[#1A1612] border border-[#D4AF37]/40'
                    }`}
                  >
                    <span>NHẬN TƯ VẤN GÓI NÀY</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
