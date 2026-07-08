import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class NkscNivsApi implements ICredentialType {
	name = 'nkscNivsApi';

	icon?: Icon = 'file:nksc-nivs.svg';

	displayName = 'NKSC NIVS API';

	documentationUrl = 'https://github.com/syn-con/n8n-nodes-nksc-nivs#readme';

	properties: INodeProperties[] = [
		{
			displayName: 'API Endpoint',
			name: 'tenant',
			type: 'string',
			default: 'https://incidentai.nksc.lt/HEAT/api',
			required: true,
			description:
				'Full NKSC NIVS API endpoint URL. Include /HEAT/api when your instance requires it. Use HTTPS in production: with an http:// endpoint the API key is sent unencrypted, so only use http:// on trusted internal networks.',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			default: '',
			required: true,
			typeOptions: {
				password: true,
			},
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '={{ "rest_api_key=" + $credentials.apiKey }}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			// Mirrors buildApiBaseUrl in nodes/NkscNivs/transports/index.ts — keep the two in sync.
			baseURL:
				'={{ ($credentials.tenant.match(/^https?:\\/\\//i) ? $credentials.tenant : "https://" + $credentials.tenant).replace(/\\/+$/, "") + "/odata/businessobject" }}',
			method: 'GET',
			url: '/XSC_SecurityReport__DetailReports',
		},
	};
}
