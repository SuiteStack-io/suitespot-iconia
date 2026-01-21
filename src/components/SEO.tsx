import { Helmet } from 'react-helmet-async';

const BASE_URL = 'https://www.findyoursuitespot.com';
const DEFAULT_OG_IMAGE = '/slideshow/iconia-zamalek.jpg';
const SITE_NAME = 'SuiteSpot Hospitality';

interface BreadcrumbItem {
  name: string;
  path?: string;
}

interface SEOProps {
  title: string;
  description: string;
  path: string;
  ogImage?: string;
  robots?: string;
  type?: string;
  breadcrumbs?: BreadcrumbItem[];
  additionalJsonLd?: object | object[];
}

export const SEO = ({
  title,
  description,
  path,
  ogImage = DEFAULT_OG_IMAGE,
  robots = 'index, follow',
  type = 'website',
  breadcrumbs,
  additionalJsonLd,
}: SEOProps) => {
  const canonicalUrl = `${BASE_URL}${path}`;
  const fullOgImage = ogImage.startsWith('http') ? ogImage : `${BASE_URL}${ogImage}`;
  
  // Generate BreadcrumbList JSON-LD
  const breadcrumbJsonLd = breadcrumbs && breadcrumbs.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs.map((crumb, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": crumb.name,
      ...(crumb.path ? { "item": `${BASE_URL}${crumb.path}` } : {})
    }))
  } : null;

  // Combine all JSON-LD schemas
  const allJsonLd = [
    breadcrumbJsonLd,
    ...(Array.isArray(additionalJsonLd) ? additionalJsonLd : additionalJsonLd ? [additionalJsonLd] : [])
  ].filter(Boolean);

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      <meta name="robots" content={robots} />
      
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={fullOgImage} />
      <meta property="og:site_name" content={SITE_NAME} />
      
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullOgImage} />

      {allJsonLd.map((jsonLd, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      ))}
    </Helmet>
  );
};

export default SEO;
