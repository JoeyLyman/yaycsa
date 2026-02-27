import * as v from 'valibot';
import { invalid, redirect } from '@sveltejs/kit';
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

const REQUEST_PASSWORD_RESET_MUTATION = graphql(`
	mutation RequestPasswordReset($emailAddress: String!) {
		requestPasswordReset(emailAddress: $emailAddress) {
			... on Success {
				success
			}
			... on NativeAuthStrategyError {
				errorCode
				message
			}
		}
	}
`);

const RESET_PASSWORD_MUTATION = graphql(`
	mutation ResetPassword($token: String!, $password: String!) {
		resetPassword(token: $token, password: $password) {
			... on CurrentUser {
				id
				identifier
			}
			... on PasswordResetTokenInvalidError {
				errorCode
				message
			}
			... on PasswordResetTokenExpiredError {
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
			... on NotVerifiedError {
				errorCode
				message
			}
		}
	}
`);

const REQUEST_UPDATE_EMAIL_MUTATION = graphql(`
	mutation RequestUpdateEmail($password: String!, $newEmailAddress: String!) {
		requestUpdateCustomerEmailAddress(password: $password, newEmailAddress: $newEmailAddress) {
			... on Success {
				success
			}
			... on InvalidCredentialsError {
				errorCode
				message
			}
			... on EmailAddressConflictError {
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

const UPDATE_PASSWORD_MUTATION = graphql(`
	mutation UpdatePassword($currentPassword: String!, $newPassword: String!) {
		updateCustomerPassword(currentPassword: $currentPassword, newPassword: $newPassword) {
			... on Success {
				success
			}
			... on InvalidCredentialsError {
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

const REFRESH_VERIFICATION_MUTATION = graphql(`
	mutation RefreshVerification($emailAddress: String!) {
		refreshCustomerVerification(emailAddress: $emailAddress) {
			... on Success {
				success
			}
			... on NativeAuthStrategyError {
				errorCode
				message
			}
		}
	}
`);

function safeReturnTo(url: URL): string {
	const returnTo = url.searchParams.get('returnTo');
	if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') && !returnTo.includes('\\')) {
		return returnTo;
	}
	return '/';
}

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
			if (result.errorCode === 'NOT_VERIFIED_ERROR') {
				invalid(issue.email('Please verify your email address first'));
			}
			const msg =
				result.errorCode === 'INVALID_CREDENTIALS_ERROR'
					? 'Invalid email or password'
					: result.message;
			invalid(issue.email(msg));
		}

		return { success: true as const, returnTo: safeReturnTo(event.url) };
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

export const requestPasswordReset = form(
	v.object({
		email: v.pipe(v.string(), v.nonEmpty('Email is required'), v.email('Invalid email'))
	}),
	async ({ email }) => {
		const event = getRequestEvent();
		// Always return success regardless of whether the email exists (no enumeration)
		await event.locals.vendure.mutate(REQUEST_PASSWORD_RESET_MUTATION, {
			emailAddress: email
		});
		return { success: true };
	}
);

export const resetPassword = form(
	v.object({
		token: v.pipe(v.string(), v.nonEmpty('Reset token is required')),
		_password: v.pipe(
			v.string(),
			v.nonEmpty('Password is required'),
			v.minLength(8, 'Password must be at least 8 characters')
		),
		_confirmPassword: v.pipe(v.string(), v.nonEmpty('Please confirm your password'))
	}),
	async ({ token, _password, _confirmPassword }, issue) => {
		if (_password !== _confirmPassword) {
			invalid(issue._confirmPassword('Passwords do not match'));
		}

		const event = getRequestEvent();
		const data = await event.locals.vendure.mutate(RESET_PASSWORD_MUTATION, {
			token,
			password: _password
		});

		const result = data.resetPassword;

		if ('errorCode' in result) {
			const msg =
				result.errorCode === 'PASSWORD_RESET_TOKEN_INVALID_ERROR'
					? 'This reset link is invalid'
					: result.errorCode === 'PASSWORD_RESET_TOKEN_EXPIRED_ERROR'
						? 'This reset link has expired'
						: result.message;
			invalid(issue.token(msg));
		}

		redirect(303, '/');
	}
);

export const requestUpdateEmail = form(
	v.object({
		_currentPassword: v.pipe(v.string(), v.nonEmpty('Current password is required')),
		newEmail: v.pipe(v.string(), v.nonEmpty('New email is required'), v.email('Invalid email'))
	}),
	async ({ _currentPassword, newEmail }, issue) => {
		const event = getRequestEvent();
		const data = await event.locals.vendure.mutate(REQUEST_UPDATE_EMAIL_MUTATION, {
			password: _currentPassword,
			newEmailAddress: newEmail
		});

		const result = data.requestUpdateCustomerEmailAddress;

		if ('errorCode' in result) {
			const msg =
				result.errorCode === 'INVALID_CREDENTIALS_ERROR'
					? 'Incorrect password'
					: result.message;
			invalid(issue._currentPassword(msg));
		}

		return { success: true };
	}
);

export const updatePassword = form(
	v.object({
		_currentPassword: v.pipe(v.string(), v.nonEmpty('Current password is required')),
		_newPassword: v.pipe(
			v.string(),
			v.nonEmpty('New password is required'),
			v.minLength(8, 'Password must be at least 8 characters')
		),
		_confirmPassword: v.pipe(v.string(), v.nonEmpty('Please confirm your new password'))
	}),
	async ({ _currentPassword, _newPassword, _confirmPassword }, issue) => {
		if (_newPassword !== _confirmPassword) {
			invalid(issue._confirmPassword('Passwords do not match'));
		}

		const event = getRequestEvent();
		const data = await event.locals.vendure.mutate(UPDATE_PASSWORD_MUTATION, {
			currentPassword: _currentPassword,
			newPassword: _newPassword
		});

		const result = data.updateCustomerPassword;

		if ('errorCode' in result) {
			const msg =
				result.errorCode === 'INVALID_CREDENTIALS_ERROR'
					? 'Incorrect current password'
					: result.message;
			invalid(issue._currentPassword(msg));
		}

		return { success: true };
	}
);

export const resendVerification = command(
	v.string(),
	async (emailAddress) => {
		const event = getRequestEvent();
		// Always returns success regardless of whether the email exists (no enumeration)
		await event.locals.vendure.mutate(REFRESH_VERIFICATION_MUTATION, { emailAddress });
		return { success: true };
	}
);
