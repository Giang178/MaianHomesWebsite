'use client';

import RouteErrorState from '@/components/system/RouteErrorState';

export default function AdminRouteError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteErrorState {...props} title="Khu vực quản trị tạm thời chưa khả dụng" />;
}
