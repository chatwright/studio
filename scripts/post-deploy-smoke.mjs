const baseURL = new URL(process.argv[2] ?? 'https://chatwright.dev/prototype/');

async function fetchOK(pathname) {
  const url = new URL(pathname, baseURL);
  // Worker pages are edge-cached (Cache-Control: public, max-age=300) and the
  // smoke runs within a second of `wrangler deploy` — without a unique query
  // the edge can serve the PREVIOUS deploy's HTML and fail assertions about
  // markup that is in fact live (run 30090757271). Route handlers match on
  // pathname only, so the parameter is invisible to the worker.
  url.searchParams.set('smokebust', String(Date.now()));
  let response;

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    response = await fetch(url, { redirect: 'follow' });
    if (response.ok) {
      return response;
    }
    if (attempt < 6 && (response.status === 404 || response.status >= 500)) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      continue;
    }
    break;
  }

  throw new Error(`${url} returned HTTP ${response?.status ?? 'no response'} after propagation retries`);
}

const shellResponse = await fetchOK('./');
const shell = await shellResponse.text();

const rootResponse = await fetchOK('/');
const root = await rootResponse.text();
if (!root.includes('The platform is emulated.') || !root.includes('/studio/player')) {
  throw new Error('Root domain is not the Chatwright landing page with the player hero');
}
if (!root.includes('conversational UX') || !root.includes('/formats/chatwright-md/v1')) {
  throw new Error('Root domain is not the repositioned knowledge-platform landing page');
}
if (!root.includes('href="/pricing"')) {
  throw new Error('Root domain landing page is missing the /pricing link');
}

await fetchOK('/formats/chatwright-md/v1');
await fetchOK('/formats/chatwright-md/v1/schema.json');
await fetchOK('/badge.svg');
await fetchOK('/try/github/chatwright/recipes');

const recipesResponse = await fetchOK('/recipes');
const recipesBody = await recipesResponse.text();
if (!recipesBody.includes('Every recipe runs')) {
  throw new Error('/recipes is not the knowledge-graph recipes page');
}

const pricingResponse = await fetchOK('/pricing');
const pricingBody = await pricingResponse.text();
if (!pricingBody.includes('included in your sneat.work subscription')) {
  throw new Error('/pricing is not the bundle-explaining pricing page');
}
if (!pricingBody.includes('data-buy-plan="team"')) {
  throw new Error('/pricing tier cards are missing the embedded-checkout buy buttons');
}
// The tier cards must no longer bounce buyers to the sneat.work pricing page
// — checkout happens on-site. Only the four tier cards are asserted: the
// Lifetime card below the grid still links out for now, and the footer/
// bundle prose may mention sneat.work as text.
const tierGridStart = pricingBody.indexOf('class="tier-grid"');
const tierGridEnd = pricingBody.indexOf('class="lifetime-card"');
if (tierGridStart === -1 || tierGridEnd === -1 || tierGridEnd < tierGridStart) {
  throw new Error('/pricing has lost the tier grid followed by the lifetime card');
}
if (pricingBody.slice(tierGridStart, tierGridEnd).includes('sneat.work/team/#pricing')) {
  throw new Error('/pricing tier cards still link out to the sneat.work pricing page');
}

const checkoutReturnResponse = await fetchOK('/pricing/return');
const checkoutReturnBody = await checkoutReturnResponse.text();
if (!checkoutReturnBody.includes('id="checkout-return"')) {
  throw new Error('/pricing/return is not the embedded-checkout return page');
}

if (!shell.includes('<base href="/studio/">')) {
  throw new Error('Deployed shell does not use the /studio/ Angular base href');
}

const mainScript = shell.match(/src="([^"]*main[^"?]*\.js)"/)?.[1];
if (!mainScript) {
  throw new Error('Could not find the built Angular main script in deployed HTML');
}

await fetchOK(mainScript);

// The four design-prototype pages now live under /studio/prototypes/ (see
// spec/ideas/studio-ui-surfaces.md, MVP Scope item 2). fetchOK already
// follows redirects, so these two forms both have to resolve: the new
// canonical deep links, and the old top-level paths (an Angular
// `redirectTo`, not an HTTP redirect — the SPA shell serves 200 either way,
// so this mainly guards against the old routes 404ing if the redirect ever
// regresses).
await fetchOK('prototypes/emulator');
await fetchOK('prototypes/scenario');
await fetchOK('prototypes/run?event=2&platform=telegram&view=rendered');
await fetchOK('emulator');

await fetchOK('/studio/playground');
await fetchOK('/studio/player');

// The legacy /prototype/ mount (worker-level 308, unrelated to the Angular
// routes above) still has to resolve too.
await fetchOK('/prototype/emulator');

console.log(`Chatwright Studio smoke passed at ${baseURL}`);
