<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { login, resendVerification } from '$lib/api/shop/auth.remote';
	import * as Card from '$lib/components/bits/card';
	import { Button } from '$lib/components/bits/button';

	let resendState = $state<'idle' | 'sending' | 'sent'>('idle');
	let errorMessage = $state<string | null>(null);
	let redirecting = $state(false);

	async function handleResend() {
		const email = login.fields.email.value();
		if (!email) return;
		resendState = 'sending';
		await resendVerification(email);
		resendState = 'sent';
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title class="text-2xl">Log in</Card.Title>
		<Card.Description>Enter your email and password to continue.</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if errorMessage}
			<p class="text-destructive text-sm">{errorMessage}</p>
		{/if}
		<form
			{...login.enhance(async ({ submit }) => {
				errorMessage = null;
				try {
					await submit();
					if (login.result?.success) {
						redirecting = true;
						await invalidateAll();
						goto(login.result.returnTo);
					}
				} catch (err) {
					errorMessage = err instanceof Error ? err.message : 'Something went wrong';
				}
			})}
			class="space-y-4"
		>
			<div class="space-y-2">
				<label for="email" class="text-sm font-medium leading-none">Email</label>
				<input
					{...login.fields.email.as('email')}
					id="email"
					placeholder="you@example.com"
					autocomplete="email"
					class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
				/>
				{#each login.fields.email.issues() as issue}
					<p class="text-destructive text-sm">{issue.message}</p>
				{/each}
				{#if login.fields.email.issues()?.some((i: { message: string }) => i.message.includes('verify'))}
					<Button
						variant="outline"
						size="sm"
						type="button"
						disabled={resendState === 'sending'}
						onclick={handleResend}
					>
						{#if resendState === 'sent'}
							Verification email sent
						{:else if resendState === 'sending'}
							Sending...
						{:else}
							Resend verification email
						{/if}
					</Button>
				{/if}
			</div>
			<div class="space-y-2">
				<label for="password" class="text-sm font-medium leading-none">Password</label>
				<input
					{...login.fields._password.as('password')}
					id="password"
					autocomplete="current-password"
					class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
				/>
				{#each login.fields._password.issues() as issue}
					<p class="text-destructive text-sm">{issue.message}</p>
				{/each}
			</div>
			<Button type="submit" class="w-full" disabled={!!login.pending || redirecting}>
				{login.pending || redirecting ? 'Logging in...' : 'Log in'}
			</Button>
		</form>
	</Card.Content>
	<Card.Footer class="flex-col gap-2">
		<a href="/forgot-password" class="text-muted-foreground text-sm hover:underline">Forgot password?</a>
		<p class="text-muted-foreground text-sm">
			Don't have an account? <a href="/register" class="text-foreground font-medium hover:underline">Register</a>
		</p>
	</Card.Footer>
</Card.Root>
