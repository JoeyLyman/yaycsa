<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		myOffersWorkspace,
		type OfferStatus,
		type SellerFulfillmentOptionWorkspaceItem,
		type SellerOffersWorkspaceData
	} from '$lib/api/admin/offers.remote';
	import {
		createFulfillmentOption,
		deleteFulfillmentOption,
		restoreFulfillmentOption,
		updateFulfillmentOption,
		type FulfillmentOptionType,
		type RecurrenceType
	} from '$lib/api/admin/fulfillment-options.remote';
	import { Button } from '$lib/components/bits/button';
	import { Input } from '$lib/components/bits/input';
	import { SpinnerSun } from '$lib/components/bits/spinner-sun';
	import { Textarea } from '$lib/components/bits/textarea';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';

	type OffersWorkspaceTab = 'offers' | 'fulfillment-options';
	type FulfillmentOptionsVisibilityFilter = 'current' | 'deleted';
	type EditorRecurrence = RecurrenceType | '';

	interface FulfillmentOptionEditorRow {
		id: string;
		name: string;
		type: FulfillmentOptionType;
		notes: string;
		recurrence: EditorRecurrence;
		fulfillmentStartDate: string;
		fulfillmentEndDate: string;
		deadlineOffsetHours: string;
		activeOfferCount: number;
		offerCount: number;
		historicalOfferCount: number;
		canPermanentlyDelete: boolean;
	}

	const recurrenceOptions: Array<{ value: EditorRecurrence; label: string }> = [
		{ value: '', label: 'No recurrence' },
		{ value: 'once', label: 'Once' },
		{ value: 'daily', label: 'Daily' },
		{ value: 'weekly', label: 'Weekly' },
		{ value: 'every_2_weeks', label: 'Every 2 weeks' },
		{ value: 'every_4_weeks', label: 'Every 4 weeks' },
		{ value: 'every_8_weeks', label: 'Every 8 weeks' },
		{ value: 'every_12_weeks', label: 'Every 12 weeks' }
	];

	/** Full workspace payload used for the summary strip and both tab views. */
	let workspaceData = $state<SellerOffersWorkspaceData | null>(null);

	/** Snapshot of the last server-loaded saved fulfillment-option rows for dirty-state comparisons. */
	let savedFulfillmentOptionRowSnapshots = $state<Record<string, FulfillmentOptionEditorRow>>({});

	/** Whether the initial workspace load or a later refresh is still running. */
	let loading = $state(true);

	/** Error message from the initial load or the most recent refresh attempt. */
	let loadError = $state<string | null>(null);

	/** Mutable editable copy of the seller's current non-deleted fulfillment options. */
	let fulfillmentOptionRows = $state<FulfillmentOptionEditorRow[]>([]);

	/** Unsaved draft fulfillment-option rows currently appended to the bottom of the list. */
	let fulfillmentOptionDraftRows = $state<FulfillmentOptionEditorRow[]>([]);

	/** Counter used to create stable IDs for draft rows before they exist in the database. */
	let fulfillmentOptionDraftIdCounter = $state(0);

	/** Saved-row IDs whose metadata section is currently expanded. */
	let expandedFulfillmentOptionRowIds = new SvelteSet<string>();

	/** Draft-row IDs whose metadata section is currently expanded. */
	let expandedFulfillmentOptionDraftRowIds = new SvelteSet<string>();

	/** Row IDs currently running a save, delete, or restore mutation. */
	let pendingRowIds = new SvelteSet<string>();

	/** Row-level validation or mutation errors keyed by row ID. */
	let rowErrors = new SvelteMap<string, string>();

	/** Current-row IDs that are showing the inline delete confirmation state. */
	let confirmingDeleteRowIds = new SvelteSet<string>();

	/** Deleted-row IDs that are showing the inline permanent-delete confirmation state. */
	let confirmingDeletedPermanentRowIds = new SvelteSet<string>();

	/** URL-driven selected workspace tab so refresh/back/deep-linking preserve context. */
	let selectedWorkspaceTab = $derived.by(() => {
		const rawTab = page.url.searchParams.get('tab');
		return rawTab === 'fulfillment-options' ? 'fulfillment-options' : 'offers';
	});

	/** URL-driven deleted/current filter for the fulfillment-options workspace view. */
	let selectedFulfillmentOptionsFilter = $derived.by(() => {
		const rawFilter = page.url.searchParams.get('fulfillmentView');
		return rawFilter === 'deleted' ? 'deleted' : 'current';
	});

	/** Active-offer count shown in the summary strip at the top of the workspace. */
	let activeOfferCount = $derived(workspaceData?.activeOfferCount ?? 0);

	/** Total non-deleted offer count shown in the summary strip. */
	let offerCount = $derived(workspaceData?.offerCount ?? 0);

	/** Active current fulfillment-option count shown in the summary strip. */
	let activeFulfillmentOptionCount = $derived(workspaceData?.activeFulfillmentOptionCount ?? 0);

	/** Total current non-deleted fulfillment-option count shown in the summary strip. */
	let fulfillmentOptionCount = $derived(workspaceData?.fulfillmentOptionCount ?? 0);

	/** Deleted fulfillment options shown when the deleted filter is active. */
	let deletedFulfillmentOptions = $derived(workspaceData?.deletedFulfillmentOptions ?? []);

	/** Whether the fulfillment-options workspace is currently showing deleted rows. */
	let showingDeletedFulfillmentOptions = $derived(selectedFulfillmentOptionsFilter === 'deleted');

	loadWorkspaceData();

	function getErrorMessage(error: unknown, fallbackMessage: string): string {
		if (error instanceof Error && error.message) return error.message;
		if (typeof error === 'string' && error.length > 0) return error;
		return fallbackMessage;
	}

	function formatCompactDateTime(isoValue: string | null): string {
		if (!isoValue) return '—';
		const parsedDate = new Date(isoValue);
		if (Number.isNaN(parsedDate.getTime())) return '—';
		return new Intl.DateTimeFormat(undefined, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(parsedDate);
	}

	function formatDeletedDate(isoValue: string | null): string {
		if (!isoValue) return '—';
		const parsedDate = new Date(isoValue);
		if (Number.isNaN(parsedDate.getTime())) return '—';
		return new Intl.DateTimeFormat(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(parsedDate);
	}

	function toDatetimeLocalInputValue(isoValue: string | null): string {
		if (!isoValue) return '';
		const parsedDate = new Date(isoValue);
		if (Number.isNaN(parsedDate.getTime())) return '';
		const localDate = new Date(parsedDate.getTime() - parsedDate.getTimezoneOffset() * 60_000);
		return localDate.toISOString().slice(0, 16);
	}

	function toEditorRow(
		fulfillmentOption: SellerFulfillmentOptionWorkspaceItem
	): FulfillmentOptionEditorRow {
		return {
			id: fulfillmentOption.id,
			name: fulfillmentOption.name,
			type: fulfillmentOption.type,
			notes: fulfillmentOption.notes ?? '',
			recurrence: fulfillmentOption.recurrence ?? '',
			fulfillmentStartDate: toDatetimeLocalInputValue(fulfillmentOption.fulfillmentStartDate),
			fulfillmentEndDate: toDatetimeLocalInputValue(fulfillmentOption.fulfillmentEndDate),
			deadlineOffsetHours:
				fulfillmentOption.deadlineOffsetHours == null
					? ''
					: String(fulfillmentOption.deadlineOffsetHours),
			activeOfferCount: fulfillmentOption.activeOfferCount,
			offerCount: fulfillmentOption.offerCount,
			historicalOfferCount: fulfillmentOption.historicalOfferCount,
			canPermanentlyDelete: fulfillmentOption.canPermanentlyDelete
		};
	}

	function createBlankFulfillmentOptionEditorRow(id: string): FulfillmentOptionEditorRow {
		return {
			id,
			name: '',
			type: 'pickup',
			notes: '',
			recurrence: '',
			fulfillmentStartDate: '',
			fulfillmentEndDate: '',
			deadlineOffsetHours: '',
			activeOfferCount: 0,
			offerCount: 0,
			historicalOfferCount: 0,
			canPermanentlyDelete: true
		};
	}

	function sortFulfillmentOptionEditorRows(
		rows: FulfillmentOptionEditorRow[]
	): FulfillmentOptionEditorRow[] {
		return [...rows].sort((left, right) => left.name.localeCompare(right.name));
	}

	function summarizeFulfillmentOptionUsage(row: {
		activeOfferCount: number;
		historicalOfferCount: number;
	}): string {
		if (row.activeOfferCount > 0) {
			return row.activeOfferCount === 1
				? '1 active offer'
				: `${row.activeOfferCount} active offers`;
		}
		if (row.historicalOfferCount > 0) {
			return row.historicalOfferCount === 1
				? '1 historical offer'
				: `${row.historicalOfferCount} historical offers`;
		}
		return 'Unused';
	}

	function getDeleteButtonLabel(row: { canPermanentlyDelete: boolean }): string {
		return row.canPermanentlyDelete ? 'Permanently Delete' : 'Delete';
	}

	function getDeleteConfirmMessage(row: {
		name: string;
		canPermanentlyDelete: boolean;
		activeOfferCount: number;
		historicalOfferCount: number;
	}): string {
		if (row.canPermanentlyDelete) {
			return `Permanently delete "${row.name}"? This cannot be undone.`;
		}
		if (row.activeOfferCount > 0) {
			return `Delete "${row.name}"? It is still referenced by ${summarizeFulfillmentOptionUsage(row)} and will move to the deleted view instead of being permanently removed.`;
		}
		return `Delete "${row.name}"? It is still referenced by ${summarizeFulfillmentOptionUsage(row)} and will move to the deleted view.`;
	}

	function getRecurrenceLabel(recurrence: EditorRecurrence): string {
		return (
			recurrenceOptions.find((option) => option.value === recurrence)?.label ?? 'No recurrence'
		);
	}

	function summarizeWindow(row: {
		fulfillmentStartDate: string;
		fulfillmentEndDate: string;
		recurrence: EditorRecurrence;
	}): string {
		if (!row.fulfillmentStartDate && !row.fulfillmentEndDate) {
			return row.recurrence
				? `${getRecurrenceLabel(row.recurrence)} · no window yet`
				: 'No window set';
		}

		const startLabel = row.fulfillmentStartDate
			? formatCompactDateTime(new Date(row.fulfillmentStartDate).toISOString())
			: null;
		const endLabel = row.fulfillmentEndDate
			? formatCompactDateTime(new Date(row.fulfillmentEndDate).toISOString())
			: null;

		if (startLabel && endLabel) {
			return row.recurrence
				? `${getRecurrenceLabel(row.recurrence)} · ${startLabel}–${endLabel}`
				: `${startLabel}–${endLabel}`;
		}

		if (startLabel) {
			return row.recurrence
				? `${getRecurrenceLabel(row.recurrence)} · starts ${startLabel}`
				: `Starts ${startLabel}`;
		}

		return `Ends ${endLabel}`;
	}

	function summarizeDeadline(deadlineOffsetHours: string): string {
		if (deadlineOffsetHours.trim().length === 0) return 'No deadline';
		const value = Number.parseInt(deadlineOffsetHours, 10);
		if (Number.isNaN(value)) return 'No deadline';
		return value === 1 ? '1 hr deadline' : `${value} hrs deadline`;
	}

	function getSavedFulfillmentOptionSnapshot(rowId: string): FulfillmentOptionEditorRow | null {
		return savedFulfillmentOptionRowSnapshots[rowId] ?? null;
	}

	function isExistingFulfillmentOptionRowDirty(row: FulfillmentOptionEditorRow): boolean {
		const snapshot = getSavedFulfillmentOptionSnapshot(row.id);
		if (!snapshot) return false;
		return JSON.stringify(row) !== JSON.stringify(snapshot);
	}

	function getRowValidationErrors(
		row: FulfillmentOptionEditorRow,
		otherRows: FulfillmentOptionEditorRow[]
	): string[] {
		const errors: string[] = [];
		const trimmedName = row.name.trim();
		const parsedDeadlineOffset =
			row.deadlineOffsetHours.trim().length > 0
				? Number.parseInt(row.deadlineOffsetHours, 10)
				: null;

		if (trimmedName.length < 2) {
			errors.push('Name must be at least 2 characters.');
		}

		if (
			trimmedName.length > 0 &&
			otherRows.some(
				(otherRow) =>
					otherRow.id !== row.id && otherRow.name.trim().toLowerCase() === trimmedName.toLowerCase()
			)
		) {
			errors.push('Name must be unique within your fulfillment options.');
		}

		if (
			parsedDeadlineOffset != null &&
			(Number.isNaN(parsedDeadlineOffset) || parsedDeadlineOffset < 0)
		) {
			errors.push('Deadline hours must be 0 or greater.');
		}

		if (row.fulfillmentEndDate && !row.fulfillmentStartDate) {
			errors.push('Window end requires a window start.');
		}

		if (row.recurrence && !row.fulfillmentStartDate) {
			errors.push('Recurrence requires a window start.');
		}

		if (row.fulfillmentStartDate && row.fulfillmentEndDate) {
			const startTime = new Date(row.fulfillmentStartDate).getTime();
			const endTime = new Date(row.fulfillmentEndDate).getTime();
			if (!Number.isNaN(startTime) && !Number.isNaN(endTime) && endTime < startTime) {
				errors.push('Window end must be after the window start.');
			}
		}

		return errors;
	}

	function rowToMutationInput(row: FulfillmentOptionEditorRow) {
		return {
			name: row.name.trim(),
			type: row.type,
			notes: row.notes.trim() || null,
			recurrence: row.recurrence || null,
			fulfillmentStartDate: row.fulfillmentStartDate
				? new Date(row.fulfillmentStartDate).toISOString()
				: null,
			fulfillmentEndDate: row.fulfillmentEndDate
				? new Date(row.fulfillmentEndDate).toISOString()
				: null,
			deadlineOffsetHours:
				row.deadlineOffsetHours.trim().length > 0
					? Number.parseInt(row.deadlineOffsetHours, 10)
					: null
		};
	}

	async function loadWorkspaceData() {
		loading = true;
		loadError = null;
		try {
			workspaceData = await myOffersWorkspace();
			fulfillmentOptionRows = sortFulfillmentOptionEditorRows(
				(workspaceData?.currentFulfillmentOptions ?? []).map(toEditorRow)
			);
			savedFulfillmentOptionRowSnapshots = Object.fromEntries(
				fulfillmentOptionRows.map((row) => [row.id, { ...row }])
			);
		} catch (error) {
			loadError = getErrorMessage(error, 'Failed to load offers workspace');
			console.error('Failed to load offers workspace:', error);
		} finally {
			loading = false;
		}
	}

	function updateSearchParams(updates: Record<string, string | null>) {
		const nextUrl = new URL(page.url);
		for (const [key, value] of Object.entries(updates)) {
			if (value == null) {
				nextUrl.searchParams.delete(key);
			} else {
				nextUrl.searchParams.set(key, value);
			}
		}
		goto(`${nextUrl.pathname}${nextUrl.search}`, {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	function selectWorkspaceTab(tab: OffersWorkspaceTab) {
		updateSearchParams({ tab: tab === 'offers' ? null : tab });
	}

	function selectFulfillmentOptionsFilter(filter: FulfillmentOptionsVisibilityFilter) {
		updateSearchParams({
			tab: 'fulfillment-options',
			fulfillmentView: filter === 'deleted' ? 'deleted' : null
		});
	}

	function updateFulfillmentOptionRow(rowId: string, patch: Partial<FulfillmentOptionEditorRow>) {
		rowErrors.delete(rowId);
		fulfillmentOptionRows = fulfillmentOptionRows.map((row) =>
			row.id === rowId ? { ...row, ...patch } : row
		);
	}

	function updateFulfillmentOptionDraftRow(
		rowId: string,
		patch: Partial<FulfillmentOptionEditorRow>
	) {
		rowErrors.delete(rowId);
		fulfillmentOptionDraftRows = fulfillmentOptionDraftRows.map((row) =>
			row.id === rowId ? { ...row, ...patch } : row
		);
	}

	function toggleFulfillmentOptionRowExpanded(rowId: string) {
		if (expandedFulfillmentOptionRowIds.has(rowId)) {
			expandedFulfillmentOptionRowIds.delete(rowId);
			return;
		}
		expandedFulfillmentOptionRowIds.add(rowId);
	}

	function toggleFulfillmentOptionDraftExpanded(rowId: string) {
		if (expandedFulfillmentOptionDraftRowIds.has(rowId)) {
			expandedFulfillmentOptionDraftRowIds.delete(rowId);
			return;
		}
		expandedFulfillmentOptionDraftRowIds.add(rowId);
	}

	function addFulfillmentOptionDraftRow() {
		const draftId = `__draft_${++fulfillmentOptionDraftIdCounter}`;
		fulfillmentOptionDraftRows = [
			...fulfillmentOptionDraftRows,
			createBlankFulfillmentOptionEditorRow(draftId)
		];
		expandedFulfillmentOptionDraftRowIds.add(draftId);
		rowErrors.delete(draftId);
	}

	function cancelFulfillmentOptionDraftRow(rowId: string) {
		fulfillmentOptionDraftRows = fulfillmentOptionDraftRows.filter((row) => row.id !== rowId);
		expandedFulfillmentOptionDraftRowIds.delete(rowId);
		rowErrors.delete(rowId);
	}

	function resetExistingFulfillmentOptionRow(rowId: string) {
		const snapshot = getSavedFulfillmentOptionSnapshot(rowId);
		if (!snapshot) return;
		fulfillmentOptionRows = fulfillmentOptionRows.map((row) =>
			row.id === rowId ? { ...snapshot } : row
		);
		rowErrors.delete(rowId);
		confirmingDeleteRowIds.delete(rowId);
	}

	function beginDeleteExistingFulfillmentOptionRow(rowId: string) {
		confirmingDeleteRowIds.add(rowId);
		rowErrors.delete(rowId);
	}

	function cancelDeleteExistingFulfillmentOptionRow(rowId: string) {
		confirmingDeleteRowIds.delete(rowId);
	}

	async function saveExistingFulfillmentOptionRow(rowId: string) {
		const row = fulfillmentOptionRows.find((candidateRow) => candidateRow.id === rowId);
		if (!row) return;

		const validationErrors = getRowValidationErrors(row, [
			...fulfillmentOptionRows,
			...fulfillmentOptionDraftRows
		]);
		if (validationErrors.length > 0) {
			rowErrors.set(rowId, validationErrors[0]);
			return;
		}

		pendingRowIds.add(rowId);
		rowErrors.delete(rowId);

		try {
			await updateFulfillmentOption({ id: row.id, ...rowToMutationInput(row) });
			await loadWorkspaceData();
			expandedFulfillmentOptionRowIds.add(rowId);
		} catch (error) {
			console.error('Failed to update fulfillment option:', error);
			rowErrors.set(rowId, getErrorMessage(error, 'Failed to update fulfillment option'));
		} finally {
			pendingRowIds.delete(rowId);
		}
	}

	async function saveFulfillmentOptionDraftRow(rowId: string) {
		const row = fulfillmentOptionDraftRows.find((candidateRow) => candidateRow.id === rowId);
		if (!row) return;

		const validationErrors = getRowValidationErrors(row, [
			...fulfillmentOptionRows,
			...fulfillmentOptionDraftRows
		]);
		if (validationErrors.length > 0) {
			rowErrors.set(rowId, validationErrors[0]);
			return;
		}

		pendingRowIds.add(rowId);
		rowErrors.delete(rowId);

		try {
			await createFulfillmentOption(rowToMutationInput(row));
			fulfillmentOptionDraftRows = fulfillmentOptionDraftRows.filter(
				(candidateRow) => candidateRow.id !== rowId
			);
			expandedFulfillmentOptionDraftRowIds.delete(rowId);
			await loadWorkspaceData();
		} catch (error) {
			console.error('Failed to create fulfillment option:', error);
			rowErrors.set(rowId, getErrorMessage(error, 'Failed to create fulfillment option'));
		} finally {
			pendingRowIds.delete(rowId);
		}
	}

	async function deleteExistingFulfillmentOptionRow(rowId: string) {
		const row = fulfillmentOptionRows.find((candidateRow) => candidateRow.id === rowId);
		if (!row) return;

		pendingRowIds.add(rowId);
		rowErrors.delete(rowId);

		try {
			await deleteFulfillmentOption({ id: row.id, permanently: row.canPermanentlyDelete });
			await loadWorkspaceData();
			expandedFulfillmentOptionRowIds.delete(rowId);
			confirmingDeleteRowIds.delete(rowId);
		} catch (error) {
			console.error('Failed to delete fulfillment option:', error);
			rowErrors.set(rowId, getErrorMessage(error, 'Failed to delete fulfillment option'));
		} finally {
			pendingRowIds.delete(rowId);
		}
	}

	async function restoreDeletedFulfillmentOptionRow(rowId: string) {
		pendingRowIds.add(rowId);
		rowErrors.delete(rowId);

		try {
			await restoreFulfillmentOption(rowId);
			await loadWorkspaceData();
			selectFulfillmentOptionsFilter('current');
		} catch (error) {
			console.error('Failed to restore fulfillment option:', error);
			rowErrors.set(rowId, getErrorMessage(error, 'Failed to restore fulfillment option'));
		} finally {
			pendingRowIds.delete(rowId);
		}
	}

	async function permanentlyDeleteDeletedFulfillmentOptionRow(
		row: SellerFulfillmentOptionWorkspaceItem
	) {
		pendingRowIds.add(row.id);
		rowErrors.delete(row.id);

		try {
			await deleteFulfillmentOption({ id: row.id, permanently: true });
			await loadWorkspaceData();
			confirmingDeletedPermanentRowIds.delete(row.id);
		} catch (error) {
			console.error('Failed to permanently delete fulfillment option:', error);
			rowErrors.set(
				row.id,
				getErrorMessage(error, 'Failed to permanently delete fulfillment option')
			);
		} finally {
			pendingRowIds.delete(row.id);
		}
	}

	function getOfferStatusLabel(status: OfferStatus): string {
		if (status === 'active') return 'Active';
		if (status === 'draft') return 'Draft';
		if (status === 'paused') return 'Paused';
		return 'Expired';
	}

	function getOfferStatusClasses(status: OfferStatus): string {
		if (status === 'active') return 'text-emerald-700';
		if (status === 'draft') return 'text-amber-700';
		if (status === 'paused') return 'text-slate-600';
		return 'text-muted-foreground';
	}

	function stopRowToggle(event: Event) {
		event.stopPropagation();
	}

	function handleExpandableRowKeydown(event: KeyboardEvent, rowId: string, draft = false) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		if (draft) {
			toggleFulfillmentOptionDraftExpanded(rowId);
			return;
		}
		toggleFulfillmentOptionRowExpanded(rowId);
	}
</script>

{#snippet MoreActionsIcon()}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="14"
		height="14"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<circle cx="12" cy="5" r="1" />
		<circle cx="12" cy="12" r="1" />
		<circle cx="12" cy="19" r="1" />
	</svg>
{/snippet}

{#if loading}
	<div class="flex items-center justify-center py-32">
		<SpinnerSun class="size-8 text-muted-foreground" />
	</div>
{:else if loadError}
	<div class="space-y-4">
		<h1 class="text-2xl font-bold">Offers</h1>
		<p class="text-destructive">Error loading offers workspace: {loadError}</p>
		<Button variant="outline" onclick={loadWorkspaceData}>Try again</Button>
	</div>
{:else}
	<div class="space-y-4 pb-10">
		<div class="space-y-2">
			<h1 class="text-2xl font-bold">Offers</h1>
			<p class="text-sm text-muted-foreground">
				Manage your reusable fulfillment options here now, and build into full product-offer tables
				next. This workspace keeps both views together because offers reference fulfillment options
				directly.
			</p>
		</div>

		<div class="grid grid-cols-2 gap-3 md:grid-cols-4">
			<div class="rounded-md border p-3">
				<p class="text-xs tracking-wide text-muted-foreground uppercase">Active offers</p>
				<p class="mt-1 text-2xl font-semibold">{activeOfferCount}</p>
			</div>
			<div class="rounded-md border p-3">
				<p class="text-xs tracking-wide text-muted-foreground uppercase">Offers</p>
				<p class="mt-1 text-2xl font-semibold">{offerCount}</p>
			</div>
			<div class="rounded-md border p-3">
				<p class="text-xs tracking-wide text-muted-foreground uppercase">
					Active fulfillment options
				</p>
				<p class="mt-1 text-2xl font-semibold">{activeFulfillmentOptionCount}</p>
			</div>
			<div class="rounded-md border p-3">
				<p class="text-xs tracking-wide text-muted-foreground uppercase">Fulfillment options</p>
				<p class="mt-1 text-2xl font-semibold">{fulfillmentOptionCount}</p>
			</div>
		</div>

		<div class="inline-flex items-center gap-1 rounded-md bg-muted p-1">
			<Button
				variant={selectedWorkspaceTab === 'offers' ? 'secondary' : 'ghost'}
				size="sm"
				onclick={() => selectWorkspaceTab('offers')}
			>
				Offers
			</Button>
			<Button
				variant={selectedWorkspaceTab === 'fulfillment-options' ? 'secondary' : 'ghost'}
				size="sm"
				onclick={() => selectWorkspaceTab('fulfillment-options')}
			>
				Fulfillment Options
			</Button>
		</div>

		{#if selectedWorkspaceTab === 'offers'}
			<div class="space-y-3">
				<div class="rounded-md border">
					<div
						class="border-b px-3 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase"
					>
						Offers workspace
					</div>
					{#if (workspaceData?.offers.length ?? 0) === 0}
						<div class="px-3 py-8 text-center text-sm text-muted-foreground">
							No offers yet. The full seller offers table and editor are the next step.
						</div>
					{:else}
						<div>
							{#each workspaceData?.offers ?? [] as offer (offer.id)}
								<div class="border-b px-3 py-3 last:border-b-0">
									<div class="flex items-start justify-between gap-3">
										<div class="min-w-0 space-y-1">
											<p class="text-sm font-medium {getOfferStatusClasses(offer.status)}">
												{getOfferStatusLabel(offer.status)}
											</p>
											<div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
												<span>
													{formatCompactDateTime(offer.validFrom)}
													{#if offer.validUntil}
														→ {formatCompactDateTime(offer.validUntil)}
													{:else}
														· no end date
													{/if}
												</span>
												<span>{offer.lineItemCount} items</span>
												{#if offer.fulfillmentOptionNames.length > 0}
													<span>{offer.fulfillmentOptionNames.join(', ')}</span>
												{:else}
													<span>No fulfillment options</span>
												{/if}
											</div>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<Button variant="outline" class="w-full" disabled>+ Add Offer (coming next)</Button>
			</div>
		{:else}
			<div class="space-y-3">
				<div class="flex flex-wrap items-center gap-2">
					<div class="inline-flex items-center gap-1 rounded-md bg-muted p-1">
						<Button
							variant={selectedFulfillmentOptionsFilter === 'current' ? 'secondary' : 'ghost'}
							size="sm"
							onclick={() => selectFulfillmentOptionsFilter('current')}
						>
							Current
						</Button>
						<Button
							variant={selectedFulfillmentOptionsFilter === 'deleted' ? 'secondary' : 'ghost'}
							size="sm"
							onclick={() => selectFulfillmentOptionsFilter('deleted')}
						>
							Deleted
						</Button>
					</div>
					<p class="text-sm text-muted-foreground">
						{#if showingDeletedFulfillmentOptions}
							Deleted fulfillment options stay searchable here and can be restored or permanently
							deleted when safe.
						{:else}
							Current fulfillment options can be attached to future offers. Delete becomes a soft
							delete when non-deleted offers still reference an option.
						{/if}
					</p>
				</div>

				{#if showingDeletedFulfillmentOptions}
					<div class="rounded-md border">
						{#if deletedFulfillmentOptions.length === 0}
							<div class="px-3 py-8 text-center text-sm text-muted-foreground">
								No deleted fulfillment options found.
							</div>
						{:else}
							{#each deletedFulfillmentOptions as fulfillmentOption (fulfillmentOption.id)}
								<div class="border-b last:border-b-0">
									<div class="flex items-start gap-3 px-3 py-3 md:px-4">
										<div class="min-w-0 flex-1 space-y-1">
											<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
												<p class="truncate text-[17px] leading-tight font-medium">
													{fulfillmentOption.name}
												</p>
											</div>
											<div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
												<span class="capitalize">{fulfillmentOption.type}</span>
												<span
													>{summarizeWindow({
														fulfillmentStartDate: toDatetimeLocalInputValue(
															fulfillmentOption.fulfillmentStartDate
														),
														fulfillmentEndDate: toDatetimeLocalInputValue(
															fulfillmentOption.fulfillmentEndDate
														),
														recurrence: fulfillmentOption.recurrence ?? ''
													})}</span
												>
												<span>{summarizeFulfillmentOptionUsage(fulfillmentOption)}</span>
												<span>Deleted {formatDeletedDate(fulfillmentOption.deletedAt)}</span>
											</div>
											{#if fulfillmentOption.notes}
												<p class="text-sm text-muted-foreground">{fulfillmentOption.notes}</p>
											{/if}
											{#if rowErrors.get(fulfillmentOption.id)}
												<p class="text-xs text-destructive">
													{rowErrors.get(fulfillmentOption.id)}
												</p>
											{/if}
										</div>
										<div
											class="shrink-0"
											role="presentation"
											onclick={stopRowToggle}
											onkeydown={stopRowToggle}
										>
											<div class="flex flex-wrap items-center justify-end gap-1">
												<Button
													size="sm"
													variant="outline"
													onclick={() => restoreDeletedFulfillmentOptionRow(fulfillmentOption.id)}
													disabled={pendingRowIds.has(fulfillmentOption.id)}
												>
													{#if pendingRowIds.has(fulfillmentOption.id)}
														<SpinnerSun class="size-3.5" />
													{:else}
														Restore
													{/if}
												</Button>
												{#if confirmingDeletedPermanentRowIds.has(fulfillmentOption.id)}
													<Button
														size="sm"
														variant="destructive"
														onclick={() =>
															permanentlyDeleteDeletedFulfillmentOptionRow(fulfillmentOption)}
														disabled={pendingRowIds.has(fulfillmentOption.id) ||
															!fulfillmentOption.canPermanentlyDelete}
													>
														Permanently Delete
													</Button>
													<Button
														size="sm"
														variant="ghost"
														onclick={() =>
															confirmingDeletedPermanentRowIds.delete(fulfillmentOption.id)}
													>
														Cancel
													</Button>
												{:else}
													<Button
														size="sm"
														variant="ghost"
														onclick={() =>
															confirmingDeletedPermanentRowIds.add(fulfillmentOption.id)}
														disabled={!fulfillmentOption.canPermanentlyDelete}
													>
														Permanently Delete
													</Button>
												{/if}
											</div>
										</div>
									</div>
								</div>
							{/each}
						{/if}
					</div>
				{:else}
					<div class="rounded-md border" data-testid="fulfillment-options-table">
						{#if fulfillmentOptionRows.length === 0 && fulfillmentOptionDraftRows.length === 0}
							<div class="px-3 py-8 text-center text-sm text-muted-foreground">
								No fulfillment options yet. Add your first pickup, delivery, or shipping option
								below.
							</div>
						{/if}

						{#each fulfillmentOptionRows as row (row.id)}
							<div
								class="cursor-pointer border-b last:border-b-0"
								role="button"
								tabindex="0"
								onclick={() => toggleFulfillmentOptionRowExpanded(row.id)}
								onkeydown={(event) => handleExpandableRowKeydown(event, row.id)}
							>
								<div class="flex items-start gap-3 px-3 py-3 md:px-4">
									<div class="min-w-0 flex-1 space-y-1">
										<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
											<p class="truncate text-[17px] leading-tight font-medium">{row.name}</p>
										</div>
										<div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
											<span class="capitalize">{row.type}</span>
											<span>{summarizeWindow(row)}</span>
											<span>{summarizeDeadline(row.deadlineOffsetHours)}</span>
											<span>{summarizeFulfillmentOptionUsage(row)}</span>
										</div>
										{#if row.notes.trim().length > 0}
											<p class="text-sm text-muted-foreground">{row.notes}</p>
										{/if}
										{#if rowErrors.get(row.id)}
											<p class="text-xs text-destructive">{rowErrors.get(row.id)}</p>
										{/if}
									</div>
									<div
										class="shrink-0"
										role="presentation"
										onclick={stopRowToggle}
										onkeydown={stopRowToggle}
									>
										{#if isExistingFulfillmentOptionRowDirty(row)}
											<div class="flex items-center gap-1">
												<Button
													size="sm"
													onclick={() => saveExistingFulfillmentOptionRow(row.id)}
													disabled={pendingRowIds.has(row.id)}
												>
													{#if pendingRowIds.has(row.id)}
														<SpinnerSun class="size-3.5" />
													{:else}
														Save
													{/if}
												</Button>
												<Button
													size="sm"
													variant="ghost"
													onclick={() => resetExistingFulfillmentOptionRow(row.id)}
												>
													Cancel
												</Button>
											</div>
										{:else if confirmingDeleteRowIds.has(row.id)}
											<div class="flex items-center gap-1">
												<Button
													size="sm"
													variant="destructive"
													title={getDeleteConfirmMessage(row)}
													onclick={() => deleteExistingFulfillmentOptionRow(row.id)}
													disabled={pendingRowIds.has(row.id)}
												>
													{getDeleteButtonLabel(row)}
												</Button>
												<Button
													size="sm"
													variant="ghost"
													onclick={() => cancelDeleteExistingFulfillmentOptionRow(row.id)}
												>
													Cancel
												</Button>
											</div>
										{:else}
											<Button
												size="icon-sm"
												variant="ghost"
												onclick={() => beginDeleteExistingFulfillmentOptionRow(row.id)}
												title="Row actions"
											>
												{@render MoreActionsIcon()}
											</Button>
										{/if}
									</div>
								</div>

								{#if expandedFulfillmentOptionRowIds.has(row.id)}
									<div class="space-y-4 px-3 pb-3 md:px-4">
										<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
											<div class="space-y-2 xl:col-span-2">
												<label
													for={`fulfillment-name-${row.id}`}
													class="text-xs font-medium text-muted-foreground">Name</label
												>
												<Input
													id={`fulfillment-name-${row.id}`}
													value={row.name}
													oninput={(event) =>
														updateFulfillmentOptionRow(row.id, {
															name: (event.currentTarget as HTMLInputElement).value
														})}
													onclick={stopRowToggle}
													placeholder="Wednesday Portland Delivery"
												/>
											</div>

											<div class="space-y-2">
												<p class="text-xs font-medium text-muted-foreground">Type</p>
												<div class="flex flex-wrap gap-1">
													<Button
														size="sm"
														variant={row.type === 'pickup' ? 'secondary' : 'outline'}
														onclick={() => updateFulfillmentOptionRow(row.id, { type: 'pickup' })}
													>
														Pickup
													</Button>
													<Button
														size="sm"
														variant={row.type === 'delivery' ? 'secondary' : 'outline'}
														onclick={() => updateFulfillmentOptionRow(row.id, { type: 'delivery' })}
													>
														Delivery / Shipping
													</Button>
												</div>
											</div>
										</div>

										<div class="space-y-2">
											<p class="text-xs font-medium text-muted-foreground">Window</p>
											<div class="grid gap-3 md:grid-cols-2">
												<div class="space-y-2">
													<label
														for={`fulfillment-window-start-${row.id}`}
														class="text-xs text-muted-foreground">Start</label
													>
													<Input
														id={`fulfillment-window-start-${row.id}`}
														type="datetime-local"
														value={row.fulfillmentStartDate}
														oninput={(event) =>
															updateFulfillmentOptionRow(row.id, {
																fulfillmentStartDate: (event.currentTarget as HTMLInputElement)
																	.value
															})}
														onclick={stopRowToggle}
													/>
												</div>
												<div class="space-y-2">
													<label
														for={`fulfillment-window-end-${row.id}`}
														class="text-xs text-muted-foreground">End</label
													>
													<Input
														id={`fulfillment-window-end-${row.id}`}
														type="datetime-local"
														value={row.fulfillmentEndDate}
														oninput={(event) =>
															updateFulfillmentOptionRow(row.id, {
																fulfillmentEndDate: (event.currentTarget as HTMLInputElement).value
															})}
														onclick={stopRowToggle}
													/>
												</div>
											</div>
										</div>

										<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
											<div class="space-y-2 xl:col-span-3">
												<p class="text-xs font-medium text-muted-foreground">Recurrence</p>
												<div class="flex flex-wrap gap-1">
													{#each recurrenceOptions as option (option.value)}
														<Button
															size="sm"
															variant={row.recurrence === option.value ? 'secondary' : 'outline'}
															onclick={() =>
																updateFulfillmentOptionRow(row.id, { recurrence: option.value })}
														>
															{option.label}
														</Button>
													{/each}
												</div>
											</div>

											<div class="space-y-2">
												<label
													for={`fulfillment-deadline-${row.id}`}
													class="text-xs font-medium text-muted-foreground">Deadline hrs</label
												>
												<Input
													id={`fulfillment-deadline-${row.id}`}
													type="number"
													min="0"
													step="1"
													value={row.deadlineOffsetHours}
													oninput={(event) =>
														updateFulfillmentOptionRow(row.id, {
															deadlineOffsetHours: (event.currentTarget as HTMLInputElement).value
														})}
													onclick={stopRowToggle}
													placeholder="48"
												/>
											</div>
										</div>

										<div class="grid gap-3 md:grid-cols-2">
											<div class="space-y-2">
												<label
													for={`fulfillment-notes-${row.id}`}
													class="text-xs font-medium text-muted-foreground">Notes</label
												>
												<Textarea
													id={`fulfillment-notes-${row.id}`}
													value={row.notes}
													oninput={(event) =>
														updateFulfillmentOptionRow(row.id, {
															notes: (event.currentTarget as HTMLTextAreaElement).value
														})}
													onclick={stopRowToggle}
													placeholder="Pickup instructions, address notes, handling details, or shipping context"
												/>
											</div>

											<div class="space-y-2">
												<p class="text-xs font-medium text-muted-foreground">Reference state</p>
												<div class="rounded-md border px-3 py-3 text-sm text-muted-foreground">
													<p class="font-medium text-foreground">
														{summarizeFulfillmentOptionUsage(row)}
													</p>
													<p class="mt-1">
														{#if row.canPermanentlyDelete}
															No non-deleted offers reference this option, so permanent delete is
															available.
														{:else}
															Delete will move this option into the deleted view instead of
															permanently removing it.
														{/if}
													</p>
												</div>
											</div>
										</div>
									</div>
								{/if}
							</div>
						{/each}

						{#each fulfillmentOptionDraftRows as row (row.id)}
							<div
								class="cursor-pointer border-b bg-muted/20 last:border-b-0"
								role="button"
								tabindex="0"
								onclick={() => toggleFulfillmentOptionDraftExpanded(row.id)}
								onkeydown={(event) => handleExpandableRowKeydown(event, row.id, true)}
							>
								<div class="flex items-start gap-3 px-3 py-3 md:px-4">
									<div class="min-w-0 flex-1 space-y-2">
										<Input
											value={row.name}
											oninput={(event) =>
												updateFulfillmentOptionDraftRow(row.id, {
													name: (event.currentTarget as HTMLInputElement).value
												})}
											onclick={stopRowToggle}
											placeholder="Wednesday Portland Delivery"
										/>
										<div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
											<span class="capitalize">{row.type}</span>
											<span>{summarizeWindow(row)}</span>
											<span>{summarizeDeadline(row.deadlineOffsetHours)}</span>
											<span>New draft fulfillment option</span>
										</div>
										{#if rowErrors.get(row.id)}
											<p class="text-xs text-destructive">{rowErrors.get(row.id)}</p>
										{/if}
									</div>
									<div
										class="shrink-0"
										role="presentation"
										onclick={stopRowToggle}
										onkeydown={stopRowToggle}
									>
										<div class="flex items-center gap-1">
											<Button
												size="sm"
												onclick={() => saveFulfillmentOptionDraftRow(row.id)}
												disabled={pendingRowIds.has(row.id)}
											>
												{#if pendingRowIds.has(row.id)}
													<SpinnerSun class="size-3.5" />
												{:else}
													Save
												{/if}
											</Button>
											<Button
												size="sm"
												variant="ghost"
												onclick={() => cancelFulfillmentOptionDraftRow(row.id)}
											>
												Cancel
											</Button>
										</div>
									</div>
								</div>

								{#if expandedFulfillmentOptionDraftRowIds.has(row.id)}
									<div class="space-y-4 px-3 pb-3 md:px-4">
										<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
											<div class="space-y-2">
												<p class="text-xs font-medium text-muted-foreground">Type</p>
												<div class="flex flex-wrap gap-1">
													<Button
														size="sm"
														variant={row.type === 'pickup' ? 'secondary' : 'outline'}
														onclick={() =>
															updateFulfillmentOptionDraftRow(row.id, { type: 'pickup' })}
													>
														Pickup
													</Button>
													<Button
														size="sm"
														variant={row.type === 'delivery' ? 'secondary' : 'outline'}
														onclick={() =>
															updateFulfillmentOptionDraftRow(row.id, { type: 'delivery' })}
													>
														Delivery / Shipping
													</Button>
												</div>
											</div>
										</div>

										<div class="space-y-2">
											<p class="text-xs font-medium text-muted-foreground">Window</p>
											<div class="grid gap-3 md:grid-cols-2">
												<div class="space-y-2">
													<label
														for={`fulfillment-draft-window-start-${row.id}`}
														class="text-xs text-muted-foreground">Start</label
													>
													<Input
														id={`fulfillment-draft-window-start-${row.id}`}
														type="datetime-local"
														value={row.fulfillmentStartDate}
														oninput={(event) =>
															updateFulfillmentOptionDraftRow(row.id, {
																fulfillmentStartDate: (event.currentTarget as HTMLInputElement)
																	.value
															})}
														onclick={stopRowToggle}
													/>
												</div>
												<div class="space-y-2">
													<label
														for={`fulfillment-draft-window-end-${row.id}`}
														class="text-xs text-muted-foreground">End</label
													>
													<Input
														id={`fulfillment-draft-window-end-${row.id}`}
														type="datetime-local"
														value={row.fulfillmentEndDate}
														oninput={(event) =>
															updateFulfillmentOptionDraftRow(row.id, {
																fulfillmentEndDate: (event.currentTarget as HTMLInputElement).value
															})}
														onclick={stopRowToggle}
													/>
												</div>
											</div>
										</div>

										<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
											<div class="space-y-2 xl:col-span-3">
												<p class="text-xs font-medium text-muted-foreground">Recurrence</p>
												<div class="flex flex-wrap gap-1">
													{#each recurrenceOptions as option (option.value)}
														<Button
															size="sm"
															variant={row.recurrence === option.value ? 'secondary' : 'outline'}
															onclick={() =>
																updateFulfillmentOptionDraftRow(row.id, {
																	recurrence: option.value
																})}
														>
															{option.label}
														</Button>
													{/each}
												</div>
											</div>

											<div class="space-y-2">
												<label
													for={`fulfillment-draft-deadline-${row.id}`}
													class="text-xs font-medium text-muted-foreground">Deadline hrs</label
												>
												<Input
													id={`fulfillment-draft-deadline-${row.id}`}
													type="number"
													min="0"
													step="1"
													value={row.deadlineOffsetHours}
													oninput={(event) =>
														updateFulfillmentOptionDraftRow(row.id, {
															deadlineOffsetHours: (event.currentTarget as HTMLInputElement).value
														})}
													onclick={stopRowToggle}
													placeholder="48"
												/>
											</div>
										</div>

										<div class="space-y-2">
											<label
												for={`fulfillment-draft-notes-${row.id}`}
												class="text-xs font-medium text-muted-foreground">Notes</label
											>
											<Textarea
												id={`fulfillment-draft-notes-${row.id}`}
												value={row.notes}
												oninput={(event) =>
													updateFulfillmentOptionDraftRow(row.id, {
														notes: (event.currentTarget as HTMLTextAreaElement).value
													})}
												onclick={stopRowToggle}
												placeholder="Pickup instructions, address notes, handling details, or shipping context"
											/>
										</div>
									</div>
								{/if}
							</div>
						{/each}
					</div>

					<Button
						variant="outline"
						class="w-full"
						onclick={addFulfillmentOptionDraftRow}
						data-testid="add-fulfillment-option-button"
					>
						+ Add Fulfillment Option
					</Button>
				{/if}
			</div>
		{/if}
	</div>
{/if}
