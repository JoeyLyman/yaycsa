## File Access Boundary

- The `~/Programs/yaycsa` tree is trusted and git-backed.
- Do not read, search, edit, or write files outside `~/Programs/yaycsa` unless the user explicitly asks for it.
- This includes shell dotfiles, home directory files, sibling repos, and system files.
- If a task appears to require access outside the repo, stop and ask permission first.

## Shared Docs & Todo (git submodule: `apps/docs/`)

Architecture docs and the project todo are maintained in a shared git submodule (`apps/docs/`).
This repo is shared with **Wally** — Joe's OpenClaw bot (runs on Opus 4.6, accessed via Discord). Joe does a lot of YAYCSA planning with Wally, and the results get distilled into the docs here. The docs in this submodule are the **single source of truth** for architecture and feature specs (not SPEC.md, which is outdated).

**On session start:** Pull latest shared docs:

```bash
cd apps/docs && git pull origin main && cd ../..
```

**Key locations:**

- `apps/docs/library/yaycsa/vision.md` — project vision + feature index
- `apps/docs/library/yaycsa/features/` — feature specs (unified accounts, pricing, etc.)
- `apps/docs/library/yaycsa/plugins/` — plugin specs (offer-plugin, marketplace-plugin, inbox-manager)
- `apps/docs/todos/yaycsa.md` — project todo / phase tracker

Before implementing any feature, scan `apps/docs/library/yaycsa/features/` and `apps/docs/library/yaycsa/plugins/` for relevant docs and read them.

## Data Conventions

- **All DB dates/times use `timestamptz`** (Postgres timestamp with time zone), stored in UTC, always full date+time. No bare `date` or `time` types.
- **Money stored as integers in cents** (Vendure convention). `400` = $4.00.
- **Channel assignment:** Custom entities that are `ChannelAware` must be assigned to both the seller's channel AND the default (marketplace) channel. For new unsaved entities, set `entity.channels = [sellerChannel, defaultChannel]` directly — do not use `channelService.assignToCurrentChannel()` on unsaved entities.
- **Always use Vendure Admin API (not raw SQL)** for data operations — creating/updating entities, linking relations, seeding data. Vendure fires events, updates search indexes, syncs channels, and runs hooks on entity mutations. Raw SQL bypasses all of that and can leave the system in an inconsistent state.
- **Seller Admin Proxy constraint:** Vendure's SuperAdmin is only authorized in the **default channel**. Using `vendure-token` to scope Admin API requests to a seller's channel causes FORBIDDEN. All proxy queries run in the default channel and filter by `sellerId` custom field instead. Channel assignment via `assignProductsToChannel` also fails for seller channels. See `apps/docs/library/yaycsa/features/seller-admin-proxy.md` for full details.
- See `apps/docs/library/yaycsa/data-conventions.md` for full details.

**If you update docs or the todo:** Do **not** commit or push. Leave all git actions to Joe.

```bash
# Never run git add / commit / push unless Joe explicitly asks.
```

## Git Safety Rule

- Never run `git add`, `git commit`, `git push`, `git pull --rebase`, or any other git history-changing command unless Joe explicitly asks for that exact git action in the current chat.
- Default behavior: make file edits only and leave the repo/submodule uncommitted.
- If a task would normally end with a commit or push, stop at "files updated locally" and let Joe handle git.

## Plan Library

When asked to "save this plan" or "save to plan library", save the current plan as a formatted markdown file to library/yaycsa/plans/<descriptive-name>.md in the apps/docs submodule. don't commit or push, but instead prompt me by saying "plan is locally saved to the plan library - feel free to commit and push."

## Storefront Component Conventions

Components live in `apps/storefront/src/lib/components/` and follow a consistent naming pattern.

### Filesystem naming

- **Use lowercase kebab-case for component directories and component filenames.**
- Do **not** create camelCase or PascalCase component directories/files.
- Standard structure: `<category>/<component-name>/<component-name>.svelte` with an `index.ts` barrel export.

Examples:
- `bits/button/button.svelte` + `bits/button/index.ts`
- `blocks/product-list-row-fields/product-list-row-fields.svelte` + `blocks/product-list-row-fields/index.ts`
- `bundles/navbar/navbar.svelte` + `bundles/navbar/index.ts`

Import via the directory (barrel): `import { Navbar } from '$lib/components/bundles/navbar'`

### Category meanings

- **`bits/`** — atomic UI primitives (button, card, input, avatar). These are shadcn-svelte components.
- **`blocks/`** — reusable composed components made from multiple bits. Use this for shared UI chunks that are reused across features, such as reusable row field editors like `product-list-row-fields`.
- **`bundles/`** — app-specific composed implementations with feature or page-level behavior. These may still be reusable, but they are typically higher-level pieces such as forms, navbars, feature tables, and other concrete implementations.

### Multi-file block convention

- A block folder may contain **multiple related component files**, not just one large `.svelte` file.
- Prefer splitting non-trivial reusable UI into focused subcomponents inside the same block folder instead of creating one monolithic component.
- For subcomponents inside a shared folder, prefer **prefixing filenames with the parent folder name** for clarity and grep-ability.
- Example: `blocks/product-list-row-fields/` can contain files like `product-list-row-fields-name.svelte`, `product-list-row-fields-bits.svelte`, `product-list-row-fields-processes.svelte`, and `product-list-row-fields-allergen-warnings.svelte`, plus an optional thin coordinator component and `index.ts` barrel exports.

Rule of thumb:
- If it is a small primitive, it belongs in `bits/`.
- If it is a reusable multi-bit building block, it belongs in `blocks/`.
- If it is a specific feature implementation or higher-level composed UI, it belongs in `bundles/`.

## Code Style

- **Verbose comments on state and derived values.** Every reactive variable (`$state`, `$derived`, computed values) should have a JSDoc-style comment above it explaining what it represents, when it's true/false (for booleans), and why it exists. Don't assume variable names are self-documenting — spell it out.
- **Use domain-neutral variable names.** Sellers can be farms, restaurants, grocery stores, distributors, etc. Don't use "farm" in variable names — use "business", "seller", or "sales page" instead.

## Design Conventions

- **Mobile-first design.** No native apps planned — the webapp must be fully functional on mobile. Design for small screens first, enhance for desktop.
- **Table-based UI everywhere.** Wholesale is NOT image-grid e-commerce. Buyers buy from tables, sellers manage from tables. Inline editing, bulk edits, no navigating to detail pages for common ops. Think spreadsheet, not Shopify. Tables must be responsive (horizontal scroll or stacked cards on mobile).
- **No unnecessary UI chrome.** Minimize clicks. Common operations should be inline, not behind modals or detail pages.

## Vendure Tooling

**Use the Vendure CLI directly** for all project interactions — migrations, codegen, plugin scaffolding, etc. Run from `apps/server/`:

```bash
cd apps/server && npx vendure <command>
```

The `@vendure/mcp-server` (local project MCP) is **deprecated and abandoned**. Do NOT use it. The Vendure team explicitly says: "Let your agents interact with the Vendure CLI directly."

**For Vendure documentation lookup**, the `vendure-docs` MCP (`docs.vendure.io/mcp`) is still active and useful — use `search_docs` and `get_doc_page` tools for API reference and guides. This is separate from the deprecated project MCP.

## Svelte MCP Tools

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.

## Implementation Order of Operations

Follow this sequence for **every feature implementation**, automatically — no prompting needed:

1. **Read the docs** — scan `apps/docs/library/yaycsa/features/` and `/plugins/` for relevant specs before writing any code.

2. **Implement** — write the code.

3. **Self-review pass** — before running tests, review the diff with fresh eyes:
   - **Security:** no SQL injection, XSS, exposed secrets, or unsanitized user input
   - **Data conventions:** `timestamptz` for dates, cents for money, no derived/denormalized fields, Admin API not raw SQL, channel assignment rules
   - **Design:** mobile-first, table-based UI, no unnecessary chrome or extra navigation (see Design Conventions)
   - **Svelte:** run `svelte-autofixer` on any new `.svelte` files

4. **Regression suite** — run `cd apps/storefront && npx playwright test` to catch regressions in existing flows. Fix failures before continuing.

5. **Smoke test** — use MCP Playwright tools to test the specific changed pages interactively:
   - Check `git diff` first to know exactly what changed, then focus testing on those areas
   - Test the happy path end-to-end and at least one error case
   - Check console for errors (`browser_console_messages`)

6. **Fix and hand off** — fix any bugs found, then declare done.

## Playwright Testing

**Regression suite** lives in `apps/storefront/tests/`. Run it with:

```bash
cd apps/storefront && npx playwright test
```

The suite self-manages test users (creates via Admin API, deletes after). No credentials needed. Optionally set `TEST_SELLER_SLUG` in `apps/storefront/.env.test` to override the default (`gathering-together-farm`). Both servers must be running (`npm run dev`).

**Smoke tests** (MCP tools) are used for interactive testing of the specific pages changed in a given implementation. These complement the regression suite — they're fast and context-aware, while the suite catches regressions.

The storefront runs at `http://localhost:5180` and the Vendure server at `http://localhost:3000`. Both must be running for Playwright tests (Joe starts them with `npm run dev`).

### Tearing down test sellers (FK trap — read before deleting a seller)

Deleting a seller you created via the `becomeSeller` flow is **not** just `deleteSeller`. `becomeSeller` creates a Seller + a Channel (`channel.sellerId` FK) + links `Customer.customFields.seller`. `deleteSeller` is a **hard** delete, so both FKs must be cleared first — and `deleteCustomer` is a **soft** delete that keeps the row (and its seller FK) AND makes the customer unreachable via the Admin API afterward. So deleting the customer first **permanently strands** the seller.

- **To tear down a seller you just created:** use `teardownSeller()` in [`apps/storefront/tests/setup/seller-helpers.ts`](apps/storefront/tests/setup/seller-helpers.ts). It runs the FK-safe order (unlink customer → delete channel → delete seller → soft-delete customer). It's test/dev-only — nothing in the shipped app uses it. `auth.teardown.ts` calls it automatically when a spec records a `sellerId`.
- **To purge sellers already stranded** (their customer was soft-deleted, so the Admin API can't reach them): run [`apps/storefront/tests/scripts/purge-test-sellers.sql`](apps/storefront/tests/scripts/purge-test-sellers.sql) against the dev DB (Supabase SQL editor or `psql`). It keeps a safelist (Default Seller id 1, GTF id 2) and is re-runnable.

## Agent Teams

Agent teams are enabled. When a task would clearly benefit from parallel work, **suggest to the user** that they use agent teams. Good candidates:

- Work that spans both `apps/server/` and `apps/storefront/` independently (e.g., one teammate on a Vendure plugin, another on SvelteKit routes)
- Building multiple independent features or modules at once
- Parallel code review (security, performance, tests)
- Research/investigation tasks that can be split up

**Do not suggest agent teams for:**

- Sequential tasks where each step depends on the last
- Changes that touch the same files
- Simple single-file edits or bug fixes

When suggesting, say something like: _"This task could benefit from agent teams — want me to spin up a team?"_

## Model Selection

Suggest switching models when it would meaningfully help the user. Use `/model` to switch.

- **Opus 4.6** — best for: complex architecture decisions, multi-file refactors, tricky debugging, planning, tasks requiring deep reasoning
- **Sonnet 4.6** — best for: straightforward edits, boilerplate generation, well-defined single-file changes, rapid iteration, simple bug fixes

When you notice the current model isn't ideal for the task, suggest switching. For example: _"This is mostly boilerplate — want to switch to Sonnet for speed?"_ or _"This is a complex refactor — might be worth switching to Opus if you're not already on it."_

## External Review Tools

Scripts live in `apps/docs/scripts/`. Run them from the YAYCSA project root.

Requires `OPENAI_API_KEY` set in your shell environment.

### Plan/architecture review (GPT-5.4):

```bash
apps/docs/scripts/ask-chatgpt-plan.sh "your question" < path/to/plan.md
```

### Code review (GPT-5.4):

```bash
apps/docs/scripts/ask-chatgpt-code.sh "review this" < path/to/file.ts
# or for a diff:
git diff HEAD~1 | apps/docs/scripts/ask-chatgpt-code.sh "review this diff"
```

When asked to consult ChatGPT, run the appropriate script and include the output in your response.
