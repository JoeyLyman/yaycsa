<script lang="ts">
	import { requestPasswordReset } from '$lib/api/shop/auth.remote';
	import * as Card from '$lib/components/bits/card';
	import { Button } from '$lib/components/bits/button';
	import { Input } from '$lib/components/bits/input';
	import { SpinnerSun } from '$lib/components/bits/spinner-sun';
</script>

{#if requestPasswordReset.result?.success}
	<Card.Root>
		<Card.Header>
			<Card.Title class="text-2xl">Check your email</Card.Title>
			<Card.Description>If an account exists for that email, we sent a password reset link.</Card.Description>
		</Card.Header>
		<Card.Footer>
			<a href="/login" class="text-muted-foreground text-sm hover:underline">Back to login</a>
		</Card.Footer>
	</Card.Root>
{:else}
	<Card.Root>
		<Card.Header>
			<Card.Title class="text-2xl">Forgot password</Card.Title>
			<Card.Description>Enter your email and we'll send you a reset link.</Card.Description>
		</Card.Header>
		<Card.Content>
			<form {...requestPasswordReset} class="space-y-4">
				<div class="space-y-2">
					<label for="email" class="text-sm font-medium leading-none">Email</label>
					<Input
						{...requestPasswordReset.fields.email.as('email')}
						id="email"
						placeholder="you@example.com"
						autocomplete="email"
					/>
					{#each requestPasswordReset.fields.email.issues() as issue}
						<p class="text-destructive text-sm">{issue.message}</p>
					{/each}
				</div>
				<Button type="submit" class="w-full" disabled={!!requestPasswordReset.pending}>
					{#if requestPasswordReset.pending}<SpinnerSun class="mr-2" />{/if}
					{requestPasswordReset.pending ? 'Sending...' : 'Send reset link'}
				</Button>
			</form>
		</Card.Content>
		<Card.Footer>
			<a href="/login" class="text-muted-foreground text-sm hover:underline">Back to login</a>
		</Card.Footer>
	</Card.Root>
{/if}
