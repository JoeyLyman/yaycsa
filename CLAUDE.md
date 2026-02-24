## Shared Architecture Docs

Feature specs and architecture decisions are maintained in a shared git submodule (`shared-docs/`).
This repo is shared with Wally (AI assistant on the server) — both of us can read and write.

**On session start:** Pull latest shared docs:
\`\`\`bash
cd shared-docs && git pull origin main && cd ..
\`\`\`

**Feature docs location:** `shared-docs/library/yaycsa/`

Before implementing any feature, read the relevant doc:

- Order ingest system: `shared-docs/library/yaycsa/features/order-ingest-architecture.md`
- Unified accounts (multi-role): `shared-docs/library/yaycsa/features/unified-business-accounts.md`
- Supply chain transparency: `shared-docs/library/yaycsa/features/supply-chain-transparency.md`
- Value propositions: `shared-docs/library/yaycsa/features/value-propositions.md`
- Pricing model: `shared-docs/library/yaycsa/features/pricing-model.md`
- Decentralization/blockchain: `shared-docs/library/yaycsa/features/decentralization-analysis.md`
- Overall vision: `shared-docs/library/yaycsa/vision.md`

**If you update a feature doc:** Commit and push the submodule separately:
\`\`\`bash
cd shared-docs
git add -A && git commit -m "Update: [description]" && git push
cd ..
git add shared-docs && git commit -m "Update shared-docs ref"
\`\`\`

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available MCP Tools:

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

When suggesting, say something like: *"This task could benefit from agent teams — want me to spin up a team?"*

## Model Selection

Suggest switching models when it would meaningfully help the user. Use `/model` to switch.

- **Opus 4.6** — best for: complex architecture decisions, multi-file refactors, tricky debugging, planning, tasks requiring deep reasoning
- **Sonnet 4.6** — best for: straightforward edits, boilerplate generation, well-defined single-file changes, rapid iteration, simple bug fixes

When you notice the current model isn't ideal for the task, suggest switching. For example: *"This is mostly boilerplate — want to switch to Sonnet for speed?"* or *"This is a complex refactor — might be worth switching to Opus if you're not already on it."*
