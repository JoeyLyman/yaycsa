import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { graphql } from '../../../graphql';

const VERIFY_MUTATION = graphql(`
	mutation VerifyCustomerAccount($token: String!) {
		verifyCustomerAccount(token: $token) {
			... on CurrentUser {
				id
				identifier
			}
			... on VerificationTokenInvalidError {
				errorCode
				message
			}
			... on VerificationTokenExpiredError {
				errorCode
				message
			}
			... on MissingPasswordError {
				errorCode
				message
			}
			... on PasswordAlreadySetError {
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
		return { error: 'No verification token provided' };
	}

	const data = await locals.vendure.mutate(VERIFY_MUTATION, { token });
	const result = data.verifyCustomerAccount;

	if ('errorCode' in result) {
		return { error: result.message };
	}

	// Verification succeeded and user is now logged in
	redirect(303, '/');
};
