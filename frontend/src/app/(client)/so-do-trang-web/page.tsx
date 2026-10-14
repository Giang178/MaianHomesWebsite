import { Metadata } from 'next';
import { connection } from 'next/server';
import Link from 'next/link';
import { ChevronRight, Home, Building2, Newspaper, Briefcase, Map, FileText, Phone, UserCircle, Handshake } from 'lucide-react';
import PublicDataUnavailable from '@/components/system/PublicDataUnavailable';
import { fetchPublicJson, invalidPublicPayload, type PublicFetchResult } from '@/lib/public-fetch';
import { buildCmsMetadata, getPublicPage, pageText } from '@/features/website/public/page-content';

const fallbackMetadata: Metadata = {
  title: 'Sơ đồ trang web',
  description: 'Khám phá cấu trúc và toàn bộ các trang trên website Maian Homes.',
};
void fallbackMetadata;
export async function generateMetadata(): Promise<Metadata> {
  return buildCmsMetadata('sitemap', {title: 'Sơ đồ website Maian Homes', description: 'Khám phá toàn bộ cấu trúc và các chuyên mục trên website Maian Homes.', canonicalPath: '/so-do-trang-web'});
}

const API_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

// Define types based on sitemap.ts
type Project = { id: string | number; name: string; slug: string; };
type Article = { id: string | number; title: string; slug: string; };
type Job = { id: string | number; title: string; slug: string; status: string; };

async function getProjects(): Promise<PublicFetchResult<Project[]>> {
  const result = await fetchPublicJson<Project[] | { data?: Project[] }>(
    `${API_URL}/api/public/projects?view=summary`,
    { cache: 'force-cache', next: { revalidate: 3600, tags: ['projects'] } },
  );
  if (result.state !== 'ok') return result;
  const projects = Array.isArray(result.data)
    ? result.data
    : (Array.isArray(result.data?.data) ? result.data.data : null);
  if (!projects) return invalidPublicPayload(result);
  return { ...result, data: projects };
}

async function getArticles(): Promise<PublicFetchResult<Article[]>> {
  const result = await fetchPublicJson<{ data?: Article[] }>(
    `${API_URL}/api/public/articles?limit=100`,
    { cache: 'force-cache', next: { revalidate: 3600, tags: ['articles'] } },
  );
  if (result.state !== 'ok') return result;
  if (!Array.isArray(result.data?.data)) return invalidPublicPayload(result);
  return { ...result, data: result.data.data };
}

async function getJobs(): Promise<PublicFetchResult<Job[]>> {
  const result = await fetchPublicJson<Job[]>(
    `${API_URL}/api/public/jobs?view=summary`,
    { cache: 'force-cache', next: { revalidate: 3600, tags: ['public-jobs'] } },
  );
  if (result.state !== 'ok') return result;
  if (!Array.isArray(result.data)) return invalidPublicPayload(result);
  return { ...result, data: result.data.filter((job) => job.status === 'PUBLISHED') };
}

export default async function SitemapPage() {
  await connection();
  const [projectsResult, articlesResult, jobsResult, page] = await Promise.all([
    getProjects(),
    getArticles(),
    getJobs(),
    getPublicPage('sitemap'),
  ]);
  const content = page?.content || {};
  const projects = projectsResult.state === 'ok' ? projectsResult.data : [];
  const articles = articlesResult.state === 'ok' ? articlesResult.data : [];
  const jobs = jobsResult.state === 'ok' ? jobsResult.data : [];

  const staticPages = [
    { title: 'Trang chủ', path: '/', icon: <Home className="w-4 h-4" /> },
    { title: 'Về Maian Homes', path: '/gioi-thieu', icon: <UserCircle className="w-4 h-4" /> },
    { title: 'Đội ngũ chuyên gia', path: '/doi-ngu', icon: <UserCircle className="w-4 h-4" /> },
    { title: 'Liên hệ', path: '/lien-he', icon: <Phone className="w-4 h-4" /> },
    { title: 'Chính sách bảo mật', path: '/chinh-sach-bao-mat', icon: <FileText className="w-4 h-4" /> },
  ];

  const services = [
    { title: 'Ký gửi nhà đất', path: '/ky-gui', icon: <Handshake className="w-4 h-4" /> },
    { title: 'Co-working Space', path: '/dich-vu-cho-thue/coworking', icon: <Briefcase className="w-4 h-4" /> },
    { title: 'Maian Office (Tổng quan)', path: '/dich-vu-cho-thue/office', icon: <Building2 className="w-4 h-4" /> },
    { title: 'Văn phòng Hạng A', path: '/dich-vu-cho-thue/office/hang-a', icon: <Building2 className="w-4 h-4" /> },
    { title: 'Văn phòng Hạng B', path: '/dich-vu-cho-thue/office/hang-b', icon: <Building2 className="w-4 h-4" /> },
    { title: 'Văn phòng Hạng C', path: '/dich-vu-cho-thue/office/hang-c', icon: <Building2 className="w-4 h-4" /> },
  ];

  return (
    <main className="min-h-screen bg-[#FAFAFA] pt-20 sm:pt-24 pb-20">
      {/* Hero Section */}
      <div className="relative bg-[#1A1612] text-[#F3E6C6] py-16 mb-16 overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#D4AF37] via-transparent to-transparent"></div>
        <div className="container max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-white/5 rounded-full mb-6 ring-1 ring-white/10">
            <Map className="w-8 h-8 text-[#D4AF37]" />
          </div>
          <h1 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">{pageText(content, 'title', 'Sơ đồ trang web')}</h1>
          <p className="text-[#F3E6C6]/70 max-w-2xl mx-auto text-lg font-light">
            {pageText(content, 'description', 'Khám phá toàn bộ cấu trúc và các chuyên mục trên website của Maian Homes.')}
          </p>
        </div>
      </div>

      <div className="container max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          
          {/* Cột 1: Thông tin chung & Dịch vụ */}
          <div className="space-y-8">
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                <div className="p-2 bg-gray-50 rounded-lg text-gray-700">
                  <Home className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Thông tin chung</h2>
              </div>
              <ul className="space-y-3">
                {staticPages.map((page, idx) => (
                  <li key={idx}>
                    <Link href={page.path} className="group flex items-center gap-3 text-gray-600 hover:text-[#D4AF37] transition-colors">
                      <span className="text-gray-400 group-hover:text-[#D4AF37] transition-colors">{page.icon}</span>
                      <span className="font-medium">{page.title}</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-[#D4AF37]" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                <div className="p-2 bg-gray-50 rounded-lg text-gray-700">
                  <Handshake className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Dịch vụ</h2>
              </div>
              <ul className="space-y-3">
                {services.map((page, idx) => (
                  <li key={idx}>
                    <Link href={page.path} className="group flex items-center gap-3 text-gray-600 hover:text-[#D4AF37] transition-colors">
                      <span className="text-gray-400 group-hover:text-[#D4AF37] transition-colors">{page.icon}</span>
                      <span className="font-medium">{page.title}</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-[#D4AF37]" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Cột 2: Dự án & Tuyển dụng */}
          <div className="space-y-8">
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-50 rounded-lg text-gray-700">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Dự án bất động sản</h2>
                </div>
                <Link href="/du_an" className="text-sm font-medium text-[#D4AF37] hover:underline" aria-label="Xem tất cả dự án bất động sản Maian Homes">Xem tất cả <span className="sr-only">dự án</span></Link>
              </div>
              {projectsResult.state !== 'ok' && (
                <PublicDataUnavailable
                  compact
                  title="Chưa thể tải danh sách dự án"
                  requestId={projectsResult.requestId}
                  status={projectsResult.status}
                />
              )}
              <ul className="space-y-3">
                <li>
                  <Link href="/du_an" className="group flex items-center gap-3 text-gray-900 font-semibold hover:text-[#D4AF37] transition-colors mb-2">
                    Tổng hợp dự án
                    <ChevronRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </Link>
                </li>
                {projects.slice(0, 10).map((project: Project, idx: number) => (
                  <li key={idx} className="pl-4 border-l-2 border-gray-100">
                    <Link href={`/du_an/${project.slug}`} className="group flex items-center gap-3 text-gray-600 hover:text-[#D4AF37] transition-colors py-1" aria-label={`Chi tiết dự án bất động sản: ${project.name || project.slug}`}>
                      <span className="line-clamp-1">{project.name || project.slug}</span>
                    </Link>
                  </li>
                ))}
                {projectsResult.state === 'ok' && projects.length === 0 && (
                  <li className="text-gray-400 text-sm italic">Chưa có dự án nào</li>
                )}
              </ul>
            </section>

            <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-50 rounded-lg text-gray-700">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Tuyển dụng</h2>
                </div>
                <Link href="/tuyen-dung" className="text-sm font-medium text-[#D4AF37] hover:underline" aria-label="Xem tất cả vị trí tuyển dụng Maian Homes">Xem tất cả <span className="sr-only">tuyển dụng</span></Link>
              </div>
              {jobsResult.state !== 'ok' && (
                <PublicDataUnavailable
                  compact
                  title="Chưa thể tải danh sách tuyển dụng"
                  requestId={jobsResult.requestId}
                  status={jobsResult.status}
                />
              )}
              <ul className="space-y-3">
                <li>
                  <Link href="/tuyen-dung" className="group flex items-center gap-3 text-gray-900 font-semibold hover:text-[#D4AF37] transition-colors mb-2">
                    Cơ hội nghề nghiệp
                    <ChevronRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </Link>
                </li>
                {jobs.slice(0, 5).map((job: Job, idx: number) => (
                  <li key={idx} className="pl-4 border-l-2 border-gray-100">
                    <Link href={`/tuyen-dung/${job.slug}`} className="group flex items-center gap-3 text-gray-600 hover:text-[#D4AF37] transition-colors py-1" aria-label={`Cơ hội nghề nghiệp: ${job.title || job.slug}`}>
                      <span className="line-clamp-1">{job.title || job.slug}</span>
                    </Link>
                  </li>
                ))}
                {jobsResult.state === 'ok' && jobs.length === 0 && (
                  <li className="text-gray-400 text-sm italic">Đang cập nhật...</li>
                )}
              </ul>
            </section>
          </div>

          {/* Cột 3: Tin tức */}
          <div className="space-y-8">
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-50 rounded-lg text-gray-700">
                    <Newspaper className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Tin tức & Thị trường</h2>
                </div>
                <Link href="/tin_tuc" className="text-sm font-medium text-[#D4AF37] hover:underline" aria-label="Xem tất cả tin tức thị trường bất động sản Maian Homes">Xem tất cả <span className="sr-only">tin tức</span></Link>
              </div>
              {articlesResult.state !== 'ok' && (
                <PublicDataUnavailable
                  compact
                  title="Chưa thể tải danh sách bài viết"
                  requestId={articlesResult.requestId}
                  status={articlesResult.status}
                />
              )}
              <ul className="space-y-3">
                <li>
                  <Link href="/tin_tuc" className="group flex items-center gap-3 text-gray-900 font-semibold hover:text-[#D4AF37] transition-colors mb-2">
                    Trang tin tức
                    <ChevronRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </Link>
                </li>
                {articles.slice(0, 10).map((article: Article, idx: number) => (
                  <li key={idx} className="pl-4 border-l-2 border-gray-100">
                    <Link href={`/tin_tuc/${article.slug}`} className="group flex items-center gap-3 text-gray-600 hover:text-[#D4AF37] transition-colors py-1" aria-label={`Bài viết phân tích: ${article.title || article.slug}`}>
                      <span className="line-clamp-2 leading-relaxed text-sm">{article.title || article.slug}</span>
                    </Link>
                  </li>
                ))}
                {articlesResult.state === 'ok' && articles.length === 0 && (
                  <li className="text-gray-400 text-sm italic">Chưa có bài viết nào</li>
                )}
              </ul>
            </section>
          </div>

        </div>
      </div>
    </main>
  );
}
