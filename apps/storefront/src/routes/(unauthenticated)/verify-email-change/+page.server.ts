import type { PageServerLoad } from './$types';
import { graphql } from '../../../graphql';

const UPDATE_EMAIL_MUTATION = graphql(`
	mutation UpdateCustomerEmailAddress($token: String!) {
		updateCustomerEmailAddress(token: $token) {
			... on Success {
				success
			}
			... on IdentifierChangeTokenInvalidError {
				errorCode
				message
			}
			... on IdentifierChangeTokenExpiredError {
				errorCode
				message
			}
			... on NativeAuthStrategyError {
				errorCode
				message
			}
		}
	}
`);

export const load: PageServerLoad = async ({ url, locals }) => {
	const token = url.searchParams.get('token');

	if (!token) {
		return { error: 'No verification token provided', success: false };
	}

	const data = await locals.vendure.mutate(UPDATE_EMAIL_MUTATION, { token });
	const result = data.updateCustomerEmailAddress;

	if ('errorCode' in result) {
		return { error: result.message, success: false };
	}

	return { error: null, success: true };
};
