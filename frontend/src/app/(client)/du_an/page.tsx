import { getAssetUrl } from '@/lib/api';
import { connection } from 'next/server';
import ProjectsSection from '@/features/projects/ProjectsSection';
import { selectProjectCardImage } from '@/features/projects/project-card-data';
import ContactFormSection from '@/components/home/ContactFormSection';
import { buildCmsMetadata, cmsGeoJsonLd, getPublicPage, pageText } from '@/features/website/public/page-content';

interface DBProject {
  _id?: string;
  id?: string;
  name: string;
  slug: string;
  logo_url?: string;
  images?: string[];
  hero_images?: string[];
  marketing_tags?: string[];
  location?: string;
  status?: string;
  price_range?: string;
  is_featured?: boolean;
}

interface NormalizedProject {
  id: string;
  name: string;
  slug: string;
  shortDesc: string;
  location: string;
  image: string;
  status: string;
  priceRange: string;
  isFeatured?: boolean;
}

async function getAllProjects() {
  try {
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    const cleanBase = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;

    const res = await fetch(`${cleanBase}/api/public/projects?view=summary`, {
      cache: 'force-cache',
      next: { revalidate: 300, tags: ['projects'] },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error(`API Error: ${res.status}`);
      return { projects: [], error: true };
    }
    const resData = await res.json();
    const dbProjects: DBProject[] = resData.data || [];

    const dbProjNormalized: NormalizedProject[] = dbProjects.map((p) => {
      const imgPath = selectProjectCardImage(p);
      return {
        id: p._id || p.id || '',
        name: p.name,
        slug: p.slug,
        shortDesc: p.marketing_tags?.[0] || 'Căn hộ cao cấp',
        location: p.location || '',
        image: getAssetUrl(imgPath) || '/images/default-project.jpg',
        status: p.status || 'AVAILABLE',
        priceRange: p.price_range || '',
        isFeatured: Boolean(p.is_featured),
      };
    });

    const combined: NormalizedProject[] = [];
    for (const p of dbProjNormalized) {
      if (!combined.some(c => c.slug === p.slug)) {
        combined.push(p);
      }
    }
    return { projects: combined, error: false };
  } catch (err) {
    console.error('Error fetching all public projects:', err);
    return { projects: [], error: true };
  }
}

export async function generateMetadata() {
  return buildCmsMetadata('projects_index', {
    title: 'Tất cả dự án',
    description: 'Danh sách tất cả dự án bất động sản cao cấp từ Maian Homes.',
    canonicalPath: '/du_an',
  });
}

export default async function ProjectsPage() {
  await connection();
  const [{ projects, error }, page] = await Promise.all([getAllProjects(), getPublicPage('projects_index')]);
  const content = page?.content || {};
  const pageTitle = pageText(content, 'title', 'Tất cả dự án');
  const pageDescription = pageText(content, 'description', 'Khám phá danh sách dự án bất động sản cao cấp được Maian Homes chọn lọc.');
  const jsonLd = cmsGeoJsonLd(page, 'https://maianhomes.vn/du_an', 'Tất cả dự án');

  return (
    <div className="overflow-hidden bg-[#F9F9F9] min-h-screen pt-16 sm:pt-20 lg:pt-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLd).replace(/</g, '\\u003c')}}/>
      <div className="max-w-7xl mx-auto px-6 pb-10 lg:pb-14">
        <div className="text-center mb-6 sm:mb-8 lg:mb-6 animate-in fade-in slide-in-from-bottom-10 duration-1000">
          <h1 className="uppercase tracking-[4px] text-[#D4AF37] text-2xl sm:text-3xl md:text-4xl min-[1368px]:text-5xl mb-2.5 lg:mb-2 font-bold leading-tight">{pageTitle}</h1>
          <div className="w-16 h-0.5 bg-[#D4AF37] mx-auto"></div>
          <p className="mx-auto mt-4 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">{pageDescription}</p>
        </div>

        <ProjectsSection initialProjects={projects} initialError={error} />
      </div>

      {/* Contact Consultation Form Section */}
      <div className="mt-20">
        <ContactFormSection projects={projects} />
      </div>
    </div>
  );
}
