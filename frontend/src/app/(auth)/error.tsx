'use client';

import RouteErrorState from '@/components/system/RouteErrorState';

export default function AuthRouteError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteErrorState {...props} title="Không thể mở trang đăng nhập" />;
}
