import { Helmet } from 'react-helmet-async';
import { getCanonicalUrl, getAlternateUrls, SITE_CONFIG, type SEOConfig } from '../utils/seo';

interface SEOProps extends Partial<SEOConfig> {
  path?: string;
  structuredData?: object | object[];
  children?: React.ReactNode;
}

export function SEO({
  title,
  description,
  keywords,
  image,
  url,
  type = 'website',
  noindex = false,
  path = '',
  structuredData,
  children,
}: SEOProps) {
  const canonicalUrl = url || getCanonicalUrl(path);
  const ogImage = image || `${SITE_CONFIG.domain}${SITE_CONFIG.defaultImage}`;
  const fullTitle = title || SITE_CONFIG.siteName;
  const alternateUrls = getAlternateUrls(path);

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      {keywords && <meta name="keywords" content={keywords} />}

      {/* Canonical URL */}
      <link rel="canonical" href={canonicalUrl} />

      {/* Robots */}
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content={SITE_CONFIG.siteName} />
      <meta property="og:locale" content="uz_UZ" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={ogImage} />

      {/* Language Alternates */}
      {alternateUrls.map(({ lang, url }) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={url} />
      ))}

      {/* Structured Data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(Array.isArray(structuredData) ? structuredData : [structuredData])}
        </script>
      )}

      {/* Additional custom elements */}
      {children}
    </Helmet>
  );
}
