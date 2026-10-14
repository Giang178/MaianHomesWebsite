import CompanyKnowledgePanel from '@/features/content/company/CompanyKnowledgePanel';

export const metadata = {
  title: {
    absolute: 'Kho kiến thức doanh nghiệp | Maian Homes Admin',
  },
  description: 'Quản lý nguồn dữ liệu doanh nghiệp dùng chung cho website, FAQ Schema và trợ lý AI.',
};

export default function CompanyKnowledgePage() {
  return <CompanyKnowledgePanel />;
}