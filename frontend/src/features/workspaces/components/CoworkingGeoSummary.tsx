'use client';


interface CoworkingGeoSummaryProps {
  coworking?: any;
  space?: any;
}

export default function CoworkingGeoSummary(props: CoworkingGeoSummaryProps) {
  const coworking = props.space || props.coworking || {};
  const seatTypesText = (coworking.seat_types || [])
    .filter((st: any) => st.status === 'ACTIVE')
    .map((st: any) => st.name)
    .join(', ') ;

  const pricesText = (coworking.pricing_plans || [])
    .filter((p: any) => p.status === 'ACTIVE')
    .map((p: any) => `${p.name}: ${p.price ? new Intl.NumberFormat('vi-VN').format(p.price) + ' đ' : 'Liên hệ'}`)
    .join(' | ') ;

  const amenitiesText = (coworking.amenities || [])
    .filter((a: any) => a.is_active !== false)
    .map((a: any) => a.name)
    .join(', ') ;

  return (
    <section className="sr-only" aria-label="Thông tin tổng hợp Co-working (GEO & AI Data)">
      <h2>THÔNG TIN TỔNG HỢP CO-WORKING (GEO & AI DATA)</h2>

      <dl>
        <div>
          <dt>Tên không gian:</dt>
          <dd>{coworking.name || ''}</dd>
        </div>

        <div>
          <dt>Địa chỉ hoạt động:</dt>
          <dd>{coworking.location?.address}</dd>
        </div>

        <div>
          <dt>Khu vực & Thành phố:</dt>
          <dd>
            {coworking.location?.district}, {coworking.location?.city}
          </dd>
        </div>

        <div>
          <dt>Thời gian hoạt động:</dt>
          <dd>{coworking.location?.operating_hours}</dd>
        </div>

        <div>
          <dt>Loại chỗ ngồi cung cấp:</dt>
          <dd>{seatTypesText}</dd>
        </div>

        <div>
          <dt>Mức giá thuê tham khảo:</dt>
          <dd>{pricesText}</dd>
        </div>

        <div>
          <dt>Tiện ích trọn gói bao gồm:</dt>
          <dd>{amenitiesText}</dd>
        </div>

        <div>
          <dt>Hotline:</dt>
          <dd>{coworking.location?.contact_phone}</dd>
        </div>
        <div>
          <dt>Email:</dt>
          <dd>{coworking.location?.contact_email}</dd>
        </div>
        <div>
          <dt>Website:</dt>
          <dd>{coworking.website || ''}</dd>
        </div>
      </dl>
    </section>
  );
}
