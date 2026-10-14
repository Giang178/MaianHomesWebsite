'use client';

import { useState } from 'react';
import CoworkingHero from './CoworkingHero';
import CoworkingIntro from './CoworkingIntro';
import CoworkingSeatTypes from './CoworkingSeatTypes';
import CoworkingPricing from './CoworkingPricing';
import CoworkingAmenities from './CoworkingAmenities';
import CoworkingGallery from './CoworkingGallery';
import CoworkingLocationMap from './CoworkingLocationMap';
import CoworkingGeoSummary from './CoworkingGeoSummary';
import WorkspaceFAQ from './WorkspaceFAQ';
import WorkspaceConsultationForm from './WorkspaceConsultationForm';
import CoworkingConsultationModal, { ConsultationSelectedItem } from './CoworkingConsultationModal';
import { SeatType, PricingPlan, WorkspaceFAQ as WorkspaceFAQType } from '../types';

interface CoworkingViewProps {
  space: any;
  seatTypes: SeatType[];
  pricingPlans: PricingPlan[];
  faqs: WorkspaceFAQType[];
  isPreview?: boolean;
}

export default function CoworkingView({
  space,
  seatTypes = [],
  pricingPlans = [],
  faqs = [],
  isPreview = false,
}: CoworkingViewProps) {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    selectedItem: ConsultationSelectedItem | null;
  }>({
    isOpen: false,
    selectedItem: null,
  });

  const handleSelectSeatType = (seat: SeatType) => {
    setModalState({
      isOpen: true,
      selectedItem: {
        type: 'SEAT',
        title: seat.name,
        subtitle: seat.description,
        price: seat.reference_price || undefined,
        code: seat.code,
      },
    });
  };

  const handleSelectPlan = (plan: PricingPlan) => {
    const formattedPrice = plan.price
      ? `${new Intl.NumberFormat('vi-VN').format(plan.price)} đ / ${plan.billing_period === 'NGAY' ? 'ngày' : 'tháng'}`
      : undefined;
    setModalState({
      isOpen: true,
      selectedItem: {
        type: 'PLAN',
        title: plan.name,
        subtitle: plan.description,
        price: formattedPrice || plan.duration,
        code: plan.code,
      },
    });
  };

  const handleGeneralConsult = () => {
    setModalState({
      isOpen: true,
      selectedItem: {
        type: 'GENERAL',
        title: space?.hero?.cta_consult_label || space?.hero?.title || space?.name,
        subtitle: space?.hero?.subtitle || space?.hero?.description,
      },
    });
  };

  return (
    <div className="min-h-screen bg-white text-[#2D1B14]">
      {isPreview && (
        <div className="bg-amber-500/20 border-b border-amber-500/40 text-amber-900 text-center py-2 px-4 text-xs font-semibold tracking-wider uppercase sticky top-16 z-30 backdrop-blur-md">
          Chế độ xem trước (Preview Mode) — Nội dung chưa công khai
        </div>
      )}

      {/* 1. Hero Section */}
      <CoworkingHero
        space={space}
        onTourClick={handleGeneralConsult}
        onConsultClick={handleGeneralConsult}
      />

      {/* 2. Intro Section */}
      <CoworkingIntro space={space} />

      {/* 3. Seat Types */}
      <CoworkingSeatTypes
        seatTypes={seatTypes}
        onSelectSeatType={handleSelectSeatType}
      />

      {/* 4. Pricing Plans */}
      <CoworkingPricing
        plans={pricingPlans}
        onSelectPlan={handleSelectPlan}
      />

      {/* 5. Verified Amenities */}
      <CoworkingAmenities amenities={space?.amenities || []} />

      {/* 6. Gallery with Lightbox */}
      <CoworkingGallery gallery={space?.gallery || []} />

      {/* 7. Location, Hours & Direct Contact */}
      <CoworkingLocationMap space={space} />

      {/* 8. Semantic GEO Summary (SEO/GEO Crawlers) */}
      <CoworkingGeoSummary space={space} />

      {/* 9. FAQ Section */}
      <WorkspaceFAQ faqs={faqs} title={space?.hero?.title || space?.name} theme="light" />

      {/* 10. Consultation & Tour Booking Form (In-page anchor) */}
      <div id="dat-lich" className="py-12 lg:py-16 bg-[#FAF8F5]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <span className="text-xs uppercase tracking-[0.15em] text-[#AA820A] font-bold">{space?.hero?.cta_tour_label || space?.hero?.title}</span>
            <h2 className="text-2xl sm:text-4xl font-serif text-[#2D1B14] font-bold mt-2 tracking-[-0.015em] leading-[1.25]">{space?.hero?.cta_consult_label || space?.hero?.title}</h2>
            <p className="text-zinc-600 text-sm sm:text-base mt-2.5 max-w-lg mx-auto leading-[1.65] tracking-[0.01em]">{space?.hero?.description || space?.introduction?.short_desc}</p>
          </div>
          <WorkspaceConsultationForm
            source="COWORKING"
            badge={space?.hero?.title}
            title={space?.hero?.cta_consult_label || space?.hero?.title}
            subtitle={space?.hero?.description || space?.introduction?.short_desc}
            pricingPlans={pricingPlans}
            theme="light"
          />
        </div>
      </div>

      {/* Popup Form Modal */}
      <CoworkingConsultationModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false, selectedItem: null })}
        selectedItem={modalState.selectedItem}
        seatTypes={seatTypes}
        pricingPlans={pricingPlans}
      />
    </div>
  );
}
