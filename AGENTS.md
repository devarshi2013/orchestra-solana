<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Quill project rules

- No custom smart contracts or on-chain programs. On-chain execution goes only through Jupiter REST APIs (Swap v2 `/order` + `/execute`).
- Non-custodial: the user's wallet signs every transaction (`signTransaction`, never send it from the wallet). Do not use Jupiter Trigger v2 or DCA: they deposit into custodial vaults.
- `JUPITER_API_KEY` is server-only. The browser calls `/api/*`, which goes through `src/server/jupiter/client.ts`. Never use `lite-api.jup.ag`.
- Endpoint shapes and caveats: `docs/jupiter-api.md`. Env: `src/env/`. Run `pnpm check` before finishing.
