<script lang="ts">
	import { resetPassword } from '$lib/api/shop/auth.remote';
	import * as Card from '$lib/components/bits/card';
	import { Button } from '$lib/components/bits/button';
	import { SpinnerSun } from '$lib/components/bits/spinner-sun';

	let { data } = $props();

	// Set the token from page data into the form field
	$effect(() => {
		if (data.token) resetPassword.fields.token.set(data.token);
	});
</script>

{#if data.error}
	<Card.Root>
		<Card.Header>
			<Card.Title class="text-2xl">Invalid reset link</Card.Title>
			<Card.Description>{data.error}</Card.Description>
		</Card.Header>
		<Card.Footer>
			<Button href="/forgot-password" variant="outline" class="w-full">Request a new link</Button>
		</Card.Footer>
	</Card.Root>
{:else}
	<Card.Root>
		<Card.Header>
			<Card.Title class="text-2xl">Reset password</Card.Title>
			<Card.Description>Enter your new password.</Card.Description>
		</Card.Header>
		<Card.Content>
			<form {...resetPassword} class="space-y-4">
				{#each resetPassword.fields.token.issues() as issue}
					<p class="text-destructive text-sm">{issue.message}</p>
				{/each}
				<div class="space-y-2">
					<label for="password" class="text-sm font-medium leading-none">New password</label>
					<input
						{...resetPassword.fields._password.as('password')}
						id="password"
						autocomplete="new-password"
						class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
					/>
					{#each resetPassword.fields._password.issues() as issue}
						<p class="text-destructive text-sm">{issue.message}</p>
					{/each}
				</div>
				<div class="space-y-2">
					<label for="confirmPassword" class="text-sm font-medium leading-none">Confirm password</label>
					<input
						{...resetPassword.fields._confirmPassword.as('password')}
						id="confirmPassword"
						autocomplete="new-password"
						class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
					/>
					{#each resetPassword.fields._confirmPassword.issues() as issue}
						<p class="text-destructive text-sm">{issue.message}</p>
					{/each}
				</div>
				<Button type="submit" class="w-full" disabled={!!resetPassword.pending}>
					{#if resetPassword.pending}<SpinnerSun class="mr-2" />{/if}
					{resetPassword.pending ? 'Resetting...' : 'Reset password'}
				</Button>
			</form>
		</Card.Content>
	</Card.Root>
{/if}
