import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import ProjectForm, { IMAGE_UPLOAD_PROFILES, PROJECT_FORM_TABS, projectFieldTab, projectIssueLocation } from './ProjectEditor';
import { normalizeProjectForm, projectImageEntries, projectImageUrls, reconcileProjectImageMetadata } from './project-form-contract';

describe('project form contract', () => {
  it('keeps the editor in the same order as the public project page', () => {
    expect(PROJECT_FORM_TABS).toEqual([
      'Khởi tạo & Hero Gallery',
      'Giới thiệu & Quick Facts',
      'Vị trí & Kết nối',
      'Mặt bằng & Thiết kế',
      'Tiện ích đặc quyền',
      'Chủ đầu tư & Liên hệ',
      'Kiểm soát SEO/GEO & FAQ',
    ]);
  });

  it('normalizes legacy null collections and discovers nested images', () => {
    const project = normalizeProjectForm({
      hero_images: ['/hero.jpg'],
      story_blocks: [{title: 'Story', content: '', image_url: '/story.jpg', alignment: 'left'}],
      seo_metadata: undefined,
    });
    expect(project.seo_metadata.sources).toEqual([]);
    expect(projectImageUrls(project)).toEqual(['/hero.jpg', '/story.jpg']);
    expect(projectImageEntries(project).map(item => item.label)).toEqual([
      'Hero - ảnh 1',
      'Câu chuyện - khối 1',
    ]);
  });

  it('preserves location content and nearby distances', () => {
    const project = normalizeProjectForm({
      location_description: 'Kết nối thuận tiện với các tiện ích trọng điểm.',
      location_distances: [{ destination: 'Trung tâm thương mại', distance: '5 phút lái xe', distance_km: '3.5 km', icon: '' }],
    });
    expect(project.location_description).toBe('Kết nối thuận tiện với các tiện ích trọng điểm.');
    expect(project.location_distances).toEqual([
      { destination: 'Trung tâm thương mại', distance: '5 phút lái xe', distance_km: '3.5 km', icon: '' },
    ]);
  });
  it('preserves legacy GLOBAL amenity floors without an implicit migration', () => {
    const legacyFloors = [
      {
        floor_label: 'Khối đế',
        floor_map_image: '/legacy-map.jpg',
        amenities: [{name: 'Sảnh', category: 'legacy', image_url: '', icon: ''}],
      },
      {
        floor_label: 'Tầng mái',
        floor_map_image: '',
        amenities: [{name: 'Vườn mái', category: 'roof', image_url: '', icon: ''}],
      },
    ];
    const project = normalizeProjectForm({
      amenity_template: 'GLOBAL',
      amenity_floors: legacyFloors,
      name: 'Dự án cũ',
    });
    expect(project.amenity_floors).toEqual(legacyFloors);
  });

  it('shows an alt input directly below an uploaded image', () => {
    const {container} = render(React.createElement(ProjectForm, {
      initialData: {hero_images: ['/hero.jpg']},
      onSubmit: async () => undefined,
      isSubmitting: false,
      isEdit: false,
    }));
    expect(screen.getByLabelText('Alt ảnh Hero - ảnh 1')).toBeVisible();
    expect(container.querySelector('input[type="url"]')).toBeNull();
  });

  it('reindexes metadata and preserves each image occurrence when an item is removed', () => {
    const project = normalizeProjectForm({
      hero_images: ['/one.jpg', '/two.jpg'],
      image_metadata: [
        {field: 'hero_images.0', media_id: 'one', url: '/one.jpg', alt_text: 'Một', width: 1600, height: 900, focal_x: 40, focal_y: 50, variants: {}},
        {field: 'hero_images.1', media_id: 'two', url: '/two.jpg', alt_text: 'Hai', width: 1600, height: 900, focal_x: 60, focal_y: 50, variants: {}},
      ],
    });
    const reconciled = reconcileProjectImageMetadata({...project, hero_images: ['/two.jpg']});
    expect(reconciled.image_metadata).toEqual([
      expect.objectContaining({field: 'hero_images.0', media_id: 'two', alt_text: 'Hai'}),
    ]);
  });

  it('maps validation issues to a human-readable step and control', () => {
    const project = normalizeProjectForm({
      story_blocks: [{title: 'Khởi nguồn', content: '', image_url: '/story.jpg', alignment: 'left'}],
    });
    expect(projectFieldTab('slug')).toBe(0);
    expect(projectIssueLocation(project, {
      code: 'IMAGE_ALT_MISSING',
      field: 'story_blocks.0.image_url',
      message: 'Thiếu alt ảnh.',
      group: 'MEDIA',
    })).toEqual({
      step: 'Bước 6/7 · Chủ đầu tư & Liên hệ',
      control: 'Câu chuyện - khối 1',
    });
    expect(projectIssueLocation(project, {
      code: 'SOURCE_INVALID',
      field: 'seo_metadata.sources.1',
      message: 'Nguồn không hợp lệ.',
      group: 'GEO',
    }).control).toBe('Nguồn tham khảo GEO #2');
  });

  it('allows 900x900 source images for storytelling and plan/map positions', () => {
    expect(IMAGE_UPLOAD_PROFILES.story).toMatchObject({minWidth: 900, minHeight: 900});
    expect(IMAGE_UPLOAD_PROFILES.plan).toMatchObject({minWidth: 900, minHeight: 900});
    expect(IMAGE_UPLOAD_PROFILES.story.acceptedAspectRatios).toContain(1);
    expect(IMAGE_UPLOAD_PROFILES.plan.acceptedAspectRatios).toContain(1);
  });

  it('allows apartment layout images from 600x500', () => {
    expect(IMAGE_UPLOAD_PROFILES.unitLayout).toMatchObject({
      minWidth: 600,
      minHeight: 500,
    });
    expect(IMAGE_UPLOAD_PROFILES.unitLayout.acceptedAspectRatios).toContain(6 / 5);
  });

  it('allows wide amenity floor plans from 1200x300 for the GLOBAL zoned layout', () => {
    expect(IMAGE_UPLOAD_PROFILES.globalAmenityPlan).toMatchObject({
      minWidth: 1200,
      minHeight: 300,
      aspectRatio: 4,
      acceptAnyLandscape: true,
    });
    expect(IMAGE_UPLOAD_PROFILES.globalAmenityPlan.acceptedAspectRatios).toEqual([]);
  });

  it('hides raw marketing media API url and displays sharp auto-calibration badge with working alt input', async () => {
    const rawApiUrl = '/api/public/marketing-media/662f37b17d324d22afed43e38111b0ed';
    render(React.createElement(ProjectForm, {
      initialData: {
        name: 'The Beverly',
        hero_images: [rawApiUrl],
      },
      onSubmit: async () => undefined,
      isSubmitting: false,
      isEdit: false,
    }));

    // Chuỗi raw API URL không bao giờ được phơi bày trực tiếp trên giao diện
    expect(screen.queryByText(rawApiUrl)).toBeNull();

    // Hệ thống hiển thị huy hiệu tự căn chỉnh độ nét
    expect(screen.getByText('Tự căn chỉnh nét')).toBeVisible();

    // Ô nhập Alt text xuất hiện ngay bên dưới ảnh và cho phép nhập
    const altInput = screen.getByLabelText('Alt ảnh Hero - ảnh 1') as HTMLInputElement;
    expect(altInput).toBeVisible();

    // Nút gợi ý Alt chuẩn SEO hoạt động
    const suggestBtn = screen.getByRole('button', { name: /Gợi ý Alt chuẩn SEO/i });
    expect(suggestBtn).toBeVisible();
    await userEvent.click(suggestBtn);
    expect(altInput.value).toBe('The Beverly - Hero - ảnh 1');
  });

  it('allows entering and reconciling alt text for all overview images', () => {
    const project = normalizeProjectForm({
      name: 'Vinhomes Grand Park',
      overview_images: ['/overview-1.jpg', '/overview-2.jpg', '/overview-3.jpg'],
    });

    const entries = projectImageEntries(project);
    expect(entries.map(e => e.field)).toContain('overview_images.0');
    expect(entries.map(e => e.field)).toContain('overview_images.1');
    expect(entries.map(e => e.field)).toContain('overview_images.2');

    const reconciled = reconcileProjectImageMetadata({
      ...project,
      image_metadata: [
        { field: 'overview_images.0', media_id: 'm1', url: '/overview-1.jpg', alt_text: 'Phối cảnh 1', width: 1200, height: 900, focal_x: 50, focal_y: 50, variants: {} },
        { field: 'overview_images.1', media_id: 'm2', url: '/overview-2.jpg', alt_text: 'Phối cảnh 2', width: 1200, height: 900, focal_x: 50, focal_y: 50, variants: {} },
        { field: 'overview_images.2', media_id: 'm3', url: '/overview-3.jpg', alt_text: 'Phối cảnh 3', width: 1200, height: 900, focal_x: 50, focal_y: 50, variants: {} },
      ],
    });

    expect(reconciled.image_metadata.find(m => m.field === 'overview_images.0')?.alt_text).toBe('Phối cảnh 1');
    expect(reconciled.image_metadata.find(m => m.field === 'overview_images.1')?.alt_text).toBe('Phối cảnh 2');
    expect(reconciled.image_metadata.find(m => m.field === 'overview_images.2')?.alt_text).toBe('Phối cảnh 3');
    expect(reconciled.seo_metadata.image_alts).toEqual(
      expect.arrayContaining([
        { url: '/overview-1.jpg', alt_text: 'Phối cảnh 1' },
        { url: '/overview-2.jpg', alt_text: 'Phối cảnh 2' },
        { url: '/overview-3.jpg', alt_text: 'Phối cảnh 3' },
      ])
    );
  });

  it('preserves location map hotspot coordinates', () => {
    const project = normalizeProjectForm({
      location_map_image: '/map.jpg',
      location_map_x: 35.8,
      location_map_y: 72.4,
    });
    expect(project.location_map_x).toBe(35.8);
    expect(project.location_map_y).toBe(72.4);
  });
});
