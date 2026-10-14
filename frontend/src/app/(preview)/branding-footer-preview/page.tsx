import type { Metadata } from 'next';

import BrandingFooterPreviewClient from './PreviewClient';

export const metadata: Metadata = {
  title: 'Mô phỏng Footer',
  robots: { index: false, follow: false },
};

export default function BrandingFooterPreviewPage() {
  return <BrandingFooterPreviewClient />;
}
