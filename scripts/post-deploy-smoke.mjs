const baseURL = new URL(process.argv[2] ?? 'https://chatwright.dev/prototype/');

async function fetchOK(pathname) {
  const url = new URL(pathname, baseURL);
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return response;
}

const shellResponse = await fetchOK('./');
const shell = await shellResponse.text();

const rootResponse = await fetchOK('/');
const root = await rootResponse.text();
if (!root.includes('Your bot has a user interface.') || !root.includes('/studio/emulator')) {
  throw new Error('Root domain is not the Chatwright landing page with the live Studio preview');
}

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
