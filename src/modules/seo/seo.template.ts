export type OgPreviewData = {
  title: string;
  description: string;
  imageUrl: string | null;
  pageUrl: string;
};

// Minimal escaping for the handful of characters that break an HTML attribute value — this
// only ever renders inside `content="..."`, never as raw markup, so a full HTML-escape library
// would be overkill.
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// A static HTML shell for crawlers only (facebookexternalhit/Twitterbot/etc. don't execute JS,
// so they can't read tags the SPA would set client-side) — not a real page for humans. See
// seo.bot-detector.ts's isKnownCrawler for who this is served to.
export const buildOgPreviewHtml = (data: OgPreviewData): string => {
  const title = escapeHtml(data.title);
  const description = escapeHtml(data.description);
  const url = escapeHtml(data.pageUrl);
  const imageTag = data.imageUrl ? `<meta property="og:image" content="${escapeHtml(data.imageUrl)}" />` : '';

  return `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${url}" />
  ${imageTag}
</head>
<body></body>
</html>`;
};
