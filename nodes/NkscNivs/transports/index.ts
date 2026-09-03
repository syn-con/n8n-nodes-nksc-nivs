import {
	IDataObject,
	IExecuteFunctions,
	IExecuteSingleFunctions,
	IHookFunctions,
	IHttpRequestOptions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
	JsonObject,
	NodeApiError,
	NodeOperationError,
} from 'n8n-workflow';

type NkscNivsApiRequestContext =
	| IExecuteFunctions
	| IExecuteSingleFunctions
	| IHookFunctions
	| ILoadOptionsFunctions;

type NkscNivsApiRequestOptions = {
	method: IHttpRequestMethods;
	endpoint: string;
	body?: IDataObject;
	qs?: IDataObject;
	headers?: IDataObject;
};

type NkscNivsCredentials = {
	// The apiKey is consumed by the credential's `authenticate` block (see NkscNivsApi.credentials.ts),
	// not read here — only the tenant is needed to build the base URL.
	tenant: string;
};

type FullHttpResponse = {
	statusCode: number;
	body?: unknown;
};

export async function nkscNivsApiRequest(
	this: NkscNivsApiRequestContext,
	requestOptions: NkscNivsApiRequestOptions,
): Promise<unknown> {
	const credential = (await this.getCredentials('nkscNivsApi')) as NkscNivsCredentials | undefined;

	if (credential === undefined) {
		throw new NodeOperationError(this.getNode(), 'No NKSC NIVS credentials got returned');
	}

	const baseUrl = buildApiBaseUrl(credential.tenant);
	const options = buildHttpRequestOptions(baseUrl, requestOptions);

	try {
		const response = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'nkscNivsApi',
			options,
		)) as FullHttpResponse | undefined;
		return parseNivsResponse(this, response);
	} catch (error) {
		// Already-wrapped errors (notably the NodeApiError from parseNivsResponse) are passed
		// through as-is; anything else is wrapped so the n8n UI keeps the HTTP context. Written as
		// one throw of a conditional rather than a bare `throw error` in the catch, which
		// @n8n/community-nodes/require-node-api-error rejects.
		throw error instanceof NodeApiError || error instanceof NodeOperationError
			? error
			: new NodeApiError(this.getNode(), error as JsonObject);
	}
}

// Note: NkscNivsApi.credentials.ts's `test.request.baseURL` expression mirrors this normalization
// (add https:// if no scheme, strip trailing slashes). Keep the two in sync.
export function buildApiBaseUrl(apiEndpoint: string): string {
	const normalizedEndpoint = apiEndpoint.trim().replace(/\/+$/, '');

	return /^https?:\/\//i.test(normalizedEndpoint)
		? normalizedEndpoint
		: `https://${normalizedEndpoint}`;
}

function buildHttpRequestOptions(
	baseUrl: string,
	requestOptions: NkscNivsApiRequestOptions,
): IHttpRequestOptions {
	// The Authorization header is injected by the credential's `authenticate` block
	// through httpRequestWithAuthentication, so it is intentionally not set here.
	const options: IHttpRequestOptions = {
		method: requestOptions.method,
		body: requestOptions.body,
		url: `${baseUrl}${requestOptions.endpoint}`,
		json: true,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
	};

	if (requestOptions.headers !== undefined) {
		options.headers = requestOptions.headers;
	}

	if (requestOptions.qs !== undefined) {
		options.qs = requestOptions.qs;
	}

	return options;
}

function parseNivsResponse(
	node: NkscNivsApiRequestContext,
	response: FullHttpResponse | undefined,
): unknown {
	if (response && response.statusCode > 299) {
		const errorResponse = getErrorResponseBody(response.body);
		// n8n's NodeApiError reads errorResponse.message directly and calls .toUpperCase() on it while
		// building the descriptive message. NIVS OData errors carry a non-string `message` (the
		// localised { lang, value } object), so leaving message extraction to NodeApiError throws
		// "(message || "").toUpperCase is not a function". Passing an always-string message (and the real
		// HTTP status code) keeps this.message a string and prevents that crash.
		throw new NodeApiError(node.getNode(), errorResponse, {
			httpCode: response.statusCode.toString(),
			message: extractErrorMessage(response.body, response.statusCode),
			// Fall back to the raw response body so an unexpected NIVS error shape (e.g. a
			// rejected property on the target business object) is still visible instead of being
			// swallowed behind the generic status-code message.
			description: extractErrorDescription(errorResponse) ?? summarizeRawBody(response.body),
		});
	}

	// Any successful response without a JSON body (204, or a 200 with an empty body)
	// resolves to {} so the full { statusCode, headers, body } envelope is never leaked
	// into the item output.
	return response?.body ?? {};
}

function getErrorResponseBody(body: unknown): JsonObject {
	return typeof body === 'object' && body !== null && !Array.isArray(body)
		? (body as JsonObject)
		: {};
}

// Keys under which NIVS, OData and ASP.NET Web API responses put the human-readable
// error string. `value` covers OData's localised message object ({ lang, value }); `error`
// is traversed to reach the nested OData error object.
const ERROR_MESSAGE_KEYS = ['message', 'Message', 'value', 'ExceptionMessage', 'error'] as const;
const ERROR_MESSAGE_MAX_DEPTH = 5;

function extractErrorMessage(body: unknown, statusCode: number): string {
	return findErrorString(body, 0) ?? `NKSC NIVS request failed with status code ${statusCode}`;
}

function findErrorString(value: unknown, depth: number): string | undefined {
	if (typeof value === 'string') {
		const trimmed = value.trim();
		return trimmed === '' ? undefined : trimmed;
	}

	if (typeof value === 'number') {
		return String(value);
	}

	if (depth >= ERROR_MESSAGE_MAX_DEPTH || typeof value !== 'object' || value === null) {
		return undefined;
	}

	const record = value as Record<string, unknown>;
	for (const key of ERROR_MESSAGE_KEYS) {
		if (key in record) {
			const found = findErrorString(record[key], depth + 1);
			if (found !== undefined) {
				return found;
			}
		}
	}

	return undefined;
}

function extractErrorDescription(body: JsonObject): string | undefined {
	return findErrorDescription(body, 0);
}

function findErrorDescription(value: unknown, depth: number): string | undefined {
	if (depth >= ERROR_MESSAGE_MAX_DEPTH || typeof value !== 'object' || value === null) {
		return undefined;
	}

	const record = value as Record<string, unknown>;
	for (const key of ['description', 'Description', 'detail', 'details']) {
		const candidate = record[key];
		if (typeof candidate === 'string' && candidate.trim() !== '') {
			return candidate.trim();
		}
	}

	for (const key of ['error', 'Error']) {
		if (key in record) {
			const found = findErrorDescription(record[key], depth + 1);
			if (found !== undefined) {
				return found;
			}
		}
	}

	return undefined;
}

const rawBodyDescriptionMaxLength = 500;

function summarizeRawBody(body: unknown): string | undefined {
	if (body === undefined || body === null) {
		return undefined;
	}

	let text: string;
	if (typeof body === 'string') {
		text = body.trim();
	} else {
		try {
			text = JSON.stringify(body);
		} catch {
			return undefined;
		}
	}

	if (text === '' || text === '{}' || text === '""') {
		return undefined;
	}

	const truncated =
		text.length > rawBodyDescriptionMaxLength
			? `${text.slice(0, rawBodyDescriptionMaxLength)}…`
			: text;

	return `NKSC NIVS response body: ${truncated}`;
}
