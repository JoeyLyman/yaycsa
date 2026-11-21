<script lang="ts">
	import { requestPasswordReset } from '#lib/api/shop/auth.remote.ts';
	import * as Card from '#lib/old/components/bits/card/index.ts';
	import { Button } from '#lib/old/components/bits/button/index.ts';
	import { Input } from '#lib/old/components/bits/input/index.ts';
	import { SpinnerSun } from '#lib/old/components/bits/spinner-sun/index.ts';
</script>

{#if requestPasswordReset.result?.success}
	<Card.Root>
		<Card.Header>
			<Card.Title class="text-2xl">Check your email</Card.Title>
			<Card.Description>
				If an account exists for that email, we sent a password reset link.
			</Card.Description>
		</Card.Header>
		<Card.Footer>
			<a href="/login" class="text-sm text-muted-foreground hover:underline">Back to login</a>
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
					<label for="email" class="text-sm leading-none font-medium">Email</label>
					<Input
						{...requestPasswordReset.fields.email.as('email')}
						id="email"
						placeholder="you@example.com"
						autocomplete="email"
					/>
					{#each requestPasswordReset.fields.email.issues() as issue}
						<p class="text-sm text-destructive">{issue.message}</p>
					{/each}
				</div>
				<Button type="submit" class="w-full" disabled={!!requestPasswordReset.pending}>
					{#if requestPasswordReset.pending}<SpinnerSun class="mr-2" />{/if}
					{requestPasswordReset.pending ? 'Sending...' : 'Send reset link'}
				</Button>
			</form>
		</Card.Content>
		<Card.Footer>
			<a href="/login" class="text-sm text-muted-foreground hover:underline">Back to login</a>
		</Card.Footer>
	</Card.Root>
{/if}
