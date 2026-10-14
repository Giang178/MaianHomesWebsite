import ContentWorkspace from '@/features/content/ContentWorkspace';

export const metadata = {
  title: {
    absolute: 'Quản lý Bài viết & SEO/GEO | Maian Homes Admin',
  },
  description: 'Hệ thống quản trị nội dung tin tức bất động sản, kiểm duyệt 2 cấp và tối ưu hóa SEO/GEO cho AI Answer Engines.',
};

export default function AdminArticlesPage() {
  return <ContentWorkspace initialTab="news" />;
}
