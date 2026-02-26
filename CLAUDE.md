## Shared Docs & Todo (git submodule: `apps/docs/`)

Architecture docs and the project todo are maintained in a shared git submodule (`apps/docs/`).
This repo is shared with **Wally** — Joe's OpenClaw bot (runs on Opus 4.6, accessed via Discord). Joe does a lot of YAYCSA planning with Wally, and the results get distilled into the docs here. The docs in this submodule are the **single source of truth** for architecture and feature specs (not SPEC.md, which is outdated).

**On session start:** Pull latest shared docs:

```bash
cd apps/docs && git pull origin main && cd ../..
```

**Key locations:**

- `apps/docs/library/yaycsa/vision.md` — project vision + feature index
- `apps/docs/library/yaycsa/features/` — feature specs (order ingest, unified accounts, pricing, etc.)
- `apps/docs/todos/yaycsa.md` — project todo / phase tracker

Before implementing any feature, scan `apps/docs/library/yaycsa/features/` and `apps/docs/library/yaycsa/plugins/` for relevant docs and read them.

## Data Conventions

- **All DB dates/times use `timestamptz`** (Postgres timestamp with time zone), stored in UTC, always full date+time. No bare `date` or `time` types.
- **Money stored as integers in cents** (Vendure convention). `400` = $4.00.
- **Channel assignment:** Custom entities that are `ChannelAware` must be assigned to both the seller's channel AND the default (marketplace) channel. For new unsaved entities, set `entity.channels = [sellerChannel, defaultChannel]` directly — do not use `channelService.assignToCurrentChannel()` on unsaved entities.
- See `apps/docs/library/yaycsa/data-conventions.md` for full details.

**If you update docs or the todo:** Commit and push the submodule:

```bash
cd apps/docs
git add -A && git commit -m "Update: [description]" && git push
cd ../..
```

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

When suggesting, say something like: _"This task could benefit from agent teams — want me to spin up a team?"_

## Model Selection

Suggest switching models when it would meaningfully help the user. Use `/model` to switch.

- **Opus 4.6** — best for: complex architecture decisions, multi-file refactors, tricky debugging, planning, tasks requiring deep reasoning
- **Sonnet 4.6** — best for: straightforward edits, boilerplate generation, well-defined single-file changes, rapid iteration, simple bug fixes

When you notice the current model isn't ideal for the task, suggest switching. For example: _"This is mostly boilerplate — want to switch to Sonnet for speed?"_ or _"This is a complex refactor — might be worth switching to Opus if you're not already on it."_

## External Review Tools

Scripts live in `apps/docs/scripts/`. Run them from the YAYCSA project root.

Requires `OPENAI_API_KEY` set in your shell environment.

### Plan/architecture review (GPT-5.2):

```bash
apps/docs/scripts/ask-chatgpt-plan.sh "your question" < path/to/plan.md
```

### Code review (GPT-5.3-Codex):

```bash
apps/docs/scripts/ask-chatgpt-code.sh "review this" < path/to/file.ts
# or for a diff:
git diff HEAD~1 | apps/docs/scripts/ask-chatgpt-code.sh "review this diff"
```

When asked to consult ChatGPT, run the appropriate script and include the output in your response.
