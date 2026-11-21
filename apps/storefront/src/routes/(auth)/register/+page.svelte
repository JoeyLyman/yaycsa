<script lang="ts">
	import { register, resendVerification } from '#lib/api/shop/auth.remote.ts';
	import * as Card from '#lib/components/bits/card/index.ts';
	import { Button } from '#lib/components/bits/button/index.ts';
	import { Input } from '#lib/components/bits/input/index.ts';
	import { SpinnerSun } from '#lib/components/bits/spinner-sun/index.ts';

	/**
	 * True after successful registration. Swaps the form for a
	 * "check your email" confirmation card.
	 */
	let registered = $state(false);

	/** The email address submitted during registration. Shown in the confirmation card. */
	let registeredEmail = $state('');

	/**
	 * Tracks the state of the "resend verification email" button on the confirmation card.
	 * - "idle": button ready to click
	 * - "sending": request in flight, button disabled
	 * - "sent": confirmation shown
	 */
	let resendState = $state<'idle' | 'sending' | 'sent'>('idle');

	/** Server-side or network error message from a failed registration attempt. null when no error. */
	let errorMessage = $state<string | null>(null);

	async function handleResend() {
		if (!registeredEmail) return;
		resendState = 'sending';
		await resendVerification(registeredEmail);
		resendState = 'sent';
	}
</script>

{#if registered}
	<Card.Root data-testid="register-success">
		<Card.Header>
			<Card.Title class="text-2xl">Check your email</Card.Title>
			<Card.Description>
				We sent a verification link to <strong>{registeredEmail}</strong>. Click the link to
				activate your account.
			</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<Button
				variant="outline"
				class="w-full"
				disabled={resendState === 'sending'}
				onclick={handleResend}
			>
				{#if resendState === 'sent'}
					Verification email sent
				{:else if resendState === 'sending'}
					<SpinnerSun class="mr-2" /> Sending...
				{:else}
					Didn't get it? Resend
				{/if}
			</Button>
		</Card.Content>
		<Card.Footer>
			<a href="/login" class="text-sm text-muted-foreground hover:underline">Back to login</a>
		</Card.Footer>
	</Card.Root>
{:else}
	<Card.Root>
		<Card.Header>
			<Card.Title class="text-2xl">Create an account</Card.Title>
			<Card.Description>Enter your details to get started.</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if errorMessage}
				<p class="mb-4 text-sm text-destructive" data-testid="register-error">{errorMessage}</p>
			{/if}
			<form
				{...register.enhance(async ({ submit }) => {
					errorMessage = null;
					try {
						await submit();
						if (register.result?.success) {
							registeredEmail = register.fields.email.value() ?? '';
							registered = true;
						}
					} catch (err) {
						errorMessage = err instanceof Error ? err.message : 'Something went wrong';
					}
				})}
				class="space-y-4"
			>
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<label for="firstName" class="text-sm leading-none font-medium">First name</label>
						<Input
							{...register.fields.firstName.as('text')}
							id="firstName"
							autocomplete="given-name"
						/>
						{#each register.fields.firstName.issues() as issue}
							<p class="text-sm text-destructive">{issue.message}</p>
						{/each}
					</div>
					<div class="space-y-2">
						<label for="lastName" class="text-sm leading-none font-medium">Last name</label>
						<Input
							{...register.fields.lastName.as('text')}
							id="lastName"
							autocomplete="family-name"
						/>
						{#each register.fields.lastName.issues() as issue}
							<p class="text-sm text-destructive">{issue.message}</p>
						{/each}
					</div>
				</div>
				<div class="space-y-2">
					<label for="email" class="text-sm leading-none font-medium">Email</label>
					<Input
						{...register.fields.email.as('email')}
						id="email"
						placeholder="you@example.com"
						autocomplete="email"
					/>
					{#each register.fields.email.issues() as issue}
						<p class="text-sm text-destructive">{issue.message}</p>
					{/each}
				</div>
				<div class="space-y-2">
					<label for="password" class="text-sm leading-none font-medium">Password</label>
					<Input
						{...register.fields._password.as('password')}
						id="password"
						autocomplete="new-password"
					/>
					{#each register.fields._password.issues() as issue}
						<p class="text-sm text-destructive">{issue.message}</p>
					{/each}
				</div>
				<Button
					type="submit"
					class="w-full"
					disabled={!!register.pending}
					data-testid="register-submit"
				>
					{#if register.pending}<SpinnerSun class="mr-2" />{/if}
					{register.pending ? 'Creating account...' : 'Create account'}
				</Button>
			</form>
		</Card.Content>
		<Card.Footer>
			<p class="text-sm text-muted-foreground">
				Already have an account? <a
					href="/login"
					class="font-medium text-foreground hover:underline">Log in</a
				>
			</p>
		</Card.Footer>
	</Card.Root>
{/if}
