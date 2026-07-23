// The "Try in Chatwright" README badge, served at https://chatwright.dev/badge.svg
// (see ./index.ts). Hand-authored, dependency-free SVG — no image libraries,
// no build step. Colours are the site's own accent pair (see the :root
// custom properties in ./landing.ts): --ink for the brand segment, --mint
// with the site's established on-mint text colour (the same #06271d used by
// .primary buttons) for the call-to-action segment, so a badge pasted into a
// third-party README reads as unmistakably Chatwright's.
//
// Referenced from the CHATWRIGHT.md manifest format
// (./formats/chatwright-md/v1/page.ts) and decision
// 0013-chatwright-md-federation.md in chatwright/chatwright:
//   [![Try in Chatwright](https://chatwright.dev/badge.svg)](https://chatwright.dev/try/github/OWNER/REPO)
export const badgeSvgDocument = `<svg xmlns="http://www.w3.org/2000/svg" width="132" height="20" role="img" aria-label="Chatwright: Try it">
  <title>Chatwright: Try it</title>
  <clipPath id="cw-badge-r"><rect width="132" height="20" rx="3"/></clipPath>
  <g clip-path="url(#cw-badge-r)">
    <rect width="80" height="20" fill="#111827"/>
    <rect x="80" width="52" height="20" fill="#50cba0"/>
  </g>
  <g font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" text-anchor="middle">
    <text x="40" y="14" fill="#ffffff" textLength="64" lengthAdjust="spacingAndGlyphs">Chatwright</text>
    <text x="106" y="14" fill="#06271d" textLength="34" lengthAdjust="spacingAndGlyphs">Try it</text>
  </g>
</svg>
`;
