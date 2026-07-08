import assert from 'node:assert/strict';
import { test, vi } from 'vitest';

import { buildApiBaseUrl, nkscNivsApiRequest } from '../nodes/NkscNivs/transports';

function createTransportContext(options?: {
	credentials?: Record<string, unknown> | undefined;
	response?: unknown;
	error?: Error;
}) {
	const httpRequest = vi.fn();
	const getCredentials = vi.fn().mockResolvedValue(options?.credentials);

	if (options?.error !== undefined) {
		httpRequest.mockRejectedValue(options.error);
	} else if (options?.response !== undefined) {
		httpRequest.mockResolvedValue(options.response);
	}

	return {
		getCredentials,
		getNode: () => ({ name: 'NKSC NIVS' }),
		helpers: {
			httpRequest,
			httpRequestWithAuthentication: httpRequest,
		},
	} as any;
}

test('normalizes explicit API endpoint URLs', () => {
	assert.equal(
		buildApiBaseUrl('https://incidentai.nksc.lt/HEAT/api/'),
		'https://incidentai.nksc.lt/HEAT/api',
	);
});

test('preserves explicit HTTP API endpoints', () => {
	assert.equal(buildApiBaseUrl('http://uat1-putheat/HEAT/api/'), 'http://uat1-putheat/HEAT/api');
});

test('adds HTTPS to bare endpoint hosts', () => {
	assert.equal(
		buildApiBaseUrl('test-incidentai.nksc.lt/HEAT/api'),
		'https://test-incidentai.nksc.lt/HEAT/api',
	);
});

test('throws when NKSC NIVS credentials are missing', async () => {
	const context = createTransportContext({ credentials: undefined });

	await assert.rejects(
		() =>
			nkscNivsApiRequest.call(context, {
				method: 'GET',
				endpoint: '/odata/businessobject/XSC_SecurityReport__DetailReports',
			}),
		/No NKSC NIVS credentials got returned/,
	);
});

test('returns response bodies and forwards query parameters', async () => {
	const context = createTransportContext({
		credentials: {
			tenant: 'https://nivs.example.local/HEAT/api',
			apiKey: 'secret',
		},
		response: {
			statusCode: 200,
			body: { value: [{ RecId: 'A' }] },
		},
	});
	const httpRequest = context.helpers.httpRequest as ReturnType<typeof vi.fn>;

	const result = await nkscNivsApiRequest.call(context, {
		method: 'GET',
		endpoint: '/odata/businessobject/XSC_SecurityReport__DetailReports',
		qs: {
			$filter: "XSC_ExternalTicket_RecId eq 'EXT-123'",
		},
	});

	assert.deepEqual(result, { value: [{ RecId: 'A' }] });
	assert.equal(httpRequest.mock.calls[0][0], 'nkscNivsApi');
	assert.equal(
		httpRequest.mock.calls[0][1].url,
		'https://nivs.example.local/HEAT/api/odata/businessobject/XSC_SecurityReport__DetailReports',
	);
	assert.deepEqual(httpRequest.mock.calls[0][1].qs, {
		$filter: "XSC_ExternalTicket_RecId eq 'EXT-123'",
	});
	// The Authorization header is injected by the credential's authenticate block through the
	// real httpRequestWithAuthentication helper (mocked here), so it is not set by the transport.
});

test('returns an empty object for successful responses with an empty body', async () => {
	const context = createTransportContext({
		credentials: {
			tenant: 'https://nivs.example.local/HEAT/api',
			apiKey: 'secret',
		},
		response: {
			statusCode: 200,
			body: undefined,
		},
	});

	const result = await nkscNivsApiRequest.call(context, {
		method: 'POST',
		endpoint: '/odata/businessobject/XSC_SecurityReport__InitialReports',
		body: { Summary: 'Created' },
	});

	assert.deepEqual(result, {});
});

test('returns an empty object for no-content responses', async () => {
	const context = createTransportContext({
		credentials: {
			tenant: 'https://nivs.example.local/HEAT/api',
			apiKey: 'secret',
		},
		response: {
			statusCode: 204,
			body: undefined,
		},
	});

	const result = await nkscNivsApiRequest.call(context, {
		method: 'POST',
		endpoint: '/odata/businessobject/XSC_SecurityReport__InitialReports',
		body: { Summary: 'Created' },
	});

	assert.deepEqual(result, {});
});

test('rejects non-2xx responses with API error content', async () => {
	const context = createTransportContext({
		credentials: {
			tenant: 'https://nivs.example.local/HEAT/api',
			apiKey: 'secret',
		},
		response: {
			statusCode: 500,
			body: {
				message: 'Bad request',
				description: 'Validation failed',
			},
		},
	});

	await assert.rejects(
		() =>
			nkscNivsApiRequest.call(context, {
				method: 'PATCH',
				endpoint: "/odata/businessobject/XSC_SecurityReport__DetailReports('RID-1')",
				body: { Summary: 'Updated' },
			}),
		(error) =>
			error instanceof Error &&
			error.message.includes('Bad request') &&
			'description' in error &&
			(error as { description?: string }).description === 'Validation failed',
	);
});

test('forwards custom request headers to the HTTP helper', async () => {
	const context = createTransportContext({
		credentials: {
			tenant: 'https://nivs.example.local/HEAT/api',
			apiKey: 'secret',
		},
		response: {
			statusCode: 200,
			body: { ok: true },
		},
	});
	const httpRequest = context.helpers.httpRequest as ReturnType<typeof vi.fn>;

	await nkscNivsApiRequest.call(context, {
		method: 'GET',
		endpoint: '/odata/businessobject/XSC_SecurityReport__DetailReports',
		headers: { 'X-Custom': 'value' },
	});

	assert.deepEqual(httpRequest.mock.calls[0][1].headers, { 'X-Custom': 'value' });
});

test('wraps non-2xx responses whose body is not an object', async () => {
	const context = createTransportContext({
		credentials: {
			tenant: 'https://nivs.example.local/HEAT/api',
			apiKey: 'secret',
		},
		response: {
			statusCode: 400,
			body: 'plain text error',
		},
	});

	await assert.rejects(() =>
		nkscNivsApiRequest.call(context, {
			method: 'GET',
			endpoint: '/odata/businessobject/XSC_SecurityReport__DetailReports',
		}),
	);
});

test('wraps unexpected HTTP errors in a node api error', async () => {
	const context = createTransportContext({
		credentials: {
			tenant: 'https://nivs.example.local/HEAT/api',
			apiKey: 'secret',
		},
		error: new Error('network down'),
	});

	await assert.rejects(() =>
		nkscNivsApiRequest.call(context, {
			method: 'GET',
			endpoint: '/odata/businessobject/XSC_SecurityReport__DetailReports',
		}),
	);
});
