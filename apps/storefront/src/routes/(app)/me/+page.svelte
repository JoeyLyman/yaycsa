<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { becomeSeller } from '$lib/api/shop/sellers.remote';
	import * as Card from '$lib/components/bits/card';
	import { Button } from '$lib/components/bits/button';
	import { SpinnerSun } from '$lib/components/bits/spinner-sun';

	let { data } = $props();

	/**
	 * Set of all existing seller slugs, loaded on page load.
	 * Used for real-time client-side slug availability checking.
	 */
	const takenSlugs = $derived(new Set(data.takenSlugs));

	/** Server-side or network error message. null when no error. */
	let errorMessage = $state<string | null>(null);

	/**
	 * True after a successful becomeSeller, while we invalidate layout data and redirect.
	 * Keeps the button disabled and shows a spinner during the redirect.
	 */
	let redirecting = $state(false);

	function slugify(name: string): string {
		return name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	}

	/**
	 * Blocklist of profane words. Checked against both the business name and slug
	 * by splitting into words/segments and testing each one.
	 */
	const PROFANITY_BLOCKLIST = new Set([
		'fuck', 'shit', 'ass', 'asshole', 'bitch', 'bastard', 'damn', 'dick',
		'cock', 'cunt', 'piss', 'slut', 'whore', 'fag', 'faggot', 'nigger',
		'nigga', 'retard', 'twat', 'wanker', 'bollocks',
	]);

	/**
	 * Returns true if the given text contains any profane words.
	 * Splits on non-alphanumeric characters and checks each word.
	 */
	function containsProfanity(text: string): boolean {
		const words = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
		return words.some((w) => PROFANITY_BLOCKLIST.has(w));
	}

	/**
	 * Sanitizes the business name input on every keystroke.
	 * Only allows letters, numbers, and single spaces. Strips symbols and collapses multiple spaces.
	 */
	function sanitizeNameInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const cleaned = input.value
			.replace(/[^a-zA-Z0-9 ]/g, '')
			.replace(/ {2,}/g, ' ');
		if (cleaned !== input.value) {
			const pos = Math.min(input.selectionStart ?? cleaned.length, cleaned.length);
			input.value = cleaned;
			input.setSelectionRange(pos, pos);
			input.dispatchEvent(new Event('input', { bubbles: true }));
		}
		syncSlugInput();
	}

	/**
	 * Sanitizes the custom slug input on every keystroke.
	 * Converts to lowercase, replaces spaces with hyphens, strips symbols,
	 * and collapses consecutive hyphens into one.
	 */
	function sanitizeSlugInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const cleaned = input.value
			.toLowerCase()
			.replace(/\s+/g, '-')
			.replace(/[^a-z0-9-]/g, '')
			.replace(/-{2,}/g, '-');
		if (cleaned !== input.value) {
			const pos = Math.min(input.selectionStart ?? cleaned.length, cleaned.length);
			input.value = cleaned;
			input.setSelectionRange(pos, pos);
			input.dispatchEvent(new Event('input', { bubbles: true }));
		}
	}

	/**
	 * Whether the user has clicked "customize" to manually edit the URL slug.
	 * When false, slug is auto-generated from the business name.
	 * When true, slug is whatever the user types in the slug input.
	 */
	let customizingSlug = $state(false);

	/**
	 * The URL slug auto-generated from the business name.
	 * Only used as the slug value when customizingSlug is false.
	 */
	const generatedSlug = $derived(slugify(becomeSeller.fields.shopName.value() ?? ''));

	/**
	 * The effective slug that will be submitted — either auto-generated or
	 * the user's custom value if they've opened the customize field.
	 */
	const effectiveSlug = $derived(
		customizingSlug
			? (becomeSeller.fields.slug.value() ?? '')
			: generatedSlug,
	);

	/** The current business name value, trimmed for validation purposes. */
	const shopName = $derived((becomeSeller.fields.shopName.value() ?? '').trim());

	/**
	 * List of real-time validation errors for the business name.
	 * Shown below the input so the user knows exactly what to fix.
	 */
	const nameErrors = $derived.by(() => {
		const errors: string[] = [];
		if (shopName.length > 0 && shopName.length < 3) errors.push('Name must be at least 3 characters.');
		if (containsProfanity(shopName)) errors.push('Please choose an appropriate business name.');
		return errors;
	});

	/**
	 * List of real-time validation errors for the slug.
	 * Covers taken slugs, leading/trailing hyphens, consecutive hyphens, length, and profanity.
	 */
	const slugErrors = $derived.by(() => {
		const errors: string[] = [];
		if (effectiveSlug.length > 0 && effectiveSlug.length < 3) errors.push('URL must be at least 3 characters.');
		if (effectiveSlug.startsWith('-') || effectiveSlug.endsWith('-')) errors.push('URL cannot start or end with a hyphen.');
		if (/--/.test(effectiveSlug)) errors.push('URL cannot have consecutive hyphens.');
		if (effectiveSlug.length >= 3 && takenSlugs.has(effectiveSlug)) errors.push('That URL is already taken — try a different name or customize the URL.');
		if (containsProfanity(effectiveSlug)) errors.push('Please choose an appropriate URL.');
		return errors;
	});

	/** Whether the submit button should be disabled. */
	const submitDisabled = $derived(
		!!becomeSeller.pending || redirecting || shopName.length < 3 || effectiveSlug.length < 3 ||
		nameErrors.length > 0 || slugErrors.length > 0,
	);

	/**
	 * Syncs the hidden slug input with the auto-generated slug value.
	 * Only called when customizingSlug is false (user hasn't opened the custom field).
	 * Uses the native value setter to trigger SvelteKit's form binding.
	 */
	function syncSlugInput() {
		if (customizingSlug) return;
		const slugInput = document.getElementById('slug') as HTMLInputElement | null;
		if (slugInput) {
			const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
				window.HTMLInputElement.prototype,
				'value',
			)?.set;
			nativeInputValueSetter?.call(slugInput, generatedSlug);
			slugInput.dispatchEvent(new Event('input', { bubbles: true }));
		}
	}
</script>

<div class="mx-auto max-w-md py-8">
	<Card.Root>
		<Card.Header>
			<Card.Title class="text-2xl">Start selling</Card.Title>
			<Card.Description>
				Farm, restaurant, co-op, distributor, or all of the above? All good, see if our sales flows and tools work for you.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if errorMessage}
				<p class="text-destructive mb-4 text-sm">{errorMessage}</p>
			{/if}
			<form
				{...becomeSeller.enhance(async ({ submit }) => {
					errorMessage = null;
					try {
						await submit();
						if (becomeSeller.result?.alreadySeller) {
							// Customer is already a seller — refresh and go home
							redirecting = true;
							await invalidateAll();
							goto('/');
							return;
						}
						if (becomeSeller.result?.success) {
							redirecting = true;
							await invalidateAll();
							goto(`/${becomeSeller.result.slug}`);
						}
					} catch (err) {
						errorMessage = err instanceof Error ? err.message : 'Something went wrong';
					}
				})}
				class="space-y-4"
			>
				<div class="space-y-2">
					<label for="shopName" class="text-sm font-medium leading-none">
						Business name
					</label>
					<input
						{...becomeSeller.fields.shopName.as('text')}
						id="shopName"
						placeholder="My Farm"
						autocomplete="organization"
						oninput={sanitizeNameInput}
						class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
					/>
				</div>
				{#if customizingSlug}
					<div class="space-y-2">
						<div class="flex items-center justify-between">
							<label for="slug" class="text-sm font-medium leading-none">Custom URL</label>
							<button
								type="button"
								class="text-muted-foreground hover:text-foreground text-sm underline underline-offset-2"
								onclick={() => {
									customizingSlug = false;
									syncSlugInput();
								}}
							>Close</button>
						</div>
						<input
							{...becomeSeller.fields.slug.as('text')}
							id="slug"
							placeholder={generatedSlug}
							autocomplete="off"
							oninput={sanitizeSlugInput}
							class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
						/>
					</div>
				{:else}
					<!-- Hidden input keeps the slug field in sync with the auto-generated value -->
					<input {...becomeSeller.fields.slug.as('text')} id="slug" class="hidden" />
				{/if}
				<div class="flex items-center justify-between">
					<p class="text-muted-foreground text-sm">
						Your page: yaycsa.com/<span class="text-foreground font-medium">{effectiveSlug || '...'}</span>
					</p>
					{#if !customizingSlug}
						<button
							type="button"
							class="text-primary text-sm underline underline-offset-2"
							onclick={() => (customizingSlug = true)}
						>Customize URL</button>
					{/if}
				</div>
				<Button type="submit" class="w-full" disabled={submitDisabled}>
					{#if becomeSeller.pending || redirecting}<SpinnerSun class="mr-2" />{/if}
					{becomeSeller.pending || redirecting ? 'Setting up...' : 'Start selling'}
				</Button>
				{#each becomeSeller.fields.shopName.issues() as issue (issue.message)}
					<p class="text-destructive text-sm">{issue.message}</p>
				{/each}
				{#each nameErrors as error (error)}
					<p class="text-destructive text-sm">{error}</p>
				{/each}
				{#each becomeSeller.fields.slug.issues() as issue (issue.message)}
					<p class="text-destructive text-sm">{issue.message}</p>
				{/each}
				{#each slugErrors as error (error)}
					<p class="text-destructive text-sm">{error}</p>
				{/each}
			</form>
		</Card.Content>
	</Card.Root>
</div>
