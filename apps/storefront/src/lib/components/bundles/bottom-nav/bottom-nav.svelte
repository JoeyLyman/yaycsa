<script lang="ts">
	import { page, navigating } from '$app/state';
	import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
	import ClipboardList from '@lucide/svelte/icons/clipboard-list';
	import Search from '@lucide/svelte/icons/search';
	import Package from '@lucide/svelte/icons/package';
	import BoxesStacked from '@lucide/svelte/icons/boxes';
	import HandCoins from '@lucide/svelte/icons/hand-coins';
	import Store from '@lucide/svelte/icons/store';
	import LogIn from '@lucide/svelte/icons/log-in';

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
	 * null if not logged in or not a seller.
	 */
	const mySellerSlug = $derived(customer?.customFields?.seller?.customFields?.slug ?? null);

	/**
	 * The pathname we're navigating TO (if mid-navigation) or currently on.
	 * Matches the same pattern used in the top navbar for instant feedback.
	 */
	const currentPathname = $derived(navigating.to?.url.pathname ?? page.url.pathname);

	/**
	 * Paths that are NOT seller slugs. Matches the same set in the top navbar.
	 * Used to detect when the user is browsing a seller page (e.g. /gathering-together-farm).
	 */
	const reservedPaths = new Set([
		'me', 'cart', 'login', 'register',
		'forgot-password', 'reset-password', 'verify', 'verify-email-change'
	]);

	/** The current URL split into path segments. */
	const pathSegments = $derived(currentPathname.split('/').filter(Boolean));

	/**
	 * True when the first URL segment is a seller slug (not a reserved path).
	 * Seller pages are part of "browsing" the marketplace.
	 */
	const isSellerPage = $derived(
		pathSegments.length >= 1 && !reservedPaths.has(pathSegments[0])
	);

	/**
	 * True when Browse should be highlighted. Active on the home page (/)
	 * and on any seller page (e.g. /gathering-together-farm), since viewing
	 * a seller's page is part of browsing the marketplace.
	 */
	const isBrowseActive = $derived(currentPathname === '/' || isSellerPage);

	/**
	 * Checks if a nav item is active. Uses startsWith for most routes
	 * so nested pages (e.g. /me/orders/123) highlight the parent tab.
	 */
	function isActive(href: string, exact = false): boolean {
		if (exact) return currentPathname === href;
		return currentPathname.startsWith(href);
	}
</script>

<!--
	Mobile bottom navigation bar. Hidden on md+ screens where the top navbar handles navigation.
	Uses safe-area padding for iPhone home indicator.
-->
<nav class="fixed bottom-0 left-0 right-0 z-50 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
	<div class="flex items-stretch justify-around">
		{#if customer}
			<!-- Buyer links: Browse, Cart, Orders -->
			<a
				href="/"
				class="flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors {isBrowseActive
					? 'text-foreground'
					: 'text-muted-foreground/60'}"
			>
				<Search class="h-5 w-5" />
				<span class="text-[10px]">Browse</span>
			</a>
			<a
				href="/cart"
				class="flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors {isActive('/cart')
					? 'text-foreground'
					: 'text-muted-foreground/60'}"
			>
				<ShoppingCart class="h-5 w-5" />
				<span class="text-[10px]">Cart</span>
			</a>
			<a
				href="/me/orders"
				class="flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors {isActive('/me/orders')
					? 'text-foreground'
					: 'text-muted-foreground/60'}"
			>
				<ClipboardList class="h-5 w-5" />
				<span class="text-[10px]">Orders</span>
			</a>

			<!-- Seller links (right side) — or "Sell" CTA for non-sellers -->
			{#if mySellerSlug}
				<!-- Vertical separator between buyer and seller sections -->
				<div class="my-2 w-px bg-border"></div>
				<a
					href="/me/products"
					class="flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors {isActive('/me/products')
						? 'text-foreground'
						: 'text-muted-foreground/60'}"
				>
					<BoxesStacked class="h-5 w-5" />
					<span class="text-[10px]">Products</span>
				</a>
				<a
					href="/me/offers"
					class="flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors {isActive('/me/offers')
						? 'text-foreground'
						: 'text-muted-foreground/60'}"
				>
					<Package class="h-5 w-5" />
					<span class="text-[10px]">Offers</span>
				</a>
				<a
					href="/me/sales"
					class="flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors {isActive('/me/sales')
						? 'text-foreground'
						: 'text-muted-foreground/60'}"
				>
					<HandCoins class="h-5 w-5" />
					<span class="text-[10px]">Sales</span>
				</a>
			{:else}
				<a
					href="/me"
					class="flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors {isActive('/me', true)
						? 'text-foreground'
						: 'text-muted-foreground/60'}"
				>
					<Store class="h-5 w-5" />
					<span class="text-[10px]">Sell</span>
				</a>
			{/if}
		{:else}
			<!-- Logged out: Browse, Cart, Login -->
			<a
				href="/"
				class="flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors {isBrowseActive
					? 'text-foreground'
					: 'text-muted-foreground/60'}"
			>
				<Search class="h-5 w-5" />
				<span class="text-[10px]">Browse</span>
			</a>
			<a
				href="/cart"
				class="flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors {isActive('/cart')
					? 'text-foreground'
					: 'text-muted-foreground/60'}"
			>
				<ShoppingCart class="h-5 w-5" />
				<span class="text-[10px]">Cart</span>
			</a>
			<a
				href="/login"
				class="flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors {isActive('/login')
					? 'text-foreground'
					: 'text-muted-foreground/60'}"
			>
				<LogIn class="h-5 w-5" />
				<span class="text-[10px]">Login</span>
			</a>
		{/if}
	</div>
</nav>
