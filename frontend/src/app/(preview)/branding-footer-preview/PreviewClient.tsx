'use client';

import { useEffect, useState } from 'react';

import { FooterView } from '@/components/layout/Footer';
import type { PublicContactSettings } from '@/features/contact/types';
import type { PublicSiteSettings } from '@/features/website/public/site-settings';

type PreviewPayload = {
  type: 'branding-footer-preview';
  contact: PublicContactSettings;
  siteSettings: PublicSiteSettings;
};

function isPreviewPayload(value: unknown): value is PreviewPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<PreviewPayload>;
  return payload.type === 'branding-footer-preview'
    && Boolean(payload.contact)
    && Boolean(payload.siteSettings);
}

export default function BrandingFooterPreviewClient() {
  const [payload, setPayload] = useState<PreviewPayload | null>(null);

  useEffect(() => {
    const receivePreview = (event: MessageEvent<unknown>) => {
      if (event.origin !== window.location.origin || !isPreviewPayload(event.data)) return;
      setPayload(event.data);
    };

    window.addEventListener('message', receivePreview);
    window.parent.postMessage({ type: 'branding-footer-preview-ready' }, window.location.origin);
    return () => window.removeEventListener('message', receivePreview);
  }, []);

  if (!payload) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[#14110E] px-6 text-center text-sm text-[#F3E6C6]/75"
        aria-label="Đang tải mô phỏng Footer"
      >
        Đang đồng bộ dữ liệu xem trước…
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#14110E]"
      onClickCapture={(event) => {
        if ((event.target as HTMLElement).closest('a')) event.preventDefault();
      }}
    >
      <FooterView
        forceShow
        contact={payload.contact}
        siteSettings={payload.siteSettings}
      />
    </div>
  );
}
