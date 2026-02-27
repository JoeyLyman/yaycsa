import { bootstrap, runMigrations } from "@vendure/core";
import { config } from "./vendure-config";

runMigrations(config)
  .then(() => bootstrap(config))
  .then(() => {
    const links = [
      ["Storefront", "http://localhost:5180"],
      ["Dashboard", "http://localhost:3001/dashboard"],
      ["Admin API", "http://localhost:3000/admin-api"],
      ["Shop API", "http://localhost:3000/shop-api"],
      ["GraphiQL Admin", "http://localhost:3000/graphiql/admin"],
      ["GraphiQL Shop", "http://localhost:3000/graphiql/shop"],
      ["Dev Mailbox", "http://localhost:3000/mailbox"],
      ["Assets", "http://localhost:3000/assets"],
      ["Supabase", "https://supabase.com/dashboard/project/nygmkufogodcsmfftueq"],
    ];
    const maxLabel = Math.max(...links.map(([l]) => l.length));
    const lines = links.map(([label, url]) => `  ${label.padEnd(maxLabel)}  ${url}`);
    const width = Math.max(...lines.map((l) => l.length)) + 2;
    const bar = "=".repeat(width);
    const dash = "-".repeat(width);
    console.log("");
    console.log(`  ${bar}`);
    console.log(`  ${"yaycsa dev links".padStart(Math.floor((width + 15) / 2)).padEnd(width)}`);
    console.log(`  ${dash}`);
    console.log("");
    console.log("  Vendure runs two servers in dev mode:");
    console.log("");
    console.log("  :3001 — Vite dev server for the Admin Dashboard UI. This is what you");
    console.log("          use during development. It supports hot module replacement");
    console.log("          (HMR), so changes to dashboard code update instantly.");
    console.log("");
    console.log("  :3000 — The Vendure backend. All API routes, assets, mailbox, etc.");
    console.log("          are fully functional on :3000 during development. The only");
    console.log("          exception is /dashboard, which serves pre-built static files");
    console.log("          that don't exist until you run a production build. That's");
    console.log("          why it 404s in dev — use :3001/dashboard instead.");
    console.log("");
    console.log(`  ${dash}`);
    lines.forEach((l) => console.log(l));
    console.log(`  ${bar}`);
    console.log("");
  })
  .catch((err) => {
    console.log(err);
  });
