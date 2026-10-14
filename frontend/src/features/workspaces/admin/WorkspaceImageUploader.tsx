'use client';

import { useState, useRef } from 'react';
import { workspaceApi } from '../api';
import { generateSingleAltText } from '../utils/aiAltGenerator';
import {
  Upload,
  X,
  Star,
  RefreshCw,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

interface WorkspaceImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxFiles?: number;
  label?: string;
  description?: string;
  altText?: string;
  onAltTextChange?: (alt: string) => void;
  altLabel?: string;
  altPlaceholder?: string;
  requireAlt?: boolean;
  entityName?: string;
  district?: string;
  city?: string;
  category?: 'building' | 'office' | 'coworking' | 'grade' | 'general';
}

export function WorkspaceImageUploader({
  images = [],
  onChange,
  maxFiles = 20,
  label = 'Hình ảnh tòa nhà văn phòng',
  description = 'Tải ảnh thực tế (mặt tiền, sảnh lễ tân, sàn làm việc, hầm xe). Định dạng: JPG, PNG, WEBP (tối đa 50MB/ảnh).',
  altText = '',
  onAltTextChange,
  altLabel,
  altPlaceholder,
  requireAlt = false,
  entityName,
  district,
  city,
  category = 'office',
}: WorkspaceImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAiSuggestAlt = () => {
    if (!onAltTextChange) return;
    const generated = generateSingleAltText({
      entityName: entityName || label || 'Văn phòng',
      district,
      city,
      category,
      isPrimary: true,
      existingAlts: altText ? [altText] : [],
    });
    onAltTextChange(generated);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploading(true);

    const uploadedUrls: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) {
          setUploadError(`File "${file.name}" không phải là ảnh hợp lệ.`);
          continue;
        }
        if (file.size > 50 * 1024 * 1024) {
          setUploadError(`File "${file.name}" vượt quá giới hạn 50MB.`);
          continue;
        }

        const res = await workspaceApi.uploadImage(file);
        if (res?.url) {
          uploadedUrls.push(res.url);
        }
      }

      if (uploadedUrls.length > 0) {
        if (maxFiles === 1) {
          onChange([uploadedUrls[uploadedUrls.length - 1]]);
          // Tự động sinh Alt Text nếu chưa có
          if (onAltTextChange && (!altText || altText.trim() === '')) {
            const autoAlt = generateSingleAltText({
              entityName: entityName || label || 'Văn phòng cho thuê',
              district,
              city,
              category,
              isPrimary: true,
            });
            onAltTextChange(autoAlt);
          }
        } else {
          onChange([...images, ...uploadedUrls].slice(0, maxFiles));
        }
      }
    } catch (err) {
      setUploadError('Tải ảnh thất bại: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = (indexToRemove: number) => {
    onChange(images.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSetPrimary = (indexToPrimary: number) => {
    if (indexToPrimary === 0) return;
    const selected = images[indexToPrimary];
    const filtered = images.filter((_, idx) => idx !== indexToPrimary);
    onChange([selected, ...filtered]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-xs font-semibold text-zinc-900">{label}</label>
          {description && <p className="text-[11px] text-zinc-500">{description}</p>}
        </div>
        {maxFiles > 1 && (
          <span className="text-xs text-zinc-500 font-medium">
            {images.length} / {maxFiles} ảnh
          </span>
        )}
      </div>

      {uploadError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple={maxFiles > 1}
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Single Image Mode with existing image */}
      {maxFiles === 1 && images.length > 0 && !uploading ? (
        <div className="space-y-3">
          <div className="relative rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-900 aspect-[21/9] max-h-56 group shadow-sm">
            <img
              src={images[0]}
              alt={altText || 'Ảnh tải lên'}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-zinc-900 hover:bg-[#D4AF37] hover:text-white text-xs font-semibold transition-colors shadow-lg"
              >
                <Upload className="w-4 h-4" /> Thay đổi ảnh
              </button>
              <button
                type="button"
                onClick={() => onChange([])}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 text-xs font-semibold transition-colors shadow-lg"
              >
                <X className="w-4 h-4" /> Xóa ảnh
              </button>
            </div>
          </div>

          {onAltTextChange && (
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-zinc-800">
                  {altLabel || 'Văn bản thay thế (Alt text SEO)'}
                  {requireAlt && <span className="text-red-500 ml-1">*</span>}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAiSuggestAlt}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-[#AA820A] bg-amber-50 hover:bg-amber-100 border border-amber-300 transition-colors shadow-xs"
                    title="AI tự động tạo Alt text chuẩn SEO tối ưu"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#AA820A]" /> AI sinh Alt text
                  </button>
                  <span
                    className={`text-[10px] font-semibold ${
                      (altText || '').length > 0 ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {(altText || '').length} ký tự
                  </span>
                </div>
              </div>
              <input
                type="text"
                value={altText || ''}
                onChange={(e) => onAltTextChange(e.target.value)}
                placeholder={altPlaceholder || 'Nhập mô tả hình ảnh cho công cụ tìm kiếm và trợ năng...'}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37] bg-white"
              />
              <p className="text-[11px] text-zinc-500">
                Thẻ alt giúp Google lập chỉ mục hình ảnh và tăng thứ hạng tìm kiếm SEO cho văn phòng.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Dropzone & Upload Button */
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleFiles(e.dataTransfer.files);
          }}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
            uploading
              ? 'border-[#D4AF37] bg-amber-50/40 pointer-events-none'
              : 'border-zinc-300 hover:border-[#D4AF37] bg-zinc-50/60 hover:bg-amber-50/20'
          }`}
        >
          {uploading ? (
            <div className="flex flex-col items-center justify-center py-2">
              <RefreshCw className="w-8 h-8 animate-spin text-[#D4AF37] mb-2" />
              <p className="text-xs font-semibold text-zinc-800">Đang xử lý & tải ảnh lên hệ thống...</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Tự động tối ưu hóa WebP/AVIF độ nét cao</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-2">
              <div className="w-12 h-12 rounded-full bg-[#D4AF37]/15 text-[#AA820A] flex items-center justify-center mb-3">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-zinc-900">
                Nhấn để chọn ảnh từ máy tính hoặc kéo thả ảnh vào đây
              </p>
              <p className="text-[11px] text-zinc-500 mt-1">
                {maxFiles > 1
                  ? 'Hỗ trợ chọn nhiều ảnh cùng lúc • Tối đa 50MB/file'
                  : 'Định dạng JPG, PNG, WEBP • Tối đa 50MB'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Thumbnails Grid (Multiple files mode) */}
      {maxFiles > 1 && images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 pt-2">
          {images.map((imgUrl, index) => {
            const isPrimary = index === 0;
            return (
              <div
                key={index}
                className={`relative group rounded-xl overflow-hidden border bg-zinc-900 aspect-video transition-all shadow-sm ${
                  isPrimary
                    ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/50'
                    : 'border-zinc-200 hover:border-zinc-400'
                }`}
              >
                <img
                  src={imgUrl}
                  alt={`Ảnh ${index + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Primary Badge */}
                {isPrimary && (
                  <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-[#D4AF37] text-white text-[10px] font-bold shadow flex items-center gap-1 z-10">
                    <Star className="w-3 h-3 fill-white" /> Ảnh chính
                  </span>
                )}

                {/* Hover Actions Overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
                  {!isPrimary && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetPrimary(index);
                      }}
                      title="Đặt làm ảnh đại diện chính"
                      className="p-1.5 rounded-lg bg-white/90 text-zinc-800 hover:bg-[#D4AF37] hover:text-white transition-colors"
                    >
                      <Star className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(index);
                    }}
                    title="Xóa ảnh này"
                    className="p-1.5 rounded-lg bg-red-600/90 text-white hover:bg-red-700 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
