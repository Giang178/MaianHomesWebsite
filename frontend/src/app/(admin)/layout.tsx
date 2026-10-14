import type { Metadata } from 'next';
import AdminClientLayout from './AdminClientLayout';
import { AdminDialogProvider } from '@/components/admin/AdminDialogProvider';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminServerLayout({ children }: { children: React.ReactNode }) {
  return <AdminDialogProvider><AdminClientLayout>{children}</AdminClientLayout></AdminDialogProvider>;
}
