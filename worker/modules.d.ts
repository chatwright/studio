// Wrangler Text-module imports (see wrangler.jsonc "rules"): install
// scripts are bundled as plain strings.
declare module '*.sh' {
  const text: string;
  export default text;
}

declare module '*.ps1' {
  const text: string;
  export default text;
}
