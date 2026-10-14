// BASE_URL dùng cho API Proxy (đi qua Next.js Server)
const BASE_URL = '/api';

// ASSET_URL dùng trực tiếp địa chỉ Backend để lấy ảnh/file tĩnh
const ASSET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
const isDev = process.env.NODE_ENV === 'development';
const REQUEST_TIMEOUT_MS = 60_000;

function createTimeoutReason(): Error {
  const reason = new Error('API request timed out');
  reason.name = 'TimeoutError';
  return reason;
}

export function getAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;

  // Media API nội bộ phải đi qua proxy cùng origin. Nếu đổi thành URL
  // 127.0.0.1 tuyệt đối, Next Image sẽ từ chối tối ưu và máy khách production
  // cũng không thể truy cập backend qua loopback của chính họ.
  if (path.startsWith('/api/') || path.startsWith('api/')) {
    return path.startsWith('/') ? path : `/${path}`;
  }

  // Nếu là file tĩnh tải lên (/uploads/), sử dụng đường dẫn tương đối để Next.js Proxy Rewrite tự xử lý ở Client
  if (path.startsWith('/uploads') || path.startsWith('images')) {
    return path.startsWith('/') ? path : `/${path}`;
  }

  // Nếu là file tĩnh của Frontend (/images/), không gắn thêm Backend URL
  if (path.startsWith('/images') || path.startsWith('images')) {
    return path.startsWith('/') ? path : `/${path}`;
  }

  const cleanBase = ASSET_URL.endsWith('/') ? ASSET_URL.slice(0, -1) : ASSET_URL;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

let isRedirectingToLogin = false;
export const SESSION_EXPIRED_EVENT = 'maian:session-expired';

export function shouldRedirectExpiredSession(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

function sessionExpiredError(response: Response): Error {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('maian_user');
    if (typeof document !== 'undefined') {
      document.cookie = 'maian_logged_in=; path=/; max-age=0; SameSite=Lax';
    }
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));

    if (shouldRedirectExpiredSession(window.location.pathname) && !isRedirectingToLogin) {
      isRedirectingToLogin = true;
      window.location.assign('/login?session=expired');
    }
  }

  const error = new Error('Phiên làm việc hết hạn. Vui lòng đăng nhập lại.');
  const metadata = error as Error & {status?: number; code?: string; requestId?: string};
  metadata.status = 401;
  metadata.code = 'SESSION_EXPIRED';
  metadata.requestId = response.headers.get('x-request-id') || undefined;
  return error;
}

const DEFAULT_CLIENT_TIMEOUT_MS = 35_000;
const DEFAULT_SERVER_TIMEOUT_MS = 12_000;

export async function apiFetch(endpoint: string, options: RequestInit = {}, type: 'public' | 'protected' = 'protected') {
  const prefix = type === 'public' ? '/public' : '/protected';
  const isServer = typeof window === 'undefined';
  const serverOrigin = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
  const url = isServer ? `${serverOrigin}/api${prefix}${endpoint}` : `${BASE_URL}${prefix}${endpoint}`;

  // Gắn credentials: 'include' để tự động gửi HttpOnly cookie và giữ fallback Bearer Token
  const defaultOptions: RequestInit = {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  let response: Response;
  const controller = options.signal ? null : new AbortController();
  let didTimeout = false;
  const timeoutMs = isServer ? DEFAULT_SERVER_TIMEOUT_MS : DEFAULT_CLIENT_TIMEOUT_MS;
  const timeout = controller
    ? globalThis.setTimeout(() => {
        didTimeout = true;
        controller.abort(createTimeoutReason());
      }, timeoutMs)
    : null;
  if (controller) defaultOptions.signal = controller.signal;
  try {
    if (isDev) console.log(`[API ${type.toUpperCase()}] ${options.method || 'GET'} ${url}`);
    response = await fetch(url, defaultOptions);
  } catch (err) {
    // Abort do component/unmount phải được giữ nguyên để caller có thể bỏ qua nó.
    if (options.signal?.aborted) {
      throw err;
    }

    if (isDev) {
      if (didTimeout) {
        // A handled timeout is an expected transport failure. Passing the
        // TimeoutError object to console.error makes the Next.js dev overlay
        // report it as an unhandled application error.
        console.warn(`[API ${type.toUpperCase()}] ${options.method || 'GET'} ${endpoint} timed out after ${timeoutMs}ms`);
      } else {
        console.error('API network error:', err);
      }
    }
    const networkError = new Error(didTimeout
      ? 'Máy chủ phản hồi quá chậm. Vui lòng thử lại.'
      : 'Lỗi kết nối máy chủ. Đảm bảo Backend (port 8000) đang chạy.');
    const metadata = networkError as Error & { status?: number; code?: string };
    metadata.status = 0;
    metadata.code = didTimeout ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR';
    throw networkError;
  } finally {
    if (timeout !== null) globalThis.clearTimeout(timeout);
  }

  if (response.status === 401 && type === 'protected') {
    throw sessionExpiredError(response);
  }

  if (!response.ok) {
    const error: { detail?: unknown } = await response.json().catch(() => ({ detail: `Lỗi hệ thống (${response.status})` }));
    const detail = error.detail;
    const structuredDetail = typeof detail === 'object' && detail !== null && !Array.isArray(detail)
      ? detail as { code?: unknown; message?: unknown; current_version?: unknown; warning_codes?: unknown; score?: unknown; errors?: unknown; warnings?: unknown }
      : null;

    let errorMsg = 'Lỗi không xác định';
    if (typeof detail === 'string') {
      errorMsg = detail;
    } else if (structuredDetail && typeof structuredDetail.message === 'string' && structuredDetail.message.trim()) {
      errorMsg = structuredDetail.message;
    } else if (structuredDetail && (Array.isArray(structuredDetail.errors) || Array.isArray(structuredDetail.warnings))) {
      const issueMessages: string[] = [];
      if (Array.isArray(structuredDetail.errors)) {
        for (const item of structuredDetail.errors) {
          if (typeof item === 'object' && item !== null && typeof (item as { message?: unknown }).message === 'string') {
            issueMessages.push((item as { message: string }).message);
          }
        }
      }
      if (issueMessages.length === 0 && Array.isArray(structuredDetail.warnings)) {
        for (const item of structuredDetail.warnings) {
          if (typeof item === 'object' && item !== null && typeof (item as { message?: unknown }).message === 'string') {
            issueMessages.push((item as { message: string }).message);
          }
        }
      }
      if (issueMessages.length > 0) {
        errorMsg = issueMessages.join(' ');
      } else if (structuredDetail.code === 'QUALITY_WARNINGS_REQUIRE_CONFIRMATION') {
        errorMsg = 'Dữ liệu dự án còn cảnh báo chất lượng cần được xác nhận.';
      } else if (structuredDetail.code === 'QUALITY_GATE_FAILED') {
        errorMsg = 'Dự án chưa đáp ứng tiêu chuẩn kiểm duyệt chất lượng.';
      } else {
        errorMsg = JSON.stringify(detail);
      }
    } else if (Array.isArray(detail) && detail.length > 0) {
      const messages = detail
        .map((item) => {
          if (typeof item === 'object' && item !== null && 'msg' in item) {
            const msg = (item as { msg?: unknown }).msg;
            return typeof msg === 'string' ? msg : null;
          }
          return null;
        })
        .filter((msg): msg is string => Boolean(msg));
      errorMsg = messages.length > 0 ? messages.join(', ') : JSON.stringify(detail);
    } else if (detail !== undefined) {
      errorMsg = typeof detail === 'object' && detail !== null && 'message' in detail && typeof (detail as { message?: unknown }).message === 'string'
        ? (detail as { message: string }).message
        : JSON.stringify(detail);
    }
    if (response.status === 429) {
      errorMsg = 'Bạn đang thao tác quá nhanh. Vui lòng chờ 1 phút.';
    } else if (errorMsg === 'fetch failed' || errorMsg.includes('Failed to fetch')) {
      errorMsg = 'Lỗi kết nối máy chủ. Đảm bảo Backend đang hoạt động.';
    }

    const apiError = new Error(errorMsg || `Lỗi API: ${response.status}`);
    const metadata = apiError as Error & {
      status?: number;
      requestId?: string;
      code?: string;
      currentVersion?: number;
      warningCodes?: string[];
      validation?: { score: number; errors: unknown[]; warnings: unknown[] };
      issues?: Array<{ code?: string; field?: string; message?: string }>;
    };
    metadata.status = response.status;
    metadata.requestId = response.headers.get('x-request-id') || undefined;
    metadata.code = typeof structuredDetail?.code === 'string'
      ? structuredDetail.code
      : response.status === 409
        ? 'VERSION_CONFLICT'
        : response.status === 429
          ? 'RATE_LIMITED'
          : response.status === 503 ? 'SERVICE_UNAVAILABLE' : undefined;
    metadata.currentVersion = typeof structuredDetail?.current_version === 'number'
      ? structuredDetail.current_version
      : undefined;
    metadata.warningCodes = Array.isArray(structuredDetail?.warning_codes)
      ? structuredDetail.warning_codes.filter((code): code is string => typeof code === 'string')
      : undefined;
    if (
      typeof structuredDetail?.score === 'number'
      && Array.isArray(structuredDetail.errors)
      && Array.isArray(structuredDetail.warnings)
    ) {
      metadata.validation = {
        score: structuredDetail.score,
        errors: structuredDetail.errors,
        warnings: structuredDetail.warnings,
      };
    }
    if (Array.isArray(structuredDetail?.errors)) {
      metadata.issues = structuredDetail.errors.filter(
        (item): item is { code?: string; field?: string; message?: string } => typeof item === 'object' && item !== null,
      );
    }
    throw apiError;
  }

  if (response.status === 204) return null;

  return response.json();
}

export async function apiUpload(endpoint: string, formData: FormData) {
  const url = `${BASE_URL}/protected${endpoint}`;
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: {},
      signal: controller.signal,
    });
  } catch {
    throw new Error('Lỗi tải file. Vui lòng thử lại.');
  } finally {
    globalThis.clearTimeout(timeout);
  }
  if (response.status === 401) throw sessionExpiredError(response);
  if (!response.ok) {
    const error: { detail?: unknown; message?: unknown } = await response.json().catch(() => ({ detail: `Lỗi tải file (${response.status})` }));
    const detail = error.detail;
    let errorMsg = typeof error.message === 'string' ? error.message : '';
    if (!errorMsg) {
      if (typeof detail === 'string') {
        errorMsg = detail;
      } else if (typeof detail === 'object' && detail !== null) {
        if ('message' in detail && typeof (detail as { message?: unknown }).message === 'string') {
          errorMsg = (detail as { message: string }).message;
        } else if (Array.isArray(detail) && detail.length > 0) {
          const messages = detail
            .map((item) => (typeof item === 'object' && item !== null && 'msg' in item ? String((item as { msg?: unknown }).msg) : null))
            .filter((msg): msg is string => Boolean(msg));
          errorMsg = messages.length > 0 ? messages.join(', ') : 'Dữ liệu tải file không hợp lệ';
        } else {
          errorMsg = JSON.stringify(detail);
        }
      }
    }
    throw new Error(errorMsg || `Tải file thất bại (${response.status})`);
  }
  return response.json();
}

export async function apiUploadPublic(
  endpoint: string,
  formData: FormData,
  idempotencyKey?: string,
) {
  const url = `${BASE_URL}/public${endpoint}`;
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new Error('Không thể kết nối máy chủ. Vui lòng thử lại.');
  } finally {
    globalThis.clearTimeout(timeout);
  }
  if (!response.ok) {
    const error: { detail?: unknown; message?: unknown } = await response.json().catch(() => ({ detail: 'Tải hồ sơ thất bại' }));
    const detail = error.detail;
    let errorMsg = typeof error.message === 'string' ? error.message : '';
    if (!errorMsg) {
      if (typeof detail === 'string') {
        errorMsg = detail;
      } else if (typeof detail === 'object' && detail !== null) {
        if ('message' in detail && typeof (detail as { message?: unknown }).message === 'string') {
          errorMsg = (detail as { message: string }).message;
        } else if (Array.isArray(detail) && detail.length > 0) {
          const messages = detail
            .map((item) => (typeof item === 'object' && item !== null && 'msg' in item ? String((item as { msg?: unknown }).msg) : null))
            .filter((msg): msg is string => Boolean(msg));
          errorMsg = messages.length > 0 ? messages.join(', ') : 'Dữ liệu không hợp lệ';
        }
      }
    }
    throw new Error(errorMsg || 'Thông tin tải lên không hợp lệ');
  }
  return response.json();
}
