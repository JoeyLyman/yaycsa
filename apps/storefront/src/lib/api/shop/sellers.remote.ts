import * as v from 'valibot';
import { invalid } from '@sveltejs/kit';
import { query, form, getRequestEvent } from '$app/server';
import { graphql } from '../../../graphql.js';

const SELLERS_QUERY = graphql(`
	query Sellers($activeOffersOnly: Boolean) {
		sellers(activeOffersOnly: $activeOffersOnly) {
			id
			name
			slug
		}
	}
`);

const SELLER_BY_SLUG_QUERY = graphql(`
	query SellerBySlug($slug: String!) {
		sellerBySlug(slug: $slug) {
			id
			name
			slug
		}
	}
`);

export const sellers = query(
	v.optional(v.object({ activeOffersOnly: v.optional(v.boolean()) })),
	async (args) => {
		const event = getRequestEvent();
		const data = await event.locals.vendure.query(SELLERS_QUERY, {
			activeOffersOnly: args?.activeOffersOnly ?? true,
		});
		return data.sellers;
	}
);

export const sellerBySlug = query(v.string(), async (slug) => {
	const event = getRequestEvent();
	const data = await event.locals.vendure.query(SELLER_BY_SLUG_QUERY, { slug });
	return data.sellerBySlug ?? null;
});

const BECOME_SELLER_MUTATION = graphql(`
	mutation BecomeSeller($input: BecomeSellerInput!) {
		becomeSeller(input: $input) {
			... on BecomeSellerSuccess {
				seller {
					id
					name
					slug
				}
			}
			... on SlugAlreadyTakenError {
				errorCode
				message
			}
			... on AlreadyASellerError {
				errorCode
				message
			}
			... on InvalidSlugError {
				errorCode
				message
			}
			... on SellerRegistrationClosedError {
				errorCode
				message
			}
		}
	}
`);

const PROFANITY_BLOCKLIST = new Set([
	'fuck', 'shit', 'ass', 'asshole', 'bitch', 'bastard', 'damn', 'dick',
	'cock', 'cunt', 'piss', 'slut', 'whore', 'fag', 'faggot', 'nigger',
	'nigga', 'retard', 'twat', 'wanker', 'bollocks',
]);

function containsProfanity(text: string): boolean {
	const words = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
	return words.some((w) => PROFANITY_BLOCKLIST.has(w));
}

export const becomeSeller = form(
	v.object({
		shopName: v.pipe(
			v.string(),
			v.nonEmpty('Business name is required'),
			v.minLength(3, 'Name must be at least 3 characters'),
			v.maxLength(100),
			v.regex(/^[a-zA-Z0-9 ]+$/, 'Only letters, numbers, and spaces'),
		),
		slug: v.pipe(
			v.string(),
			v.nonEmpty('Slug is required'),
			v.regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Only lowercase letters, numbers, and hyphens (no leading/trailing hyphens)'),
			v.check((s) => !s.includes('--'), 'Cannot have consecutive hyphens'),
			v.minLength(3, 'Must be at least 3 characters'),
			v.maxLength(60, 'Must be 60 characters or less'),
		),
	}),
	async ({ shopName, slug }, issue) => {
		if (containsProfanity(shopName)) {
			return invalid(issue.shopName('Please choose an appropriate business name'));
		}
		if (containsProfanity(slug)) {
			return invalid(issue.slug('Please choose an appropriate URL'));
		}

		const event = getRequestEvent();
		const data = await event.locals.vendure.mutate(BECOME_SELLER_MUTATION, {
			input: { shopName, slug },
		});
		const result = data.becomeSeller;

		if ('errorCode' in result) {
			switch (result.__typename) {
				case 'SlugAlreadyTakenError':
				case 'InvalidSlugError':
					return invalid(issue.slug(result.message));
				case 'AlreadyASellerError':
					return { alreadySeller: true };
				case 'SellerRegistrationClosedError':
					return invalid(issue.shopName(result.message));
			}
		}

		return { success: true, slug: (result as { seller: { slug: string } }).seller.slug };
	},
);
