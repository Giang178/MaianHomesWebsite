'use client';

import { Clock, ExternalLink, Mail, MapPin, Navigation, Phone } from 'lucide-react';

interface CoworkingLocationMapProps {
  space?: any;
  address?: string;
  district?: string;
  city?: string;
  mapEmbedUrl?: string;
  directionsUrl?: string;
  contactPhone?: string;
  contactEmail?: string;
  operatingHours?: string;
}

export default function CoworkingLocationMap(props: CoworkingLocationMapProps) {
  const {
    space,
    address: providedAddress,
    district: providedDistrict,
    city: providedCity,
    mapEmbedUrl: providedMapEmbedUrl,
    directionsUrl: providedDirectionsUrl,
    contactPhone: providedContactPhone,
    contactEmail: providedContactEmail,
    operatingHours: providedOperatingHours,
  } = props;
  const address = providedAddress ?? space?.location?.address ?? space?.address ?? '';
  const district = providedDistrict ?? space?.location?.district ?? space?.district ?? '';
  const city = providedCity ?? space?.location?.city ?? space?.city ?? '';
  const mapEmbedUrl = providedMapEmbedUrl ?? space?.location?.map_embed_url ?? '';
  const directionsUrl = providedDirectionsUrl ?? space?.location?.directions_url ?? '';
  const contactPhone = providedContactPhone ?? space?.location?.contact_phone ?? space?.phone ?? '';
  const contactEmail = providedContactEmail ?? space?.location?.contact_email ?? space?.email ?? '';
  const operatingHours = providedOperatingHours ?? space?.location?.operating_hours ?? space?.opening_hours ?? '';
  const finalDirectionsUrl = directionsUrl || (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '');

  return (
    <section className="py-12 lg:py-16 px-4 sm:px-6 lg:px-8 bg-[#FAF8F5] text-[#2D1B14]">
      <div className="max-w-7xl mx-auto space-y-8 lg:space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 text-xs sm:text-sm lg:text-base uppercase font-bold tracking-[0.15em] text-[#AA820A]">
            <MapPin className="w-4 h-4 lg:w-5 lg:h-5" />
            <span>Vị trí & Kết nối</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold font-serif text-[#2D1B14] tracking-[-0.015em] leading-[1.25]">
            Vị Trí Đắc Địa Tại Trung Tâm
          </h2>
          <p className="text-sm sm:text-base text-zinc-600 font-light leading-[1.65] tracking-[0.01em]">
            Nằm trên trục đường giao thương thuận tiện, dễ dàng di chuyển và tiếp cận các quận trung tâm TP.HCM.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
          {/* Thông tin liên hệ & địa chỉ */}
          <div className="lg:col-span-5 bg-white rounded-2xl p-6 sm:p-7 border border-[#E8E0D8] flex flex-col justify-between space-y-6 shadow-xs">
            <div className="space-y-5">
              <h3 className="text-xl font-bold font-serif text-[#2D1B14] leading-[1.3]">
                Thông Tin Địa Điểm & Liên Hệ
              </h3>

              <div className="space-y-4 text-sm text-zinc-600 font-normal">
                {/* Address */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#FAF6EE] border border-[#D4AF37]/30 flex items-center justify-center text-[#AA820A] shrink-0 mt-0.5 shadow-2xs">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500 uppercase tracking-wider block">
                      Địa chỉ:
                    </span>
                    <p className="font-medium text-[#2D1B14] leading-[1.4]">{address}</p>
                    {district && city && (
                      <p className="text-xs text-[#AA820A] font-medium mt-0.5">{district}, {city}</p>
                    )}
                  </div>
                </div>

                {/* Operating Hours */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#FAF6EE] border border-[#D4AF37]/30 flex items-center justify-center text-[#AA820A] shrink-0 mt-0.5 shadow-2xs">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500 uppercase tracking-wider block">
                      Giờ hoạt động:
                    </span>
                    <p className="font-medium text-[#2D1B14]">{operatingHours}</p>
                  </div>
                </div>

                {/* Phone */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#FAF6EE] border border-[#D4AF37]/30 flex items-center justify-center text-[#AA820A] shrink-0 mt-0.5 shadow-2xs">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500 uppercase tracking-wider block">
                      Hotline hỗ trợ:
                    </span>
                    <a
                      href={`tel:${contactPhone.replace(/\D/g, '')}`}
                      className="font-bold text-[#AA820A] hover:underline"
                    >
                      {contactPhone}
                    </a>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#FAF6EE] border border-[#D4AF37]/30 flex items-center justify-center text-[#AA820A] shrink-0 mt-0.5 shadow-2xs">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500 uppercase tracking-wider block">
                      Email tiếp nhận:
                    </span>
                    <a
                      href={`mailto:${contactEmail}`}
                      className="font-medium text-zinc-700 hover:text-[#AA820A] hover:underline"
                    >
                      {contactEmail}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Directions button */}
            <div className="pt-4 border-t border-[#E8E0D8]">
              <a
                href={finalDirectionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] text-[#1A1612] hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Navigation className="w-4 h-4" />
                <span>XEM CHỈ ĐƯỜNG TRÊN GOOGLE MAPS</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Bản đồ trực quan */}
          <div className="lg:col-span-7 rounded-2xl overflow-hidden border border-[#E8E0D8] shadow-xs bg-zinc-100 min-h-[380px] relative">
            {mapEmbedUrl ? (
              <iframe
                src={mapEmbedUrl}
                width="100%"
                height="100%"
                style={{ border: 0, minHeight: '380px' }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={space?.name || undefined}
                className="w-full h-full"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-white/90 space-y-4">
                <MapPin className="w-12 h-12 text-[#AA820A] animate-bounce" />
                <div>
                  <p className="font-bold text-[#2D1B14] text-lg font-serif">{address}</p>
                  <p className="text-xs text-zinc-600 mt-1">
                    Nhấn nút bên dưới để mở định vị GPS chính xác trên Google Maps
                  </p>
                </div>
                <a
                  href={finalDirectionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-2.5 rounded-full font-bold text-xs uppercase tracking-wider border border-[#AA820A] text-[#AA820A] hover:bg-[#FAF6EE] transition-colors flex items-center gap-2 shadow-xs"
                >
                  <span>Mở Google Maps</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
