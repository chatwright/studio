interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS: AssetsBinding;
}

import { landingDocument } from './landing';

const studioMountPath = '/studio';
const legacyMountPath = '/prototype';

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
