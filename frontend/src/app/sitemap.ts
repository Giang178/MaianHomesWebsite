import { MetadataRoute } from 'next';
import { connection } from 'next/server';

const API_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
const CONTACT_LAST_MODIFIED = new Date('2026-07-08');

type SitemapProject = {
  slug?: string;
  updated_at?: string;
  created_at?: string;
};

type SitemapArticle = {
  slug?: string;
  updated_at?: string;
  published_at?: string;
};

type SitemapJob = {
  slug?: string;
  updated_at?: string;
  created_at?: string;
  deadline?: string;
  status?: string;
};

type SitemapTeamMember = {
  slug?: string;
  updated_at?: string;
  allow_detail_view?: boolean;
};

type SitemapBuilding = {
  slug?: string;
  updated_at?: string;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://maianhomes.vn';

  const staticRoutes = [
    '',
    '/gioi-thieu',
    '/doi-ngu',
    '/du_an',
    '/tin_tuc',
    '/ky-gui',
    '/dich-vu-cho-thue/coworking',
    '/dich-vu-cho-thue/office',
    '/dich-vu-cho-thue/office/hang-a',
    '/dich-vu-cho-thue/office/hang-b',
    '/dich-vu-cho-thue/office/hang-c',
    '/tuyen-dung',
    '/lien-he',
    '/chinh-sach-bao-mat',
    '/so-do-trang-web',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: route === '/lien-he' ? CONTACT_LAST_MODIFIED : new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1.0 : (route.startsWith('/dich-vu-cho-thue') ? 0.9 : (route === '/so-do-trang-web' ? 0.5 : 0.8)),
  }));

  // Dynamic project routes
  let projectRoutes: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${API_URL}/api/public/projects?view=summary`, { cache: 'force-cache', next: { revalidate: 3600 }, signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const resData = await res.json();
      const projects = Array.isArray(resData) ? resData : (Array.isArray(resData?.data) ? resData.data : []);
      if (Array.isArray(projects)) {
        projectRoutes = projects
          .filter((project: SitemapProject) => Boolean(project.slug))
          .map((project: SitemapProject) => ({
            url: `${baseUrl}/du_an/${project.slug}`,
            lastModified: new Date(project.updated_at || project.created_at || new Date()),
            changeFrequency: 'weekly' as const,
            priority: 0.8,
          }));
      }
    }
  } catch (err) {
    console.error('Sitemap project fetching error:', err);
  }

  // Dynamic article routes (News Module)
  let articleRoutes: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${API_URL}/api/public/articles?limit=100`, { cache: 'force-cache', next: { revalidate: 3600 }, signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const resData = await res.json();
      const articles = Array.isArray(resData?.data) ? resData.data : [];
      articleRoutes = articles
        .filter((art: SitemapArticle) => Boolean(art.slug))
        .map((art: SitemapArticle) => ({
          url: `${baseUrl}/tin_tuc/${art.slug}`,
          lastModified: new Date(art.updated_at || art.published_at || new Date()),
          changeFrequency: 'daily' as const,
          priority: 0.7,
        }));
    }
  } catch (err) {
    console.error('Sitemap article fetching error:', err);
  }

  // Dynamic recruitment routes
  let jobRoutes: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${API_URL}/api/public/jobs?view=summary`, { cache: 'force-cache', next: { revalidate: 3600 }, signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const jobs = await res.json();
      if (Array.isArray(jobs)) {
        jobRoutes = jobs
          .filter((job: SitemapJob) => Boolean(job.slug))
          .map((job: SitemapJob) => ({
            url: `${baseUrl}/tuyen-dung/${job.slug}`,
            lastModified: new Date(job.updated_at || job.created_at || new Date()),
            changeFrequency: 'weekly' as const,
            priority: job.status === 'PUBLISHED' ? 0.75 : 0.5,
          }));
      }
    }
  } catch (err) {
    console.error('Sitemap job fetching error:', err);
  }

  let teamRoutes: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${API_URL}/api/public/team?limit=100`, {
      cache: 'force-cache',
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const payload = await res.json() as { data?: SitemapTeamMember[] };
      teamRoutes = (payload.data || [])
        .filter(member => Boolean(member.slug) && member.allow_detail_view !== false)
        .map(member => ({
          url: `${baseUrl}/doi-ngu/${member.slug}`,
          lastModified: new Date(member.updated_at || new Date()),
          changeFrequency: 'weekly' as const,
          priority: 0.7,
        }));
    }
  } catch (err) {
    console.error('Sitemap team fetching error:', err);
  }

  // Dynamic office building routes (Workspace Solutions)
  let buildingRoutes: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${API_URL}/api/public/workspaces/office/buildings?limit=100`, {
      cache: 'force-cache',
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const payload = await res.json() as { items?: SitemapBuilding[] };
      buildingRoutes = (payload.items || [])
        .filter(b => Boolean(b.slug))
        .map(b => ({
          url: `${baseUrl}/dich-vu-cho-thue/office/${b.slug}`,
          lastModified: new Date(b.updated_at || new Date()),
          changeFrequency: 'weekly' as const,
          priority: 0.85,
        }));
    }
  } catch (err) {
    console.error('Sitemap workspace buildings fetching error:', err);
  }

  return [...staticRoutes, ...projectRoutes, ...articleRoutes, ...jobRoutes, ...teamRoutes, ...buildingRoutes];
}
