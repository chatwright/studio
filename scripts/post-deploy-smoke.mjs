const baseURL = new URL(process.argv[2] ?? 'https://chatwright.dev/prototype/');

async function fetchOK(pathname) {
  const url = new URL(pathname, baseURL);
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

await fetchOK('/formats/chatwright-md/v1');
await fetchOK('/formats/chatwright-md/v1/schema.json');
await fetchOK('/badge.svg');
await fetchOK('/try/github/chatwright/recipes');

if (!shell.includes('<base href="/studio/">')) {
  throw new Error('Deployed shell does not use the /studio/ Angular base href');
}

const mainScript = shell.match(/src="([^"]*main[^"?]*\.js)"/)?.[1];
if (!mainScript) {
  throw new Error('Could not find the built Angular main script in deployed HTML');
}

await fetchOK(mainScript);
await fetchOK('emulator');
await fetchOK('scenario');
await fetchOK('run?event=2&platform=telegram&view=rendered');
await fetchOK('/prototype/emulator');

console.log(`Chatwright Studio smoke passed at ${baseURL}`);
