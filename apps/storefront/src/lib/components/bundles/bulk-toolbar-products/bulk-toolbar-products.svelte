<script lang="ts">
	import { Button } from '$lib/components/bits/button';
	import { SpinnerSun } from '$lib/components/bits/spinner-sun';
	import { BulkToolbar } from '$lib/components/blocks/bulk-toolbar';
	import { InputSelect, type InputSelectItem } from '$lib/components/blocks/input-select';

	let {
		/** Number of items currently selected. */
		selectedCount,
		/** All available bits (ingredients/components). */
		allBits,
		/** All available processing types. */
		allProcesses,
		/** All available allergen warnings. */
		allAllergenWarnings,
		/** Unit type options. */
		unitTypes,
		/** Whether the toolbar is visible. */
		visible = false,
		/** Whether a bulk operation is in progress. */
		busy = false,
		/** Callback to clear all selections. */
		onclear,
		/** Callback to bulk delete selected products. */
		ondelete,
		/** Callback to set unit type on selected products. */
		onSetUnitType,
		/** Callback to add facet values to selected products. */
		onAddFacets,
	}: {
		selectedCount: number;
		allBits: InputSelectItem[];
		allProcesses: InputSelectItem[];
		allAllergenWarnings: InputSelectItem[];
		unitTypes: InputSelectItem[];
		visible?: boolean;
		busy?: boolean;
		onclear: () => void;
		ondelete: () => void;
		onSetUnitType: (value: string) => void;
		onAddFacets: (ids: string[]) => void;
	} = $props();

	/** Whether delete confirmation is shown. */
	let confirmingDelete = $state(false);

	/** Which tag panel is open (null = none). */
	let tagPanel: 'bits' | 'processes' | 'allergens' | null = $state(null);

	/** Temporary selection for the active tag panel. */
	let tagSelection: string[] = $state([]);

	function openTagPanel(panel: 'bits' | 'processes' | 'allergens') {
		tagPanel = panel;
		tagSelection = [];
	}

	function applyTags() {
		if (tagSelection.length > 0) {
			onAddFacets(tagSelection);
		}
		tagPanel = null;
		tagSelection = [];
	}

	function cancelTags() {
		tagPanel = null;
		tagSelection = [];
	}
</script>

<BulkToolbar {selectedCount} {visible} {onclear}>
	{#snippet actions()}
		{#if busy}
			<SpinnerSun class="size-4 text-muted-foreground" />
			<span class="text-sm text-muted-foreground">Working...</span>
		{:else if confirmingDelete}
			<span class="text-sm text-destructive">Delete {selectedCount} products?</span>
			<Button
				size="sm"
				variant="destructive"
				onclick={() => {
					confirmingDelete = false;
					ondelete();
				}}
			>
				Yes, delete
			</Button>
			<Button size="sm" variant="ghost" onclick={() => (confirmingDelete = false)}>
				Cancel
			</Button>
		{:else if tagPanel}
			<div class="flex items-center gap-2">
				<span class="text-sm text-muted-foreground">
					Add {tagPanel === 'bits' ? 'bits' : tagPanel === 'processes' ? 'processing' : 'allergens'} to {selectedCount} products:
				</span>
				<div class="w-56">
					<InputSelect
						items={tagPanel === 'bits'
							? allBits
							: tagPanel === 'processes'
								? allProcesses
								: allAllergenWarnings}
						bind:selectedValues={tagSelection}
						multiSelect={true}
						color={tagPanel === 'bits' ? 'green' : tagPanel === 'processes' ? 'blue' : 'orange'}
						displayName={tagPanel === 'allergens'
							? (item) => item.label.replace(/^May contain /i, '')
							: undefined}
						placeholder="Search..."
					/>
				</div>
				<Button size="sm" onclick={applyTags} disabled={tagSelection.length === 0}>
					Apply
				</Button>
				<Button size="sm" variant="ghost" onclick={cancelTags}>
					Cancel
				</Button>
			</div>
		{:else}
			<!-- Default action buttons -->
			<Button
				size="sm"
				variant="destructive"
				onclick={() => (confirmingDelete = true)}
			>
				Delete
			</Button>

			<div class="w-40">
				<InputSelect
					items={unitTypes}
					selectedValues={[]}
					onchange={(values) => {
						if (values[0] !== undefined) onSetUnitType(values[0]);
					}}
					multiSelect={false}
					placeholder="Set unit type..."
				/>
			</div>

			<Button size="sm" variant="outline" onclick={() => openTagPanel('bits')}>
				+ Bits
			</Button>
			<Button size="sm" variant="outline" onclick={() => openTagPanel('processes')}>
				+ Processing
			</Button>
			<Button size="sm" variant="outline" onclick={() => openTagPanel('allergens')}>
				+ Allergens
			</Button>
		{/if}
	{/snippet}
</BulkToolbar>
