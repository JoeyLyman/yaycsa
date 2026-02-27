<script lang="ts">
	import { requestPasswordReset } from '$lib/api/shop/auth.remote';
	import * as Card from '$lib/components/bits/card';
	import { Button } from '$lib/components/bits/button';
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
					<input
						{...requestPasswordReset.fields.email.as('email')}
						id="email"
						placeholder="you@example.com"
						autocomplete="email"
						class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
					/>
					{#each requestPasswordReset.fields.email.issues() as issue}
						<p class="text-destructive text-sm">{issue.message}</p>
					{/each}
				</div>
				<Button type="submit" class="w-full" disabled={!!requestPasswordReset.pending}>
					{requestPasswordReset.pending ? 'Sending...' : 'Send reset link'}
				</Button>
			</form>
		</Card.Content>
		<Card.Footer>
			<a href="/login" class="text-muted-foreground text-sm hover:underline">Back to login</a>
		</Card.Footer>
	</Card.Root>
{/if}
