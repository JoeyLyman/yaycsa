<script lang="ts">
	import { Input } from '$lib/components/bits/input';
	import { Button } from '$lib/components/bits/button';
	import { InputSelect, type InputSelectItem } from '$lib/components/blocks/input-select';

	let {
		/** All available bits (ingredients/components). */
		allBits,
		/** All available processing types. */
		allProcesses,
		/** All available allergen warnings. */
		allAllergenWarnings,
		/** Unit type options (value + label). */
		unitTypes,
		/** Default process ID to pre-select (e.g., "Raw / Fresh"). */
		defaultProcessId,
		/** Callback when the user submits a new product. */
		oncreate,
		/** Callback for creating a new bit (ingredient). */
		onCreateBit,
	}: {
		allBits: InputSelectItem[];
		allProcesses: InputSelectItem[];
		allAllergenWarnings: InputSelectItem[];
		unitTypes: InputSelectItem[];
		defaultProcessId?: string;
		oncreate: (data: {
			name: string;
			unitType: string;
			bitIds: string[];
			processIds: string[];
			allergenIds: string[];
		}) => void;
		onCreateBit: (name: string) => Promise<InputSelectItem | null>;
	} = $props();

	// ─── Form state ───

	/** Name input for the new product. */
	let newName = $state('');

	/** Selected unit type value. Stored as single-element array for InputSelect compatibility. */
	let newUnitTypeValues: string[] = $state([]);

	/** Selected bit (ingredient) IDs. */
	let newBitIds: string[] = $state([]);

	/** Selected process IDs. Pre-populated with defaultProcessId if provided. */
	let newProcessIds: string[] = $state([]);

	/** Initialize process selection with default on first render. */
	$effect(() => {
		if (defaultProcessId && newProcessIds.length === 0) {
			newProcessIds = [defaultProcessId];
		}
	});

	/** Selected allergen warning IDs. */
	let newAllergenIds: string[] = $state([]);

	/** Reference to the product name input for re-focusing after submit. */
	let nameInput: HTMLInputElement | null = $state(null);

	function handleSubmit() {
		const name = newName.trim();
		if (name.length < 3) return;

		oncreate({
			name,
			unitType: newUnitTypeValues[0] ?? '',
			bitIds: newBitIds,
			processIds: newProcessIds,
			allergenIds: newAllergenIds,
		});

		// Reset form
		newName = '';
		newUnitTypeValues = [];
		newBitIds = [];
		newProcessIds = [];
		newAllergenIds = [];
		nameInput?.focus();
	}
</script>

<form
	class="space-y-5 rounded-md border px-3 pt-1 pb-3"
	onsubmit={(e) => {
		e.preventDefault();
		handleSubmit();
	}}
>
	<!-- Row 1: Name, Unit Type -->
	<div class="flex flex-wrap items-end gap-2">
		<div class="min-w-[180px] flex-1">
			<label for="new-name" class="text-xs font-medium text-muted-foreground">Product Name</label>
			<Input
				id="new-name"
				bind:value={newName}
				bind:ref={nameInput}
				placeholder="e.g. Mixed Salad Greens"
			/>
		</div>
		<div class="w-40">
			<p class="text-xs font-medium text-muted-foreground">Unit Type</p>
			<InputSelect
				items={unitTypes}
				bind:selectedValues={newUnitTypeValues}
				multiSelect={false}
				placeholder="Select unit..."
			/>
		</div>
	</div>

	<!-- Row 2: Bits (ingredients) — searchable multi-select -->
	<div>
		<p class="text-xs font-medium text-muted-foreground">
			Bits <span class="font-normal text-muted-foreground/70">(Ingredients — What's in it?)</span>
		</p>
		<InputSelect
			items={allBits}
			bind:selectedValues={newBitIds}
			multiSelect={true}
			color="green"
			allowCreate={true}
			onCreate={onCreateBit}
			placeholder="Search ingredients..."
		/>
	</div>

	<!-- Row 3: Processing — searchable multi-select -->
	<div>
		<p class="text-xs font-medium text-muted-foreground">
			Processing <span class="font-normal text-muted-foreground/70">(What was done to it?)</span>
		</p>
		<InputSelect
			items={allProcesses}
			bind:selectedValues={newProcessIds}
			multiSelect={true}
			color="blue"
			placeholder="Search processing..."
		/>
	</div>

	<!-- Row 4: Allergen Warnings — searchable multi-select -->
	<div>
		<p class="text-xs font-medium text-muted-foreground">
			Allergen Warnings <span class="font-normal text-muted-foreground/70"
				>(May have come in contact with...)</span
			>
		</p>
		<InputSelect
			items={allAllergenWarnings}
			bind:selectedValues={newAllergenIds}
			multiSelect={true}
			color="orange"
			displayName={(item) => item.label.replace(/^May contain /i, '')}
			placeholder="Search allergens..."
		/>
	</div>

	<!-- Submit -->
	<div class="flex justify-center pt-1 pb-2">
		<Button
			type="submit"
			disabled={newName.trim().length < 3}
			class="w-full max-w-md"
			data-testid="add-product-submit"
		>
			Add Product
		</Button>
	</div>
</form>
