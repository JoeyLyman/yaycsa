# Pi project config

This directory contains YAYCSA-specific Pi configuration.

## Files

- `tooling.json` — project-local tool defaults for the global `joey-global-tools` Pi extension

## Current setup

### Supabase

The global Pi extension reads:

- `supabase.projectRef`
- `supabase.accessTokenEnv`

For YAYCSA, the expected env var is:

```bash
export YAYCSA_SUPABASE_ACCESS_TOKEN=...
```

That keeps the token out of repo config files.

### Playwright

`tooling.json` sets the default storefront base URL to:

- `http://localhost:5180`

and uses:

- browser: `firefox`
- headless: `true`

## Notes

- This `.pi/` directory is project-local, not global.
- Global Pi extensions live under `~/.pi/agent/extensions/`.
- The YAYCSA repo can override global defaults here without affecting other projects.
