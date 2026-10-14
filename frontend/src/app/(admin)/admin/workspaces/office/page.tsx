import { Metadata } from 'next';
import { WorkspaceAdminHub } from '@/features/workspaces/admin/WorkspaceAdminHub';

export const metadata: Metadata = {
  title: 'Quản trị Văn Phòng Cho Thuê | Maian Homes Admin',
  description: 'Quản trị tòa nhà văn phòng, bảng diện tích sàn trống và nội dung dịch vụ.',
};

export default function OfficeAdminPage() {
  return <WorkspaceAdminHub initialTab="office" />;
}
