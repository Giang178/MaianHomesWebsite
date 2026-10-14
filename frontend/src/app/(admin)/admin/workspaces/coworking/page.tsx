import { Metadata } from 'next';
import { WorkspaceAdminHub } from '@/features/workspaces/admin/WorkspaceAdminHub';

export const metadata: Metadata = {
  title: 'Quản trị Co-working Space | Maian Homes Admin',
  description: 'Quản trị địa điểm, gói cước, chỗ ngồi và tiện ích Co-working Space.',
};

export default function CoworkingAdminPage() {
  return <WorkspaceAdminHub initialTab="coworking" />;
}
