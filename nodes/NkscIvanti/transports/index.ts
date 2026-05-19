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

export async function nkscIvantiApiRequest(
	this: NkscIvantiApiRequestContext,
	requestOptions: NkscIvantiApiRequestOptions,
): Promise<unknown> {
	const credential = await this.getCredentials('nkscIvantiApi');

	if (credential === undefined) {
		throw new Error('No NKSC Ivanti credentials got returned');
	}

	const baseUrl = buildApiBaseUrl(credential.tenant as string);

	const options: IHttpRequestOptions = {
		headers: {
			Authorization: `rest_api_key=${credential.apiKey}`,
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

	try {
		const response = await this.helpers.httpRequest(options);

		if (response && response.statusCode > 299) {
			const errorResponse = response.body as JsonObject;
			throw new NodeApiError(this.getNode(), errorResponse, {
				description: errorResponse.description?.toString(),
				message: errorResponse.message?.toString(),
			});
		}

		if (response && response.statusCode === 204) {
			return {};
		}

		return response?.body ?? response;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

export function buildApiBaseUrl(apiEndpoint: string): string {
	const normalizedEndpoint = apiEndpoint.trim().replace(/\/+$/, '');

	return /^https?:\/\//i.test(normalizedEndpoint)
		? normalizedEndpoint
		: `https://${normalizedEndpoint}`;
}
