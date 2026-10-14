import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8000';
const TRUSTED_PROXY_HEADERS = (process.env.TRUSTED_PROXY_HEADERS || '').toLowerCase() === 'true';
const FALLBACK_CLIENT_IP = process.env.PROXY_FALLBACK_CLIENT_IP || '127.0.0.1';
const BACKEND_PROXY_TIMEOUT_MS = Number(process.env.BACKEND_PROXY_TIMEOUT_MS || 60_000);

function getClientIp(request: NextRequest) {
  let ip: string | undefined;

  if (TRUSTED_PROXY_HEADERS) {
    ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || undefined;
  }

  // Fallback to Next.js built-in IP tracking or predefined fallback
  const nextRequestIp = (request as NextRequest & {ip?: string}).ip;
  return ip || nextRequestIp || FALLBACK_CLIENT_IP;
}

/**
 * Enterprise Proxy Gateway for Maian Homes
 * Handles body forwarding, header sanitation, and Set-Cookie preservation.
 */
async function handleProxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  
  // Strip '/api' from the beginning of the pathname to match backend routes
  // Example: /api/v1/public/auth/login -> http://127.0.0.1:8000/api/v1/public/auth/login
  const targetUrl = `${BACKEND_URL}${pathname}${search}`;

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Proxy] Forwarding: ${request.method} ${pathname} -> ${targetUrl}`);
  }

  // 1. Prepare Request Headers (Sanitize to avoid conflicts)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete('host');
  requestHeaders.delete('content-length');

  // Hop-by-hop connection headers belong to the runtime/proxy transport.
  requestHeaders.delete('connection');
  requestHeaders.delete('upgrade');

  const clientIp = getClientIp(request);
  requestHeaders.set('X-Forwarded-For', clientIp);

  // Trích xuất Cookie qua API chuyên dụng của NextRequest
  // (request.headers.get('cookie') không đáng tin cậy trong Server Component)
  const cookies = request.cookies.getAll();
  const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  if (cookieString) {
    requestHeaders.set('cookie', cookieString);
  }

  try {
    // Stream uploads to the backend instead of buffering up to 96 MiB per
    // request inside the Next.js process.
    const fetchOptions: RequestInit & {duplex?: 'half'} = {
      method: request.method,
      headers: requestHeaders,
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(BACKEND_PROXY_TIMEOUT_MS),
    };
    if (request.method !== 'GET' && request.method !== 'HEAD' && request.body) {
      fetchOptions.body = request.body;
      fetchOptions.duplex = 'half';
    }

    const backendResponse = await fetch(targetUrl, fetchOptions);

    // 3. Create Proxy Response (Null body for 204, 205, 304 to prevent Node/Edge runtime crash)
    const hasNullBody = backendResponse.status === 204 || backendResponse.status === 205 || backendResponse.status === 304;
    const proxyResponse = new NextResponse(hasNullBody ? null : backendResponse.body, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
    });

    // 4. Forward Backend Headers (filtering out problematic ones & skipping set-cookie handled below)
    backendResponse.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      // Skip headers that fetch or browser handles automatically, and skip set-cookie to prevent duplication
      if (lowerKey !== 'content-encoding' && lowerKey !== 'content-length' && lowerKey !== 'set-cookie') {
        // Fix CORS/Network issues on 307/308 Redirects from FastAPI (trailing slash issue)
        if (lowerKey === 'location' && value.startsWith(BACKEND_URL)) {
          value = value.replace(BACKEND_URL, '');
        }
        proxyResponse.headers.set(key, value);
      }
    });

    // 5. CRITICAL: Preserve Set-Cookie headers from Backend without duplication
    const setCookies = typeof backendResponse.headers.getSetCookie === 'function'
      ? backendResponse.headers.getSetCookie()
      : [backendResponse.headers.get('set-cookie')].filter(Boolean) as string[];
      
    setCookies.forEach((cookie) => {
      proxyResponse.headers.append('Set-Cookie', cookie);
    });

    return proxyResponse;

  } catch (error) {
    const isTimeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError' || (error as unknown as { cause?: { code?: string } })?.cause?.code === 'UND_ERR_HEADERS_TIMEOUT');
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[Proxy Error] Path: ${pathname} (${isTimeout ? 'Timeout' : 'Error'})`, error);
    }
    const payload: {error: string; detail?: string} = {
      error: isTimeout ? 'Backend Request Timed Out' : 'Backend Server Unreachable',
    };
    if (process.env.NODE_ENV !== 'production') {
      payload.detail = error instanceof Error ? error.message : 'Unknown';
    }
    return NextResponse.json(
      payload,
      { status: isTimeout ? 504 : 502 }
    );
  }
}

// Support all standard HTTP Methods
export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const DELETE = handleProxy;
export const PATCH = handleProxy;
export const HEAD = handleProxy;
export const OPTIONS = handleProxy;
