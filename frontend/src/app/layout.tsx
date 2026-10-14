// src/app/layout.tsx
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';


const inter = localFont({
  src: '../assets/fonts/inter/InterVariable.woff2',
  variable: '--font-inter',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  preload: true,
  fallback: ['Arial', 'sans-serif'],
});

const notoSerifDisplay = localFont({
  src: '../assets/fonts/noto-serif-display/NotoSerifDisplay-Variable.woff2',
  variable: '--font-noto-serif',
  display: 'swap',
  preload: false,
});


const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://maianhomes.vn';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Maian Homes - Bất động sản cao cấp hàng đầu Việt Nam',
    template: '%s | Maian Homes'
  },
  description: 'Website tư vấn thông tin chính thức về các dự án Maian Homes: The Global City, Grand Marina Saigon, Lumiere... Trợ lý AI Mái Đỏ hỗ trợ 24/7.',
  keywords: ['Maian Homes', 'bất động sản cao cấp', 'căn hộ hạng sang', 'The Global City', 'Grand Marina Saigon', 'Lumiere Riverside'],
  authors: [{ name: 'Maian Homes Team' }],
  creator: 'Maian Homes',
  publisher: 'Maian Homes',
  // Open Graph cho Facebook, Zalo, LinkedIn
  openGraph: {
    title: 'Maian Homes - Bất động sản cao cấp hàng đầu Việt Nam',
    description: 'Tư vấn dự án bất động sản cao cấp tại TP.HCM. Liên hệ trực tiếp với Maian Homes. MST: 0319287798.',
    url: SITE_URL,
    siteName: 'Maian Homes',
    locale: 'vi_VN',
    type: 'website',
    images: [
      {
        url: `${SITE_URL}/images/banner_sec1.png`,
        width: 1200,
        height: 630,
        alt: 'Maian Homes – Bất động sản cao cấp TP.HCM',
      },
    ],
  },
  // Twitter Cards
  twitter: {
    card: 'summary_large_image',
    title: 'Maian Homes - Bất động sản cao cấp hàng đầu Việt Nam',
    description: 'Tư vấn dự án bất động sản cao cấp tại TP.HCM. Liên hệ trực tiếp với Maian Homes.',
    images: [`${SITE_URL}/images/banner_sec1.png`],
  },
  // Robot Crawling
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  // Nhắm mục tiêu địa lý (GEO Targeting - Việt Nam)
  other: {
    'geo.region': 'VN',
    'geo.placename': 'Vietnam',
    'geo.position': '14.058324;108.277199',
    'ICBM': '14.058324, 108.277199',
  },
  icons: {
    icon: '/images/minilogo.png',
    shortcut: '/images/minilogo.png',
    apple: '/apple-touch-icon.png',
  },
};

import { NotificationProvider } from '@/context/NotificationContext';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${inter.variable} ${notoSerifDisplay.variable} font-sans antialiased leading-[1.5]`} suppressHydrationWarning>
        <AuthProvider>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
