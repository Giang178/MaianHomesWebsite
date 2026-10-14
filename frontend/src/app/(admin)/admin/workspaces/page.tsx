import { Metadata } from 'next';
import { WorkspaceAdminHub } from '@/features/workspaces/admin/WorkspaceAdminHub';

export const metadata: Metadata = {
  title: 'Quản trị Dịch vụ (Workspaces) | Maian Homes Admin',
  description: 'Quản trị dịch vụ Co-working Space và Maian Office — Maian Homes.',
};

export default function WorkspacesAdminPage() {
  return <WorkspaceAdminHub initialTab="coworking" />;
}
