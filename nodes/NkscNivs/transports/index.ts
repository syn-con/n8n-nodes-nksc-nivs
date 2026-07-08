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
		if (error instanceof NodeApiError || error instanceof NodeOperationError) {
			throw error;
		}

		throw new NodeApiError(this.getNode(), error as JsonObject);
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
		throw new NodeApiError(node.getNode(), errorResponse, {
			description: getStringProperty(errorResponse, 'description'),
			message: getStringProperty(errorResponse, 'message'),
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

function getStringProperty(object: JsonObject, key: string): string | undefined {
	const value = object[key];

	return typeof value === 'string' ? value : undefined;
}
