'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { usePublicContactSettings } from '@/features/contact/usePublicContactSettings';
import Link from 'next/link';
import {
  ShieldCheck,
  Lock,
  Eye,
  Share2,
  Cookie,
  Clock,
  UserCheck,
  FileText,
  CheckCircle2,
  ChevronDown,
  Mail,
  ArrowRight,
  Menu,
  X,
  ExternalLink,
  RefreshCw
} from 'lucide-react';

interface SectionData {
  id: string;
  number: string;
  title: string;
  icon: React.ReactNode;
  summary: string;
  content: string[];
  bullets?: string[];
  subcontent?: string;
  subBullets?: string[];
  note?: string;
}

const POLICY_SECTIONS: SectionData[] = [
  {
    id: 'muc-dich-thu-thap',
    number: '01',
    title: 'Mục đích và phạm vi thu thập thông tin',
    icon: <Eye className="w-5 h-5 text-[#9A7326]" />,
    summary: 'Thu thập thông tin tự nguyện của khách hàng nhằm hỗ trợ hiệu quả quá trình mua bán, cho thuê, đầu tư và thực hiện các giao dịch bất động sản.',
    content: [
      'Nhằm nâng cao chất lượng dịch vụ, hỗ trợ khách hàng hiệu quả hơn trong quá trình tìm kiếm, mua bán, cho thuê, đầu tư bất động sản và thực hiện các giao dịch liên quan, Maian Homes có thể thu thập các thông tin cá nhân do khách hàng tự nguyện cung cấp, bao gồm nhưng không giới hạn:'
    ],
    bullets: [
      'Họ và tên; Ngày tháng năm sinh (nếu có);',
      'Số điện thoại liên hệ; Địa chỉ email; Địa chỉ liên hệ;',
      'Tên doanh nghiệp hoặc tổ chức (nếu có);',
      'Nhu cầu tìm kiếm, mua bán, chuyển nhượng, cho thuê hoặc đầu tư bất động sản;',
      'Nội dung yêu cầu tư vấn, phản hồi, góp ý hoặc khiếu nại;',
      'Các thông tin phát sinh trong quá trình giao dịch hoặc sử dụng dịch vụ;',
      'Địa chỉ IP, loại thiết bị, trình duyệt, thời gian truy cập và các thông tin kỹ thuật khác phục vụ cho việc vận hành, quản trị và tối ưu website.'
    ],
    subcontent: 'Thông tin được thu thập thông qua các hình thức như:',
    subBullets: [
      'Biểu mẫu đăng ký tư vấn trên website; Biểu mẫu liên hệ;',
      'Đăng ký nhận bản tin hoặc tài liệu;',
      'Liên hệ qua điện thoại, email hoặc các nền tảng trực tuyến khác của Maian Homes (Zalo, Facebook, Google Ads...);',
      'Các chương trình khảo sát, sự kiện, hội thảo hoặc hoạt động chăm sóc khách hàng.'
    ],
    note: 'Maian Homes chỉ thu thập thông tin cá nhân sau khi có sự đồng ý của khách hàng, phù hợp với mục đích thu thập đã thông báo. Khách hàng có quyền từ chối cung cấp thông tin; tuy nhiên trong một số trường hợp, việc từ chối có thể khiến Maian Homes không thể đáp ứng đầy đủ yêu cầu tư vấn hoặc dịch vụ. Chính sách này không áp dụng cho trẻ em dưới 16 tuổi. Nếu phát hiện thông tin của trẻ em dưới 16 tuổi được cung cấp mà chưa có sự đồng ý của cha mẹ/người giám hộ hợp pháp, Maian Homes sẽ lập tức tiến hành xóa bỏ.'
  },
  {
    id: 'pham-vi-su-dung',
    number: '02',
    title: 'Phạm vi và mục đích sử dụng thông tin',
    icon: <FileText className="w-5 h-5 text-[#9A7326]" />,
    summary: 'Cam kết chỉ sử dụng thông tin trong phạm vi cần thiết để hỗ trợ khách hàng, tối ưu trải nghiệm và tuân thủ nghĩa vụ pháp lý.',
    content: [
      'Thông tin khách hàng cung cấp có thể được Maian Homes sử dụng cho các mục đích sau:'
    ],
    bullets: [
      'Cung cấp thông tin về dự án, sản phẩm, dịch vụ bất động sản theo yêu cầu của khách hàng;',
      'Liên hệ tư vấn, hỗ trợ và chăm sóc khách hàng trong quá trình sử dụng dịch vụ;',
      'Xác nhận thông tin đăng ký, lịch hẹn, giao dịch hoặc các yêu cầu phát sinh;',
      'Gửi thông báo, bản tin, tài liệu, chương trình ưu đãi, sự kiện hoặc các thông tin liên quan đến hoạt động của Maian Homes;',
      'Nghiên cứu, phân tích hành vi khách hàng nhằm nâng cao chất lượng sản phẩm, dịch vụ và trải nghiệm người dùng;',
      'Quản lý hoạt động kinh doanh, thống kê dữ liệu và xây dựng các chính sách chăm sóc khách hàng phù hợp;',
      'Giải quyết các khiếu nại, tranh chấp hoặc các vấn đề phát sinh liên quan đến việc sử dụng dịch vụ;',
      'Phát hiện, ngăn chặn và xử lý các hành vi vi phạm pháp luật, gian lận hoặc xâm phạm quyền và lợi ích hợp pháp của Maian Homes và khách hàng;',
      'Thực hiện các nghĩa vụ theo yêu cầu của cơ quan nhà nước có thẩm quyền theo quy định của pháp luật.'
    ],
    note: 'Maian Homes cam kết chỉ sử dụng thông tin khách hàng trong phạm vi cần thiết để thực hiện các mục đích nêu trên và KHÔNG sử dụng cho mục đích nào khác khi chưa có sự đồng ý của khách hàng.'
  },
  {
    id: 'chia-se-ben-thu-ba',
    number: '03',
    title: 'Chia sẻ thông tin với bên thứ ba',
    icon: <Share2 className="w-5 h-5 text-[#9A7326]" />,
    summary: 'Cam kết KHÔNG bán, cho thuê hoặc trao đổi dữ liệu cá nhân vì mục đích thương mại khi chưa có sự đồng ý của khách hàng.',
    content: [
      'Maian Homes không bán, cho thuê, trao đổi hoặc chuyển giao thông tin cá nhân của khách hàng cho bất kỳ bên thứ ba nào vì mục đích thương mại khi chưa có sự đồng ý của khách hàng.',
      'Thông tin khách hàng chỉ được chia sẻ với bên thứ ba trong các trường hợp sau:'
    ],
    bullets: [
      'Có sự chấp thuận của khách hàng;',
      'Chia sẻ với các đối tác, nhà cung cấp dịch vụ hỗ trợ hoạt động của Maian Homes (ví dụ: dịch vụ email, tổng đài chăm sóc khách hàng, nền tảng quảng cáo Google/Facebook, phần mềm quản lý khách hàng) với phạm vi giới hạn nhằm phục vụ đúng mục đích đã nêu tại Mục 2, và các đối tác này có trách nhiệm bảo mật thông tin theo cam kết với Maian Homes;',
      'Theo yêu cầu của cơ quan nhà nước có thẩm quyền hoặc theo quy định của pháp luật;',
      'Trong trường hợp bảo vệ quyền, tài sản hoặc sự an toàn hợp pháp của Maian Homes, khách hàng hoặc cộng đồng.'
    ],
    note: 'Tất cả các bên thứ ba khi tiếp cận dữ liệu của khách hàng đều bị ràng buộc bởi các điều khoản bảo mật nghiêm ngặt và không được phép sử dụng dữ liệu cho bất kỳ mục đích độc lập nào khác.'
  },
  {
    id: 'cookie-va-cong-nghe',
    number: '04',
    title: 'Cookie và công nghệ theo dõi',
    icon: <Cookie className="w-5 h-5 text-[#9A7326]" />,
    summary: 'Sử dụng Cookie và Analytics để nâng cao trải nghiệm truy cập website và cá nhân hóa nội dung phù hợp với nhu cầu.',
    content: [
      'Website maianhomes.vn có thể sử dụng Cookie và các công nghệ theo dõi tương tự (như Google Analytics, Facebook Pixel) để thu thập thông tin về cách khách hàng tương tác với website, từ đó giúp nâng cao trải nghiệm người dùng, cải thiện hiệu suất hệ thống và cung cấp các nội dung, dịch vụ phù hợp hơn.',
      'Khách hàng có thể cài đặt trình duyệt để từ chối hoặc cảnh báo khi Cookie được gửi đi. Tuy nhiên, nếu từ chối Cookie, một số tính năng trên website có thể hoạt động không trơn tru hoặc đầy đủ.'
    ],
    bullets: [
      'Ghi nhớ tùy chọn và lịch sử tìm kiếm dự án của khách hàng;',
      'Phân tích lưu lượng truy cập và đánh giá hiệu quả của các chiến dịch truyền thông;',
      'Tối ưu hóa tốc độ tải trang và bảo mật kết nối mạng.'
    ]
  },
  {
    id: 'thoi-gian-luu-tru',
    number: '05',
    title: 'Thời gian lưu trữ thông tin',
    icon: <Clock className="w-5 h-5 text-[#9A7326]" />,
    summary: 'Lưu trữ thông tin trong suốt quá trình cung cấp dịch vụ hoặc cho đến khi khách hàng có yêu cầu hủy bỏ theo đúng luật định.',
    content: [
      'Thông tin cá nhân của khách hàng sẽ được lưu trữ trong suốt thời gian cung cấp dịch vụ hoặc cho đến khi mục đích thu thập đã hoàn thành, hoặc khi khách hàng có yêu cầu hủy bỏ/xóa dữ liệu.',
      'Trong một số trường hợp nhất định, Maian Homes có thể phải lưu trữ thông tin lâu hơn để tuân thủ quy định pháp luật (ví dụ: luật thuế, kế toán, giải quyết tranh chấp hợp đồng), giải quyết khiếu nại hoặc thực thi các cam kết pháp lý của mình.'
    ]
  },
  {
    id: 'quyen-cua-khach-hang',
    number: '06',
    title: 'Quyền của khách hàng đối với thông tin cá nhân',
    icon: <UserCheck className="w-5 h-5 text-[#9A7326]" />,
    summary: 'Khách hàng nắm toàn quyền chủ thể dữ liệu (Nghị định 13): quyền được biết, đồng ý, truy cập, chỉnh sửa, rút lại sự đồng ý hoặc yêu cầu xóa dữ liệu.',
    content: [
      'Tuân thủ theo Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân, khách hàng với tư cách là chủ thể dữ liệu có các quyền sau:'
    ],
    bullets: [
      'Quyền được biết: về hoạt động xử lý dữ liệu cá nhân của mình, trừ trường hợp pháp luật có quy định khác;',
      'Quyền đồng ý hoặc không đồng ý: cho phép xử lý dữ liệu cá nhân của mình;',
      'Quyền truy cập: xem, chỉnh sửa hoặc yêu cầu chỉnh sửa dữ liệu cá nhân của mình;',
      'Quyền rút lại sự đồng ý: đối với việc xử lý dữ liệu cá nhân đã đồng ý trước đó;',
      'Quyền xóa dữ liệu: yêu cầu xóa dữ liệu cá nhân của mình, trừ trường hợp pháp luật quy định khác;',
      'Quyền hạn chế xử lý dữ liệu: yêu cầu hạn chế xử lý dữ liệu cá nhân của mình;',
      'Quyền tự bảo vệ: theo quy định của pháp luật, hoặc yêu cầu cơ quan, tổ chức có thẩm quyền thực hiện các phương thức bảo vệ quyền dân sự.'
    ],
    subcontent: 'Khách hàng có thể thực hiện các quyền trên thông qua:',
    subBullets: [
      'Gửi yêu cầu qua email: maianhomes.vn@gmail.com;',
      'Liên hệ hotline: 0969 10 50 59;',
      'Liên hệ trực tiếp tại văn phòng làm việc của Maian Homes.'
    ],
    note: 'Sau khi tiếp nhận yêu cầu, Maian Homes có thể yêu cầu khách hàng cung cấp thêm thông tin để xác minh danh tính trước khi thực hiện việc chỉnh sửa, cập nhật hoặc xóa dữ liệu nhằm đảm bảo tính bảo mật và tránh các hành vi truy cập trái phép.'
  },
  {
    id: 'cam-ket-bao-mat',
    number: '07',
    title: 'Cam kết bảo mật thông tin khách hàng',
    icon: <Lock className="w-5 h-5 text-[#9A7326]" />,
    summary: 'Áp dụng các biện pháp bảo mật kỹ thuật đa tầng, phân quyền nghiêm ngặt và quy trình ứng phó sự cố khẩn cấp.',
    content: [
      'Maian Homes cam kết áp dụng các biện pháp kỹ thuật và quản lý phù hợp nhằm bảo vệ thông tin cá nhân của khách hàng khỏi các nguy cơ truy cập trái phép, tiết lộ, thay đổi hoặc phá hủy dữ liệu.',
      'Các biện pháp bảo mật được Maian Homes áp dụng bao gồm:'
    ],
    bullets: [
      'Sử dụng công nghệ mã hóa dữ liệu truyền tải (SSL/HTTPS);',
      'Giới hạn quyền truy cập thông tin cá nhân chỉ cho những nhân viên, đối tác có nhu cầu công việc chính đáng và đã cam kết bảo mật;',
      'Sử dụng hệ thống bảo mật, tường lửa và các công cụ giám sát để phát hiện và ngăn chặn các nguy cơ tấn công mạng;',
      'Thường xuyên rà soát, nâng cấp hệ thống và quy trình bảo mật.'
    ],
    note: 'Mặc dù Maian Homes nỗ lực tối đa để bảo vệ dữ liệu, không có phương thức truyền tải qua internet hay hệ thống lưu trữ điện tử nào bảo đảm an toàn tuyệt đối 100%. Khách hàng cũng cần chủ động tự bảo vệ thông tin cá nhân của mình, không chia sẻ thông tin tài khoản, mật khẩu hoặc dữ liệu nhạy cảm cho bên thứ ba không xác thực.'
  },
  {
    id: 'thay-doi-chinh-sach',
    number: '08',
    title: 'Thay đổi và cập nhật chính sách bảo mật',
    icon: <RefreshCw className="w-5 h-5 text-[#9A7326]" />,
    summary: 'Chính sách được xem xét cập nhật định kỳ. Mọi điều chỉnh sẽ được công bố công khai kèm thời gian có hiệu lực.',
    content: [
      'Maian Homes có quyền cập nhật, chỉnh sửa hoặc bổ sung Chính sách bảo mật này bất cứ lúc nào để phù hợp với những thay đổi trong quy định của pháp luật, hoạt động kinh doanh hoặc công nghệ bảo mật.',
      'Khi có thay đổi quan trọng, Maian Homes sẽ cập nhật nội dung trên website và công bố "Ngày hiệu lực" mới. Việc khách hàng tiếp tục truy cập website và sử dụng dịch vụ sau khi Chính sách được cập nhật đồng nghĩa với việc khách hàng đã đồng ý với những thay đổi đó.',
      'Khách hàng được khuyến khích thường xuyên kiểm tra trang này để cập nhật thông tin mới nhất về cách thức Maian Homes bảo vệ dữ liệu cá nhân.'
    ]
  }
];

const GEO_FAQS = [
  {
    q: 'Maian Homes thu thập những thông tin gì từ tôi khi truy cập website?',
    a: 'Khi bạn duyệt website, chúng tôi tự động ghi nhận các thông tin kỹ thuật cơ bản như địa chỉ IP và loại trình duyệt qua Cookie để tối ưu tốc độ tải trang. Thông tin định danh như Họ tên, Số điện thoại và Email chỉ được thu thập khi bạn tự nguyện điền vào biểu mẫu liên hệ hoặc yêu cầu tư vấn.'
  },
  {
    q: 'Dữ liệu cá nhân của tôi có bị bán hoặc chia sẻ cho bên thứ ba không?',
    a: 'Hoàn toàn KHÔNG. Maian Homes cam kết tuyệt đối không bán, cho thuê hay chuyển giao dữ liệu của bạn cho bên thứ ba vì mục đích thương mại. Thông tin chỉ được chia sẻ cho các đối tác hạ tầng kỹ thuật (email, server, tổng đài) trong phạm vi bảo mật nghiêm ngặt hoặc khi có yêu cầu của cơ quan pháp luật.'
  },
  {
    q: 'Tôi có thể yêu cầu xóa dữ liệu hoặc rút lại sự đồng ý xử lý thông tin như thế nào?',
    a: 'Theo Nghị định 13/2023/NĐ-CP, bạn có đầy đủ quyền truy cập, chỉnh sửa, yêu cầu xóa dữ liệu hoặc rút lại sự đồng ý bất kỳ lúc nào bằng cách gửi yêu cầu qua email maianhomes.vn@gmail.com, gọi hotline 0969 10 50 59 hoặc liên hệ trực tiếp tại văn phòng của Maian Homes.'
  },
  {
    q: 'Thời gian Maian Homes lưu trữ thông tin của khách hàng là bao lâu?',
    a: 'Thông tin cá nhân được lưu trữ trong suốt quá trình khách hàng sử dụng dịch vụ hoặc phát sinh nhu cầu giao dịch, và được duy trì thêm một khoảng thời gian hợp lý sau đó để thực hiện công tác chăm sóc khách hàng, bảo hành dịch vụ và tuân thủ quy định pháp luật hiện hành.'
  }
];

type CmsPolicySection = { id?: string; title?: string; content?: string | string[] };

export default function PrivacyPolicyClient({ title, introduction, cmsSections }: { title?: string; introduction?: string; cmsSections?: CmsPolicySection[] }) {
  const [activeSection, setActiveSection] = useState<string>('muc-dich-thu-thap');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const { contact } = usePublicContactSettings();
  const contactPhone = contact.phone || 'Đang cập nhật';
  const contactEmail = contact.email || 'Đang cập nhật';
  const gmailComposeUrl = contact.email
    ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(contact.email)}&su=${encodeURIComponent('Yêu cầu hỗ trợ Quyền chủ thể dữ liệu - Maian Homes')}`
    : '#';
  const withContact = (value: string) => value.replaceAll('0969 10 50 59', contactPhone).replaceAll('maianhomes.vn@gmail.com', contactEmail);
  const sections = useMemo<SectionData[]>(() => cmsSections?.length ? cmsSections.map((section, index) => ({
    id: section.id || `policy-section-${index + 1}`,
    number: String(index + 1).padStart(2, '0'),
    title: section.title?.trim() || `Mục ${index + 1}`,
    icon: <FileText className="w-5 h-5 text-[#9A7326]" />,
    summary: '',
    content: Array.isArray(section.content) ? section.content.map(String) : [String(section.content || '')],
  })) : POLICY_SECTIONS, [cmsSections]);

  // Scroll spy for TOC
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 240;
      for (const section of sections) {
        const element = document.getElementById(section.id);
        if (element) {
          const top = element.offsetTop;
          const height = element.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [sections]);

  const handleScrollTo = (id: string) => {
    setActiveSection(id);
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      const yOffset = -110;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const activeSectionObj = sections.find((s) => s.id === activeSection) || sections[0];

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#2D2A26] pt-20 sm:pt-24 pb-24 selection:bg-[#C59B27] selection:text-white font-sans relative">

      {/* ARCHITECTURAL WARM GRADIENT BACKGROUND (clipping container to prevent scrollbar without breaking sticky) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-0 left-0 right-0 h-[600px] bg-gradient-to-b from-[#F2EDE4] via-[#FAF9F6] to-[#FAF9F6]" />
        <div className="absolute top-20 right-1/4 w-[500px] h-[500px] bg-[#EAE3D2]/40 rounded-full blur-[140px]" />
      </div>

      {/* 1. ARCHITECTURAL EDITORIAL HERO HEADER */}
      <section className="relative px-4 sm:px-6 py-12 sm:py-16 lg:py-20 border-b border-[#EAE6DF]">
        <div className="max-w-7xl mx-auto">
          <nav className="flex items-center gap-2 text-xs text-[#8C7A6B] uppercase tracking-wider font-sans font-semibold mb-6">
            <Link href="/" className="hover:text-[#1A1A1A] transition-colors font-bold" aria-label="Điều hướng: Quay về trang chủ từ trang chính sách">Trang chủ</Link>
            <span className="text-[#D8D0C5]">/</span>
            <span className="text-[#2D1B14] font-bold">Pháp lý & Bảo mật</span>
          </nav>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-sm bg-[#F8F5EE] border border-[#E5DCC8] text-[#9A7326] text-xs font-sans font-bold uppercase tracking-wider mb-5 shadow-sm">
                <ShieldCheck className="w-4 h-4 text-[#C59B27]" />
                <span>Tuân thủ Nghị định 13/2023/NĐ-CP</span>
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-[#1A1A1A] font-serif leading-[1.15] sm:leading-[1.12]">
                {title || 'Chính Sách Bảo Mật'} <br className="hidden md:inline" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1A1A1A] via-[#8C6218] to-[#C59B27]">
                  & Bảo Vệ Dữ Liệu Cá Nhân
                </span>
              </h1>
              <p className="mt-4 text-sm sm:text-base md:text-lg text-[#5C5852] font-normal max-w-2xl leading-relaxed">
                {introduction || 'Cam kết minh bạch tuyệt đối trong việc thu thập, lưu trữ và bảo vệ quyền chủ thể dữ liệu của quý khách hàng trên hệ sinh thái bất động sản Maian Homes.'}
              </p>
            </div>

            <div className="flex items-center gap-4 text-sm text-[#3D3A36] bg-white border border-[#EAE6DF] px-5 py-4 rounded-sm shadow-sm shrink-0">
              <Clock className="w-5 h-5 text-[#9A7326] shrink-0" />
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#9A7326] font-bold">Phiên bản chính thức</p>
                <p className="font-bold text-[#1A1A1A] text-xs sm:text-sm">Hiệu lực từ: Tháng 07/2026</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/*  MOBILE & TABLET STICKY TOC DRAWER PILL (< lg) */}
      <div className="sticky top-20 z-40 lg:hidden px-4 py-3 bg-white/95 backdrop-blur-xl border-b border-[#EAE6DF] shadow-sm transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 truncate">
            <span className="w-2 h-2 bg-[#C59B27] shrink-0 animate-pulse" />
            <span className="font-sans text-xs font-bold uppercase text-[#9A7326] shrink-0">
              MỤC {activeSectionObj.number}:
            </span>
            <span className="text-xs sm:text-sm font-bold text-[#1A1A1A] truncate font-serif">
              {activeSectionObj.title}
            </span>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[#F8F5EE] border border-[#E5DCC8] text-[#9A7326] text-xs font-bold shrink-0 hover:bg-[#1A1A1A] hover:text-white hover:border-[#1A1A1A] transition-all"
            aria-label="Mở mục lục điều khoản"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            <span>Mục lục</span>
          </button>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-white border-b border-[#EAE6DF] shadow-2xl max-h-[70vh] overflow-y-auto p-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="text-[11px] uppercase tracking-wider text-[#9A7326] font-sans font-bold px-2 py-1">
              Chọn điều khoản để xem nhanh:
            </div>
            {sections.map((sec) => {
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => handleScrollTo(sec.id)}
                  className={`w-full text-left px-3.5 py-3 rounded-sm text-xs sm:text-sm transition-all flex items-center justify-between gap-3 ${isActive
                    ? 'bg-[#1A1A1A] text-white font-bold shadow-sm'
                    : 'bg-[#FAF9F6] text-[#3D3A36] hover:bg-[#F2EDE4] font-normal'
                    }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className={`font-sans text-xs font-bold ${isActive ? 'text-[#C59B27]' : 'text-[#9A7326]'}`}>
                      {sec.number}.
                    </span>
                    <span className="truncate">{sec.title}</span>
                  </div>
                  <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'opacity-100 text-[#C59B27]' : 'opacity-40'}`} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. GEO QUICK SUMMARY DASHBOARD (White Architectural Card Grid) */}
      <section className="px-4 sm:px-6 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white border border-[#EAE6DF] rounded-sm p-6 sm:p-8 lg:p-10 shadow-sm relative overflow-hidden group">
            <div className="absolute -top-24 -right-24 w-80 h-80 bg-[radial-gradient(circle_at_center,rgba(197,155,39,0.08)_0,transparent_70%)] pointer-events-none" />

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8 pb-6 border-b border-[#EAE6DF] relative z-10">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-wider text-[#9A7326] bg-[#F8F5EE] border border-[#E5DCC8] px-2.5 py-0.5 rounded-sm font-bold">
                    Executive Summary
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#1A1A1A] tracking-tight font-serif mt-1">
                  Tóm Tắt Nhanh Chính Sách
                </h2>
                <p className="text-xs sm:text-sm text-[#6E6961] mt-0.5 font-normal">
                  Tóm tắt các nội dung chính của chính sách bảo mật
                </p>
              </div>

              <a
                href={gmailComposeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-sm bg-[#1A1A1A] hover:bg-[#2D2A26] text-white font-bold text-xs sm:text-sm uppercase tracking-wider active:scale-95 transition-all shadow-sm shrink-0"
              >
                <Mail className="w-4 h-4 text-[#C59B27]" />
                <span>Liên hệ qua Gmail</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#C59B27] opacity-80" />
              </a>
            </div>

            {/* Clean Sharp Architectural Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 relative z-10">
              <div className="bg-[#FAF9F6] hover:bg-white border border-[#EAE6DF] hover:border-[#C59B27]/40 p-5 rounded-sm transition-all duration-300 flex flex-col justify-between shadow-sm">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[#9A7326] font-bold mb-1.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-[#C59B27]" />
                    Đơn vị kiểm soát
                  </p>
                  <p className="text-base sm:text-lg font-bold text-[#1A1A1A] font-serif">Maian Homes</p>
                </div>
                <p className="text-xs text-[#6E6961] mt-3 pt-3 border-t border-[#EAE6DF] font-normal">Website: maianhomes.vn | MST: 0319287798</p>
              </div>

              <div className="bg-[#FAF9F6] hover:bg-white border border-[#EAE6DF] hover:border-[#C59B27]/40 p-5 rounded-sm transition-all duration-300 flex flex-col justify-between shadow-sm">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[#9A7326] font-bold mb-1.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-[#C59B27]" />
                    Cơ sở pháp lý
                  </p>
                  <p className="text-base sm:text-lg font-bold text-[#1A1A1A] font-serif">Nghị định 13/2023/NĐ-CP</p>
                </div>
                <p className="text-xs text-[#6E6961] mt-3 pt-3 border-t border-[#EAE6DF] font-normal">Luật An toàn thông tin & Bảo vệ NTD</p>
              </div>

              <div className="bg-[#FAF9F6] hover:bg-white border border-[#EAE6DF] hover:border-[#C59B27]/40 p-5 rounded-sm transition-all duration-300 flex flex-col justify-between shadow-sm">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[#9A7326] font-bold mb-1.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-[#C59B27]" />
                    Cam kết cốt lõi
                  </p>
                  <p className="text-base sm:text-lg font-bold text-[#1A1A1A] font-serif">Không bán dữ liệu</p>
                </div>
                <p className="text-xs text-[#6E6961] mt-3 pt-3 border-t border-[#EAE6DF] font-normal">Chỉ phục vụ tư vấn & giao dịch BĐS</p>
              </div>

              <div className="bg-[#FAF9F6] hover:bg-white border border-[#EAE6DF] hover:border-[#C59B27]/40 p-5 rounded-sm transition-all duration-300 flex flex-col justify-between shadow-sm">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[#9A7326] font-bold mb-1.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-[#C59B27]" />
                    Hỗ trợ chủ thể
                  </p>
                  <p className="text-base sm:text-lg font-bold text-[#1A1A1A] font-serif">{contactPhone}</p>
                </div>
                <p className="text-xs text-[#6E6961] mt-3 pt-3 border-t border-[#EAE6DF] truncate font-normal">{contactEmail}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. MAIN CONTENT: DESKTOP STICKY TOC SIDEBAR + 8 LUXURY CARDS */}
      <section className="px-4 sm:px-6 py-6 sm:py-10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">

          {/* Desktop Sticky TOC Sidebar (4 cols - hidden on mobile/tablet) */}
          <div className="hidden lg:block lg:col-span-4">
            <div className="sticky top-28 z-30 bg-white border border-[#EAE6DF] rounded-sm p-6 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#F8F5EE] rounded-full blur-2xl pointer-events-none" />

              <h3 className="text-xs font-sans font-bold uppercase tracking-wider text-[#9A7326] mb-4 flex items-center gap-2 border-b border-[#EAE6DF] pb-3">
                <FileText className="w-4 h-4 text-[#C59B27]" />
                <span>Mục lục điều khoản</span>
              </h3>

              <nav className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200">
                {sections.map((sec) => {
                  const isActive = activeSection === sec.id;
                  return (
                    <button
                      key={sec.id}
                      onClick={() => handleScrollTo(sec.id)}
                      className={`w-full text-left px-3.5 py-3 rounded-sm text-xs md:text-sm transition-all duration-300 flex items-center justify-between gap-2 group relative ${isActive
                        ? 'bg-[#1A1A1A] text-white font-bold shadow-sm scale-[1.01]'
                        : 'text-[#5C5852] hover:bg-[#FAF9F6] hover:text-[#1A1A1A] font-normal'
                        }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className={`font-sans text-xs font-bold ${isActive ? 'text-[#C59B27]' : 'text-[#9A7326]'}`}>
                          {sec.number}.
                        </span>
                        <span className="truncate">{sec.title}</span>
                      </div>
                      <ArrowRight className={`w-3.5 h-3.5 shrink-0 transition-all ${isActive ? 'opacity-100 translate-x-0.5 text-[#C59B27]' : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'
                        }`} />
                    </button>
                  );
                })}
              </nav>

              {/* DPO Email CTA inside Sidebar */}
              <div className="mt-6 pt-5 border-t border-[#EAE6DF] bg-[#FAF9F6] p-4 rounded-sm relative overflow-hidden border">
                <p className="text-xs text-[#5C5852] font-normal leading-relaxed mb-3.5">
                  Cần hỗ trợ tra cứu, chỉnh sửa hoặc hủy bỏ dữ liệu cá nhân của quý khách?
                </p>
                <a
                  href={gmailComposeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 rounded-sm bg-white hover:bg-[#1A1A1A] text-[#1A1A1A] hover:text-white font-bold text-xs uppercase tracking-wider transition-all duration-300 border border-[#EAE6DF] hover:border-[#1A1A1A] flex items-center justify-center gap-2 shadow-sm"
                >
                  <Mail className="w-3.5 h-3.5 text-[#C59B27]" />
                  <span>Gửi Gmail Hỗ Trợ</span>
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              </div>
            </div>
          </div>

          {/* Policy Sections (8 cols) */}
          <div className="lg:col-span-8 space-y-8 sm:space-y-10">

            {/* Legal Welcome Notice */}
            <div className="bg-[#F8F5EE] border border-[#E5DCC8] rounded-sm p-6 sm:p-8 text-sm sm:text-base leading-relaxed text-[#2D2A26] font-normal border-l-4 border-l-[#C59B27] shadow-sm">
              <p className="mb-3.5">
                <strong className="text-[#1A1A1A] font-bold">Maian Homes</strong> tôn trọng và cam kết bảo vệ quyền riêng tư, dữ liệu cá nhân của khách hàng khi truy cập, tìm hiểu thông tin, đăng ký tư vấn hoặc sử dụng các dịch vụ được cung cấp trên website <span className="text-[#9A7326] font-semibold">maianhomes.vn</span>. Chính sách này được xây dựng nhằm tuân thủ <strong className="text-[#1A1A1A] font-bold">Luật An toàn thông tin mạng</strong>, <strong className="text-[#1A1A1A] font-bold">Luật Bảo vệ quyền lợi người tiêu dùng</strong> và <strong className="text-[#1A1A1A] font-bold">Nghị định 13/2023/NĐ-CP</strong> về bảo vệ dữ liệu cá nhân.
              </p>
              <p className="text-xs sm:text-sm text-[#6E6961] italic">
                * Việc khách hàng truy cập website, đăng ký tư vấn, gửi thông tin hoặc sử dụng các dịch vụ của Maian Homes đồng nghĩa với việc khách hàng đã đọc, hiểu và đồng ý với toàn bộ nội dung của Chính sách này.
              </p>
            </div>

            {/* 8 Detailed Policy Sections (Clean Architectural Sharp Cards) */}
            {sections.map((sec) => {
              const isActive = activeSection === sec.id;
              return (
                <div
                  key={sec.id}
                  id={sec.id}
                  className={`scroll-mt-32 sm:scroll-mt-36 bg-white border transition-all duration-500 rounded-sm p-6 sm:p-8 lg:p-10 relative overflow-hidden group shadow-sm ${isActive
                    ? 'border-[#C59B27] ring-1 ring-[#C59B27]/20 bg-[#FDFCFA]'
                    : 'border-[#EAE6DF] hover:border-[#C59B27]/40'
                    }`}
                >
                  {/* Subtle Background Accent */}
                  <div className="absolute top-0 right-0 w-48 h-48 bg-radial from-[#F8F5EE] to-transparent blur-3xl pointer-events-none" />

                  {/* Section Header */}
                  <div className="flex items-start gap-4 sm:gap-5 mb-6 pb-6 border-b border-[#EAE6DF] relative z-10">
                    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-sm border flex items-center justify-center shrink-0 transition-transform duration-500 group-hover:scale-105 ${isActive
                      ? 'bg-[#1A1A1A] text-[#C59B27] border-[#1A1A1A] shadow-sm'
                      : 'bg-[#F8F5EE] text-[#9A7326] border-[#E5DCC8]'
                      }`}>
                      {sec.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-[#9A7326] uppercase tracking-wider block mb-1 font-sans">
                        Điều khoản {sec.number}
                      </span>
                      <h2 className="text-lg sm:text-2xl font-bold text-[#1A1A1A] tracking-tight font-serif leading-snug">
                        {sec.title}
                      </h2>
                    </div>
                  </div>

                  {/* Section Summary Callout (Clean Architectural Bar without warning icons) */}
                  <div className="bg-[#FAF9F6] border-l-4 border-l-[#C59B27] border-y border-r border-[#EAE6DF] p-4 sm:p-5 mb-6 text-xs sm:text-sm font-medium text-[#2D2A26] relative z-10">
                    <span className="leading-relaxed block">{sec.summary}</span>
                  </div>

                  {/* Content Paragraphs */}
                  <div className="space-y-4 text-sm sm:text-base text-[#3D3A36] font-normal leading-relaxed relative z-10">
                    {sec.content.map((para, idx) => (
                      <p key={idx}>{withContact(para)}</p>
                    ))}
                  </div>

                  {/* Bullet Points */}
                  {sec.bullets && (
                    <ul className="mt-5 space-y-3 relative z-10">
                      {sec.bullets.map((bullet, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-sm sm:text-base text-[#2D2A26] font-normal bg-[#FAF9F6] p-3 sm:p-3.5 rounded-sm border border-[#F0EBE1]">
                          <CheckCircle2 className="w-4 h-4 text-[#C59B27] shrink-0 mt-1" />
                          <span className="leading-relaxed">{withContact(bullet)}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Sub Content */}
                  {sec.subcontent && (
                    <p className="mt-6 text-sm sm:text-base text-[#1A1A1A] font-bold relative z-10 font-sans">
                      {withContact(sec.subcontent)}
                    </p>
                  )}

                  {/* Sub Bullets */}
                  {sec.subBullets && (
                    <ul className="mt-3 space-y-2.5 relative z-10 pl-2">
                      {sec.subBullets.map((sub, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-sm sm:text-base text-[#3D3A36] font-normal pl-2">
                          <div className="w-1.5 h-1.5 bg-[#C59B27] shrink-0 mt-2.5" />
                          <span className="leading-relaxed">{withContact(sub)}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Highlight Note (No warning emojis) */}
                  {sec.note && (
                    <div className="mt-7 pt-5 border-t border-[#EAE6DF] bg-[#FDFBF7] border-l-4 border-l-[#C59B27] p-4 sm:p-5 rounded-sm text-xs sm:text-sm text-[#3D3A36] leading-relaxed relative z-10">
                      <strong className="text-[#9A7326] font-bold block sm:inline mb-1 sm:mb-0 uppercase tracking-wider font-sans text-xs">
                        Lưu ý quan trọng:{' '}
                      </strong>
                      <span>{withContact(sec.note)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* 4. GEO FAQ SECTION (Hỏi đáp quyền riêng tư trên nền trắng) */}
      <section className="px-4 sm:px-6 py-14 sm:py-20 border-t border-[#EAE6DF] bg-[#F2EDE4]/50 relative">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs uppercase tracking-wider font-sans font-bold text-[#9A7326] inline-block mb-2.5 bg-[#F8F5EE] px-3.5 py-1 rounded-sm border border-[#E5DCC8]">
              Hỏi đáp thường gặp (FAQ)
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#1A1A1A] font-serif tracking-tight">
              Câu Hỏi Về Quyền Riêng Tư & Dữ Liệu
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-[#6E6961] mt-2.5 max-w-xl mx-auto font-normal">
              Giải đáp minh bạch và chuẩn xác các thắc mắc phổ biến của khách hàng liên quan đến việc xử lý và bảo mật thông tin tại Maian Homes.
            </p>
          </div>

          <div className="space-y-4">
            {GEO_FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className={`bg-white border transition-all duration-300 rounded-sm overflow-hidden shadow-sm ${isOpen ? 'border-[#C59B27] ring-1 ring-[#C59B27]/20 shadow-md' : 'border-[#EAE6DF] hover:border-[#C59B27]/50'
                    }`}
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-5 sm:px-6 py-5 text-left flex items-center justify-between gap-4 hover:bg-[#FAF9F6] transition-colors"
                    aria-expanded={isOpen}
                  >
                    <span className="text-sm sm:text-base md:text-lg font-bold text-[#1A1A1A] font-serif leading-snug">
                      {faq.q}
                    </span>
                    <div className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 transition-transform duration-300 ${isOpen ? 'bg-[#1A1A1A] text-white rotate-180' : 'bg-[#FAF9F6] text-[#6E6961]'
                      }`}>
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-5 sm:px-6 pb-6 pt-3 text-sm sm:text-base text-[#3D3A36] font-normal leading-relaxed border-t border-[#EAE6DF] bg-[#FAF9F6]">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. CONTACT & DATA SUBJECT RIGHT BANNER (Architectural Editorial Card) */}
      <section className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto bg-gradient-to-br from-[#1A1A1A] via-[#2D2A26] to-[#14110E] text-white border border-[#3D3A36] rounded-sm p-6 sm:p-10 md:p-14 text-center relative overflow-hidden shadow-lg">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(circle_at_center,rgba(197,155,39,0.15)_0,transparent_70%)] pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-[#C59B27]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <span className="text-[11px] font-sans uppercase tracking-wider font-bold text-[#D4AF37] bg-white/10 px-3 py-1 rounded-sm border border-white/15 inline-block mb-4">
              DPO Support Center
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white font-serif tracking-tight mb-4">
              Cần Hỗ Trợ Hoặc Thực Hiện Quyền Chủ Thể Dữ Liệu?
            </h2>
            <p className="text-sm sm:text-base text-[#F3E6C6]/80 max-w-2xl mx-auto font-light leading-relaxed mb-8">
              Bộ phận Bảo vệ Dữ liệu Cá nhân của Maian Homes luôn sẵn sàng tiếp nhận và giải quyết mọi yêu cầu về truy cập, chỉnh sửa, hoặc hủy bỏ dữ liệu của quý khách một cách nhanh chóng, minh bạch và bảo mật nhất.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
              <a
                href={gmailComposeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-8 py-4 rounded-sm bg-gradient-to-r from-[#D4AF37] via-[#C59B27] to-[#AA771C] text-black font-bold text-xs sm:text-sm uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2.5 shadow-md"
              >
                <Mail className="w-4 h-4 text-black shrink-0" />
                <span>Gửi Gmail Hỗ Trợ ({contactEmail})</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-70 shrink-0" />
              </a>

              <a
                href={contact.phone ? `tel:${contact.phone.replace(/\D/g, "")}` : undefined}
                className="w-full sm:w-auto px-8 py-4 rounded-sm bg-white/10 hover:bg-white/20 active:scale-95 text-white font-semibold text-xs sm:text-sm transition-all border border-white/20 flex items-center justify-center gap-2"
              >
                <span>Hotline: {contactPhone}</span>
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
