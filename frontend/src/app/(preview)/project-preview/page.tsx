import type { Metadata } from 'next';
import ProjectPreviewClient from './PreviewClient';

export const metadata: Metadata = {
  title: 'Xem trước dự án',
  robots: { index: false, follow: false },
};

export default function ProjectPreviewPage() {
  return <ProjectPreviewClient />;
}

