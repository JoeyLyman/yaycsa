<script lang="ts">
	import { page, navigating } from '$app/state';
	import * as Avatar from '$lib/components/bits/avatar';
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
	 * The pathname we're navigating TO (if mid-navigation) or currently on.
	 * Uses the navigating target for instant visual feedback — the navbar
	 * updates as soon as a link is clicked, not after the page loads.
	 */
	const currentPathname = $derived(navigating.to?.url.pathname ?? page.url.pathname);

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
	const isSellerPage = $derived(
		pathSegments.length >= 1 && !reservedPaths.has(pathSegments[0])
	);

	/** True when on the marketplace home page (/). */
	const isHome = $derived(currentPathname === '/');

	/**
	 * True when the logged-in user is viewing their own seller's sales page.
	 * e.g. Joe (linked to gathering-together-farm) is on /gathering-together-farm.
	 * When true, the navbar shows "yay·me" instead of the seller slug.
	 */
	const isMySellerPage = $derived(isSellerPage && mySellerSlug != null && pathSegments[0] === mySellerSlug);

	/**
	 * Maps /me subpage segments to their display text in the navbar suffix.
	 * e.g. /me/offers → "my offers", /cart → "my cart".
	 * Pages not in this map (or /me itself) show "me".
	 */
	const meSubpageSuffixes: Record<string, string> = {
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
		isAuthPage ? 'welcome'
		: isCartPage ? 'my cart'
		: isMySellerPage ? 'me'
		: isMe ? (meSubpageSuffixes[pathSegments[1]] ?? 'me')
		: isSellerPage ? pathSegments[0]
		: 'csa'
	);

	/**
	 * Where the suffix links to when clicked (only used when the suffix is NOT active).
	 * - /seller-slug when on a seller subpage
	 * - /me on the home page or other non-seller pages (go to become-a-seller or own sales page)
	 */
	const navSuffixHref = $derived(isSellerPage ? `/${pathSegments[0]}` : '/me');

	/**
	 * True when the suffix represents the current page context — meaning it should be
	 * bold and inert (not a link). True on:
	 * - auth pages (login, register, etc.) — shows "welcome"
	 * - all /me/* pages (each has its own suffix like "my offers")
	 * - a seller's root page (/gathering-together-farm)
	 */
	const isNavSuffixActive = $derived(
		isAuthPage || isCartPage || isMe || (isSellerPage && pathSegments.length === 1)
	);

	/** Nav links for the buyer side (visible to all authenticated users). */
	const buyerLinks = [
		{ href: '/me/orders', label: 'Orders' }
	];

	/** Nav links for the seller side (only visible when the user is a seller). */
	const sellerLinks = [
		{ href: '/me/offers', label: 'Offers' },
		{ href: '/me/sales', label: 'Sales' }
	];

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

	/**
	 * Element ref for the suffix text container. Used to measure whether the
	 * suffix text overflows its max-width, triggering the scroll animation.
	 */
	let suffixEl: HTMLElement | undefined = $state();

	/**
	 * The pixel distance the suffix text overflows its container.
	 * 0 when the text fits (e.g. "csa", "me"). Positive when it overflows
	 * (e.g. "gathering-together-farm"). Used as the CSS translate distance.
	 */
	let overflowDistance = $state(0);

	/**
	 * Measures whether the suffix text overflows and updates overflowDistance.
	 * Re-runs whenever the suffix text or element ref changes.
	 * NOTE: If the scrolling animation doesn't feel good, try truncation +
	 * tap/tooltip to reveal the full name instead.
	 */
	$effect(() => {
		// Subscribe to navSuffix so this re-runs on route changes
		void navSuffix;
		if (!suffixEl) {
			overflowDistance = 0;
			return;
		}
		// Wait a tick for the DOM to update with the new text
		requestAnimationFrame(() => {
			if (suffixEl) {
				overflowDistance = Math.max(0, suffixEl.scrollWidth - suffixEl.clientWidth);
			}
		});
	});
</script>

<header class="border-b">
	<div class="mx-auto max-w-5xl px-4 flex items-center justify-between py-4">
		<div class="flex items-center min-w-0">
			<a
				href="/"
				class="shrink-0 text-lg font-bold transition-colors {isHome
					? 'text-foreground cursor-default'
					: 'text-muted-foreground/60 hover:text-muted-foreground'}"
			>yay</a><span class="shrink-0 mx-1 text-lg font-bold {isNavSuffixActive ? 'text-foreground' : 'text-muted-foreground/60'}">&middot;</span>{#if isNavSuffixActive}<span
				bind:this={suffixEl}
				class="suffix-scroll text-lg font-bold text-foreground max-w-48 sm:max-w-72"
				style:--overflow-distance="{overflowDistance}px"
				title={navSuffix}
			>{navSuffix}</span>{:else}<a
				bind:this={suffixEl}
				href={navSuffixHref}
				class="suffix-scroll text-lg font-bold transition-colors max-w-48 sm:max-w-72 text-muted-foreground/60 hover:text-muted-foreground"
				style:--overflow-distance="{overflowDistance}px"
				title={navSuffix}
			>{navSuffix}</a>{/if}
		</div>
		<div class="flex items-center gap-4">
			{#if customer}
				<!-- Desktop-only nav links (hidden on mobile where bottom nav handles navigation) -->
				<nav class="hidden items-center gap-4 md:flex">
					<a
						href="/cart"
						class="mr-1 transition-colors {currentPathname.startsWith('/cart')
							? 'text-foreground cursor-default'
							: 'text-muted-foreground/60 hover:text-muted-foreground'}"
					>
						<ShoppingCart class="h-4 w-4" />
					</a>
					{#each buyerLinks as { href, label } (href)}
						<a
							{href}
							class="text-sm transition-colors {isNavActive(href)
								? 'text-foreground font-medium cursor-default'
								: 'text-muted-foreground/60 hover:text-muted-foreground'}"
						>
							{label}
						</a>
					{/each}
					{#if mySellerSlug}
						<span class="text-border">|</span>
						{#each sellerLinks as { href, label } (href)}
							<a
								{href}
								class="text-sm transition-colors {isNavActive(href)
									? 'text-foreground font-medium cursor-default'
									: 'text-muted-foreground/60 hover:text-muted-foreground'}"
							>
								{label}
							</a>
						{/each}
					{/if}
				</nav>
				<a href="/me/account" class="ml-2 flex items-center {currentPathname.startsWith('/me/account') || currentPathname === '/me' ? 'cursor-default' : ''}">
					<Avatar.Root
						class={currentPathname.startsWith('/me/account') || currentPathname === '/me'
							? 'ring-foreground ring-2 ring-offset-2 ring-offset-background'
							: 'hover:ring-muted-foreground hover:ring-2 hover:ring-offset-2 hover:ring-offset-background transition-shadow'}
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
							? 'text-foreground font-medium cursor-default'
							: 'text-muted-foreground/60 hover:text-muted-foreground'}"
					>Log in</a>
					<a
						href="/register"
						class="text-sm transition-colors {isRegisterActive
							? 'text-foreground font-medium cursor-default'
							: 'text-muted-foreground/60 hover:text-muted-foreground'}"
					>Register</a>
				</nav>
			{/if}
		</div>
	</div>
</header>

<style>
	/*
	 * Scrolling animation for long suffix text (e.g. seller slugs).
	 * When the text overflows, it pauses, scrolls one-way to reveal the end,
	 * pauses again, then snaps back. Uses a CSS variable set from JS for the
	 * exact overflow distance.
	 *
	 * NOTE: If this doesn't feel good in practice, replace with truncation +
	 * tap/tooltip to reveal the full name instead.
	 */
	.suffix-scroll {
		display: inline-block;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	/* Only animate when there's actual overflow and user hasn't requested reduced motion */
	@media (prefers-reduced-motion: no-preference) {
		.suffix-scroll[style*='--overflow-distance']:not([style*='--overflow-distance: 0px']) {
			text-overflow: clip;
			animation: suffix-scroll-reveal 7s ease-in-out 1s infinite;
		}
	}

	@keyframes suffix-scroll-reveal {
		/* Pause at start (0% – 28%) */
		0%, 28% {
			transform: translateX(0);
		}
		/* Scroll to reveal end (28% – 57%) */
		57% {
			transform: translateX(calc(var(--overflow-distance, 0px) * -1));
		}
		/* Pause at end (57% – 85%) */
		85% {
			transform: translateX(calc(var(--overflow-distance, 0px) * -1));
		}
		/* Snap back (85% – 100%) */
		100% {
			transform: translateX(0);
		}
	}
</style>
