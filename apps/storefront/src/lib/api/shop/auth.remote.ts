import * as v from 'valibot';
import { invalid } from '@sveltejs/kit';
import { query, form, command, getRequestEvent } from '$app/server';
import { graphql, readFragment } from '../../../graphql.js';
import { ActiveCustomerFields } from './fragments.js';
import { removeAuthToken } from '../auth.js';

const LOGIN_MUTATION = graphql(`
	mutation Login($username: String!, $password: String!, $rememberMe: Boolean) {
		login(username: $username, password: $password, rememberMe: $rememberMe) {
			... on CurrentUser {
				id
				identifier
			}
			... on InvalidCredentialsError {
				errorCode
				message
			}
			... on NotVerifiedError {
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

const REGISTER_MUTATION = graphql(`
	mutation Register($input: RegisterCustomerInput!) {
		registerCustomerAccount(input: $input) {
			... on Success {
				success
			}
			... on MissingPasswordError {
				errorCode
				message
			}
			... on PasswordValidationError {
				errorCode
				message
				validationErrorMessage
			}
			... on NativeAuthStrategyError {
				errorCode
				message
			}
		}
	}
`);

const ACTIVE_CUSTOMER_QUERY = graphql(
	`
		query ActiveCustomer {
			activeCustomer {
				...ActiveCustomerFields
			}
		}
	`,
	[ActiveCustomerFields]
);

const LOGOUT_MUTATION = graphql(`
	mutation Logout {
		logout {
			success
		}
	}
`);

export const login = form(
	v.object({
		email: v.pipe(v.string(), v.nonEmpty('Email is required'), v.email('Invalid email')),
		_password: v.pipe(v.string(), v.nonEmpty('Password is required'))
	}),
	async ({ email, _password }, issue) => {
		const event = getRequestEvent();
		const data = await event.locals.vendure.mutate(LOGIN_MUTATION, {
			username: email,
			password: _password,
			rememberMe: true
		});

		const result = data.login;

		if ('errorCode' in result) {
			const msg =
				result.errorCode === 'INVALID_CREDENTIALS_ERROR'
					? 'Invalid email or password'
					: result.message;
			invalid(issue.email(msg));
		}

		return { success: true };
	}
);

export const register = form(
	v.object({
		firstName: v.pipe(v.string(), v.nonEmpty('First name is required')),
		lastName: v.pipe(v.string(), v.nonEmpty('Last name is required')),
		email: v.pipe(v.string(), v.nonEmpty('Email is required'), v.email('Invalid email')),
		_password: v.pipe(
			v.string(),
			v.nonEmpty('Password is required'),
			v.minLength(8, 'Password must be at least 8 characters')
		)
	}),
	async ({ firstName, lastName, email, _password }, issue) => {
		const event = getRequestEvent();
		const data = await event.locals.vendure.mutate(REGISTER_MUTATION, {
			input: {
				firstName,
				lastName,
				emailAddress: email,
				password: _password
			}
		});

		const result = data.registerCustomerAccount;

		if ('errorCode' in result) {
			invalid(issue.email(result.message));
		}

		return { success: true };
	}
);

export const activeCustomer = query(async () => {
	const event = getRequestEvent();
	const data = await event.locals.vendure.query(ACTIVE_CUSTOMER_QUERY);
	return data.activeCustomer ? readFragment(ActiveCustomerFields, data.activeCustomer) : null;
});

export const logout = command(async () => {
	const event = getRequestEvent();
	await event.locals.vendure.mutate(LOGOUT_MUTATION);
	removeAuthToken(event.cookies);
});
