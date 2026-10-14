import type { NextConfig } from 'next';

const uploadBackendUrl = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  devIndicators: false,
  allowedDevOrigins: ['192.168.1.46', '192.168.1.133', '192.168.1.111', '192.168.1.112', '192.168.1.132', '192.168.1.152', '192.168.1.156', '192.168.1.57', '172.16.100.37', '172.16.100.137', '172.16.100.19', 'localhost', '127.0.0.1'],

  images: {
    unoptimized: false,
    formats: ['image/avif', 'image/webp'],
    qualities: [75, 85, 90, 95],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    localPatterns: [
      { pathname: '/images/**', search: '' },
      { pathname: '/api/protected/**' },
      { pathname: '/api/public/**' },
      { pathname: '/uploads/**' },
    ],
    remotePatterns: [
      { protocol: 'https', hostname: 'maianhomes.vn', pathname: '**' },
      { protocol: 'https', hostname: 'admin.maianhomes.vn', pathname: '**' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '**' },
      { protocol: 'https', hostname: 'masterisehomes.com', pathname: '**' },
      { protocol: 'https', hostname: '**.cdninstagram.com', pathname: '**' },
      { protocol: 'https', hostname: '**.googleapis.com', pathname: '**' },
      { protocol: 'https', hostname: '**.googleusercontent.com', pathname: '**' },
      { protocol: 'https', hostname: '**.cloudinary.com', pathname: '**' },
      { protocol: 'https', hostname: '**.s3.amazonaws.com', pathname: '**' },
      { protocol: 'https', hostname: 'i.imgur.com', pathname: '**' },
      { protocol: 'http', hostname: '192.168.1.46', pathname: '**' },
      { protocol: 'http', hostname: '192.168.1.133', pathname: '**' },
      { protocol: 'http', hostname: '192.168.1.57', pathname: '**' },
      { protocol: 'http', hostname: '172.16.100.37', pathname: '**' },
      { protocol: 'http', hostname: '172.16.100.137', pathname: '**' },
      { protocol: 'http', hostname: '172.16.100.19', pathname: '**' },
      { protocol: 'http', hostname: 'localhost', pathname: '**' },
      { protocol: 'http', hostname: '127.0.0.1', pathname: '**' },
    ],
  },

  experimental: {
    cpus: 1,
    workerThreads: false,
    optimizePackageImports: ['lucide-react', 'gsap', 'lenis'],
    // Matches Nginx: 8 x 10 MiB images plus multipart overhead.
    proxyClientMaxBodySize: 96 * 1024 * 1024,
  },

  turbopack: {},

  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: false,
        followSymlinks: false,
        ignored: ['**/node_modules/**', '**/.next/**'],
      };
    }
    return config;
  },



  logging: {
    fetches: {
      fullUrl: false,
    },
  },

  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/api/ws/:path*',
          destination: `${uploadBackendUrl}/api/ws/:path*`,
        },
      ],
      afterFiles: [
        {
          source: '/uploads/:path*',
          destination: `${uploadBackendUrl}/uploads/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
