import { CoworkingData, OfficeBuilding, OfficeUnit, WorkspaceFAQ } from './types';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://maianhomes.vn';

function buildCoworkingStructuredData(
  coworking: CoworkingData,
  faqs: WorkspaceFAQ[] = [],
) {
  const rawHeroImage = coworking.hero.image_url?.trim();
  const heroImage = rawHeroImage
    ? rawHeroImage.startsWith('http')
      ? rawHeroImage
      : `${SITE_URL}${rawHeroImage}`
    : undefined;

  const offers = (coworking.pricing_plans || [])
    .filter((plan) => plan.price && plan.price > 0 && plan.status === 'ACTIVE')
    .map((plan) => ({
      '@type': 'Offer',
      name: plan.name,
      description: plan.description || undefined,
      price: plan.price,
      priceCurrency: plan.currency || undefined,
      availability: 'https://schema.org/InStock',
      validFrom: plan.duration || undefined,
      category: plan.seat_type_name || undefined,
    }));

  const faqItems = faqs
    .filter((faq) => faq.question && faq.answer)
    .map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    }));

  const location = coworking.location;
  const hasCoordinates =
    typeof location.latitude === 'number' && typeof location.longitude === 'number';

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: coworking.name || undefined,
        url: SITE_URL,
        logo: `${SITE_URL}/images/logo_maian.png`,
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: location.contact_phone || undefined,
          contactType: 'customer service',
          areaServed: 'VN',
          availableLanguage: ['Vietnamese', 'English'],
        },
      },
      {
        '@type': 'Place',
        '@id': `${SITE_URL}/dich-vu-cho-thue/coworking#place`,
        name: coworking.name || undefined,
        description: coworking.introduction.short_desc || undefined,
        image: heroImage,
        address: {
          '@type': 'PostalAddress',
          streetAddress: location.address || undefined,
          addressLocality: location.district || undefined,
          addressRegion: location.city || undefined,
          addressCountry: 'VN',
        },
        geo: hasCoordinates
          ? {
              '@type': 'GeoCoordinates',
              latitude: location.latitude,
              longitude: location.longitude,
            }
          : undefined,
        telephone: location.contact_phone || undefined,
      },
      {
        '@type': 'Service',
        '@id': `${SITE_URL}/dich-vu-cho-thue/coworking#service`,
        name: coworking.name || undefined,
        serviceType: coworking.hero.title || undefined,
        provider: {
          '@id': `${SITE_URL}/#organization`,
        },
        areaServed: location.city
          ? {
              '@type': 'City',
              name: location.city,
            }
          : undefined,
        description:
          coworking.seo_metadata?.description ||
          coworking.introduction.short_desc ||
          undefined,
        offers: offers.length > 0 ? offers : undefined,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: SITE_URL,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Services',
            item: `${SITE_URL}/dich-vu-cho-thue/coworking`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: coworking.name || undefined,
            item: `${SITE_URL}/dich-vu-cho-thue/coworking`,
          },
        ],
      },
      ...(faqItems.length > 0
        ? [
            {
              '@type': 'FAQPage',
              mainEntity: faqItems,
            },
          ]
        : []),
    ],
  };
}
function buildOfficeLandingStructuredData(
  landing?: import('./types').OfficeLandingData,
  faqs: WorkspaceFAQ[] = [],
) {
  const faqItems = faqs
    .filter((f) => f.question && f.answer)
    .map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer,
      },
    }));

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: landing?.hero_title || undefined,
        url: SITE_URL,
      },
      {
        '@type': 'CollectionPage',
        '@id': `${SITE_URL}/dich-vu-cho-thue/office#page`,
        name: landing?.seo_metadata?.title || landing?.hero_title || undefined,
        description: landing?.seo_metadata?.description || landing?.hero_description || undefined,
        url: `${SITE_URL}/dich-vu-cho-thue/office`,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Trang chủ',
            item: SITE_URL,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Dịch vụ cho thuê',
            item: `${SITE_URL}/dich-vu-cho-thue/office`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: undefined,
            item: `${SITE_URL}/dich-vu-cho-thue/office`,
          },
        ],
      },
      ...(faqItems.length > 0
        ? [
            {
              '@type': 'FAQPage',
              mainEntity: faqItems,
            },
          ]
        : []),
    ],
  };
}

function buildBuildingDetailStructuredData(
  building: OfficeBuilding,
  units: OfficeUnit[] = [],
  faqs: WorkspaceFAQ[] = [],
) {
  const primaryImage =
    building.images?.find((img) => img.is_primary)?.url ||
    building.images?.[0]?.url;

  const fullImageUrl = primaryImage
    ? primaryImage.startsWith('http')
      ? primaryImage
      : `${SITE_URL}${primaryImage}`
    : undefined;

  const unitList = units.length > 0 ? units : building.units || [];
  const offers = unitList
    .filter((u) => u.rental_price && u.status !== 'HIDDEN')
    .map((u) => ({
      '@type': 'Offer',
      name: u.floor ? `${building.name} - ${u.floor}` : `${building.name} - Sàn ${u.area || ''}m²`,
      price: u.rental_price,
      priceCurrency: u.currency || undefined,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: u.rental_price,
        priceCurrency: u.currency || undefined,
        unitText: u.price_unit || undefined,
      },
      availability:
        u.availability_status === 'AVAILABLE'
          ? 'https://schema.org/InStock'
          : 'https://schema.org/PreOrder',
      description: u.notes || undefined,
    }));

  const faqItems = faqs
    .filter((f) => f.question && f.answer)
    .map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer,
      },
    }));

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'RealEstateListing',
        '@id': `${SITE_URL}/dich-vu-cho-thue/office/${building.slug}#listing`,
        name: building.name,
        description: building.seo_metadata?.description || building.description,
        image: fullImageUrl,
        url: `${SITE_URL}/dich-vu-cho-thue/office/${building.slug}`,
        dateModified: new Date().toISOString(),
        address: {
          '@type': 'PostalAddress',
          streetAddress: building.address,
          addressLocality: building.district,
          addressRegion: building.city,
          addressCountry: 'VN',
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: building.latitude || 10.7769,
          longitude: building.longitude || 106.7009,
        },
        amenityFeature: (building.amenities || []).map((a) => ({
          '@type': 'LocationFeatureSpecification',
          name: a,
          value: true,
        })),
        offers: offers.length > 0 ? offers : undefined,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Trang chủ',
            item: SITE_URL,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Dịch vụ cho thuê',
            item: `${SITE_URL}/dich-vu-cho-thue/office`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: 'Cho thuê văn phòng',
            item: `${SITE_URL}/dich-vu-cho-thue/office`,
          },
          {
            '@type': 'ListItem',
            position: 4,
            name: building.name,
            item: `${SITE_URL}/dich-vu-cho-thue/office/${building.slug}`,
          },
        ],
      },
      ...(faqItems.length > 0
        ? [
            {
              '@type': 'FAQPage',
              mainEntity: faqItems,
            },
          ]
        : []),
    ],
  };
}

export const generateCoworkingJsonLd = (
  coworking: any,
  _plans?: any,
  faqs?: any,
) => buildCoworkingStructuredData(coworking, faqs);

export const generateOfficeLandingJsonLd = (
  _landing?: any,
  _buildings?: any,
  faqs?: any,
) => buildOfficeLandingStructuredData(_landing, faqs);

export const generateBuildingJsonLd = (
  building: any,
  units?: any,
  faqs?: any,
) => buildBuildingDetailStructuredData(building, units, faqs);
