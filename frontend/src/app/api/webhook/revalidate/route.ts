import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

type RevalidationPayload = {
  entity?: 'ARTICLE' | 'PROJECT' | 'TEAM' | 'JOB' | 'COMPANY_KNOWLEDGE' | 'PAGE' | 'BRANDING';
  slug?: string;
  old_slug?: string;
  page_key?: string;
};

const safeSlug = (value: unknown) =>
  typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) ? value : undefined;

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.MARKETING_REVALIDATE_SECRET
    || (process.env.NODE_ENV !== 'production'
      ? 'change-me-local-marketing-revalidation'
      : undefined);
  const providedSecret = request.headers.get('x-marketing-revalidate-secret');
  if (!configuredSecret || providedSecret !== configuredSecret) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as RevalidationPayload;
  if (payload.entity === 'ARTICLE') {
    const slug = safeSlug(payload.slug);
    const oldSlug = safeSlug(payload.old_slug);
    revalidateTag('articles', 'max');
    if (slug) revalidateTag(`article-${slug}`, 'max');
    if (oldSlug && oldSlug !== slug) revalidateTag(`article-${oldSlug}`, 'max');
    revalidatePath('/tin_tuc');
    if (slug) revalidatePath(`/tin_tuc/${slug}`);
    if (oldSlug && oldSlug !== slug) revalidatePath(`/tin_tuc/${oldSlug}`);
  } else if (payload.entity === 'PROJECT') {
    const slug = safeSlug(payload.slug);
    const oldSlug = safeSlug(payload.old_slug);
    revalidateTag('projects', 'max');
    if (slug) revalidateTag(`project-${slug}`, 'max');
    if (oldSlug && oldSlug !== slug) revalidateTag(`project-${oldSlug}`, 'max');
    revalidatePath('/');
    revalidatePath('/du_an');
    if (slug) revalidatePath(`/du_an/${slug}`);
    if (oldSlug && oldSlug !== slug) revalidatePath(`/du_an/${oldSlug}`);
  } else if (payload.entity === 'TEAM') {
    const slug = safeSlug(payload.slug);
    const oldSlug = safeSlug(payload.old_slug);
    revalidateTag('public-team', 'max');
    if (slug) revalidateTag(`public-team-${slug}`, 'max');
    if (oldSlug && oldSlug !== slug) revalidateTag(`public-team-${oldSlug}`, 'max');
    revalidatePath('/');
    revalidatePath('/doi-ngu');
    if (slug) revalidatePath(`/doi-ngu/${slug}`);
    if (oldSlug && oldSlug !== slug) revalidatePath(`/doi-ngu/${oldSlug}`);
  } else if (payload.entity === 'JOB') {
    const slug = safeSlug(payload.slug);
    const oldSlug = safeSlug(payload.old_slug);
    revalidateTag('public-jobs', 'max');
    if (slug) revalidateTag(`public-job-${slug}`, 'max');
    if (oldSlug && oldSlug !== slug) revalidateTag(`public-job-${oldSlug}`, 'max');
    revalidatePath('/tuyen-dung');
    if (slug) revalidatePath(`/tuyen-dung/${slug}`);
    if (oldSlug && oldSlug !== slug) revalidatePath(`/tuyen-dung/${oldSlug}`);
  } else if (payload.entity === 'COMPANY_KNOWLEDGE') {
    revalidateTag('company-knowledge', 'max');
    revalidatePath('/gioi-thieu');
    revalidatePath('/llms.txt');
  } else if (payload.entity === 'PAGE' && payload.page_key) {
    const pagePaths: Record<string, string> = {
      home: '/', about: '/gioi-thieu', contact: '/lien-he', consignment: '/ky-gui',
      projects_index: '/du_an', news_index: '/tin_tuc', team_index: '/doi-ngu',
      recruitment_index: '/tuyen-dung', privacy: '/chinh-sach-bao-mat', sitemap: '/so-do-trang-web',
    };
    revalidateTag(`website-page:${payload.page_key}`, 'max');
    if (pagePaths[payload.page_key]) revalidatePath(pagePaths[payload.page_key]);
  } else if (payload.entity === 'BRANDING') {
    revalidateTag('site-settings', 'max');
    revalidatePath('/', 'layout');
  } else {
    return NextResponse.json({ detail: 'Unsupported entity' }, { status: 422 });
  }

  return NextResponse.json({ revalidated: true });
}
