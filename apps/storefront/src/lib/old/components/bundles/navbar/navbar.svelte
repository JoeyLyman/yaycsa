<script lang="ts">
	import { page, navigating } from '$app/state';
	import { resolve } from '$app/paths';
	import * as Avatar from '#lib/old/components/bits/avatar/index.ts';
	import * as Tooltip from '#lib/old/components/bits/tooltip/index.ts';
	import ShoppingCart from '@lucide/svelte/icons/shopping-cart';

	type Props = {
		customer?: {
			firstName: string;
			lastName: string;
			customFields?: { seller?: { customFields?: { slug?: string | null } } | null } | null;
		} | null;
	};

	let { customer = null }: Props = $props();

	/**
	 * The URL slug of the seller linked to the logged-in customer.
	 * null if not logged in or not a seller (e.g. a buyer-only account).
	 * Used to detect when the user is viewing their own sales page.
	 */
	const mySellerSlug = $derived(customer?.customFields?.seller?.customFields?.slug ?? null);

	/**
	 * URL prefix of the archived old design. Every old page lives under it
	 * (e.g. /old/me/products); auth pages (/login, /register, …) do not.
	 */
	const OLD_BASE = '/old';

	/**
	 * Strips the /old prefix so the route logic below can keep reasoning about
	 * the original paths ("/", "/me/offers", "/<seller>"). Paths outside /old
	 * (the auth pages) pass through unchanged.
	 */
	function withoutOldBase(pathname: string): string {
		if (pathname === OLD_BASE) return '/';
		return pathname.startsWith(`${OLD_BASE}/`) ? pathname.slice(OLD_BASE.length) : pathname;
	}

	/**
	 * The pathname we're navigating TO (if mid-navigation) or currently on, with
	 * the /old prefix removed. Uses the navigating target for instant visual
	 * feedback — the navbar updates as soon as a link is clicked, not after the
	 * page loads.
	 */
	const currentPathname = $derived(
		withoutOldBase(navigating.to?.url.pathname ?? page.url.pathname)
	);

	/**
	 * Paths that are NOT seller slugs. Any first URL segment not in this set
	 * is treated as a seller slug (e.g. /gathering-together-farm).
	 */
	const reservedPaths = new Set([
		'me',
		'cart',
		'login',
		'register',
		'forgot-password',
		'reset-password',
		'verify',
		'verify-email-change'
	]);

	/**
	 * Auth page paths that show "welcome" as the suffix.
	 * These are the (auth) layout pages where users log in, register, etc.
	 */
	const authPaths = new Set([
		'login',
		'register',
		'forgot-password',
		'reset-password',
		'verify',
		'verify-email-change'
	]);

	/** The current URL split into path segments, e.g. "/me/offers" → ["me", "offers"]. */
	const pathSegments = $derived(currentPathname.split('/').filter(Boolean));

	/** True when the URL starts with /me (dashboard pages like /me/offers, /me/account). */
	const isMe = $derived(pathSegments[0] === 'me');

	/** True when on an auth page (login, register, forgot-password, etc.). */
	const isAuthPage = $derived(pathSegments.length >= 1 && authPaths.has(pathSegments[0]));

	/**
	 * True when the first URL segment is a seller slug (not a reserved path).
	 * e.g. /gathering-together-farm → true, /login → false, /me/offers → false.
	 */
	const isSellerPage = $derived(pathSegments.length >= 1 && !reservedPaths.has(pathSegments[0]));

	/** True when on the marketplace home page (/). */
	const isHome = $derived(currentPathname === '/');

	/**
	 * True when the logged-in user is viewing their own seller's sales page.
	 * e.g. Joe (linked to gathering-together-farm) is on /gathering-together-farm.
	 * When true, the navbar shows "yay·me" instead of the seller slug.
	 */
	const isMySellerPage = $derived(
		isSellerPage && mySellerSlug != null && pathSegments[0] === mySellerSlug
	);

	/**
	 * Maps /me subpage segments to their display text in the navbar suffix.
	 * e.g. /me/offers → "my offers", /cart → "my cart".
	 * Pages not in this map (or /me itself) show "me".
	 */
	const meSubpageSuffixes: Record<string, string> = {
		products: 'my products',
		offers: 'my offers',
		orders: 'my orders',
		sales: 'my sales',
		account: 'my account'
	};

	/** True when on the /cart page (top-level, accessible without auth). */
	const isCartPage = $derived(pathSegments[0] === 'cart');

	/**
	 * The text shown after "yay·" in the navbar brand.
	 * - "welcome" when on auth pages (login, register, etc.)
	 * - "me" when on /me root or viewing your own seller page
	 * - "my offers", "my cart", etc. when on /me subpages
	 * - the seller slug when viewing another seller's page
	 * - "csa" on the home page or other non-seller pages
	 */
	const navSuffix = $derived(
		isAuthPage
			? 'welcome'
			: isCartPage
				? 'my cart'
				: isMySellerPage
					? 'me'
					: isMe
						? (meSubpageSuffixes[pathSegments[1]] ?? 'me')
						: isSellerPage
							? pathSegments[0]
							: 'csa'
	);

	/**
	 * Where the suffix links to when clicked (only used when the suffix is NOT active).
	 * - /seller-slug when on a seller subpage
	 * - /me on the home page or other non-seller pages (go to become-a-seller or own sales page)
	 */
	const navSuffixHref = $derived(
		isSellerPage ? resolve('/old/[seller]', { seller: pathSegments[0] }) : resolve('old/me')
	);

	/**
	 * True when the suffix represents the current page context — meaning it should be
	 * bold and inert (not a link). True on:
	 * - auth pages (login, register, etc.) — shows "welcome"
	 * - all /me/* pages (each has its own suffix like "my offers")
	 * - a seller's root page (/gathering-together-farm)
	 * - the home page (shows "csa") — the brand suffix is never a link, in ANY login
	 *   state. Sellers reach their own page via the explicit "My Page" nav link;
	 *   buyers and logged-out visitors have no reason to deep-link to /me from here.
	 */
	const isNavSuffixActive = $derived(
		isAuthPage || isCartPage || isMe || (isSellerPage && pathSegments.length === 1) || isHome
	);

	/**
	 * Nav links for the buyer side (visible to all authenticated users).
	 * Hrefs here are relative to the old design's root (compared against the
	 * stripped `currentPathname`); the /old prefix is added when rendering.
	 */
	const buyerLinks = [{ href: '/me/orders', label: 'Orders' }];

	/** Nav links for the seller side (only visible when the user is a seller). */
	const sellerLinks = [
		{ href: '/me/products', label: 'Products' },
		{ href: '/me/offers', label: 'Offers' },
		{ href: '/me/sales', label: 'Sales' }
	];

	/**
	 * Link to the seller's own public sales page (e.g. /gathering-together-farm).
	 * Shown to the right of "Sales" in the seller nav links. null when the
	 * customer has no linked seller (buyer-only accounts don't see this).
	 */
	const myPageLink = $derived(
		mySellerSlug
			? { href: resolve('/old/[seller]', { seller: mySellerSlug }), label: 'My Page' }
			: null
	);

	/** Returns true if the current page is within the given nav link's path. */
	function isNavActive(href: string) {
		return currentPathname.startsWith(href);
	}

	const isLoginActive = $derived(currentPathname === '/login');
	const isRegisterActive = $derived(currentPathname === '/register');

	/** Two-letter initials for the user avatar (e.g. "JL" for Joe Lyman). */
	const initials = $derived(
		customer ? (customer.firstName?.[0] ?? '') + (customer.lastName?.[0] ?? '') : ''
	);
</script>

<header class="border-b">
	<div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
		<div class="flex min-w-0 items-center">
			<a
				href={OLD_BASE}
				class="shrink-0 text-lg font-bold transition-colors {isHome
					? 'cursor-default text-foreground'
					: 'text-muted-foreground/60 hover:text-muted-foreground'}"
			>
				yay
			</a>

			<span
				class="mx-1 shrink-0 text-lg font-bold {isNavSuffixActive
					? 'text-foreground'
					: 'text-muted-foreground/60'}"
			>
				·
			</span>

			<Tooltip.Provider>
				<Tooltip.Root delayDuration={0}>
					{#if isNavSuffixActive}
						<Tooltip.Trigger
							class="max-w-64 cursor-default truncate text-lg font-bold text-foreground sm:max-w-96"
						>
							{navSuffix}
						</Tooltip.Trigger>{:else}<Tooltip.Trigger>
							{#snippet child({ props })}<a
									{...props}
									href={navSuffixHref}
									class="max-w-64 truncate text-lg font-bold text-muted-foreground/60 transition-colors hover:text-muted-foreground sm:max-w-96"
								>
									{navSuffix}
								</a>{/snippet}
						</Tooltip.Trigger>{/if}<Tooltip.Content>{navSuffix}</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
		</div>
		<div class="flex items-center gap-4">
			{#if customer}
				<!-- Desktop-only nav links (hidden on mobile where bottom nav handles navigation) -->
				<nav class="hidden items-center gap-4 md:flex">
					<a
						href="{OLD_BASE}/cart"
						class="mr-1 transition-colors {currentPathname.startsWith('/cart')
							? 'cursor-default text-foreground'
							: 'text-muted-foreground/60 hover:text-muted-foreground'}"
					>
						<ShoppingCart class="h-4 w-4" />
					</a>
					{#each buyerLinks as { href, label } (href)}
						<a
							href="{OLD_BASE}{href}"
							class="text-sm transition-colors {isNavActive(href)
								? 'cursor-default font-medium text-foreground'
								: 'text-muted-foreground/60 hover:text-muted-foreground'}"
						>
							{label}
						</a>
					{/each}
					{#if mySellerSlug}
						<span class="text-border">|</span>
						{#each sellerLinks as { href, label } (href)}
							<a
								href="{OLD_BASE}{href}"
								class="text-sm transition-colors {isNavActive(href)
									? 'cursor-default font-medium text-foreground'
									: 'text-muted-foreground/60 hover:text-muted-foreground'}"
							>
								{label}
							</a>
						{/each}
						{#if myPageLink}
							<a
								href={myPageLink.href}
								class="text-sm transition-colors {isMySellerPage
									? 'cursor-default font-medium text-foreground'
									: 'text-muted-foreground/60 hover:text-muted-foreground'}"
							>
								{myPageLink.label}
							</a>
						{/if}
					{/if}
				</nav>
				<a
					href="{OLD_BASE}/me/account"
					class="ml-2 flex items-center {currentPathname.startsWith('/me/account') ||
					currentPathname === '/me'
						? 'cursor-default'
						: ''}"
				>
					<Avatar.Root
						class={currentPathname.startsWith('/me/account') || currentPathname === '/me'
							? 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
							: 'transition-shadow hover:ring-2 hover:ring-muted-foreground hover:ring-offset-2 hover:ring-offset-background'}
					>
						<Avatar.Fallback>{initials}</Avatar.Fallback>
					</Avatar.Root>
				</a>
			{:else}
				<!-- Desktop-only auth links (hidden on mobile where bottom nav has Login) -->
				<nav class="hidden gap-4 md:flex">
					<a
						href="/login"
						class="text-sm transition-colors {isLoginActive
							? 'cursor-default font-medium text-foreground'
							: 'text-muted-foreground/60 hover:text-muted-foreground'}"
					>
						Log in
					</a>
					<a
						href="/register"
						class="text-sm transition-colors {isRegisterActive
							? 'cursor-default font-medium text-foreground'
							: 'text-muted-foreground/60 hover:text-muted-foreground'}"
					>
						Register
					</a>
				</nav>
			{/if}
		</div>
	</div>
</header>
