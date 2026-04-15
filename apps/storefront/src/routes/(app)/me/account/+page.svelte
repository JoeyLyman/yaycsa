<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { updateBusinessTimezone } from '$lib/api/admin/fulfillment-options.remote';
	import { requestUpdateEmail, updatePassword, logout } from '$lib/api/shop/auth.remote';
	import { Button } from '$lib/components/bits/button';
	import * as Card from '$lib/components/bits/card';
	import { Input } from '$lib/components/bits/input';
	import * as Select from '$lib/components/bits/select';
	import { SpinnerSun } from '$lib/components/bits/spinner-sun';
	import {
		buildBusinessTimezoneOptions,
		getBusinessTimezoneDisplayName
	} from '$lib/utils/business-timezone';
	import Sun from '@lucide/svelte/icons/sun';
	import Moon from '@lucide/svelte/icons/moon';
	import { toggleMode, mode } from 'mode-watcher';

	let { data } = $props();

	/**
	 * The URL slug for the logged-in user's linked seller (e.g. "gathering-together-farm").
	 * null if the user is not a seller. Used for the "See my sales page" link.
	 */
	const mySellerSlug = $derived(
		(data.customer.customFields as { seller?: { customFields?: { slug?: string | null } } | null })
			?.seller?.customFields?.slug ?? null
	);

	/** The logged-in seller relation, if this customer has already created a business profile. */
	const seller = $derived(
		(data.customer.customFields as {
			seller?: { name: string; customFields?: { slug?: string | null; timezone?: string | null } } | null;
		})?.seller ?? null
	);

	/** The timezone value currently stored on the seller business. Null falls back to UTC in the UI. */
	const businessTimezoneValue = $derived(seller?.customFields?.timezone ?? 'UTC');

	/** Friendly timezone label shown inside the business settings selector, e.g. Pacific Time. */
	const businessTimezoneLabel = $derived(getBusinessTimezoneDisplayName(businessTimezoneValue));

	/** Curated business timezone options, always including the seller's current stored timezone. */
	const businessTimezoneOptions = $derived(
		buildBusinessTimezoneOptions(seller?.customFields?.timezone ?? null)
	);

	/** Error shown in the business card when saving a timezone change fails. */
	let businessTimezoneError = $state<string | null>(null);

	/** True while the business timezone mutation is in flight. Disables the selector and shows a spinner. */
	let savingBusinessTimezone = $state(false);

	/** True while the logout request is in flight. Disables the logout button and shows a spinner. */
	let loggingOut = $state(false);

	async function handleBusinessTimezoneChange(nextTimezoneValue: string) {
		if (!seller || nextTimezoneValue === businessTimezoneValue) return;

		businessTimezoneError = null;
		savingBusinessTimezone = true;
		try {
			await updateBusinessTimezone(nextTimezoneValue === 'UTC' ? '' : nextTimezoneValue);
			await invalidateAll();
		} catch (error) {
			console.error('Failed to update business timezone:', error);
			businessTimezoneError =
				error instanceof Error && error.message ? error.message : 'Failed to update business timezone';
		} finally {
			savingBusinessTimezone = false;
		}
	}

	async function handleLogout() {
		loggingOut = true;
		await logout();
		goto('/login');
	}
</script>

<h1 class="text-2xl font-bold">Account</h1>

<div class="mt-6 space-y-6">
	<Card.Root>
		<Card.Header>
			<Card.Title>Business</Card.Title>
		</Card.Header>
		<Card.Content>
			<div class="space-y-4">
				{#if mySellerSlug}
					<div class="flex flex-wrap items-center justify-between gap-3">
						<div class="space-y-1">
							<p class="text-sm font-medium">{seller?.name ?? 'Your business'}</p>
							<p class="text-sm text-muted-foreground">
								Manage business-wide settings that affect new fulfillment timing calculations.
							</p>
						</div>
						<Button href="/{mySellerSlug}">See my sales page</Button>
					</div>

					<div class="space-y-2">
						<Select.Root
							type="single"
							value={businessTimezoneValue}
							items={businessTimezoneOptions}
							onValueChange={handleBusinessTimezoneChange}
							disabled={savingBusinessTimezone}
						>
							<Select.Trigger class="w-full justify-start text-left" data-testid="business-timezone-selector">
								Business Timezone: {businessTimezoneLabel}
								{#if savingBusinessTimezone}
									<span class="ml-2 inline-flex align-middle">
										<SpinnerSun class="size-3.5" />
									</span>
								{/if}
							</Select.Trigger>
							<Select.Content class="max-h-72 min-w-60">
								{#each businessTimezoneOptions as option (option.value)}
									<Select.Item value={option.value} label={option.label}>
										{option.label}
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<p class="text-xs text-muted-foreground">
							Changing the business timezone updates only the seller timezone setting used for future
							template interpretation. Existing orders, offers, and fulfillment options are not rewritten.
						</p>
						{#if businessTimezoneError}
							<p class="text-xs text-destructive">{businessTimezoneError}</p>
						{/if}
					</div>
				{:else}
					<div class="flex flex-wrap items-center justify-between gap-3">
						<p class="text-sm text-muted-foreground">
							Create your business first to get a sales page and business timezone settings.
						</p>
						<Button href="/me" data-sveltekit-reload>Become a seller</Button>
					</div>
				{/if}
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Profile</Card.Title>
		</Card.Header>
		<Card.Content>
			<dl class="space-y-2 text-sm">
				<div class="flex gap-2">
					<dt class="text-muted-foreground">Name</dt>
					<dd>{data.customer.firstName} {data.customer.lastName}</dd>
				</div>
				<div class="flex gap-2">
					<dt class="text-muted-foreground">Email</dt>
					<dd>{data.customer.emailAddress}</dd>
				</div>
			</dl>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Settings</Card.Title>
		</Card.Header>
		<Card.Content>
			<Button variant="outline" onclick={toggleMode}>
				{#if mode.current === 'dark'}
					<Sun class="h-[1.2rem] w-[1.2rem]" />
					Light Mode
				{:else}
					<Moon class="h-[1.2rem] w-[1.2rem]" />
					Dark Mode
				{/if}
			</Button>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Change email</Card.Title>
			<Card.Description>We'll send a verification link to your new email.</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if requestUpdateEmail.result?.success}
				<p class="text-sm text-green-600">Check your new email for a verification link.</p>
			{:else}
				<form {...requestUpdateEmail} class="space-y-4">
					<div class="space-y-2">
						<label for="currentPasswordEmail" class="text-sm font-medium leading-none">Current password</label>
						<Input
							{...requestUpdateEmail.fields._currentPassword.as('password')}
							id="currentPasswordEmail"
							autocomplete="current-password"
						/>
						{#each requestUpdateEmail.fields._currentPassword.issues() as issue}
							<p class="text-destructive text-sm">{issue.message}</p>
						{/each}
					</div>
					<div class="space-y-2">
						<label for="newEmail" class="text-sm font-medium leading-none">New email</label>
						<Input
							{...requestUpdateEmail.fields.newEmail.as('email')}
							id="newEmail"
							autocomplete="email"
						/>
						{#each requestUpdateEmail.fields.newEmail.issues() as issue}
							<p class="text-destructive text-sm">{issue.message}</p>
						{/each}
					</div>
					<Button type="submit" disabled={!!requestUpdateEmail.pending}>
						{#if requestUpdateEmail.pending}<SpinnerSun class="mr-2" />{/if}
						{requestUpdateEmail.pending ? 'Sending...' : 'Change email'}
					</Button>
				</form>
			{/if}
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Change password</Card.Title>
		</Card.Header>
		<Card.Content>
			{#if updatePassword.result?.success}
				<p class="text-sm text-green-600">Password changed successfully.</p>
			{:else}
				<form {...updatePassword} class="space-y-4">
					<div class="space-y-2">
						<label for="currentPassword" class="text-sm font-medium leading-none">Current password</label>
						<Input
							{...updatePassword.fields._currentPassword.as('password')}
							id="currentPassword"
							autocomplete="current-password"
						/>
						{#each updatePassword.fields._currentPassword.issues() as issue}
							<p class="text-destructive text-sm">{issue.message}</p>
						{/each}
					</div>
					<div class="space-y-2">
						<label for="newPassword" class="text-sm font-medium leading-none">New password</label>
						<Input
							{...updatePassword.fields._newPassword.as('password')}
							id="newPassword"
							autocomplete="new-password"
						/>
						{#each updatePassword.fields._newPassword.issues() as issue}
							<p class="text-destructive text-sm">{issue.message}</p>
						{/each}
					</div>
					<div class="space-y-2">
						<label for="confirmPassword" class="text-sm font-medium leading-none">Confirm new password</label>
						<Input
							{...updatePassword.fields._confirmPassword.as('password')}
							id="confirmPassword"
							autocomplete="new-password"
						/>
						{#each updatePassword.fields._confirmPassword.issues() as issue}
							<p class="text-destructive text-sm">{issue.message}</p>
						{/each}
					</div>
					<Button type="submit" disabled={!!updatePassword.pending}>
						{#if updatePassword.pending}<SpinnerSun class="mr-2" />{/if}
						{updatePassword.pending ? 'Changing...' : 'Change password'}
					</Button>
				</form>
			{/if}
		</Card.Content>
	</Card.Root>

	<div class="pt-6 border-t">
		<Button variant="destructive" disabled={loggingOut} onclick={handleLogout} data-testid="logout-btn">
			{#if loggingOut}<SpinnerSun class="mr-2" />{/if}
			{loggingOut ? 'Logging out...' : 'Log out'}
		</Button>
	</div>
</div>
