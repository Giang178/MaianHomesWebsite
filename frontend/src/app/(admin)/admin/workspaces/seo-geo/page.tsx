import { Metadata } from 'next';
import { WorkspaceAdminHub } from '@/features/workspaces/admin/WorkspaceAdminHub';

export const metadata: Metadata = {
  title: 'Kiểm toán SEO & GEO | Maian Homes Admin',
  description: 'Kiểm tra tín hiệu SEO, NAP consistency và cấu trúc Schema.org cho AI Answer Engines.',
};

export default function SeoGeoAdminPage() {
  return <WorkspaceAdminHub initialTab="seo-geo" />;
}
