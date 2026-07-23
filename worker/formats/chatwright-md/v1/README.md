# CHATWRIGHT.md format v1 — served copy

`schema.json` in this directory is served verbatim at
`https://chatwright.dev/formats/chatwright-md/v1/schema.json` (see
`../../../index.ts`, which imports it and re-serves it byte-for-byte with
`Content-Type: application/json`).

**Canonical source:** `formats/chatwright-md/v1/schema.json` and
`formats/chatwright-md/v1/README.md` in
[`chatwright/chatwright`](https://github.com/chatwright/chatwright) — decision
[0013](https://github.com/chatwright/chatwright/blob/main/spec/decisions/0013-chatwright-md-federation.md)
governs the manifest format; the front-matter schema there is hand-authored
until generation tooling exists.

This copy is **not** independently maintained: it is re-copied here from the
canonical source whenever the manifest format releases a change. Do not
hand-edit `schema.json` in this repository.

`page.ts` in this directory renders the human-readable format page at
`https://chatwright.dev/formats/chatwright-md/v1`, adapting the canonical
README's prose (what `CHATWRIGHT.md` is, the front-matter example, required
fields, versioning-by-tag, the badge) to this repo's shared landing/format
page styling.
