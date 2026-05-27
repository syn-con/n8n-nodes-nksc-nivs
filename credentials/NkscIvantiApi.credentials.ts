import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class NkscIvantiApi implements ICredentialType {
	name = 'nkscIvantiApi';

	icon?: Icon = 'file:nksc-ivanti.svg';

	displayName = 'NKSC Ivanti API';

	documentationUrl =
		'https://help.ivanti.com/ht/help/en_US/ISM/2022/admin/Content/Configure/API/RestAPI-Introduction.htm';

	properties: INodeProperties[] = [
		{
			displayName: 'API Endpoint',
			name: 'tenant',
			type: 'string',
			default: 'https://incidentai.nksc.lt/HEAT/api',
			required: true,
			description:
				'Full Ivanti API endpoint URL. Include /HEAT/api when your instance requires it.',
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
			baseURL:
				'={{ ($credentials.tenant.match(/^https?:\\/\\//i) ? $credentials.tenant : "https://" + $credentials.tenant).replace(/\\/+$/, "") + "/odata/businessobject" }}',
			method: 'GET',
			url: '/XSC_SecurityReport__DetailReports',
		},
	};
}
