const API_URL = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://maianhomes.vn';

type CompanyPayload = {
  company: null | {
    company_name?: string;
    overview?: string;
    services?: string[];
    service_areas?: string[];
    working_hours?: string;
    consultation_process?: string[];
    policies?: string[];
    faqs?: Array<{question: string; answer: string}>;
    effective_date?: string;
  };
  contact?: {phone?: string; email?: string};
};

export async function GET() {
  let payload: CompanyPayload = {company: null, contact: {}};
  try {
    const response = await fetch(`${API_URL}/api/public/company-knowledge`, {
      next: {revalidate: 300, tags: ['company-knowledge']},
    });
    if (response.ok) payload = await response.json() as CompanyPayload;
  } catch {
    // Keep the file conservative when the knowledge API is temporarily unavailable.
  }

  const company = payload.company;
  const contact = payload.contact || {};
  const lines = [
    '# Maian Homes — verified AI knowledge',
    `# Effective date: ${company?.effective_date || 'not published'}`,
    '',
    '## Organization',
    `- Name: ${company?.company_name || 'Maian Homes'}`,
    ...(company?.overview ? [`- Overview: ${company.overview}`] : []),
    ...(company?.service_areas?.length ? [`- Service areas: ${company.service_areas.join('; ')}`] : []),
    ...(company?.working_hours ? [`- Working hours: ${company.working_hours}`] : []),
    ...(contact.phone ? [`- Hotline: ${contact.phone}`] : []),
    ...(contact.email ? [`- Email: ${contact.email}`] : []),
    '',
    '## Services',
    ...(company?.services?.length ? company.services.map(item => `- ${item}`) : ['- No company service profile has been published.']),
    '',
    '## Consultation process',
    ...(company?.consultation_process?.length ? company.consultation_process.map((item, index) => `${index + 1}. ${item}`) : ['- Not published.']),
    '',
    '## Frequently asked questions',
    ...(company?.faqs?.length ? company.faqs.flatMap(item => [`- Q: ${item.question}`, `  A: ${item.answer}`]) : ['- Not published.']),
    '',
    '## Official pages',
    `- Company: ${SITE_URL}/gioi-thieu`,
    `- Projects: ${SITE_URL}/du_an`,
    `- Contact: ${SITE_URL}/lien-he`,
  ];
  return new Response(lines.join('\n'), {
    headers: {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=60, s-maxage=300'},
  });
}
