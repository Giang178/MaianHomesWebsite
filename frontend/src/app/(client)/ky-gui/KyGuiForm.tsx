'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Camera,
  CheckCircle2,
  ChevronDown,
  CircleCheck,
  Info,
  Loader2,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { consignmentApi } from '@/features/website/public/consignments';
import { usePublicContactSettings } from '@/features/contact/usePublicContactSettings';

type TransactionType = 'sale' | 'rent' | 'sale_and_rent';

type FormState = {
  transactionType: TransactionType;
  propertyType: string;
  expectedSalePrice: string;
  expectedRentPrice: string;
  address: string;
  description: string;
  ownerRole: string;
  name: string;
  email: string;
  phone: string;
  message: string;
};

const INITIAL_FORM: FormState = {
  transactionType: 'sale',
  propertyType: 'apartment',
  expectedSalePrice: '',
  expectedRentPrice: '',
  address: '',
  description: '',
  ownerRole: 'Chính chủ',
  name: '',
  email: '',
  phone: '',
  message: '',
};

const PROPERTY_LABELS: Record<string, string> = {
  apartment: 'Căn hộ',
  house: 'Nhà phố',
  villa: 'Biệt thự',
  land: 'Đất nền',
  commercial: 'Bất động sản thương mại',
};

const inputClass = 'peer h-12 w-full rounded border border-[#d8d8d8] bg-white px-4 pb-1 pt-5 text-base text-[#30333a] outline-none transition focus:border-[#838383] focus:ring-0';
const textareaClass = 'peer min-h-[86px] w-full resize-none rounded border border-[#d8d8d8] bg-white px-4 pb-2 pt-6 text-base text-[#30333a] outline-none transition focus:border-[#838383] focus:ring-0';
const floatingLabelClass = 'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[#9fa4aa] transition-all peer-focus:top-2.5 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:text-[#30333a] peer-valid:top-2.5 peer-valid:translate-y-0 peer-valid:text-[10px]';

function FloatingInput({ label, required, value, onChange, type = 'text', inputMode }: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  return (
    <div className='relative'>
      <input
        className={inputClass}
        aria-label={label}
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
      <span className={floatingLabelClass}>{label} {required && <b className='font-normal text-[#d61f00]'>*</b>}</span>
    </div>
  );
}

function RadioOption({ name, value, checked, label, onChange }: {
  name: string;
  value: string;
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label className='flex cursor-pointer items-center text-base text-[#13202a]'>
      <input className='sr-only' type='radio' name={name} value={value} checked={checked} onChange={onChange} />
      <span className={`mr-2 flex h-4 w-4 items-center justify-center rounded-full border ${checked ? 'border-[#c72528]' : 'border-[#d8d8d8]'}`}>
        {checked && <span className='h-2 w-2 rounded-full bg-[#c72528]' />}
      </span>
      {label}
    </label>
  );
}

export default function KyGuiForm({ heroImage = '/images/banner_Kg.jpg', faqs = [] }: { heroImage?: string; faqs?: Array<{ question: string; answer: string }> }) {
  const { contact } = usePublicContactSettings();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultId, setResultId] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [showImageStandards, setShowImageStandards] = useState(false);
  const [showFullInfo, setShowFullInfo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submissionKeyRef = useRef<string | null>(null);


  useEffect(() => {
    if (images.length === 0) {
      setPreviews((current) => current.length === 0 ? current : []);
      return;
    }
    const urls = images.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [images]);

  useEffect(() => {
    if (!showImageStandards) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowImageStandards(false);
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [showImageStandards]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    submissionKeyRef.current = null;
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
  };

  const hasSale = form.transactionType === 'sale' || form.transactionType === 'sale_and_rent';
  const hasRent = form.transactionType === 'rent' || form.transactionType === 'sale_and_rent';

  const addImages = (incoming: File[]) => {
    const allowed = incoming.filter((file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type));
    if (allowed.length !== incoming.length) {
      setError('Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP.');
      return;
    }
    if (allowed.some((file) => file.size > 10 * 1024 * 1024)) {
      setError('Mỗi ảnh không được vượt quá 10 MB.');
      return;
    }
    const next = [...images, ...allowed].slice(0, 8);
    submissionKeyRef.current = null;
    setImages(next);
    setError(next.length === 8 && images.length + allowed.length > 8 ? 'Bạn có thể tải tối đa 8 ảnh.' : '');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const phoneDigits = form.phone.replace(/\D/g, '');
    const activePrice = hasSale ? form.expectedSalePrice : form.expectedRentPrice;
    const salePrice = hasSale ? Number(form.expectedSalePrice) : null;
    const rentPrice = hasRent ? Number(form.expectedRentPrice) : null;
    const salePriceVnd = salePrice !== null ? Math.round(salePrice * 1_000_000_000) : null;
    const rentPriceVnd = rentPrice !== null ? Math.round(rentPrice * 1_000_000) : null;
    const normalizedEmail = form.email.trim().toLowerCase();
    if (!form.propertyType || !activePrice || !form.address.trim() || !form.description.trim() || !form.name.trim() || !form.phone.trim()) {
      setError('Vui lòng điền đầy đủ các thông tin bắt buộc (*).');
      return;
    }
    if (hasSale && (salePrice === null || !Number.isFinite(salePrice) || salePrice <= 0 || !Number.isSafeInteger(salePriceVnd))) {
      setError('Giá bán mong muốn phải lớn hơn 0.');
      return;
    }
    if (hasRent && (rentPrice === null || !Number.isFinite(rentPrice) || rentPrice <= 0 || !Number.isSafeInteger(rentPriceVnd))) {
      setError('Giá thuê mong muốn phải lớn hơn 0.');
      return;
    }
    if (images.length < 3) {
      setError('Vui lòng tải lên ít nhất 3 ảnh bất động sản.');
      return;
    }
    if (form.name.trim().length < 2 || phoneDigits.length < 9 || phoneDigits.length > 15) {
      setError('Họ tên hoặc số điện thoại không hợp lệ.');
      return;
    }
    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Email không hợp lệ.');
      return;
    }

    const propertyLabel = PROPERTY_LABELS[form.propertyType] || 'Bất động sản';
    const expectedPrice = hasSale ? salePriceVnd : rentPriceVnd;
    const combinedDescription = [form.description.trim(), form.message.trim()].filter(Boolean).join('\n\nLời nhắn: ');

    setIsSubmitting(true);
    setError('');
    const submissionKey = submissionKeyRef.current || (
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `consignment-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
    submissionKeyRef.current = submissionKey;
    try {
      const response = await consignmentApi.createPublicWithImages({
        owner: {
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: normalizedEmail || null,
          role: form.ownerRole,
        },
        property: {
          project_name: null,
          unit_code: 'Chưa cung cấp',
          title: `${propertyLabel} ký gửi tại ${form.address.trim()}`,
          expected_price: expectedPrice,
          expected_sale_price: hasSale ? salePriceVnd : null,
          expected_rent_price: hasRent ? rentPriceVnd : null,
          gross_area: 1,
          legal_status: 'Chưa cung cấp',
          transaction_type: form.transactionType,
          property_type: form.propertyType,
          city: 'TP. Hồ Chí Minh',
          address: form.address.trim(),
          description: combinedDescription,
        },
      }, images, submissionKey) as { id?: string };
      setResultId(response.id || '');
      window.scrollTo?.({ top: 0, behavior: 'smooth' });
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Không thể gửi hồ sơ. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (resultId) {
    return (
      <main className='flex min-h-screen items-center justify-center bg-[#f3f4f7] px-4 pb-12 pt-20 sm:pt-24'>
        <section className='w-full max-w-[460px] rounded-lg bg-white p-8 text-center shadow-[0_8px_24px_rgba(28,30,34,.16)]'>
          <CheckCircle2 className='mx-auto h-20 w-20 text-[#c72528]' />
          <h1 className='mt-6 text-2xl font-semibold text-[#30333a]'>Gửi thông tin thành công</h1>
          <p className='mt-3 text-base leading-6 text-[#838383]'>Cảm ơn bạn đã gửi thông tin. Chuyên viên Maian Homes sẽ liên hệ trong vòng 24 giờ làm việc.</p>
          <p className='mt-4 rounded bg-[#f3f4f7] px-4 py-3 text-sm text-[#5f666d]'>Mã hồ sơ: <strong>{resultId}</strong></p>
          <div className='mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center'>
            {contact.phone && <a href={`tel:${contact.phone.replace(/\D/g, '')}`} aria-label={`Gọi hotline hỗ trợ ký gửi: ${contact.phone}`} className='rounded bg-[#c72528] px-6 py-3 font-semibold text-white'>Gọi hỗ trợ</a>}
            <Link href='/' aria-label="Quay lại trang chủ Maian Homes" className='rounded border border-[#d8d8d8] px-6 py-3 font-semibold text-[#30333a]'>Về trang chủ</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className='bg-[#f3f4f7] pt-[60px] text-[#30333a] md:pt-[72px]'>
      <section className='flex min-h-[calc(100vh-72px)] flex-col lg:h-[calc(100vh-72px)] lg:flex-row lg:overflow-hidden'>
        <aside className='relative w-full shrink-0 overflow-hidden bg-[#17130f] px-4 pb-8 pt-10 text-white lg:h-full lg:w-[468px] lg:overflow-y-auto lg:px-10 lg:pb-10 lg:pt-8'>
          <Image src={heroImage} alt='' fill priority className='object-cover opacity-35' />
          <div className='absolute inset-0 bg-gradient-to-b from-[#191919]/65 via-[#161616]/75 to-black/90' />
          <div className='relative z-10 mx-auto max-w-[420px]'>
            <section>
              <h2 className='mb-6 font-serif text-lg font-medium leading-7'>Cam kết với khách hàng</h2>
              <ul className='space-y-3'>
                {[
                  'Đặt khách hàng làm trọng tâm trong mọi quyết định',
                  'Những điều đã nói là những điều được làm',
                  'Đảm bảo thực thi và đồng hành đến khi giao dịch hoàn tất',
                ].map((item) => (
                  <li key={item} className='flex items-start gap-3 text-sm leading-5'>
                    <ShieldCheck className='-mt-0.5 h-6 w-6 shrink-0 text-white' />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <div className={`lg:block ${showFullInfo ? 'block' : 'hidden'}`}>
              <section className='mt-10'>
                <h2 className='mb-6 font-serif text-lg font-medium leading-7'>Miễn phí các dịch vụ bổ sung</h2>
                <ul className='space-y-4'>
                  <li className='flex items-start gap-3'>
                    <Camera className='-mt-0.5 h-6 w-6 shrink-0' />
                    <div className='text-sm leading-5'><p>Dịch vụ chụp ảnh chuyên nghiệp</p><p className='mt-1 text-white/75'>Hình ảnh chất lượng cao, chuyên nghiệp<br />Tối ưu khả năng tiếp cận khách hàng</p></div>
                  </li>
                  <li className='flex items-start gap-3'>
                    <Box className='-mt-0.5 h-6 w-6 shrink-0' />
                    <div className='text-sm leading-5'><p>Dịch vụ thực tế ảo (3D)</p><p className='mt-1 text-white/75'>Trải nghiệm xem nhà như thật<br />Hỗ trợ chốt giao dịch nhanh</p></div>
                  </li>
                </ul>
              </section>

            </div>

            {!showFullInfo ? (
              <button 
                type="button"
                onClick={() => setShowFullInfo(true)}
                className="mt-6 flex items-center justify-center w-full gap-2 text-sm text-[#D6B25E] font-medium lg:hidden"
              >
                Xem thêm <ChevronDown className="w-4 h-4" />
              </button>
            ) : (
              <button 
                type="button"
                onClick={() => setShowFullInfo(false)}
                className="mt-6 flex items-center justify-center w-full gap-2 text-sm text-[#D6B25E] font-medium lg:hidden"
              >
                Thu gọn <ChevronDown className="w-4 h-4 rotate-180" />
              </button>
            )}
          </div>
        </aside>

        <div className='w-full flex-1 overflow-y-auto bg-[#f3f4f7] px-0 pb-0 pt-2 sm:px-6 lg:h-full lg:px-10 lg:pt-8'>
          <form onSubmit={submit} noValidate className='mx-auto w-full max-w-[700px]'>
            <section className='px-4 pb-0 pt-4 sm:px-0 sm:pt-0'>
              <div className='flex w-fit items-center gap-3'>
                <h1 className='font-serif text-[22px] font-medium leading-[34px] text-[#30333a] sm:text-[30px] sm:leading-[42px]'>Ký gửi nhà đất với Maian Homes</h1>
                <CircleCheck className='h-8 w-8 shrink-0 text-[#00a0bc] sm:h-10 sm:w-10' />
              </div>
              <ul className='mb-6 mt-4 list-disc space-y-1 pl-4 text-base leading-6'>
                <li>Maian Homes tiếp nhận nhà đất ký gửi tại <strong>TP. Hồ Chí Minh.</strong></li>
                <li>Phí môi giới chỉ được áp dụng khi giao dịch thành công.</li>
              </ul>
              <div className='mx-auto h-px w-full max-w-[350px] bg-[#dedede]' />
            </section>

            <section className='mx-0 mb-4 mt-8 rounded-lg border border-[#d8d8d8] bg-white p-4 shadow-[0_8px_20px_rgba(0,0,0,.20)] sm:mb-8 sm:p-6'>
              <h2 className='mb-6 font-serif text-xl font-medium leading-6 text-[#30333a]'>Thông tin cơ bản</h2>
              <div className='mb-5'>
                <p className='mb-3 text-base'>Nhu cầu của bạn là gì? <span className='text-[#d61f00]'>*</span></p>
                <div className='flex flex-col gap-3 sm:flex-row sm:gap-6'>
                  <RadioOption name='transaction' value='sale' label='Bán' checked={form.transactionType === 'sale'} onChange={() => update('transactionType', 'sale')} />
                  <RadioOption name='transaction' value='rent' label='Cho thuê' checked={form.transactionType === 'rent'} onChange={() => update('transactionType', 'rent')} />
                  <RadioOption name='transaction' value='sale_and_rent' label='Bán và cho thuê' checked={form.transactionType === 'sale_and_rent'} onChange={() => update('transactionType', 'sale_and_rent')} />
                </div>
              </div>

              <div className={`grid gap-4 ${form.transactionType === 'sale_and_rent' ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
                <div className='relative'>
                  <select aria-label='Loại hình nhà đất' className={`${inputClass} appearance-none`} value={form.propertyType} onChange={(event) => update('propertyType', event.target.value)} required>
                    <option value='apartment'>Căn hộ</option><option value='house'>Nhà phố</option><option value='villa'>Biệt thự</option><option value='land'>Đất nền</option><option value='commercial'>Bất động sản thương mại</option>
                  </select>
                  <span className={floatingLabelClass}>Loại hình nhà đất <b className='font-normal text-[#d61f00]'>*</b></span>
                  <span className='pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#838383]'>⌄</span>
                </div>
                {form.transactionType !== 'sale_and_rent' && hasSale && <FloatingInput label='Giá bán mong muốn (Tỷ VNĐ)' required value={form.expectedSalePrice} onChange={(value) => update('expectedSalePrice', value)} type='number' inputMode='decimal' />}
                {form.transactionType !== 'sale_and_rent' && hasRent && <FloatingInput label='Giá thuê mong muốn (Triệu/tháng)' required value={form.expectedRentPrice} onChange={(value) => update('expectedRentPrice', value)} type='number' inputMode='decimal' />}
              </div>
              {form.transactionType === 'sale_and_rent' && <div className='mt-4 grid gap-4 md:grid-cols-2'><FloatingInput label='Giá bán mong muốn (Tỷ VNĐ)' required value={form.expectedSalePrice} onChange={(value) => update('expectedSalePrice', value)} type='number' inputMode='decimal' /><FloatingInput label='Giá thuê mong muốn (Triệu/tháng)' required value={form.expectedRentPrice} onChange={(value) => update('expectedRentPrice', value)} type='number' inputMode='decimal' /></div>}

              <div className='mb-5 mt-5'>
                <p className='mb-3 text-base'>Tỉnh/Thành phố <span className='text-[#d61f00]'>*</span></p>
                <RadioOption name='city' value='hcm' label='TP. Hồ Chí Minh' checked onChange={() => undefined} />
              </div>
              <FloatingInput label='Địa chỉ' required value={form.address} onChange={(value) => update('address', value)} />
            </section>

            <section className='mx-0 mb-4 rounded-lg border border-[#d8d8d8] bg-white p-4 shadow-[0_8px_20px_rgba(0,0,0,.20)] sm:mb-8 sm:p-6'>
              <h2 className='mb-6 font-serif text-xl font-medium leading-6 text-[#30333a]'>Thông tin nhà đất</h2>
              <div className='relative'>
                <textarea aria-label='Mô tả nhà đất' className={textareaClass} value={form.description} onChange={(event) => update('description', event.target.value)} required />
                <span className='pointer-events-none absolute left-4 top-3 text-sm text-[#9fa4aa] transition-all peer-focus:top-1 peer-focus:text-[10px] peer-focus:text-[#30333a] peer-valid:top-1 peer-valid:text-[10px]'>Mô tả nhà đất <b className='font-normal text-[#d61f00]'>*</b></span>
              </div>

              <div className='mt-5'>
                <div className='mb-2 flex items-center justify-between gap-4'><label className='text-base'>Hình ảnh <span className='text-[#c72528]'>*</span></label><button type='button' onClick={() => setShowImageStandards(true)} aria-haspopup='dialog' className='flex items-center gap-2 text-sm font-semibold text-[#30333a] underline'><Info className='h-4 w-4' />Tiêu chuẩn hình ảnh</button></div>
                <div
                  className={`rounded-lg border border-dashed px-5 py-6 text-center transition sm:px-12 ${isDragging ? 'border-[#c72528] bg-[#fff7f7]' : 'border-[#9fa4aa]'}`}
                  onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(event) => { event.preventDefault(); setIsDragging(false); addImages(Array.from(event.dataTransfer.files)); }}
                >
                  <input ref={fileInputRef} className='sr-only' type='file' accept='image/jpeg,image/png,image/webp' multiple onChange={(event) => { addImages(Array.from(event.target.files || [])); event.target.value = ''; }} />
                  <button type='button' onClick={() => fileInputRef.current?.click()} aria-label='Tải ảnh lên' className='mx-auto block text-[#5f666d]'><Upload className='h-6 w-6' /></button>
                  <h3 className='mt-4 text-sm font-semibold leading-5'>Kéo thả hình ảnh nhà đất hoặc <button type='button' onClick={() => fileInputRef.current?.click()} className='underline'>bấm vào đây để tải lên</button></h3>
                  <p className='mt-1 text-[13px] leading-[18px] text-[#5f666d]'>Yêu cầu tối thiểu 3 hình ảnh</p>
                </div>
              </div>

              {previews.length > 0 && <div className='mt-5'><h3 className='mb-2 text-sm font-semibold'>Ảnh đã tải</h3><ul className='flex flex-wrap gap-2'>{previews.map((src, index) => <li key={src} className='relative h-[72px] w-[140px] overflow-hidden rounded'><Image src={src} alt={`Ảnh nhà đất ${index + 1}`} fill unoptimized className='object-cover' /><button type='button' aria-label={`Xóa ảnh ${index + 1}`} onClick={() => { submissionKeyRef.current = null; setImages((current) => current.filter((_, itemIndex) => itemIndex !== index)); }} className='absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded border border-[#f5f5f7] bg-white text-[#5f666d] shadow'><Trash2 className='h-4 w-4' /></button></li>)}</ul></div>}
            </section>

            <section className='mx-0 mb-4 rounded-lg border border-[#d8d8d8] bg-white p-4 shadow-[0_8px_20px_rgba(0,0,0,.20)] sm:mb-8 sm:p-6'>
              <h2 className='mb-6 font-serif text-xl font-medium leading-6 text-[#30333a]'>Thông tin liên hệ</h2>
              <div className='mb-5'>
                <p className='mb-3 text-base'>Bạn là? <span className='text-[#d61f00]'>*</span></p>
                <div className='flex flex-col gap-3 sm:flex-row sm:gap-6'>
                  {['Chính chủ', 'Người thân', 'Môi giới'].map((role) => <RadioOption key={role} name='owner-role' value={role} label={role} checked={form.ownerRole === role} onChange={() => update('ownerRole', role)} />)}
                </div>
              </div>
              <FloatingInput label='Họ và tên' required value={form.name} onChange={(value) => update('name', value)} />
              <div className='mt-4 grid gap-4 md:grid-cols-2'>
                <FloatingInput label='Email' value={form.email} onChange={(value) => update('email', value)} type='email' />
                <FloatingInput label='Số điện thoại' required value={form.phone} onChange={(value) => update('phone', value.replace(/[^\d+\s.-]/g, ''))} type='tel' inputMode='tel' />
              </div>
              <div className='relative mt-4'><textarea aria-label='Lời nhắn' className={textareaClass} value={form.message} onChange={(event) => update('message', event.target.value)} required /><span className='pointer-events-none absolute left-4 top-3 text-sm text-[#9fa4aa] transition-all peer-focus:top-1 peer-focus:text-[10px] peer-valid:top-1 peer-valid:text-[10px]'>Lời nhắn</span></div>
            </section>

            {error && <div role='alert' aria-live='polite' className='mx-4 mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#d61f00] sm:mx-0'>{error}</div>}

            <section className='px-4 pb-16 pt-2 sm:px-0 sm:pb-20 sm:pt-0'>
              <div className='flex flex-col-reverse items-center justify-between gap-6 sm:flex-row'>
                <p className='flex-1 text-center text-sm leading-5 text-[#30333a] sm:mr-6 sm:text-left'>Đăng ký với Maian Homes để giao dịch nhanh hơn và tiết kiệm thời gian với những dịch vụ chất lượng cao. Chúng tôi sẽ liên hệ tư vấn sau khi tiếp nhận thông tin.</p>
                <button type='submit' disabled={isSubmitting} className='flex w-full shrink-0 items-center justify-center gap-2 rounded bg-[#c72528] px-8 py-3 text-base font-semibold leading-6 text-white transition hover:bg-[#a91f22] disabled:cursor-wait disabled:opacity-70 sm:w-auto'>
                  {isSubmitting ? <><Loader2 className='h-5 w-5 animate-spin' />Đang gửi ...</> : 'Gửi thông tin'}
                </button>
              </div>
              <p className='mt-5 text-center text-xs text-[#838383] sm:text-left'>Khi gửi thông tin, bạn đồng ý với <Link href='/chinh-sach-bao-mat' aria-label="Đọc chính sách bảo mật thông tin khách hàng" className='underline'>Chính sách bảo mật</Link> của Maian Homes.</p>
            </section>
          </form>
        </div>
      </section>

      <section className='bg-[#17130F] py-20 text-white'>
        <div className='mx-auto max-w-7xl px-5 lg:px-8'>
          <p className='text-xs font-bold uppercase tracking-[0.3em] text-[#D6B25E]'>Quy trình rõ ràng</p>
          <h2 className='mt-3 font-serif text-3xl font-bold text-[#F5E8C7] sm:text-4xl'>Từ ký gửi đến giao dịch</h2>
          <div className='mt-10 grid gap-5 md:grid-cols-4'>
            {[
              ['01', 'Tiếp nhận', 'Gửi thông tin và hình ảnh trực tuyến.'],
              ['02', 'Thẩm định', 'Xác minh tài sản và tư vấn mức giá.'],
              ['03', 'Tiếp thị', 'Chuẩn hóa nội dung, tiếp cận khách phù hợp.'],
              ['04', 'Hoàn tất', 'Đàm phán, đặt cọc và hỗ trợ pháp lý.'],
            ].map(([number, title, copy]) => <div key={number} className='border-t border-white/15 pt-5'><span className='font-serif text-4xl font-bold text-[#D6B25E]/55'>{number}</span><h3 className='mt-4 font-semibold text-[#F5E8C7]'>{title}</h3><p className='mt-2 text-sm leading-6 text-white/55'>{copy}</p></div>)}
          </div>
        </div>
      </section>

      <section className='bg-white py-20'>
        <div className='mx-auto max-w-7xl px-5 lg:px-8'>
          <div className='mx-auto max-w-3xl text-center'>
            <p className='text-sm font-bold uppercase tracking-[0.1em] text-[#9C742E]'>Minh bạch chi phí</p>
            <h2 className='mt-3 font-serif text-3xl font-bold sm:text-4xl'>Bảng phí dịch vụ ký gửi</h2>
            <p className='mt-4 text-sm leading-6 text-stone-500'>
              Chỉ phát sinh phí khi giao dịch thành công. Không phụ phí phát sinh.
            </p>

            <div className='mt-8 space-y-4 text-stone-700'>
              <div className='flex items-center justify-between rounded-xl bg-stone-50 p-4 border border-stone-100'>
                <div>
                  <p className='font-bold text-[#1e160d] text-base'>Phí môi giới Bán</p>
                  <p className='text-xs text-stone-400'>Theo giá trị thực tế giao dịch</p>
                </div>
                <span className='text-sm font-bold text-[#c72528]'>1% - 3%</span>
              </div>

              <div className='flex items-center justify-between rounded-xl bg-stone-50 p-4 border border-stone-100'>
                <div>
                  <p className='font-bold text-[#1e160d] text-base'>Phí môi giới Cho thuê</p>
                  <p className='text-xs text-stone-400'>Hợp đồng tối thiểu 1 năm</p>
                </div>
                <span className='text-sm font-bold text-[#c72528]'>1 tháng</span>
              </div>
            </div>
          </div>
          
          <div className='mt-10 mx-auto max-w-4xl grid md:grid-cols-2 gap-6'>
            <div className='bg-white border border-stone-200 rounded-xl p-6 sm:p-8 shadow-[0_8px_20px_rgba(0,0,0,.05)] hover:shadow-[0_12px_24px_rgba(0,0,0,.08)] hover:border-[#c72528]/30 transition-all flex flex-col justify-between group'>
              <div>
                <h3 className='text-lg sm:text-xl font-bold text-[#30333a] mb-3 group-hover:text-[#c72528] transition-colors'>Giao dịch Mua Bán</h3>
                <p className='text-sm leading-6 text-stone-500 mb-6'>
                  Phí dịch vụ môi giới được tính dựa trên giá trị giao dịch thực tế, tùy thuộc vào loại hình tài sản và sự thỏa thuận giữa các bên.
                </p>
              </div>
              <div className='bg-[#f9f9f9] rounded-lg p-5 flex items-center justify-between border border-stone-100'>
                <span className='text-sm font-medium text-stone-600'>Chuyển nhượn căn hộ</span>
              </div>
              <div className='bg-[#f9f9f9] rounded-lg p-5 flex items-center justify-between border border-stone-100'>
                <span className='text-sm font-medium text-stone-600'>Mức phí tham khảo</span>
                <span className='text-s font-bold text-[#c72528]'>1% - 3%</span>
              </div>
              <div className='bg-[#f9f9f9] rounded-lg p-5 flex items-center justify-between border border-stone-100'>
                <span className='text-sm font-medium text-stone-600'>Thẩm định giá trị chuyển nhượng</span>
              </div>
              <div className='bg-[#f9f9f9] rounded-lg p-5 flex items-center justify-between border border-stone-100'>
                <span className='text-sm font-medium text-stone-600'>Đăng tin Vip Trên Các Nền Tảng</span>
              </div>
            </div>

            <div className='bg-white border border-stone-200 rounded-xl p-6 sm:p-8 shadow-[0_8px_20px_rgba(0,0,0,.05)] hover:shadow-[0_12px_24px_rgba(0,0,0,.08)] hover:border-[#c72528]/30 transition-all flex flex-col justify-between group'>
              <div>
                <h3 className='text-lg sm:text-xl font-bold text-[#30333a] mb-3 group-hover:text-[#c72528] transition-colors'>Giao dịch Cho thuê</h3>
                <p className='text-sm leading-6 text-stone-500 mb-6'>
                  Áp dụng đối với các hợp đồng cho thuê bất động sản dài hạn có thời hạn dài từ 6 tháng - 1 năm trở lên.
                </p>
              </div>
              <div className='bg-[#f9f9f9] rounded-lg p-5 flex items-center justify-between border border-stone-100'>
                <span className='text-sm font-medium text-stone-600'>Quản lý vận hành bất động sản cho thuê</span>
              </div>
              <div className='bg-[#f9f9f9] rounded-lg p-5 flex items-center justify-between border border-stone-100'>
                <span className='text-sm font-medium text-stone-600'>Cho thuê dài hạn từ 6 tháng - 1 năm</span>
              </div>
              <div className='bg-[#f9f9f9] rounded-lg p-5 flex items-center justify-between border border-stone-100'>
                <span className='text-sm font-medium text-stone-600'>Mức phí tham khảo</span>
                <span className='text-s font-bold text-[#c72528]'>1 tháng</span>
              </div>
              <div className='bg-[#f9f9f9] rounded-lg p-5 flex items-center justify-between border border-stone-100'>
                <span className='text-sm font-medium text-stone-600'>Soạn thảo hợp đồng thuê song ngữ</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className='bg-[#FAF9F5] py-20'>
        <div className='mx-auto max-w-4xl px-5'>
          <p className='text-center text-xs font-bold uppercase tracking-[0.3em] text-[#9C742E]'>Giải đáp nhanh</p>
          <h2 className='mt-3 text-center font-serif text-3xl font-bold sm:text-4xl'>Câu hỏi thường gặp</h2>
          <div className='mt-10 divide-y divide-stone-200 border-y border-stone-200'>
            {faqs.map((faq, index) => <div key={faq.question}><button type='button' onClick={() => setOpenFaq(openFaq === index ? null : index)} aria-expanded={openFaq === index} className='flex w-full items-center justify-between gap-5 py-5 text-left font-semibold'><span>{faq.question}</span><ChevronDown className={`h-5 w-5 shrink-0 transition ${openFaq === index ? 'rotate-180 text-[#B58B3B]' : 'text-stone-400'}`} /></button>{openFaq === index && <p className='pb-5 pr-10 text-sm leading-7 text-stone-500'>{faq.answer}</p>}</div>)}
          </div>
        </div>
      </section>

      {showImageStandards && (
        <div
          className='fixed inset-0 z-[100] flex items-center justify-center bg-black/55 px-4 py-8'
          role='presentation'
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowImageStandards(false);
          }}
        >
          <section
            role='dialog'
            aria-modal='true'
            aria-labelledby='image-standards-title'
            className='relative w-full max-w-[420px] rounded-2xl bg-white p-4 sm:p-5 text-[#30333a] shadow-2xl'
          >
            <button
              type='button'
              onClick={() => setShowImageStandards(false)}
              aria-label='Đóng tiêu chuẩn hình ảnh'
              className='absolute right-3 top-3 sm:right-4 sm:top-4 flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900 transition cursor-pointer'
            >
              <X className='h-4 w-4' />
            </button>
            <h2 id='image-standards-title' className='pr-8 font-serif text-base sm:text-lg font-bold leading-snug'>Tiêu chuẩn hình ảnh</h2>

            <ul className='mt-3 list-disc space-y-2 pl-4 text-xs sm:text-sm leading-relaxed text-[#30333a] marker:text-[#c72528]'>
              <li>Hình ảnh KHÔNG chứa thông tin liên hệ, logo của các thương hiệu khác.</li>
              <li>Hình ảnh rõ nét, không có đường viền.</li>
              <li>Chụp đầy đủ các khu vực phòng (phòng khách, phòng bếp, phòng ngủ, phòng tắm...), ảnh mặt tiền căn nhà, sơ đồ thửa đất (trang 3 sổ hồng).</li>
            </ul>
          </section>
        </div>
      )}
    </main>
  );
}
