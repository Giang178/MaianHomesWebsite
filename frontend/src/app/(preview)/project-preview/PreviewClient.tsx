'use client';

import { useEffect, useMemo, useState } from 'react';
import { getAssetUrl } from '@/lib/api';
import type { ProjectFormData } from '@/features/content/projects/project-form-contract';
import ProjectModernDetailView, { type ProjectModernData } from '@/features/projects/ProjectModernDetailView';
import { ProjectImageMetadataProvider } from '@/features/projects/ResponsiveProjectImage';

type ProjectPreviewPayload = {
  type: 'project-live-preview';
  project: ProjectFormData;
};

function isPreviewPayload(value: unknown): value is ProjectPreviewPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<ProjectPreviewPayload>;
  return payload.type === 'project-live-preview'
    && Boolean(payload.project)
    && typeof payload.project?.name === 'string';
}

export default function ProjectPreviewClient() {
  const [project, setProject] = useState<ProjectFormData | null>(null);

  useEffect(() => {
    const receivePreview = (event: MessageEvent<unknown>) => {
      if (event.origin !== window.location.origin || !isPreviewPayload(event.data)) return;
      setProject(event.data.project);
    };

    window.addEventListener('message', receivePreview);
    window.parent.postMessage({ type: 'project-live-preview-ready' }, window.location.origin);
    return () => window.removeEventListener('message', receivePreview);
  }, []);

  const publicProject = useMemo((): ProjectModernData | null => {
    if (!project) return null;
    return {
      id: (project as { id?: string }).id || 'preview-project',
      name: project.name || 'Dự án mẫu',
      slug: project.slug || 'du-an-mau',
      slogan: project.slogan,
      tagline: project.tagline || 'Biểu tượng thượng lưu giữa Sài Gòn',
      description: project.description,
      developer: project.developer,
      location: project.location,
      location_description: project.location_description,
      price_range: project.price_range,
      status: project.status,
      is_featured: Boolean(project.is_featured),
      marketing_tags: project.marketing_tags || [],
      master_plan_image: project.master_plan_image ? (getAssetUrl(project.master_plan_image) || project.master_plan_image) : '',
      developer_description: project.developer_description || project.stats?.['developer_description'] || project.stats?.['Mô tả CĐT'] || '',
      location_distances_note: project.location_distances_note || '',
      images: (project.images || []).map((url) => getAssetUrl(url) || url).filter(Boolean),
      primary_color: project.primary_color,
      accent_color: project.accent_color,
      hero_images: (project.hero_images || []).map((url) => getAssetUrl(url) || url).filter(Boolean),
      hero_video_url: project.hero_video_url,
      overview_images: (project.overview_images || []).map((url) => getAssetUrl(url) || url).filter(Boolean),
      location_map_image: getAssetUrl(project.location_map_image) || project.location_map_image,
      map_embed_url: project.map_embed_url,
      stats: project.stats || {},
      floor_layouts: (project.floor_layouts || []).map((group) => ({
        ...group,
        floor_map_image: getAssetUrl(group.floor_map_image) || group.floor_map_image,
        unit_layouts: (group.unit_layouts || []).map((unit) => ({
          ...unit,
          image_url: getAssetUrl(unit.image_url) || unit.image_url,
        })),
      })),
      amenity_gallery: (project.amenity_gallery || []).map((item) => ({
        ...item,
        image_url: getAssetUrl(item.image_url) || item.image_url,
      })),
      amenity_floors: (project.amenity_floors || []).map((fl) => ({
        floor_map_image: getAssetUrl(fl.floor_map_image) || fl.floor_map_image || '',
        floor_label: fl.floor_label,
        amenities: (fl.amenities || []).map((a) => ({
          ...a,
          image_url: getAssetUrl(a.image_url) || a.image_url,
        })),
      })),
      amenities: project.amenities || [],
      location_distances: project.location_distances || [],
      contact_phone: project.contact_phone || '090 123 4567',
      contact_email: project.contact_email || 'info@maianhomes.vn',
      contact_title: project.contact_title || 'Đăng ký tư vấn & Báo giá',
      contact_description: project.contact_description || 'Để lại thông tin để nhận bảng giá chi tiết từng căn và mặt bằng qua Zalo/Email.',
      seo_metadata: {
        title: project.seo_metadata?.title,
        description: project.seo_metadata?.description,
        usps: project.seo_metadata?.usps || [],
        faqs: project.seo_metadata?.faqs || [],
      },
    };
  }, [project]);

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6 text-center text-sm text-zinc-500">
        Đang đồng bộ dữ liệu xem trước dự án…
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-white"
      onClickCapture={(event) => {
        if ((event.target as HTMLElement).closest('a')) event.preventDefault();
      }}
    >
      <ProjectImageMetadataProvider metadata={project.image_metadata}>
        {publicProject && <ProjectModernDetailView project={publicProject} />}
      </ProjectImageMetadataProvider>
    </div>
  );
}

