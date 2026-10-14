import { MetadataRoute } from 'next';
import { headers } from 'next/headers';

const AI_CITATION_BOTS = [
  'GPTBot',
  'ChatGPT-User',
  'PerplexityBot',
  'ClaudeBot',
  'anthropic-ai',
  'Google-Extended',
  'Bingbot',
  'Googlebot',
];

const BLOCKED_ADMIN_BOTS = [
  'GPTBot',
  'Google-Extended',
  'PerplexityBot',
  'ClaudeBot',
  'CCBot',
  'AmazonBot',
  'anthropic-ai',
  'Applebot-Extended',
  'AI2Bot',
  'Bytespider',
];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const isAdminSubdomain = host.startsWith('admin.');
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://maianhomes.vn';

  if (isAdminSubdomain) {
    return {
      rules: [
        { userAgent: '*', disallow: '/' },
        ...BLOCKED_ADMIN_BOTS.map((userAgent) => ({ userAgent, disallow: '/' })),
      ],
    };
  }

  return {
    rules: [
      {
        userAgent: AI_CITATION_BOTS,
        allow: '/',
        disallow: [
          '/api/',
        ],
      },
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
