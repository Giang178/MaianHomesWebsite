import { cache } from 'react';
import { safeJsonLd } from '@/features/content/public/structured-data';
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { workspaceApi } from '@/features/workspaces/api';
import { generateCoworkingJsonLd } from '@/features/workspaces/structured-data';
import { CoworkingView } from '@/features/workspaces/components';
import type { CoworkingData, WorkspaceSEOMetadata } from '@/features/workspaces/types';

// Revalidate every 60 seconds
export const revalidate = 60;

type ApiError = Error & { status?: number };
type CoworkingSeo = WorkspaceSEOMetadata & {
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string[];
  robots_directives?: string;
};
type CoworkingSpace = CoworkingData & {
  seo?: CoworkingSeo;
  seo_metadata: CoworkingSeo;
  tagline?: string;
  hero_image?: string;
};
type CoworkingPageData = CoworkingSpace & { space?: CoworkingSpace };

const PREVIEW_PATH = '/dich-vu-cho-thue/coworking?preview=true';

const getCachedCoworking = cache(async (
  isPreview: boolean,
  cookieHeader?: string,
): Promise<CoworkingPageData> => {
  return isPreview
    ? workspaceApi.getCoworkingAdmin(true, cookieHeader)
    : workspaceApi.getCoworkingPublic(false);
});

async function getPreviewCookieHeader(isPreview: boolean): Promise<string | undefined> {
  if (!isPreview) return undefined;
  const cookieStore = await cookies();
  return cookieStore.toString() || undefined;
}

function previewRobots(): Metadata['robots'] {
  return {
    index: false,
    follow: false,
    noarchive: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const isPreview = params.preview === 'true';

  try {
    const cookieHeader = await getPreviewCookieHeader(isPreview);
    const data = await getCachedCoworking(isPreview, cookieHeader);
    if (!data) return {};

    const space = data.space || data;
    const seo = space.seo || space.seo_metadata;
    return {
      title: seo?.meta_title || seo?.title || space.name || undefined,
      description: seo?.meta_description || seo?.description || space.tagline || space.hero?.subtitle,
      keywords: seo?.meta_keywords?.length ? seo.meta_keywords : seo?.keywords,
      openGraph: {
      title: seo?.meta_title || seo?.title || space.name || undefined,
        description: seo?.meta_description || seo?.description || space.tagline || space.hero?.subtitle,
        images: seo?.og_image ? [{ url: seo.og_image }] : (space.hero_image ? [{ url: space.hero_image }] : (space.hero?.image_url ? [{ url: space.hero?.image_url }] : [])),
        type: 'website',
        locale: 'vi_VN',
      },
      alternates: {
        canonical: seo?.canonical_url,
      },
      robots: isPreview
        ? previewRobots()
        : (seo?.robots_directives || seo?.robots),
    };
  } catch {
    return {
      robots: isPreview ? previewRobots() : undefined,
    };
  }
}

function PreviewAccessState({ status }: { status: 'unauthorized' | 'forbidden' }) {
  const unauthorized = status === 'unauthorized';
  const href = unauthorized
    ? '/login?next=' + encodeURIComponent(PREVIEW_PATH)
    : '/admin/workspaces/coworking';

  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-[#FAF9F6] px-6 py-32 text-center text-[#2D1B14]">
      <div className="max-w-xl rounded-3xl border border-amber-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">
          {unauthorized ? '401 · Preview' : '403 · Preview'}
        </p>
        <h1 className="mt-3 font-serif text-3xl font-bold">
          {unauthorized ? 'Vui lòng đăng nhập để xem bản nháp' : 'Bạn không có quyền xem trước trang này'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          {unauthorized
            ? 'Phiên quản trị không còn hiệu lực. Đăng nhập lại để tiếp tục xem trước nội dung Coworking.'
            : 'Tài khoản hiện tại cần quyền đọc nội dung Workspace để mở bản nháp Coworking.'}
        </p>
        <Link
          href={href}
          className="mt-6 inline-flex rounded-full bg-[#2D1B14] px-6 py-3 text-sm font-semibold text-[#D4AF37]"
        >
          {unauthorized ? 'Đăng nhập' : 'Quay lại quản trị'}
        </Link>
      </div>
    </main>
  );
}

export default async function CoworkingPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const params = await searchParams;
  const isPreview = params.preview === 'true';

  const cookieHeader = await getPreviewCookieHeader(isPreview);

  let data = null;
  let previewAccessStatus: 'unauthorized' | 'forbidden' | null = null;
  try {
    data = await getCachedCoworking(isPreview, cookieHeader);
  } catch (err) {
    const status = (err as ApiError).status;
    if (isPreview && status === 401) {
      previewAccessStatus = 'unauthorized';
    } else if (isPreview && status === 403) {
      previewAccessStatus = 'forbidden';
    } else if (status !== 404) {
      console.error('Failed to fetch coworking data:', err);
    }
  }

  if (previewAccessStatus) {
    return <PreviewAccessState status={previewAccessStatus} />;
  }

  const space = data?.space || data;
  if (!data || !space) {
    notFound();
  }

  const seat_types = data.seat_types || [];
  const pricing_plans = data.pricing_plans || [];
  const faqs = data.faqs || [];
  const jsonLd = generateCoworkingJsonLd(space, pricing_plans, faqs);

  return (
    <>
      {/* JSON-LD Schema.org Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <CoworkingView
        space={space}
        seatTypes={seat_types}
        pricingPlans={pricing_plans}
        faqs={faqs}
        isPreview={isPreview}
      />
    </>
  );
}
