import assert from 'node:assert/strict';
import { test, vi } from 'vitest';

import { buildApiBaseUrl, nkscIvantiApiRequest } from '../nodes/NkscIvanti/transports';

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
		getNode: () => ({ name: 'NKSC Ivanti' }),
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

test('throws when NKSC Ivanti credentials are missing', async () => {
	const context = createTransportContext({ credentials: undefined });

	await assert.rejects(
		() =>
			nkscIvantiApiRequest.call(context, {
				method: 'GET',
				endpoint: '/odata/businessobject/XSC_SecurityReport__DetailReports',
			}),
		/No NKSC Ivanti credentials got returned/,
	);
});

test('returns response bodies and forwards query parameters', async () => {
	const context = createTransportContext({
		credentials: {
			tenant: 'https://ivanti.example.local/HEAT/api',
			apiKey: 'secret',
		},
		response: {
			statusCode: 200,
			body: { value: [{ RecId: 'A' }] },
		},
	});
	const httpRequest = context.helpers.httpRequest as ReturnType<typeof vi.fn>;

	const result = await nkscIvantiApiRequest.call(context, {
		method: 'GET',
		endpoint: '/odata/businessobject/XSC_SecurityReport__DetailReports',
		qs: {
			$filter: "XSC_ExternalTicket_RecId eq 'EXT-123'",
		},
	});

	assert.deepEqual(result, { value: [{ RecId: 'A' }] });
	assert.equal(httpRequest.mock.calls[0][0], 'nkscIvantiApi');
	assert.equal(
		httpRequest.mock.calls[0][1].url,
		'https://ivanti.example.local/HEAT/api/odata/businessobject/XSC_SecurityReport__DetailReports',
	);
	assert.deepEqual(httpRequest.mock.calls[0][1].qs, {
		$filter: "XSC_ExternalTicket_RecId eq 'EXT-123'",
	});
	assert.equal(httpRequest.mock.calls[0][1].headers, undefined);
});

test('returns an empty object for no-content responses', async () => {
	const context = createTransportContext({
		credentials: {
			tenant: 'https://ivanti.example.local/HEAT/api',
			apiKey: 'secret',
		},
		response: {
			statusCode: 204,
			body: undefined,
		},
	});

	const result = await nkscIvantiApiRequest.call(context, {
		method: 'POST',
		endpoint: '/odata/businessobject/XSC_SecurityReport__InitialReports',
		body: { Summary: 'Created' },
	});

	assert.deepEqual(result, {});
});

test('rejects non-2xx responses with API error content', async () => {
	const context = createTransportContext({
		credentials: {
			tenant: 'https://ivanti.example.local/HEAT/api',
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
			nkscIvantiApiRequest.call(context, {
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

test('wraps unexpected HTTP errors in a node api error', async () => {
	const context = createTransportContext({
		credentials: {
			tenant: 'https://ivanti.example.local/HEAT/api',
			apiKey: 'secret',
		},
		error: new Error('network down'),
	});

	await assert.rejects(() =>
		nkscIvantiApiRequest.call(context, {
			method: 'GET',
			endpoint: '/odata/businessobject/XSC_SecurityReport__DetailReports',
		}),
	);
});
