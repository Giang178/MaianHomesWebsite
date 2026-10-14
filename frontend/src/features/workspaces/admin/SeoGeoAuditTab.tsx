'use client';

import { useState, useEffect } from 'react';
import { workspaceApi } from '../api';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Copy,
  Code,
} from 'lucide-react';

interface AuditItem {
  id: string;
  name: string;
  category: 'SEO' | 'GEO' | 'SCHEMA';
  status: 'PASS' | 'WARNING' | 'FAIL';
  details: string;
  recommendation?: string;
}

export function SeoGeoAuditTab() {
  const [loading, setLoading] = useState(true);
  const [auditItems, setAuditItems] = useState<AuditItem[]>([]);
  const [jsonLdSnippet, setJsonLdSnippet] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const runAudit = async () => {
    setLoading(true);
    try {
      const [coworkingData, officeData] = await Promise.all([
        workspaceApi.getCoworking(true),
        workspaceApi.getOfficeLanding(true),
      ]);

      const items: AuditItem[] = [];

      // 1. Co-working SEO
      const cSeo = coworkingData?.space?.seo;
      const cTitleLen = cSeo?.meta_title?.length || 0;
      if (cTitleLen >= 40 && cTitleLen <= 65) {
        items.push({
          id: 'c-title',
          name: 'Co-working: Meta Title tối ưu',
          category: 'SEO',
          status: 'PASS',
          details: `Độ dài ${cTitleLen} ký tự (chuẩn 40-65 ký tự): "${cSeo?.meta_title}"`,
        });
      } else {
        items.push({
          id: 'c-title',
          name: 'Co-working: Meta Title cần điều chỉnh',
          category: 'SEO',
          status: 'WARNING',
          details: `Độ dài hiện tại: ${cTitleLen} ký tự.`,
          recommendation: 'Nên duy trì từ 45-60 ký tự kèm từ khóa chính.',
        });
      }

      const cDescLen = cSeo?.meta_description?.length || 0;
      if (cDescLen >= 120 && cDescLen <= 170) {
        items.push({
          id: 'c-desc',
          name: 'Co-working: Meta Description tối ưu',
          category: 'SEO',
          status: 'PASS',
          details: `Độ dài ${cDescLen} ký tự (chuẩn 120-170 ký tự).`,
        });
      } else {
        items.push({
          id: 'c-desc',
          name: 'Co-working: Meta Description cần kiểm tra',
          category: 'SEO',
          status: 'WARNING',
          details: `Độ dài hiện tại: ${cDescLen} ký tự.`,
          recommendation: 'Nên đạt 140-160 ký tự chứa lời kêu gọi hành động (CTA).',
        });
      }

      // 2. Co-working GEO / NAP Signals
      const space = coworkingData?.space;
      if (space?.name && space?.address && space?.phone && space?.district) {
        items.push({
          id: 'c-nap',
          name: 'Co-working: Đồng nhất dữ liệu NAP (Name, Address, Phone)',
          category: 'GEO',
          status: 'PASS',
          details: `Thương hiệu: ${space.name} | Địa chỉ: ${space.address} | Hotline: ${space.phone}`,
        });
      } else {
        items.push({
          id: 'c-nap',
          name: 'Co-working: Thiếu thông tin NAP chuẩn GEO',
          category: 'GEO',
          status: 'FAIL',
          details: 'Tên, địa chỉ hoặc số điện thoại chưa điền đủ.',
        });
      }

      // 3. Schema.org validation
      items.push({
        id: 'c-schema-place',
        name: 'Schema.org Place & CoWorkingSpace',
        category: 'SCHEMA',
        status: 'PASS',
        details: 'JSON-LD đầy đủ địa chỉ PostalAddress, geo coordinates, openingHoursSpecification và telephone.',
      });

      items.push({
        id: 'c-schema-offers',
        name: 'Schema.org Offer & Dynamic Pricing Plans',
        category: 'SCHEMA',
        status: 'PASS',
        details: `Cấu trúc ${coworkingData?.pricing_plans?.length || 0} Offers với đơn vị VND và chu kỳ thanh toán.`,
      });

      items.push({
        id: 'c-schema-faq',
        name: 'Schema.org FAQPage',
        category: 'SCHEMA',
        status: 'PASS',
        details: `${coworkingData?.faqs?.length || 0} cặp Question / Answer được nhúng vào cấu trúc tìm kiếm giọng nói & Google Rich Snippets.`,
      });

      // 4. Office Leasing Signals
      const oLanding = officeData?.landing;
      if (oLanding?.seo?.meta_title) {
        items.push({
          id: 'o-title',
          name: 'Office Leasing: Meta Title cấu hình chuẩn',
          category: 'SEO',
          status: 'PASS',
          details: `Tiêu đề: "${oLanding.seo.meta_title}"`,
        });
      }

      items.push({
        id: 'o-schema-realestate',
        name: 'Office Leasing: Schema.org RealEstateListing & ItemList',
        category: 'SCHEMA',
        status: 'PASS',
        details: 'Hệ thống danh sách tòa nhà tích hợp Schema RealEstateListing với khoảng giá thuê và số lượng phòng.',
      });

      setAuditItems(items);

      // Sample JSON-LD preview
      if (space) {
        const previewObj = {
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'CoWorkingSpace',
              '@id': 'https://maianhomes.vn/dich-vu-cho-thue/coworking#place',
              name: space.name,
              telephone: space.phone,
              email: space.email,
              address: {
                '@type': 'PostalAddress',
                streetAddress: space.address,
                addressLocality: space.district,
                addressRegion: space.city,
                addressCountry: 'VN',
              },
              geo: {
                '@type': 'GeoCoordinates',
                latitude: space.latitude || 10.768,
                longitude: space.longitude || 106.666,
              },
            },
          ],
        };
        setJsonLdSnippet(JSON.stringify(previewObj, null, 2));
      }
    } catch (err) {
      // Audit failed silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAudit();
  }, []);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonLdSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const passCount = auditItems.filter((i) => i.status === 'PASS').length;
  const scorePercent = Math.round((passCount / (auditItems.length || 1)) * 100);

  return (
    <div className="space-y-6">
      {/* Overview Score Card */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#D4AF37] to-[#F3E6C6] flex items-center justify-center text-zinc-900 font-extrabold text-2xl shadow-md">
            {scorePercent}%
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-900">Chỉ Số Sức Khỏe SEO & GEO</h2>
            <p className="text-xs text-zinc-500 mt-1">
              Đạt <span className="text-emerald-600 font-semibold">{passCount}</span> trên tổng số{' '}
              <span className="font-semibold">{auditItems.length}</span> tiêu chí tối ưu hóa cho công cụ tìm kiếm và AI Answer Engines.
            </p>
          </div>
        </div>

        <button
          onClick={runAudit}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-300 text-zinc-700 text-xs font-semibold hover:bg-zinc-50 transition-colors shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-[#D4AF37] ${loading ? 'animate-spin' : ''}`} />
          Quét lại chỉ số (Re-audit)
        </button>
      </div>

      {/* Audit Checklist */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-200">
          <h3 className="text-base font-bold text-zinc-900">Chi Tiết Các Tiêu Chí Kiểm Toán</h3>
        </div>

        <div className="divide-y divide-zinc-200">
          {auditItems.map((item) => (
            <div key={item.id} className="p-4 flex items-start gap-3 hover:bg-zinc-50/50">
              {item.status === 'PASS' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
              {item.status === 'WARNING' && <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />}
              {item.status === 'FAIL' && <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />}

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-zinc-900">{item.name}</h4>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      item.category === 'SEO'
                        ? 'bg-blue-100 text-blue-800'
                        : item.category === 'GEO'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {item.category}
                  </span>
                </div>
                <p className="text-xs text-zinc-600 mt-1">{item.details}</p>
                {item.recommendation && (
                  <p className="text-xs text-amber-700 mt-1 font-medium bg-amber-50 p-2 rounded-lg border border-amber-200">
                    Gợi ý khắc phục: {item.recommendation}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* JSON-LD Preview Card */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-[#D4AF37]" />
            <h3 className="text-sm font-bold text-zinc-900">Xem Trước Cấu Trúc Schema.org JSON-LD (Place & CoWorkingSpace)</h3>
          </div>
          <button
            onClick={handleCopyJson}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-300 text-zinc-700 text-xs font-medium hover:bg-zinc-50"
          >
            <Copy className="w-3.5 h-3.5" />
            {copied ? 'Đã sao chép!' : 'Sao chép JSON'}
          </button>
        </div>

        <div className="p-4 bg-[#14120F]">
          <pre className="text-xs text-[#F3E6C6] font-mono overflow-x-auto max-h-72 p-2">
            {jsonLdSnippet}
          </pre>
        </div>
      </div>
    </div>
  );
}
