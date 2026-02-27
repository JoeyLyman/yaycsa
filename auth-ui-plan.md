Claude’s Plan
Auth UI Pages
Context
Phase 2 auth backend is partially complete — remote functions for login, register, logout, and activeCustomer exist. No UI pages exist yet. This plan builds the complete email-based auth system: login, registration, email verification, password reset, plus authenticated account management (change email, change password). Package updates come first since bits-ui v2 and tailwind-variants v3 are breaking changes best addressed before scaffolding new components.

Vendure handles all these flows natively — no custom auth strategies needed. Patterns informed by the DJL project (remote functions + SvelteKit routing) and the official Vendure Next.js starter.

Key Insight: Remote Functions + Multi-Page Apps
Remote functions are NOT an SPA pattern. They're server functions callable from components. SvelteKit's file-based routing gives each page its own URL with proper browser navigation. Remote functions (form(), query(), command()) handle data within those pages. +layout.server.ts and +page.server.ts still work for auth guards and redirects. They coexist — proven by the DJL project.

Step 0: Package Updates DONE (already completed manually)
Step 1: Scaffold shadcn-svelte Components
Run from apps/storefront/:

npx shadcn-svelte@next add input label card
Creates input, label, card component sets in src/lib/components/bits/.

Step 2: Fix Vendure Email URLs
MODIFY apps/server/src/vendure-config.ts (lines 87-89)

verifyEmailAddressUrl: 'http://localhost:5180/verify'
passwordResetUrl: 'http://localhost:5180/reset-password'
changeEmailAddressUrl: 'http://localhost:5180/verify-email-change'
No migration needed — runtime config only.

Step 3: New & Modified Remote Functions
MODIFY apps/storefront/src/lib/api/shop/auth.remote.ts:

login — change from return { success: true } to redirect(303, '/'). Add explicit NOT_VERIFIED_ERROR message.
register — keep as-is (returns { success: true } for "check email" UI)
NEW remote functions (add to auth.remote.ts or a new file):

Function Type Purpose Vendure Mutation
requestPasswordReset form Forgot password — takes email, sends reset email requestPasswordReset(emailAddress)
resetPassword form Reset password — takes token + new password resetPassword(token, password)
requestUpdateEmail form Change email — takes current password + new email requestUpdateCustomerEmailAddress(password, newEmailAddress)
updatePassword form Change password — takes current + new password updateCustomerPassword(currentPassword, newPassword)
resendVerification command Resend verification email — takes email. Always returns success (no email enumeration) refreshCustomerVerification(emailAddress)
Token-based verification (NOT remote functions — use +page.server.ts load functions):

verifyCustomerAccount(token) — in /verify/+page.server.ts
updateCustomerEmailAddress(token) — in /verify-email-change/+page.server.ts
Step 4: Route Structure

src/routes/
├── +layout.svelte # Root: global CSS (exists, no change)
│
├── (auth)/ # Centered card layout (visual only)
│ ├── +layout.svelte # Centered flexbox container
│ ├── login/
│ │ ├── +page.server.ts # Redirect → / if authenticated
│ │ └── +page.svelte # Login form
│ ├── register/
│ │ ├── +page.server.ts # Redirect → / if authenticated
│ │ └── +page.svelte # Register form → "check email" on success
│ ├── verify/
│ │ ├── +page.server.ts # Process email verification token from URL
│ │ └── +page.svelte # Show error or redirect to /
│ ├── forgot-password/
│ │ ├── +page.server.ts # Redirect → / if authenticated
│ │ └── +page.svelte # Email input → "check email" on success
│ ├── reset-password/
│ │ └── +page.svelte # Token from URL + new password form
│ └── verify-email-change/
│ ├── +page.server.ts # Process email change token from URL
│ └── +page.svelte # Show success/error
│
├── (app)/ # App shell with nav
│ ├── +layout.svelte # Header nav + content area
│ ├── +layout.server.ts # Auth guard → /login; returns customer data
│ ├── +page.svelte # Dashboard home (/)
│ ├── offers/+page.svelte # Placeholder
│ ├── orders/+page.svelte # Placeholder
│ └── account/+page.svelte # Profile + change email + change password
Key decision: The (auth) layout group is purely visual (centered card). It does NOT have a shared +layout.server.ts that redirects authenticated users, because some pages in this group (verify, reset-password, verify-email-change) need to work regardless of auth state. Individual pages (login, register, forgot-password) handle their own redirect.

REMOVE apps/storefront/src/routes/+page.svelte — conflicts with (app)/+page.svelte (both map to /).

Step 5: Page Details
(auth) Layout
(auth)/+layout.svelte — centered flexbox container. min-h-screen items-center justify-center p-4, inner w-full max-w-sm.

Login (/login)
Fields: email (email), \_password (password)
Uses existing login form remote function (spread pattern: <form {...login}>)
Validation errors via login.fields.email.issues()
On success: handler calls redirect(303, '/') (works with progressive enhancement)
Error states: "Invalid email or password", "Please verify your email address first"
On NOT_VERIFIED_ERROR: show "Resend verification email" button. The email is available from login.fields.email.value() (the form retains field values after failed submission). Button calls await resendVerification(login.fields.email.value()). Show success feedback ("Verification email sent") after click. The resendVerification command should always return success regardless of whether the email exists (no enumeration).
Links: "Forgot password?" → /forgot-password, "Register" → /register
+page.server.ts: redirect to / if authenticated
Register (/register)
Fields: firstName, lastName (2-col grid), email, \_password
Uses existing register form remote function
On register.result?.success: replace form with "Check your email" card + "Didn't get it? Resend" button (calls resendVerification(email)) + link to /login
+page.server.ts: redirect to / if authenticated
Verify Email (/verify?token=xxx)
+page.server.ts load function: reads ?token=, calls verifyCustomerAccount(token) via locals.vendure.mutate()
On success: Vendure returns CurrentUser + sets auth token (captured by vendure.ts) → redirect(303, '/')
On error: returns { error: message } → page shows error card with links to /register and /login
No auth redirect — works for unauthenticated users (just registered)
Forgot Password (/forgot-password)
Fields: email
Uses new requestPasswordReset form remote function
On result?.success: show "If an account exists, we sent a reset link" (don't confirm email exists — security)
Link: "Back to login" → /login
+page.server.ts: redirect to / if authenticated
Reset Password (/reset-password?token=xxx)
+page.server.ts: validate token presence from URL, pass to page data (avoids client-side URL parsing)
If no token: return { error: 'No reset token' } → page shows error
Fields: \_password, \_confirmPassword (+ hidden token field from page data)
Uses new resetPassword form remote function
On success: redirect(303, '/') (resetPassword logs user in via Vendure)
Error states: token invalid/expired, password validation errors
No auth redirect — user might not be logged in
Verify Email Change (/verify-email-change?token=xxx)
+page.server.ts load function: reads ?token=, calls updateCustomerEmailAddress(token)
On success: show "Email updated" card + link to /account
On error: show error card
No auth redirect — works regardless of auth state
(app) Layout
(app)/+layout.svelte — header with "YAY CSA" logo + nav links (Offers, Orders, Account) left, user name + "Log out" right. max-w-5xl centered content.

Active nav link highlighting: Compare $page.url.pathname against each nav link's href. Apply text-foreground font-medium for active, text-muted-foreground for inactive. Use $page from $app/state.
Loading states on forms: Use .pending property on all form remote functions to disable submit buttons and show spinner/loading text during submission (pattern from DJL).
(app)/+layout.server.ts — auth guard:

Query activeCustomer using ActiveCustomerFields fragment from $lib/api/shop/fragments.ts
If no customer: redirect(303, '/login?returnTo=' + encodeURIComponent(url.pathname + url.search)) — preserves deep links
Return { customer } — available to layout and all child pages via data.customer
Logout: await logout() then goto('/login') (command can't redirect server-side)
Security additions (from ChatGPT review):

Add Referrer-Policy: strict-origin header globally in hooks.server.ts (prevents token leakage via referer headers on verify/reset pages)
Login handler should read returnTo param and redirect there on success. Validate: path.startsWith('/') && !path.startsWith('//') && !path.includes('\\') — blocks open redirects including //evil.com
All password inputs should use autocomplete="current-password" or autocomplete="new-password" for password manager support
Session expiration pattern: When a session expires mid-use, Vendure returns null for activeCustomer and errors for authenticated mutations. Concrete handling:
For form() calls: in .enhance() callbacks, if submit() throws and the error indicates FORBIDDEN/auth failure, call goto('/login').
For query() calls: if activeCustomer() returns null on a page that expects auth, the (app) layout guard already catches this on the next navigation. For in-page staleness, the user just sees null state until they navigate.
The vendure.ts wrapper throws Error('GraphQL error: ...') on failures — check the error message for auth-related strings or add structured error codes to the wrapper.
Dashboard (/)
"Welcome, {firstName}" from data.customer
Placeholder content
Account (/account)
Three sections on one page:

Profile — display name and email (read-only for now, or editable name)
Change Email — form with current password + new email → "Check your email" on success
Change Password — form with current password + new password + confirm → success message
Uses new requestUpdateEmail and updatePassword form remote functions.

Error Page
(app)/+error.svelte — catches errors when Vendure is unreachable or queries fail. Simple message: "Something went wrong" + error details + "Try again" button (calls invalidateAll()). SvelteKit's built-in error handling routes here automatically.

Also add a root-level +error.svelte for errors outside layout groups (e.g., during auth layout load failures).

Placeholder Pages
/offers, /orders — title + "Coming soon."

File Inventory

# Action Path

1 SCAFFOLD src/lib/components/bits/{input,label,card}/ (via shadcn CLI)
2 MODIFY apps/server/src/vendure-config.ts (email URLs)
3 MODIFY apps/storefront/src/lib/api/shop/auth.remote.ts (login redirect + new functions)
4 MODIFY apps/storefront/src/hooks.server.ts (add Referrer-Policy header)
5 REMOVE apps/storefront/src/routes/+page.svelte (smoke test)
6 NEW apps/storefront/src/routes/+error.svelte
7 NEW apps/storefront/src/routes/(auth)/+layout.svelte
8 NEW apps/storefront/src/routes/(auth)/login/+page.server.ts
9 NEW apps/storefront/src/routes/(auth)/login/+page.svelte
10 NEW apps/storefront/src/routes/(auth)/register/+page.server.ts
11 NEW apps/storefront/src/routes/(auth)/register/+page.svelte
12 NEW apps/storefront/src/routes/(auth)/verify/+page.server.ts
13 NEW apps/storefront/src/routes/(auth)/verify/+page.svelte
14 NEW apps/storefront/src/routes/(auth)/forgot-password/+page.server.ts
15 NEW apps/storefront/src/routes/(auth)/forgot-password/+page.svelte
16 NEW apps/storefront/src/routes/(auth)/reset-password/+page.server.ts
17 NEW apps/storefront/src/routes/(auth)/reset-password/+page.svelte
18 NEW apps/storefront/src/routes/(auth)/verify-email-change/+page.server.ts
19 NEW apps/storefront/src/routes/(auth)/verify-email-change/+page.svelte
20 NEW apps/storefront/src/routes/(app)/+layout.server.ts
21 NEW apps/storefront/src/routes/(app)/+layout.svelte
22 NEW apps/storefront/src/routes/(app)/+page.svelte
23 NEW apps/storefront/src/routes/(app)/offers/+page.svelte
24 NEW apps/storefront/src/routes/(app)/orders/+page.svelte
25 NEW apps/storefront/src/routes/(app)/account/+page.svelte
26 NEW apps/storefront/src/routes/(app)/+error.svelte
Reused Patterns & Utilities
Form spread pattern (from SvelteKit remote functions docs + DJL): <form {...login}> + login.fields.email.as('email') + login.fields.email.issues()
.enhance() pattern (from DJL): intercept submission for post-submit behavior (redirect, invalidate, etc.)
.pending state (from DJL): disable submit button during submission
Auth token auto-capture: vendure.ts lines 42-44 capture vendure-auth-token from response headers
ActiveCustomerFields fragment: from $lib/api/shop/fragments.ts
cn() utility: from $lib/components/utils.ts
Button component: $lib/components/bits/button/button.svelte
Behavior Matrix
Scenario Expected
Visit / while anonymous → redirect to /login
Visit /login while authenticated → redirect to /
Login with wrong password "Invalid email or password" on email field
Login with unverified email "Please verify your email address first" + "Resend" button
Resend verification Calls refreshCustomerVerification → success feedback
Register success Form → "Check your email" card + "Resend" button
Register with existing email Vendure error on email field
Verify with valid token Verified + logged in → redirect to /
Verify with invalid/expired token Error card + links
Forgot password with any email "If an account exists, we sent a link" (no email enumeration)
Reset password with valid token New password set, logged in → redirect to /
Reset password with invalid token Error displayed
Change email success "Check your new email" message
Verify email change "Email updated" card
Change password success Success message inline
Logout Cookie cleared → /login
Verification
npm run dev from root
Visit http://localhost:5180/ → redirects to /login
Click "Register" → /register → fill form → "Check your email"
Visit http://localhost:3000/mailbox → find verification email → click link
→ /verify?token=xxx → verified + logged in → redirected to /
See dashboard with name + nav
Navigate to /account → see profile, change-email, change-password forms
Test change password → success message
Test change email → "check your new email" → visit mailbox → click link → email updated
Log out → /login
Test forgot password → enter email → "check email" → visit mailbox → click link → /reset-password?token=xxx → enter new password → logged in
Login with new password → works
Visit /login while authenticated → redirects to /
Deferred
Magic link login (not Vendure native — needs custom auth strategy)
Multiple emails per account (not Vendure native)
Stayed in plan mode
