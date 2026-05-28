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

type NkscIvantiApiRequestContext =
	| IExecuteFunctions
	| IExecuteSingleFunctions
	| IHookFunctions
	| ILoadOptionsFunctions;

type NkscIvantiApiRequestOptions = {
	method: IHttpRequestMethods;
	endpoint: string;
	body?: IDataObject;
	qs?: IDataObject;
	headers?: IDataObject;
};

type NkscIvantiCredentials = {
	tenant: string;
	apiKey: string;
};

type FullHttpResponse = {
	statusCode: number;
	body?: unknown;
};

export async function nkscIvantiApiRequest(
	this: NkscIvantiApiRequestContext,
	requestOptions: NkscIvantiApiRequestOptions,
): Promise<unknown> {
	const credential = (await this.getCredentials('nkscIvantiApi')) as
		| NkscIvantiCredentials
		| undefined;

	if (credential === undefined) {
		throw new NodeOperationError(this.getNode(), 'No NKSC Ivanti credentials got returned');
	}

	const baseUrl = buildApiBaseUrl(credential.tenant);
	const options = buildHttpRequestOptions(baseUrl, credential.apiKey, requestOptions);

	try {
		const response = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'nkscIvantiApi',
			options,
		)) as FullHttpResponse | undefined;
		return parseIvantiResponse(this, response);
	} catch (error) {
		if (error instanceof NodeApiError || error instanceof NodeOperationError) {
			throw error;
		}

		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

export function buildApiBaseUrl(apiEndpoint: string): string {
	const normalizedEndpoint = apiEndpoint.trim().replace(/\/+$/, '');

	return /^https?:\/\//i.test(normalizedEndpoint)
		? normalizedEndpoint
		: `https://${normalizedEndpoint}`;
}

function buildHttpRequestOptions(
	baseUrl: string,
	apiKey: string,
	requestOptions: NkscIvantiApiRequestOptions,
): IHttpRequestOptions {
	const options: IHttpRequestOptions = {
		headers: {
			Authorization: `rest_api_key=${apiKey}`,
			...requestOptions.headers,
		},
		method: requestOptions.method,
		body: requestOptions.body,
		url: `${baseUrl}${requestOptions.endpoint}`,
		json: true,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
	};

	if (requestOptions.qs !== undefined) {
		options.qs = requestOptions.qs;
	}

	return options;
}

function parseIvantiResponse(
	node: NkscIvantiApiRequestContext,
	response: FullHttpResponse | undefined,
): unknown {
	if (response && response.statusCode > 299) {
		const errorResponse = getErrorResponseBody(response.body);
		throw new NodeApiError(node.getNode(), errorResponse, {
			description: getStringProperty(errorResponse, 'description'),
			message: getStringProperty(errorResponse, 'message'),
		});
	}

	if (response && response.statusCode === 204) {
		return {};
	}

	return response?.body ?? response;
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
