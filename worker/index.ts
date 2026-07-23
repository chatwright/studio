interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS: AssetsBinding;
}

import { landingDocument } from './landing';
import { vanityImportResponse } from './vanity';
import { runBundleV1PageDocument } from './formats/run-bundle/v1/page';
import runBundleV1Schema from './formats/run-bundle/v1/schema.json';
import { chatwrightMdV1PageDocument } from './formats/chatwright-md/v1/page';
import chatwrightMdV1Schema from './formats/chatwright-md/v1/schema.json';
import { recipesPageDocument } from './recipes/page';
import { badgeSvgDocument } from './badge';
import { tryGithubResponse } from './try-github';

const studioMountPath = '/studio';
const legacyMountPath = '/prototype';

const robotsDocument = `User-agent: *
Allow: /

Sitemap: https://chatwright.dev/sitemap.xml
`;

const sitemapDocument = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://chatwright.dev/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;

// The run-bundle format v1 documentation page and its machine-readable
// schema. Re-serialising the imported schema module (rather than shipping a
// second copy of the raw text) is safe here: encoding/json's Go writer and
// JSON.stringify agree byte-for-byte on this file's key order, two-space
// indent and escaping — see worker/formats/run-bundle/v1/README.md for the
// canonical source and how this copy is kept in sync on format releases.
const runBundleV1FormatPath = '/formats/run-bundle/v1';
const runBundleV1SchemaPath = '/formats/run-bundle/v1/schema.json';
const runBundleV1SchemaDocument = `${JSON.stringify(runBundleV1Schema, null, 2)}\n`;

// The CHATWRIGHT.md manifest format v1 documentation page and its
// machine-readable schema — same re-serialisation pattern as run-bundle
// above; see worker/formats/chatwright-md/v1/README.md for the canonical
// source and how this copy is kept in sync on format releases.
const chatwrightMdV1FormatPath = '/formats/chatwright-md/v1';
const chatwrightMdV1SchemaPath = '/formats/chatwright-md/v1/schema.json';
const chatwrightMdV1SchemaDocument = `${JSON.stringify(chatwrightMdV1Schema, null, 2)}\n`;

// The /recipes page — the Chatwright knowledge graph (Jobs, Recipes,
// Implementations and the federation registry) rendered from a hand-embedded
// snapshot of chatwright/recipes; see worker/recipes/data.ts for the
// provenance disclaimer and worker/recipes/page.ts for the page itself.
const recipesPath = '/recipes';

const badgeSvgPath = '/badge.svg';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const incomingURL = new URL(request.url);

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', {
        status: 405,
        headers: { Allow: 'GET, HEAD' }
      });
    }

    if (incomingURL.pathname === '/') {
      return new Response(request.method === 'HEAD' ? null : landingDocument, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300'
        }
      });
    }

    if (incomingURL.pathname === '/robots.txt') {
      return new Response(request.method === 'HEAD' ? null : robotsDocument, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    if (incomingURL.pathname === '/sitemap.xml') {
      return new Response(request.method === 'HEAD' ? null : sitemapDocument, {
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    // Canonical CLI install scripts (chatwright/chatwright
    // spec/plans/code-split-restructuring.md, Task 4):
    //   curl -fsSL https://chatwright.dev/install.sh | sh
    //   irm https://chatwright.dev/install.ps1 | iex
    // Served from the assets bundle (angular.json copies worker/install/*
    // to the assets root) rather than embedded in this script: the
    // Cloudflare API's WAF false-positives on shell-installer text inside
    // a worker-script upload, and assets keep served bytes identical to
    // the committed files anyway.
    if (incomingURL.pathname === '/install.sh' || incomingURL.pathname === '/install.ps1') {
      const assetURL = new URL(request.url);
      const assetResponse = await env.ASSETS.fetch(new Request(assetURL, request));
      if (!assetResponse.ok) {
        return assetResponse;
      }
      return new Response(request.method === 'HEAD' ? null : assetResponse.body, {
        headers: {
          'Content-Type': incomingURL.pathname === '/install.sh' ? 'text/x-shellscript; charset=utf-8' : 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=300'
        }
      });
    }

    if (incomingURL.pathname === runBundleV1FormatPath || incomingURL.pathname === `${runBundleV1FormatPath}/`) {
      return new Response(request.method === 'HEAD' ? null : runBundleV1PageDocument, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300'
        }
      });
    }

    if (incomingURL.pathname === runBundleV1SchemaPath) {
      return new Response(request.method === 'HEAD' ? null : runBundleV1SchemaDocument, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=300'
        }
      });
    }

    if (incomingURL.pathname === chatwrightMdV1FormatPath || incomingURL.pathname === `${chatwrightMdV1FormatPath}/`) {
      return new Response(request.method === 'HEAD' ? null : chatwrightMdV1PageDocument, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300'
        }
      });
    }

    if (incomingURL.pathname === chatwrightMdV1SchemaPath) {
      return new Response(request.method === 'HEAD' ? null : chatwrightMdV1SchemaDocument, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=300'
        }
      });
    }

    if (incomingURL.pathname === recipesPath || incomingURL.pathname === `${recipesPath}/`) {
      return new Response(request.method === 'HEAD' ? null : recipesPageDocument, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300'
        }
      });
    }

    if (incomingURL.pathname === badgeSvgPath) {
      return new Response(request.method === 'HEAD' ? null : badgeSvgDocument, {
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=86400'
        }
      });
    }

    const tryGithub = tryGithubResponse(incomingURL, request);
    if (tryGithub) {
      return tryGithub;
    }

    const vanityResponse = vanityImportResponse(incomingURL, request);
    if (vanityResponse) {
      return vanityResponse;
    }

    if (incomingURL.pathname === legacyMountPath || incomingURL.pathname.startsWith(`${legacyMountPath}/`)) {
      incomingURL.pathname = incomingURL.pathname.replace(legacyMountPath, studioMountPath);
      return Response.redirect(incomingURL.toString(), 308);
    }

    if (incomingURL.pathname === studioMountPath) {
      incomingURL.pathname = `${studioMountPath}/`;
      return Response.redirect(incomingURL.toString(), 308);
    }

    if (!incomingURL.pathname.startsWith(`${studioMountPath}/`)) {
      return new Response('Not found', { status: 404 });
    }

    const assetURL = new URL(request.url);
    assetURL.pathname = incomingURL.pathname.slice(studioMountPath.length) || '/';

    return env.ASSETS.fetch(new Request(assetURL, request));
  }
};
