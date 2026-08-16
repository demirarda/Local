/**
 * WEB-VİTRİN OG-kart — §12 damga + imza
 * Gerçek görsel render pipeline prova sonrası; meta + stamp payload şimdi.
 */
export function buildOgCard({
  title,
  description,
  imageUrl = null,
  url = null,
  stamp = null,
  signature = null,
  type = 'website',
  siteName = 'LOCAL',
  locale = 'tr_TR',
} = {}) {
  const damga = stamp || new Date().toISOString().slice(0, 10);
  const imza = signature || 'LOCAL';
  const resolvedTitle = title || 'LOCAL';
  const resolvedDescription = description || 'LOCAL — şehir ritüelleri';
  return {
    title: resolvedTitle,
    description: resolvedDescription,
    image: imageUrl,
    image_alt: imageUrl ? resolvedTitle : null,
    url,
    type,
    site_name: siteName,
    locale,
    stamp: damga,
    signature: imza,
    /** Twitter/X kartı OG ile aynı içerikten türer */
    twitter_card: imageUrl ? 'summary_large_image' : 'summary',
    /** Prova sonrası image pipeline: damga+imza overlay */
    render_pipeline: 'stub',
  };
}

/** OG kartında olması zorunlu alanlar — SSR smoke kontrolü */
export const OG_REQUIRED_FIELDS = [
  'title',
  'description',
  'url',
  'type',
  'site_name',
  'stamp',
  'signature',
];

/** @returns {string[]} eksik alan adları (boşsa kart tam) */
export function missingOgFields(og) {
  if (!og || typeof og !== 'object') return [...OG_REQUIRED_FIELDS];
  return OG_REQUIRED_FIELDS.filter((field) => {
    const value = og[field];
    return value == null || value === '';
  });
}
