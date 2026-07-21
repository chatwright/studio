interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS: AssetsBinding;
}

const mountPath = '/prototype';
const rootDocument = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <title>Chatwright</title>
    <style>
      :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      body { min-height: 100vh; display: grid; place-items: center; margin: 0; color: #122033; background: #f5f8fb; }
      main { display: grid; justify-items: center; gap: 0.75rem; padding: 2rem; text-align: center; }
      mark { width: 3rem; height: 3rem; display: grid; place-items: center; border-radius: 0.9rem; color: #07130f; background: linear-gradient(145deg, #70ffd0, #56b8ff); font: 800 1.2rem/1 ui-monospace, monospace; transform: rotate(90deg); }
      h1 { margin: 0; font-size: clamp(2rem, 7vw, 4rem); letter-spacing: -0.06em; }
      p { margin: 0; color: #617086; font-size: 0.95rem; }
      @media (prefers-color-scheme: dark) { body { color: #eef4ff; background: #0b111d; } p { color: #96a5ba; } }
    </style>
  </head>
  <body><main><mark>▥</mark><h1>Chatwright</h1><p>Conversation testing infrastructure.</p></main></body>
</html>`;

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
      return new Response(request.method === 'HEAD' ? null : rootDocument, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300'
        }
      });
    }

    if (incomingURL.pathname === mountPath) {
      incomingURL.pathname = `${mountPath}/`;
      return Response.redirect(incomingURL.toString(), 308);
    }

    if (!incomingURL.pathname.startsWith(`${mountPath}/`)) {
      return new Response('Not found', { status: 404 });
    }

    const assetURL = new URL(request.url);
    assetURL.pathname = incomingURL.pathname.slice(mountPath.length) || '/';

    return env.ASSETS.fetch(new Request(assetURL, request));
  }
};
