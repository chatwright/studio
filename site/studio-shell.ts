import { studioMetadata } from '../src/app/studio-metadata';

const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]!));

/** Keep the compiled Angular assets/base URL intact, with useful HTML before JS starts. */
export function studioShell(html: string, route: string): string {
  const metadata = studioMetadata(route);
  const title = escapeHtml(metadata.title);
  const description = escapeHtml(metadata.description);
  const head = `<title>${title}</title>
    <meta name="description" content="${description}">
    <meta name="robots" content="${metadata.robots}">
    <link rel="canonical" href="${metadata.canonical}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Chatwright">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:url" content="${metadata.canonical}">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">`;
  return html.replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name="description"[\s\S]*?>/i, '')
    .replace('</head>', `${head}\n</head>`)
    .replace('<cw-root></cw-root>', `<cw-root><main><h1>${title}</h1><p>${description}</p><p>Enable JavaScript to use this tool. <a href="/quickstart">Read the CLI quickstart</a> or <a href="/">explore Chatwright</a>.</p></main></cw-root>`);
}
