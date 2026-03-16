/**
 * Seed script for product taxonomy facets (bits, process, allergen-warning).
 *
 * Run AFTER the Vendure server is running:
 *   cd apps/server && npx tsx src/seed-taxonomy.ts
 *
 * Idempotent — checks for existing facets by code before creating.
 * Uses the Admin API via HTTP (same pattern as storefront's vendure-admin.ts).
 */

import 'dotenv/config';

const ADMIN_API_URL = `http://localhost:${process.env.PORT || 3000}/admin-api`;
const ADMIN_USERNAME = process.env.SUPERADMIN_USERNAME ?? 'superadmin';
const ADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD ?? 'superadmin';

// ─── Admin API helpers ───

let authToken: string | null = null;

async function authenticate(): Promise<string> {
	const res = await fetch(ADMIN_API_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			query: `mutation Login($username: String!, $password: String!) {
				login(username: $username, password: $password) {
					... on CurrentUser { id }
					... on InvalidCredentialsError { errorCode message }
				}
			}`,
			variables: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
		}),
	});
	const token = res.headers.get('vendure-auth-token');
	if (!token) throw new Error('Admin API auth failed: no token');
	return token;
}

async function adminGql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
	if (!authToken) authToken = await authenticate();

	const res = await fetch(ADMIN_API_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${authToken}`,
		},
		body: JSON.stringify({ query, variables }),
	});

	const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
	if (json.errors?.length) {
		throw new Error(`Admin API: ${json.errors.map((e) => e.message).join(', ')}`);
	}
	if (!json.data) throw new Error('No data from Admin API');
	return json.data;
}

// ─── Facet creation helpers ───

interface FacetResult {
	id: string;
	code: string;
	name: string;
}

interface FacetValueResult {
	id: string;
	code: string;
	name: string;
}

async function getExistingFacet(code: string): Promise<FacetResult | null> {
	const data = await adminGql<{ facets: { items: FacetResult[] } }>(
		`query ($options: FacetListOptions) {
			facets(options: $options) { items { id code name } }
		}`,
		{ options: { filter: { code: { eq: code } } } },
	);
	return data.facets.items[0] ?? null;
}

async function createFacet(code: string, name: string): Promise<FacetResult> {
	const data = await adminGql<{ createFacet: FacetResult }>(
		`mutation ($input: CreateFacetInput!) {
			createFacet(input: $input) { id code name }
		}`,
		{
			input: {
				code,
				isPrivate: false,
				translations: [{ languageCode: 'en', name }],
			},
		},
	);
	return data.createFacet;
}

async function createFacetValue(
	facetId: string,
	code: string,
	name: string,
	group?: string,
): Promise<FacetValueResult> {
	const data = await adminGql<{ createFacetValues: FacetValueResult[] }>(
		`mutation ($input: [CreateFacetValueInput!]!) {
			createFacetValues(input: $input) { id code name }
		}`,
		{
			input: [
				{
					facetId,
					code,
					translations: [{ languageCode: 'en', name }],
					customFields: group ? { group } : {},
				},
			],
		},
	);
	return data.createFacetValues[0];
}

async function getExistingFacetValues(facetId: string): Promise<Set<string>> {
	const data = await adminGql<{ facet: { values: Array<{ code: string }> } }>(
		`query ($id: ID!) {
			facet(id: $id) { values { code } }
		}`,
		{ id: facetId },
	);
	return new Set(data.facet.values.map((v) => v.code));
}

// ─── Taxonomy data ───

/** Convert a display name to a facet value code. */
function toCode(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

interface BitDef {
	name: string;
	group: string;
}

const BITS: BitDef[] = [
	// Vegetables
	{ name: 'Carrots', group: 'Vegetables' },
	{ name: 'Kale', group: 'Vegetables' },
	{ name: 'Cabbage', group: 'Vegetables' },
	{ name: 'Tomatoes', group: 'Vegetables' },
	{ name: 'Potatoes', group: 'Vegetables' },
	{ name: 'Onions', group: 'Vegetables' },
	{ name: 'Garlic', group: 'Vegetables' },
	{ name: 'Squash', group: 'Vegetables' },
	{ name: 'Peppers', group: 'Vegetables' },
	{ name: 'Lettuce', group: 'Vegetables' },
	{ name: 'Spinach', group: 'Vegetables' },
	{ name: 'Broccoli', group: 'Vegetables' },
	{ name: 'Cauliflower', group: 'Vegetables' },
	{ name: 'Celery', group: 'Vegetables' },
	{ name: 'Beets', group: 'Vegetables' },
	{ name: 'Radishes', group: 'Vegetables' },
	{ name: 'Turnips', group: 'Vegetables' },
	{ name: 'Sweet Potatoes', group: 'Vegetables' },
	{ name: 'Zucchini', group: 'Vegetables' },
	{ name: 'Cucumbers', group: 'Vegetables' },
	{ name: 'Green Beans', group: 'Vegetables' },
	{ name: 'Peas', group: 'Vegetables' },
	{ name: 'Corn', group: 'Vegetables' },
	{ name: 'Asparagus', group: 'Vegetables' },
	{ name: 'Leeks', group: 'Vegetables' },
	{ name: 'Fennel', group: 'Vegetables' },
	{ name: 'Chard', group: 'Vegetables' },
	{ name: 'Arugula', group: 'Vegetables' },

	// Fruit
	{ name: 'Apples', group: 'Fruit' },
	{ name: 'Strawberries', group: 'Fruit' },
	{ name: 'Blueberries', group: 'Fruit' },
	{ name: 'Raspberries', group: 'Fruit' },
	{ name: 'Blackberries', group: 'Fruit' },
	{ name: 'Peaches', group: 'Fruit' },
	{ name: 'Pears', group: 'Fruit' },
	{ name: 'Cherries', group: 'Fruit' },
	{ name: 'Melons', group: 'Fruit' },
	{ name: 'Watermelon', group: 'Fruit' },
	{ name: 'Grapes', group: 'Fruit' },
	{ name: 'Plums', group: 'Fruit' },
	{ name: 'Lemons', group: 'Fruit' },
	{ name: 'Limes', group: 'Fruit' },
	{ name: 'Oranges', group: 'Fruit' },
	{ name: 'Rhubarb', group: 'Fruit' },

	// Herbs & Spices
	{ name: 'Basil', group: 'Herbs & Spices' },
	{ name: 'Cilantro', group: 'Herbs & Spices' },
	{ name: 'Dill', group: 'Herbs & Spices' },
	{ name: 'Parsley', group: 'Herbs & Spices' },
	{ name: 'Mint', group: 'Herbs & Spices' },
	{ name: 'Rosemary', group: 'Herbs & Spices' },
	{ name: 'Thyme', group: 'Herbs & Spices' },
	{ name: 'Oregano', group: 'Herbs & Spices' },
	{ name: 'Sage', group: 'Herbs & Spices' },
	{ name: 'Chives', group: 'Herbs & Spices' },
	{ name: 'Salt', group: 'Herbs & Spices' },
	{ name: 'Black Pepper', group: 'Herbs & Spices' },
	{ name: 'Cumin', group: 'Herbs & Spices' },
	{ name: 'Paprika', group: 'Herbs & Spices' },
	{ name: 'Cinnamon', group: 'Herbs & Spices' },
	{ name: 'Ginger', group: 'Herbs & Spices' },

	// Meat
	{ name: 'Beef', group: 'Meat' },
	{ name: 'Pork', group: 'Meat' },
	{ name: 'Chicken', group: 'Meat' },
	{ name: 'Lamb', group: 'Meat' },
	{ name: 'Turkey', group: 'Meat' },
	{ name: 'Bacon', group: 'Meat' },
	{ name: 'Sausage', group: 'Meat' },

	// Dairy
	{ name: 'Milk', group: 'Dairy' },
	{ name: 'Cream', group: 'Dairy' },
	{ name: 'Butter', group: 'Dairy' },
	{ name: 'Cheese', group: 'Dairy' },
	{ name: 'Yogurt', group: 'Dairy' },
	{ name: 'Parmesan', group: 'Dairy' },
	{ name: 'Sour Cream', group: 'Dairy' },

	// Eggs
	{ name: 'Eggs', group: 'Eggs' },

	// Grains & Legumes
	{ name: 'Flour', group: 'Grains & Legumes' },
	{ name: 'Wheat', group: 'Grains & Legumes' },
	{ name: 'Oats', group: 'Grains & Legumes' },
	{ name: 'Rice', group: 'Grains & Legumes' },
	{ name: 'Beans', group: 'Grains & Legumes' },
	{ name: 'Lentils', group: 'Grains & Legumes' },
	{ name: 'Cornmeal', group: 'Grains & Legumes' },

	// Seafood
	{ name: 'Salmon', group: 'Seafood' },
	{ name: 'Shrimp', group: 'Seafood' },
	{ name: 'Oysters', group: 'Seafood' },
	{ name: 'Cod', group: 'Seafood' },
	{ name: 'Trout', group: 'Seafood' },
	{ name: 'Crab', group: 'Seafood' },

	// Mushrooms
	{ name: 'Shiitake', group: 'Mushrooms' },
	{ name: 'Oyster Mushroom', group: 'Mushrooms' },
	{ name: 'Chanterelle', group: 'Mushrooms' },
	{ name: 'Morel', group: 'Mushrooms' },
	{ name: 'Cremini', group: 'Mushrooms' },
	{ name: 'Portobello', group: 'Mushrooms' },

	// Nuts & Seeds
	{ name: 'Almonds', group: 'Nuts & Seeds' },
	{ name: 'Walnuts', group: 'Nuts & Seeds' },
	{ name: 'Pine Nuts', group: 'Nuts & Seeds' },
	{ name: 'Sunflower Seeds', group: 'Nuts & Seeds' },
	{ name: 'Peanuts', group: 'Nuts & Seeds' },
	{ name: 'Pecans', group: 'Nuts & Seeds' },

	// Sweeteners
	{ name: 'Honey', group: 'Sweeteners' },
	{ name: 'Maple Syrup', group: 'Sweeteners' },
	{ name: 'Cane Sugar', group: 'Sweeteners' },

	// Oils & Fats
	{ name: 'Olive Oil', group: 'Oils & Fats' },
	{ name: 'Coconut Oil', group: 'Oils & Fats' },
	{ name: 'Sesame Oil', group: 'Oils & Fats' },
	{ name: 'Lard', group: 'Oils & Fats' },
	{ name: 'Vinegar', group: 'Oils & Fats' },

	// Plants & Starts
	{ name: 'Tomato Starts', group: 'Plants & Starts' },
	{ name: 'Pepper Starts', group: 'Plants & Starts' },
	{ name: 'Herb Starts', group: 'Plants & Starts' },
	{ name: 'Flower Starts', group: 'Plants & Starts' },
	{ name: 'Seedlings', group: 'Plants & Starts' },
];

const PROCESSES = [
	{ name: 'Raw / Fresh', code: 'raw' },
	{ name: 'Washed', code: 'washed' },
	{ name: 'Bunched', code: 'bunched' },
	{ name: 'Dried', code: 'dried' },
	{ name: 'Frozen', code: 'frozen' },
	{ name: 'Fermented', code: 'fermented' },
	{ name: 'Baked', code: 'baked' },
	{ name: 'Smoked', code: 'smoked' },
	{ name: 'Pickled / Preserved', code: 'pickled-preserved' },
	{ name: 'Cooked / Prepared', code: 'cooked-prepared' },
	{ name: 'Roasted', code: 'roasted' },
	{ name: 'Cured', code: 'cured' },
	{ name: 'Blended / Pureed', code: 'blended-pureed' },
	{ name: 'Cold-pressed', code: 'cold-pressed' },
	{ name: 'Pasteurized', code: 'pasteurized' },
	{ name: 'Packaged / Sealed', code: 'packaged-sealed' },
];

const ALLERGEN_WARNINGS = [
	{ name: 'May contain peanuts', code: 'may-contain-peanuts' },
	{ name: 'May contain tree nuts', code: 'may-contain-tree-nuts' },
	{ name: 'May contain milk', code: 'may-contain-milk' },
	{ name: 'May contain eggs', code: 'may-contain-eggs' },
	{ name: 'May contain wheat/gluten', code: 'may-contain-wheat-gluten' },
	{ name: 'May contain soy', code: 'may-contain-soy' },
	{ name: 'May contain fish', code: 'may-contain-fish' },
	{ name: 'May contain shellfish', code: 'may-contain-shellfish' },
	{ name: 'May contain sesame', code: 'may-contain-sesame' },
];

// ─── Main ───

async function seedFacet(
	facetCode: string,
	facetName: string,
	values: Array<{ name: string; code?: string; group?: string }>,
): Promise<void> {
	// Get or create the facet
	let facet = await getExistingFacet(facetCode);
	if (facet) {
		console.log(`  ✓ Facet "${facetCode}" already exists (id: ${facet.id})`);
	} else {
		facet = await createFacet(facetCode, facetName);
		console.log(`  + Created facet "${facetCode}" (id: ${facet.id})`);
	}

	// Get existing values to skip duplicates
	const existingCodes = await getExistingFacetValues(facet.id);

	let created = 0;
	let skipped = 0;
	for (const val of values) {
		const code = val.code ?? toCode(val.name);
		if (existingCodes.has(code)) {
			skipped++;
			continue;
		}
		await createFacetValue(facet.id, code, val.name, val.group);
		created++;
	}

	console.log(`    ${created} values created, ${skipped} already existed`);
}

async function main() {
	console.log('Seeding product taxonomy facets...\n');

	console.log('Bits (ingredients/components):');
	await seedFacet(
		'bits',
		'Bits',
		BITS.map((b) => ({ name: b.name, code: toCode(b.name), group: b.group })),
	);

	console.log('\nProcessing types:');
	await seedFacet('process', 'Process', PROCESSES);

	console.log('\nAllergen warnings:');
	await seedFacet('allergen-warning', 'Allergen Warning', ALLERGEN_WARNINGS);

	console.log('\nDone! All taxonomy facets seeded.');
}

main().catch((err) => {
	console.error('Seed failed:', err);
	process.exit(1);
});
