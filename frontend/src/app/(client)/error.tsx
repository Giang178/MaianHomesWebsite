'use client';

import RouteErrorState from '@/components/system/RouteErrorState';

export default function ClientRouteError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteErrorState {...props} />;
}
