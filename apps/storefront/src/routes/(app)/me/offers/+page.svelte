<script lang="ts">
	import { afterNavigate, goto, invalidateAll } from '$app/navigation';
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
		type Weekday
	} from '$lib/api/admin/fulfillment-options.remote';
	import { Button } from '$lib/components/bits/button';
	import { Checkbox } from '$lib/components/bits/checkbox';
	import { HeaderCountFilter } from '$lib/components/bits/header-count-filter';
	import { HeaderTabs } from '$lib/components/bits/header-tabs';
	import { Input } from '$lib/components/bits/input';
	import { SpinnerSun } from '$lib/components/bits/spinner-sun';
	import { Textarea } from '$lib/components/bits/textarea';
	import { getBusinessTimezoneDisplayName } from '$lib/utils/business-timezone';
	import { onMount } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';

	type OffersWorkspaceTab = 'offers' | 'fulfillment-options';
	type WorkspaceCountFilter = 'active' | 'total';
	type EditorWeekday = Weekday | '';

	interface FulfillmentOptionEditorRow {
		id: string;
		name: string;
		type: FulfillmentOptionType;
		notes: string;
		fulfillmentWeekday: EditorWeekday;
		fulfillmentTimeWindowStart: string;
		fulfillmentTimeWindowEnd: string;
		orderDeadlineWeekday: EditorWeekday;
		orderDeadlineTime: string;
		activeOfferCount: number;
		offerCount: number;
		historicalOfferCount: number;
		canPermanentlyDelete: boolean;
	}

	interface ScheduleTemplateSummaryInput {
		type: FulfillmentOptionType;
		fulfillmentWeekday: Weekday | null;
		fulfillmentTimeWindowStart: number | null;
		fulfillmentTimeWindowEnd: number | null;
		orderDeadlineWeekday: Weekday | null;
		orderDeadlineTime: number | null;
	}

	const fulfillmentOptionTypeOptions: Array<{ value: FulfillmentOptionType; label: string }> = [
		{ value: 'scheduled_pickup', label: 'Scheduled Pickup' },
		{ value: 'scheduled_delivery', label: 'Scheduled Delivery' },
		{ value: 'shipping', label: 'Shipping' }
	];

	const weekdayOptions: Array<{ value: Weekday; label: string; shortLabel: string }> = [
		{ value: 'monday', label: 'Monday', shortLabel: 'Mon' },
		{ value: 'tuesday', label: 'Tuesday', shortLabel: 'Tue' },
		{ value: 'wednesday', label: 'Wednesday', shortLabel: 'Wed' },
		{ value: 'thursday', label: 'Thursday', shortLabel: 'Thu' },
		{ value: 'friday', label: 'Friday', shortLabel: 'Fri' },
		{ value: 'saturday', label: 'Saturday', shortLabel: 'Sat' },
		{ value: 'sunday', label: 'Sunday', shortLabel: 'Sun' }
	];

	const selectInputClasses =
		'border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:ring-ring/50 focus-visible:ring-[3px]';

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


	/** URL-synced selected workspace tab so refresh/back/deep-linking preserve context and clicks switch instantly. */
	let selectedWorkspaceTab = $state<OffersWorkspaceTab>('offers');

	/** The offers-table count filter. Defaults to total so sellers see the full list first. */
	let selectedOffersCountFilter = $state<WorkspaceCountFilter>('total');

	/** The fulfillment-options count filter. Defaults to total so sellers see the full list first. */
	let selectedFulfillmentCountFilter = $state<WorkspaceCountFilter>('total');

	/** Whether scheduled pickup options are currently included in the fulfillment table filters. */
	let showingScheduledPickupOptions = $state(true);

	/** Whether scheduled delivery options are currently included in the fulfillment table filters. */
	let showingScheduledDeliveryOptions = $state(true);

	/** Whether shipping options are currently included in the fulfillment table filters. */
	let showingShippingOptions = $state(true);

	/** Whether deleted fulfillment options should be included below the current rows. */
	let showingDeletedFulfillmentOptions = $state(false);

	/** Active-offer count shown in the compact offers-tab count filter. */
	let activeOfferCount = $derived(workspaceData?.activeOfferCount ?? 0);

	/** Total non-deleted offer count shown in the compact offers-tab count filter. */
	let offerCount = $derived(workspaceData?.offerCount ?? 0);

	/** Active current fulfillment-option count shown in the compact fulfillment count filter. */
	let activeFulfillmentOptionCount = $derived(workspaceData?.activeFulfillmentOptionCount ?? 0);

	/** Total current non-deleted fulfillment-option count shown in the compact fulfillment count filter. */
	let fulfillmentOptionCount = $derived(workspaceData?.fulfillmentOptionCount ?? 0);

	/** Deleted fulfillment options available when the seller turns on the show-deleted filter. */
	let deletedFulfillmentOptions = $derived(workspaceData?.deletedFulfillmentOptions ?? []);

	/** Friendly human-readable timezone label shown anywhere schedule templates mention the business timezone. */
	let resolvedBusinessTimezoneLabel = $derived(
		getBusinessTimezoneDisplayName(workspaceData?.businessTimezone ?? 'UTC')
	);

	/** The count filter currently visible in the header row, based on the selected workspace tab. */
	let selectedWorkspaceCountFilter = $derived(
		selectedWorkspaceTab === 'offers' ? selectedOffersCountFilter : selectedFulfillmentCountFilter
	);

	/** Offers visible in the offers table after applying the active/total count filter. */
	let filteredOffers = $derived.by(() => {
		const offers = workspaceData?.offers ?? [];
		if (selectedOffersCountFilter === 'active') {
			return offers.filter((offer) => offer.status === 'active');
		}
		return offers;
	});

	/** Current saved fulfillment options visible after type and active/total filtering. */
	let filteredFulfillmentOptionRows = $derived.by(() =>
		fulfillmentOptionRows.filter((row) => matchesFulfillmentOptionFilters(row, selectedFulfillmentCountFilter))
	);

	/** Deleted fulfillment options visible after type and active/total filtering when show deleted is on. */
	let filteredDeletedFulfillmentOptions = $derived.by(() =>
		deletedFulfillmentOptions.filter((row) =>
			matchesFulfillmentOptionFilters(row, selectedFulfillmentCountFilter)
		)
	);

	/** Whether the fulfillment area currently has no saved or draft rows matching the selected filters. */
	let fulfillmentOptionsFilterIsEmpty = $derived(
		filteredFulfillmentOptionRows.length === 0 &&
		fulfillmentOptionDraftRows.length === 0 &&
		(!showingDeletedFulfillmentOptions || filteredDeletedFulfillmentOptions.length === 0)
	);

	/** Header-level tab definitions rendered in the page title area. Each href preserves URL-driven workspace state. */
	let workspaceHeaderTabs = $derived.by(() => [
		{ value: 'offers', label: 'Offers', href: getWorkspaceTabHref('offers') },
		{
			value: 'fulfillment-options',
			label: 'Fulfillment Options',
			href: getWorkspaceTabHref('fulfillment-options')
		}
	]);

	function getWorkspaceTabFromUrl(url: URL): OffersWorkspaceTab {
		return url.searchParams.get('tab') === 'fulfillment-options' ? 'fulfillment-options' : 'offers';
	}

	onMount(() => {
		selectedWorkspaceTab = getWorkspaceTabFromUrl(page.url);
		void loadWorkspaceData();
	});

	afterNavigate(() => {
		selectedWorkspaceTab = getWorkspaceTabFromUrl(page.url);
	});

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

	function getFulfillmentOptionTypeLabel(type: FulfillmentOptionType): string {
		return fulfillmentOptionTypeOptions.find((option) => option.value === type)?.label ?? type;
	}

	function isScheduledFulfillmentOptionType(type: FulfillmentOptionType): boolean {
		return type === 'scheduled_pickup' || type === 'scheduled_delivery';
	}

	function getWeekdayLabel(weekday: Weekday | null): string {
		if (!weekday) return '—';
		return weekdayOptions.find((option) => option.value === weekday)?.label ?? weekday;
	}

	function getWeekdayShortLabel(weekday: Weekday | null): string {
		if (!weekday) return '—';
		return weekdayOptions.find((option) => option.value === weekday)?.shortLabel ?? weekday;
	}

	function formatMinutesFromMidnight(value: number | null): string {
		if (value == null || !Number.isInteger(value) || value < 0 || value > 1439) return '—';
		const hours24 = Math.floor(value / 60);
		const minutes = value % 60;
		const meridiem = hours24 >= 12 ? 'PM' : 'AM';
		const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
		return `${hours12}:${String(minutes).padStart(2, '0')} ${meridiem}`;
	}

	function minutesToTimeInputValue(value: number | null): string {
		if (value == null || !Number.isInteger(value) || value < 0 || value > 1439) return '';
		const hours = Math.floor(value / 60);
		const minutes = value % 60;
		return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
	}

	function parseTimeInputValue(value: string): number | null | 'invalid' {
		const trimmed = value.trim();
		if (trimmed.length === 0) return null;
		const match = /^(\d{2}):(\d{2})$/.exec(trimmed);
		if (!match) return 'invalid';
		const hours = Number.parseInt(match[1], 10);
		const minutes = Number.parseInt(match[2], 10);
		if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return 'invalid';
		return hours * 60 + minutes;
	}

	function buildScheduleTemplateSummaryInput(
		row: FulfillmentOptionEditorRow
	): ScheduleTemplateSummaryInput {
		const fulfillmentTimeWindowStart = parseTimeInputValue(row.fulfillmentTimeWindowStart);
		const fulfillmentTimeWindowEnd = parseTimeInputValue(row.fulfillmentTimeWindowEnd);
		const orderDeadlineTime = parseTimeInputValue(row.orderDeadlineTime);

		return {
			type: row.type,
			fulfillmentWeekday: row.fulfillmentWeekday || null,
			fulfillmentTimeWindowStart:
				typeof fulfillmentTimeWindowStart === 'number' ? fulfillmentTimeWindowStart : null,
			fulfillmentTimeWindowEnd:
				typeof fulfillmentTimeWindowEnd === 'number' ? fulfillmentTimeWindowEnd : null,
			orderDeadlineWeekday: row.orderDeadlineWeekday || null,
			orderDeadlineTime: typeof orderDeadlineTime === 'number' ? orderDeadlineTime : null
		};
	}

	function summarizeScheduleTemplate(input: ScheduleTemplateSummaryInput): string {
		if (input.type === 'shipping') {
			return 'Shipping · notes only for now';
		}

		if (
			!input.fulfillmentWeekday ||
			input.fulfillmentTimeWindowStart == null ||
			input.fulfillmentTimeWindowEnd == null ||
			!input.orderDeadlineWeekday ||
			input.orderDeadlineTime == null
		) {
			return 'Scheduled template incomplete';
		}

		return `${getWeekdayShortLabel(input.fulfillmentWeekday)} ${formatMinutesFromMidnight(
			input.fulfillmentTimeWindowStart
		)}–${formatMinutesFromMidnight(input.fulfillmentTimeWindowEnd)} · order by ${getWeekdayShortLabel(
			input.orderDeadlineWeekday
		)} ${formatMinutesFromMidnight(input.orderDeadlineTime)}`;
	}

	function toEditorRow(
		fulfillmentOption: SellerFulfillmentOptionWorkspaceItem
	): FulfillmentOptionEditorRow {
		return {
			id: fulfillmentOption.id,
			name: fulfillmentOption.name,
			type: fulfillmentOption.type,
			notes: fulfillmentOption.notes ?? '',
			fulfillmentWeekday: fulfillmentOption.fulfillmentWeekday ?? '',
			fulfillmentTimeWindowStart: minutesToTimeInputValue(
				fulfillmentOption.fulfillmentTimeWindowStart
			),
			fulfillmentTimeWindowEnd: minutesToTimeInputValue(fulfillmentOption.fulfillmentTimeWindowEnd),
			orderDeadlineWeekday: fulfillmentOption.orderDeadlineWeekday ?? '',
			orderDeadlineTime: minutesToTimeInputValue(fulfillmentOption.orderDeadlineTime),
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
			type: 'scheduled_pickup',
			notes: '',
			fulfillmentWeekday: '',
			fulfillmentTimeWindowStart: '',
			fulfillmentTimeWindowEnd: '',
			orderDeadlineWeekday: '',
			orderDeadlineTime: '',
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

	function getSavedFulfillmentOptionSnapshot(rowId: string): FulfillmentOptionEditorRow | null {
		return savedFulfillmentOptionRowSnapshots[rowId] ?? null;
	}

	function isExistingFulfillmentOptionRowDirty(row: FulfillmentOptionEditorRow): boolean {
		const snapshot = getSavedFulfillmentOptionSnapshot(row.id);
		if (!snapshot) return false;
		return JSON.stringify(row) !== JSON.stringify(snapshot);
	}

	function buildTypePatch(nextType: FulfillmentOptionType): Partial<FulfillmentOptionEditorRow> {
		if (nextType === 'shipping') {
			return {
				type: nextType,
				fulfillmentWeekday: '',
				fulfillmentTimeWindowStart: '',
				fulfillmentTimeWindowEnd: '',
				orderDeadlineWeekday: '',
				orderDeadlineTime: ''
			};
		}

		return { type: nextType };
	}

	function getRowValidationErrors(
		row: FulfillmentOptionEditorRow,
		otherRows: FulfillmentOptionEditorRow[]
	): string[] {
		const errors: string[] = [];
		const trimmedName = row.name.trim();

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

		if (!isScheduledFulfillmentOptionType(row.type)) {
			return errors;
		}

		const fulfillmentTimeWindowStart = parseTimeInputValue(row.fulfillmentTimeWindowStart);
		const fulfillmentTimeWindowEnd = parseTimeInputValue(row.fulfillmentTimeWindowEnd);
		const orderDeadlineTime = parseTimeInputValue(row.orderDeadlineTime);

		if (!row.fulfillmentWeekday) {
			errors.push('Scheduled options require a fulfillment weekday.');
		}

		if (!row.orderDeadlineWeekday) {
			errors.push('Scheduled options require an order deadline weekday.');
		}

		if (fulfillmentTimeWindowStart === null) {
			errors.push('Scheduled options require a fulfillment start time.');
		} else if (fulfillmentTimeWindowStart === 'invalid') {
			errors.push('Fulfillment start time must use HH:MM format.');
		}

		if (fulfillmentTimeWindowEnd === null) {
			errors.push('Scheduled options require a fulfillment end time.');
		} else if (fulfillmentTimeWindowEnd === 'invalid') {
			errors.push('Fulfillment end time must use HH:MM format.');
		}

		if (orderDeadlineTime === null) {
			errors.push('Scheduled options require an order deadline time.');
		} else if (orderDeadlineTime === 'invalid') {
			errors.push('Order deadline time must use HH:MM format.');
		}

		if (
			typeof fulfillmentTimeWindowStart === 'number' &&
			typeof fulfillmentTimeWindowEnd === 'number' &&
			fulfillmentTimeWindowEnd <= fulfillmentTimeWindowStart
		) {
			errors.push('Fulfillment end time must be after the fulfillment start time.');
		}

		return errors;
	}

	function rowToMutationInput(row: FulfillmentOptionEditorRow) {
		const scheduleTemplate = buildScheduleTemplateSummaryInput(row);
		return {
			name: row.name.trim(),
			type: row.type,
			notes: row.notes.trim() || null,
			fulfillmentWeekday: scheduleTemplate.fulfillmentWeekday,
			fulfillmentTimeWindowStart: scheduleTemplate.fulfillmentTimeWindowStart,
			fulfillmentTimeWindowEnd: scheduleTemplate.fulfillmentTimeWindowEnd,
			orderDeadlineWeekday: scheduleTemplate.orderDeadlineWeekday,
			orderDeadlineTime: scheduleTemplate.orderDeadlineTime
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

	function buildSearchParamsHref(updates: Record<string, string | null>): string {
		const nextUrl = new URL(page.url);
		for (const [key, value] of Object.entries(updates)) {
			if (value == null) {
				nextUrl.searchParams.delete(key);
			} else {
				nextUrl.searchParams.set(key, value);
			}
		}
		return `${nextUrl.pathname}${nextUrl.search}`;
	}

	function updateSearchParams(updates: Record<string, string | null>) {
		goto(buildSearchParamsHref(updates), {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	function selectWorkspaceTab(tab: OffersWorkspaceTab) {
		selectedWorkspaceTab = tab;
		updateSearchParams({ tab: tab === 'offers' ? null : tab });
	}

	function getWorkspaceTabHref(tab: OffersWorkspaceTab): string {
		return buildSearchParamsHref({ tab: tab === 'offers' ? null : tab });
	}

	function handleWorkspaceHeaderTabSelect(value: string) {
		if (value !== 'offers' && value !== 'fulfillment-options') return;
		selectWorkspaceTab(value);
	}

	function handleWorkspaceCountFilterSelect(value: WorkspaceCountFilter) {
		if (selectedWorkspaceTab === 'offers') {
			selectedOffersCountFilter = value;
			return;
		}

		selectedFulfillmentCountFilter = value;
	}

	function matchesFulfillmentOptionFilters(
		row: {
			type: FulfillmentOptionType;
			activeOfferCount: number;
		},
		countFilter: WorkspaceCountFilter
	): boolean {
		const matchesType =
			(row.type === 'scheduled_pickup' && showingScheduledPickupOptions) ||
			(row.type === 'scheduled_delivery' && showingScheduledDeliveryOptions) ||
			(row.type === 'shipping' && showingShippingOptions);
		if (!matchesType) return false;

		if (countFilter === 'active') {
			return row.activeOfferCount > 0;
		}

		return true;
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

	function expandFulfillmentOptionRow(rowId: string) {
		expandedFulfillmentOptionRowIds.add(rowId);
	}

	function toggleFulfillmentOptionRowExpanded(rowId: string) {
		if (expandedFulfillmentOptionRowIds.has(rowId)) {
			expandedFulfillmentOptionRowIds.delete(rowId);
			return;
		}
		expandFulfillmentOptionRow(rowId);
	}

	function expandFulfillmentOptionDraftRow(rowId: string) {
		expandedFulfillmentOptionDraftRowIds.add(rowId);
	}

	function toggleFulfillmentOptionDraftExpanded(rowId: string) {
		if (expandedFulfillmentOptionDraftRowIds.has(rowId)) {
			expandedFulfillmentOptionDraftRowIds.delete(rowId);
			return;
		}
		expandFulfillmentOptionDraftRow(rowId);
	}

	function addFulfillmentOptionDraftRow() {
		const draftId = `__draft_${++fulfillmentOptionDraftIdCounter}`;
		fulfillmentOptionDraftRows = [
			...fulfillmentOptionDraftRows,
			createBlankFulfillmentOptionEditorRow(draftId)
		];
		expandFulfillmentOptionDraftRow(draftId);
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
			await invalidateAll();
			await loadWorkspaceData();
			expandFulfillmentOptionRow(rowId);
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
			await invalidateAll();
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
			await invalidateAll();
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
			await invalidateAll();
			await loadWorkspaceData();
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
			await invalidateAll();
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

	function expandDraftRowFromCollapsedSummary(rowId: string) {
		expandFulfillmentOptionDraftRow(rowId);
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
		<div class="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
			<HeaderTabs
				items={workspaceHeaderTabs}
				selectedValue={selectedWorkspaceTab}
				onselect={handleWorkspaceHeaderTabSelect}
				ariaLabel="Offers workspace sections"
				size="xl"
			/>
			<HeaderCountFilter
				activeCount={selectedWorkspaceTab === 'offers' ? activeOfferCount : activeFulfillmentOptionCount}
				totalCount={selectedWorkspaceTab === 'offers' ? offerCount : fulfillmentOptionCount}
				selectedValue={selectedWorkspaceCountFilter}
				onselect={handleWorkspaceCountFilterSelect}
				ariaLabel={selectedWorkspaceTab === 'offers'
					? 'Offers count filters'
					: 'Fulfillment option count filters'}
				class="shrink-0 md:justify-end"
			/>
		</div>

		{#if selectedWorkspaceTab === 'offers'}
			<div class="space-y-3">
				<div class="rounded-md border">
					{#if filteredOffers.length === 0}
						<div class="px-3 py-8 text-center text-sm text-muted-foreground">
							{#if (workspaceData?.offers.length ?? 0) === 0}
								No offers yet. The full seller offers table and editor are the next step.
							{:else}
								No offers match the current filter.
							{/if}
						</div>
					{:else}
						<div>
							{#each filteredOffers as offer (offer.id)}
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
				<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<Checkbox id="scheduled-pickup-filter" bind:checked={showingScheduledPickupOptions} />
						<label for="scheduled-pickup-filter">Scheduled Pickup</label>
					</div>
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<Checkbox id="scheduled-delivery-filter" bind:checked={showingScheduledDeliveryOptions} />
						<label for="scheduled-delivery-filter">Scheduled Delivery</label>
					</div>
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<Checkbox id="shipping-filter" bind:checked={showingShippingOptions} />
						<label for="shipping-filter">Shipping</label>
					</div>
					<span aria-hidden="true" class="text-border">|</span>
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<Checkbox id="show-deleted-filter" bind:checked={showingDeletedFulfillmentOptions} />
						<label for="show-deleted-filter">Show deleted</label>
					</div>
				</div>

				<div class="rounded-md border" data-testid="fulfillment-options-table">
					{#if fulfillmentOptionsFilterIsEmpty}
						<div class="px-3 py-8 text-center text-sm text-muted-foreground">
							{#if fulfillmentOptionRows.length === 0 && deletedFulfillmentOptions.length === 0 && fulfillmentOptionDraftRows.length === 0}
								No fulfillment options yet. Add your first scheduled pickup, scheduled delivery,
								or shipping option below.
							{:else}
								No fulfillment options match the current filters.
							{/if}
						</div>
					{/if}

					{#each filteredFulfillmentOptionRows as row (row.id)}
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
											<span>{getFulfillmentOptionTypeLabel(row.type)}</span>
											<span>{summarizeScheduleTemplate(buildScheduleTemplateSummaryInput(row))}</span>
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
									<div class="space-y-4 px-3 pb-3 md:px-4" onclickcapture={stopRowToggle} onkeydowncapture={stopRowToggle}>
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
													placeholder="Tuesday Local Delivery"
												/>
											</div>

											<div class="space-y-2 xl:col-span-2">
												<p class="text-xs font-medium text-muted-foreground">Type</p>
												<div class="flex flex-wrap gap-1">
													{#each fulfillmentOptionTypeOptions as option (option.value)}
														<Button
															size="sm"
															variant={row.type === option.value ? 'secondary' : 'outline'}
															onclick={() => updateFulfillmentOptionRow(row.id, buildTypePatch(option.value))}
														>
															{option.label}
														</Button>
													{/each}
												</div>
											</div>
										</div>

										{#if isScheduledFulfillmentOptionType(row.type)}
											<div class="space-y-3 rounded-md border bg-muted/10 p-3">
												<div class="space-y-1">
													<p class="text-sm font-medium">Schedule template</p>
													<p class="text-xs text-muted-foreground">
														Times use {resolvedBusinessTimezoneLabel}. Change this in Account → Business.
													</p>
												</div>
												<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
													<div class="space-y-2">
														<label
															for={`fulfillment-weekday-${row.id}`}
															class="text-xs font-medium text-muted-foreground">Fulfillment weekday</label
														>
														<select
															id={`fulfillment-weekday-${row.id}`}
															class={selectInputClasses}
															value={row.fulfillmentWeekday}
															onchange={(event) =>
																updateFulfillmentOptionRow(row.id, {
																	fulfillmentWeekday: (event.currentTarget as HTMLSelectElement)
																		.value as EditorWeekday
																})}
															onclick={stopRowToggle}
														>
															<option value="">Select weekday</option>
															{#each weekdayOptions as option (option.value)}
																<option value={option.value}>{option.label}</option>
															{/each}
														</select>
													</div>

													<div class="space-y-2">
														<label
															for={`fulfillment-time-start-${row.id}`}
															class="text-xs font-medium text-muted-foreground">Window start</label
														>
														<Input
															id={`fulfillment-time-start-${row.id}`}
															type="time"
															value={row.fulfillmentTimeWindowStart}
															oninput={(event) =>
																updateFulfillmentOptionRow(row.id, {
																	fulfillmentTimeWindowStart: (event.currentTarget as HTMLInputElement)
																		.value
																})}
															onclick={stopRowToggle}
														/>
													</div>

													<div class="space-y-2">
														<label
															for={`fulfillment-time-end-${row.id}`}
															class="text-xs font-medium text-muted-foreground">Window end</label
														>
														<Input
															id={`fulfillment-time-end-${row.id}`}
															type="time"
															value={row.fulfillmentTimeWindowEnd}
															oninput={(event) =>
																updateFulfillmentOptionRow(row.id, {
																	fulfillmentTimeWindowEnd: (event.currentTarget as HTMLInputElement).value
																})}
															onclick={stopRowToggle}
														/>
													</div>
												</div>

												<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
													<div class="space-y-2">
														<label
															for={`deadline-weekday-${row.id}`}
															class="text-xs font-medium text-muted-foreground">Order deadline weekday</label
														>
														<select
															id={`deadline-weekday-${row.id}`}
															class={selectInputClasses}
															value={row.orderDeadlineWeekday}
															onchange={(event) =>
																updateFulfillmentOptionRow(row.id, {
																	orderDeadlineWeekday: (event.currentTarget as HTMLSelectElement)
																		.value as EditorWeekday
																})}
															onclick={stopRowToggle}
														>
															<option value="">Select weekday</option>
															{#each weekdayOptions as option (option.value)}
																<option value={option.value}>{option.label}</option>
															{/each}
														</select>
													</div>

													<div class="space-y-2">
														<label
															for={`deadline-time-${row.id}`}
															class="text-xs font-medium text-muted-foreground">Order deadline time</label
														>
														<Input
															id={`deadline-time-${row.id}`}
															type="time"
															value={row.orderDeadlineTime}
															oninput={(event) =>
																updateFulfillmentOptionRow(row.id, {
																	orderDeadlineTime: (event.currentTarget as HTMLInputElement).value
																})}
															onclick={stopRowToggle}
														/>
													</div>
												</div>
											</div>
										{:else}
											<div class="rounded-md border bg-muted/10 px-3 py-3 text-sm text-muted-foreground">
												Shipping stays simple for now. Use notes for carrier, ETA, handling, or routing
												guidance. Offer-specific shipping deadlines come later.
											</div>
										{/if}

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
													placeholder="Pickup instructions, delivery route notes, or shipping context"
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
											onfocus={() => expandDraftRowFromCollapsedSummary(row.id)}
											placeholder="Tuesday Local Delivery"
										/>
										<div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
											<span>{getFulfillmentOptionTypeLabel(row.type)}</span>
											<span>{summarizeScheduleTemplate(buildScheduleTemplateSummaryInput(row))}</span>
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
									<div class="space-y-4 px-3 pb-3 md:px-4" onclickcapture={stopRowToggle} onkeydowncapture={stopRowToggle}>
										<div class="space-y-2">
											<p class="text-xs font-medium text-muted-foreground">Type</p>
											<div class="flex flex-wrap gap-1">
												{#each fulfillmentOptionTypeOptions as option (option.value)}
													<Button
														size="sm"
														variant={row.type === option.value ? 'secondary' : 'outline'}
														onclick={() =>
															updateFulfillmentOptionDraftRow(row.id, buildTypePatch(option.value))}
													>
														{option.label}
													</Button>
												{/each}
											</div>
										</div>

										{#if isScheduledFulfillmentOptionType(row.type)}
											<div class="space-y-3 rounded-md border bg-muted/10 p-3">
												<div class="space-y-1">
													<p class="text-sm font-medium">Schedule template</p>
													<p class="text-xs text-muted-foreground">
														Times use {resolvedBusinessTimezoneLabel}. Change this in Account → Business.
													</p>
												</div>
												<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
													<div class="space-y-2">
														<label
															for={`draft-fulfillment-weekday-${row.id}`}
															class="text-xs font-medium text-muted-foreground">Fulfillment weekday</label
														>
														<select
															id={`draft-fulfillment-weekday-${row.id}`}
															class={selectInputClasses}
															value={row.fulfillmentWeekday}
															onchange={(event) =>
																updateFulfillmentOptionDraftRow(row.id, {
																	fulfillmentWeekday: (event.currentTarget as HTMLSelectElement)
																		.value as EditorWeekday
																})}
															onclick={stopRowToggle}
														>
															<option value="">Select weekday</option>
															{#each weekdayOptions as option (option.value)}
																<option value={option.value}>{option.label}</option>
															{/each}
														</select>
													</div>

													<div class="space-y-2">
														<label
															for={`draft-fulfillment-time-start-${row.id}`}
															class="text-xs font-medium text-muted-foreground">Window start</label
														>
														<Input
															id={`draft-fulfillment-time-start-${row.id}`}
															type="time"
															value={row.fulfillmentTimeWindowStart}
															oninput={(event) =>
																updateFulfillmentOptionDraftRow(row.id, {
																	fulfillmentTimeWindowStart: (event.currentTarget as HTMLInputElement)
																		.value
																})}
															onclick={stopRowToggle}
														/>
													</div>

													<div class="space-y-2">
														<label
															for={`draft-fulfillment-time-end-${row.id}`}
															class="text-xs font-medium text-muted-foreground">Window end</label
														>
														<Input
															id={`draft-fulfillment-time-end-${row.id}`}
															type="time"
															value={row.fulfillmentTimeWindowEnd}
															oninput={(event) =>
																updateFulfillmentOptionDraftRow(row.id, {
																	fulfillmentTimeWindowEnd: (event.currentTarget as HTMLInputElement).value
																})}
															onclick={stopRowToggle}
														/>
													</div>
												</div>

												<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
													<div class="space-y-2">
														<label
															for={`draft-deadline-weekday-${row.id}`}
															class="text-xs font-medium text-muted-foreground">Order deadline weekday</label
														>
														<select
															id={`draft-deadline-weekday-${row.id}`}
															class={selectInputClasses}
															value={row.orderDeadlineWeekday}
															onchange={(event) =>
																updateFulfillmentOptionDraftRow(row.id, {
																	orderDeadlineWeekday: (event.currentTarget as HTMLSelectElement)
																		.value as EditorWeekday
																})}
															onclick={stopRowToggle}
														>
															<option value="">Select weekday</option>
															{#each weekdayOptions as option (option.value)}
																<option value={option.value}>{option.label}</option>
															{/each}
														</select>
													</div>

													<div class="space-y-2">
														<label
															for={`draft-deadline-time-${row.id}`}
															class="text-xs font-medium text-muted-foreground">Order deadline time</label
														>
														<Input
															id={`draft-deadline-time-${row.id}`}
															type="time"
															value={row.orderDeadlineTime}
															oninput={(event) =>
																updateFulfillmentOptionDraftRow(row.id, {
																	orderDeadlineTime: (event.currentTarget as HTMLInputElement).value
																})}
															onclick={stopRowToggle}
														/>
													</div>
												</div>
											</div>
										{:else}
											<div class="rounded-md border bg-muted/10 px-3 py-3 text-sm text-muted-foreground">
												Shipping stays simple for now. Use notes for carrier, ETA, handling, or routing
												guidance. Offer-specific shipping deadlines come later.
											</div>
										{/if}

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
												placeholder="Pickup instructions, delivery route notes, or shipping context"
											/>
										</div>
									</div>
								{/if}
							</div>
						{/each}

						{#if showingDeletedFulfillmentOptions && filteredDeletedFulfillmentOptions.length > 0}
							<div class="border-t bg-muted/10 px-3 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
								Deleted
							</div>
							{#each filteredDeletedFulfillmentOptions as fulfillmentOption (fulfillmentOption.id)}
								<div class="border-b last:border-b-0">
									<div class="flex items-start gap-3 px-3 py-3 md:px-4">
										<div class="min-w-0 flex-1 space-y-1">
											<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
												<p class="truncate text-[17px] leading-tight font-medium">
													{fulfillmentOption.name}
												</p>
											</div>
											<div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
												<span>{getFulfillmentOptionTypeLabel(fulfillmentOption.type)}</span>
												<span
													>{summarizeScheduleTemplate({
														type: fulfillmentOption.type,
														fulfillmentWeekday: fulfillmentOption.fulfillmentWeekday,
														fulfillmentTimeWindowStart:
															fulfillmentOption.fulfillmentTimeWindowStart,
														fulfillmentTimeWindowEnd: fulfillmentOption.fulfillmentTimeWindowEnd,
														orderDeadlineWeekday: fulfillmentOption.orderDeadlineWeekday,
														orderDeadlineTime: fulfillmentOption.orderDeadlineTime
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
														onclick={() => permanentlyDeleteDeletedFulfillmentOptionRow(fulfillmentOption)}
														disabled={pendingRowIds.has(fulfillmentOption.id) ||
															!fulfillmentOption.canPermanentlyDelete}
													>
														Permanently Delete
													</Button>
													<Button
														size="sm"
														variant="ghost"
														onclick={() => confirmingDeletedPermanentRowIds.delete(fulfillmentOption.id)}
													>
														Cancel
													</Button>
												{:else}
													<Button
														size="sm"
														variant="ghost"
														onclick={() => confirmingDeletedPermanentRowIds.add(fulfillmentOption.id)}
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

					<Button
						variant="outline"
						class="w-full"
						onclick={addFulfillmentOptionDraftRow}
						data-testid="add-fulfillment-option-button"
					>
						+ Add Fulfillment Option
					</Button>
			</div>
		{/if}
	</div>
{/if}
