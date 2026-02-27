<script lang="ts">
	import { requestUpdateEmail, updatePassword } from '$lib/api/shop/auth.remote';
	import * as Card from '$lib/components/bits/card';
	import { Button } from '$lib/components/bits/button';

	let { data } = $props();
</script>

<h1 class="text-2xl font-bold">Account</h1>

<div class="mt-6 space-y-6">
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
						<input
							{...requestUpdateEmail.fields._currentPassword.as('password')}
							id="currentPasswordEmail"
							autocomplete="current-password"
							class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
						/>
						{#each requestUpdateEmail.fields._currentPassword.issues() as issue}
							<p class="text-destructive text-sm">{issue.message}</p>
						{/each}
					</div>
					<div class="space-y-2">
						<label for="newEmail" class="text-sm font-medium leading-none">New email</label>
						<input
							{...requestUpdateEmail.fields.newEmail.as('email')}
							id="newEmail"
							autocomplete="email"
							class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
						/>
						{#each requestUpdateEmail.fields.newEmail.issues() as issue}
							<p class="text-destructive text-sm">{issue.message}</p>
						{/each}
					</div>
					<Button type="submit" disabled={!!requestUpdateEmail.pending}>
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
						<input
							{...updatePassword.fields._currentPassword.as('password')}
							id="currentPassword"
							autocomplete="current-password"
							class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
						/>
						{#each updatePassword.fields._currentPassword.issues() as issue}
							<p class="text-destructive text-sm">{issue.message}</p>
						{/each}
					</div>
					<div class="space-y-2">
						<label for="newPassword" class="text-sm font-medium leading-none">New password</label>
						<input
							{...updatePassword.fields._newPassword.as('password')}
							id="newPassword"
							autocomplete="new-password"
							class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
						/>
						{#each updatePassword.fields._newPassword.issues() as issue}
							<p class="text-destructive text-sm">{issue.message}</p>
						{/each}
					</div>
					<div class="space-y-2">
						<label for="confirmPassword" class="text-sm font-medium leading-none">Confirm new password</label>
						<input
							{...updatePassword.fields._confirmPassword.as('password')}
							id="confirmPassword"
							autocomplete="new-password"
							class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
						/>
						{#each updatePassword.fields._confirmPassword.issues() as issue}
							<p class="text-destructive text-sm">{issue.message}</p>
						{/each}
					</div>
					<Button type="submit" disabled={!!updatePassword.pending}>
						{updatePassword.pending ? 'Changing...' : 'Change password'}
					</Button>
				</form>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
