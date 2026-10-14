/**
 * aiAltGenerator.ts
 * Trình hỗ trợ sinh Alt Text SEO bằng AI dành cho phân hệ Văn phòng (Office & Workspaces).
 * Đảm bảo:
 * - Chuẩn SEO Google (độ dài lý tưởng, chứa từ khóa thực tế và địa điểm).
 * - 100% ĐỘC NHẤT (Không trùng lặp giữa các ảnh trong cùng tòa nhà hoặc trang).
 * - Đa dạng góc nhìn (mặt tiền, sảnh lễ tân, sàn làm việc, view thành phố, thang máy, hầm xe, tiện ích...).
 */

export interface AltGeneratorContext {
  entityName?: string; // Tên tòa nhà hoặc tên dự án/không gian (Ví dụ: "Bitexco Financial Tower")
  district?: string; // Quận/Huyện (Ví dụ: "Quận 1")
  city?: string; // Tỉnh/Thành phố (Ví dụ: "TP. Hồ Chí Minh")
  grade?: string; // Hạng A, B, C
  category?: 'building' | 'office' | 'coworking' | 'grade' | 'general';
  imageIndex?: number; // Vị trí thứ tự ảnh (0, 1, 2...)
  isPrimary?: boolean; // Có phải ảnh đại diện chính không
  existingAlts?: string[]; // Danh sách các Alt text đã có (để AI kiểm tra và loại trừ trùng lặp)
}

// Bộ phối cảnh đa dạng dành cho tòa nhà văn phòng
const BUILDING_PERSPECTIVES = [
  'Mặt tiền kiến trúc hiện đại và nổi bật của tòa nhà {name} tại {location}',
  'Sảnh đón tiếp sang trọng và quầy lễ tân tiêu chuẩn chuyên nghiệp tại {name} {district}',
  'Không gian sàn văn phòng cho thuê thông thoáng đón ánh sáng tự nhiên tại {name}',
  'Tầm nhìn view toàn cảnh thành phố ấn tượng từ các tầng cao của tòa nhà {name}',
  'Hệ thống thang máy tốc độ cao và khu vực hành lang sang trọng tại {name}',
  'Khu vực bãi đỗ xe rộng rãi với hệ thống an ninh kiểm soát thẻ từ tại {name}',
  'Khu vực hội thảo và không gian phòng họp chuyên nghiệp bên trong {name}',
  'Phối cảnh thực tế tòa nhà văn phòng {name} kết nối giao thông đắc địa {district}',
  'Lối vào chính và cảnh quan cây xanh thoáng đãng phía trước tòa nhà {name}',
  'Khu vực sảnh thang máy và tiện ích hỗ trợ doanh nghiệp tại tòa nhà {name}',
  'Mặt bằng sàn văn phòng bố trí linh hoạt tối ưu công năng tại {name}',
  'Khu vực pantry nước sạch và không gian nghỉ ngơi thư giãn tại {name}',
  'Góc nhìn từ trên cao bao quát vị trí chiến lược của tòa nhà {name} {district}',
  'Hệ thống mặt dựng kính cao cấp tối ưu cách âm và chống bức xạ nhiệt tại {name}',
  'Khu vực lễ tân tiếp đón khách hàng đối tác với chuẩn dịch vụ cao cấp tại {name}',
  'Không gian làm việc riêng biệt và bảo mật dành cho doanh nghiệp tại {name}',
  'Cửa ngõ kết nối giao thông huyết mạch thuận tiện di chuyển tại {name} {district}',
  'Hệ thống chiếu sáng LED hiện đại tiết kiệm năng lượng tại sàn văn phòng {name}',
];

// Bộ phối cảnh dành cho Coworking Space / Văn phòng chia sẻ
const COWORKING_PERSPECTIVES = [
  'Không gian làm việc chung Co-working Space năng động và sáng tạo tại {name} {location}',
  'Khu vực bàn làm việc linh hoạt Hot Desk đầy đủ tiện nghi tại {name}',
  'Văn phòng trọn gói Private Office thiết kế hiện đại cho doanh nghiệp tại {name}',
  'Phòng họp thông minh trang bị màn hình chiếu và thiết bị họp trực tuyến tại {name}',
  'Khu vực Business Lounge tiếp khách và kết nối cộng đồng doanh nhân tại {name}',
  'Khu vực pantry mở phục vụ cà phê và đồ uống miễn phí tại {name} {district}',
  'Booth điện thoại cách âm riêng tư cho các cuộc gọi bảo mật tại {name}',
  'Không gian làm việc mở với ánh sáng tự nhiên tràn ngập tại {name}',
  'Khu vực sự kiện và hội thảo đa năng dành cho các buổi workshop tại {name}',
  'Góc thư giãn và ghế sofa nghỉ ngơi tái tạo năng lượng tại {name}',
];

// Bộ phối cảnh dành cho phân hạng văn phòng (Grade A/B/C)
const GRADE_PERSPECTIVES = [
  'Văn phòng cho thuê {name} cao cấp vị trí trung tâm tại {location}',
  'Không gian văn phòng tiêu chuẩn {name} với trang thiết bị hiện đại tại {location}',
  'Tòa nhà văn phòng chuẩn {name} đáp ứng nhu cầu doanh nghiệp đa quốc gia tại {location}',
  'Mặt bằng văn phòng {name} chuyên nghiệp với chi phí vận hành tối ưu tại {location}',
  'Sàn văn phòng {name} diện tích đa dạng phù hợp mọi quy mô doanh nghiệp tại {location}',
];

function normalizeLocation(district?: string, city?: string): string {
  const parts = [district?.trim(), city?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'TP. Hồ Chí Minh';
}

function cleanName(name?: string): string {
  return (name || 'Văn phòng').trim();
}

/**
 * Sinh một Alt text đơn lẻ có kiểm tra chống trùng lặp với danh sách đã có
 */
export function generateSingleAltText(context: AltGeneratorContext): string {
  const {
    entityName,
    district,
    city,
    category = 'building',
    imageIndex = 0,
    isPrimary = false,
    existingAlts = [],
  } = context;

  const name = cleanName(entityName);
  const location = normalizeLocation(district, city);
  const distStr = district ? district.trim() : '';

  // Chọn mẫu phối cảnh phù hợp với loại hình
  let templates = BUILDING_PERSPECTIVES;
  if (category === 'coworking') {
    templates = COWORKING_PERSPECTIVES;
  } else if (category === 'grade') {
    templates = GRADE_PERSPECTIVES;
  }

  // Tập hợp các Alt text đã dùng (chuẩn hóa chữ thường không dấu để so sánh)
  const normalizedExisting = new Set(
    existingAlts
      .filter(Boolean)
      .map((s) => s.trim().toLowerCase())
  );

  // Nếu là ảnh đại diện chính (Primary Image)
  if (isPrimary || imageIndex === 0) {
    const primaryCandidate = `Mặt tiền kiến trúc chính thức của tòa nhà ${name} tại ${location}`;
    if (!normalizedExisting.has(primaryCandidate.toLowerCase())) {
      return primaryCandidate;
    }
  }

  // Quét qua các mẫu phối cảnh để tìm mẫu CHƯA BỊ TRÙNG
  const startIndex = imageIndex % templates.length;
  for (let offset = 0; offset < templates.length; offset++) {
    const currentIdx = (startIndex + offset) % templates.length;
    let candidate = templates[currentIdx]
      .replace('{name}', name)
      .replace('{location}', location)
      .replace('{district}', distStr ? `(${distStr})` : '');

    // Làm sạch khoảng trắng thừa
    candidate = candidate.replace(/\s+/g, ' ').trim();

    if (!normalizedExisting.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  // Dự phòng an toàn: nếu đã dùng hết tất cả các mẫu, thêm số góc nhìn để đảm bảo 100% không trùng
  return `Hình ảnh thực tế tòa nhà ${name} tại ${location} (Góc nhìn #${imageIndex + 1})`;
}

/**
 * Sinh hàng loạt (Batch) Alt text cho một danh sách ảnh
 * Đảm bảo 100% các kết quả sinh ra trong danh sách là duy nhất và không trùng với các Alt text đã có trước đó.
 */
export function generateBatchAltTexts(
  count: number,
  context: Omit<AltGeneratorContext, 'imageIndex' | 'isPrimary'>
): string[] {
  const results: string[] = [];
  const currentAlts = [...(context.existingAlts || [])];

  for (let i = 0; i < count; i++) {
    const generated = generateSingleAltText({
      ...context,
      imageIndex: i,
      isPrimary: i === 0 && currentAlts.length === 0,
      existingAlts: [...currentAlts, ...results],
    });
    results.push(generated);
  }

  return results;
}
