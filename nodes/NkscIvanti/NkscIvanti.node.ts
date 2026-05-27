import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
} from 'n8n-workflow';

import { router } from './actions/router';
import * as securityReport from './actions/securityReport';
import {
	defaultFormVersion,
	defaultReportForm,
	formVersionOptions,
	reportFormOptions,
} from './actions/securityReport/reportForms';

export class NkscIvanti implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NKSC Ivanti',
		name: 'nkscIvanti',
		group: ['transform'],
		icon: 'file:nksc-ivanti.svg',
		version: 1,
		subtitle: '={{ $parameter["operation"] }}',
		description: 'Register NKSC cyber incident reports in Ivanti',
		defaults: {
			name: 'NKSC Ivanti',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'nkscIvantiApi',
				required: true,
			},
		],
		properties: [
			securityReport.operationProperty,
			{
				displayName: 'Report',
				name: 'reportForm',
				type: 'options',
				noDataExpression: true,
				options: reportFormOptions,
				default: defaultReportForm,
				required: true,
			},
			{
				displayName: 'Form Version',
				name: 'formVersion',
				type: 'options',
				noDataExpression: true,
				default: defaultFormVersion,
				required: true,
				options: formVersionOptions,
				displayOptions: {
					hide: {
						operation: ['search'],
					},
				},
			},
			...securityReport.description.filter((property) => property.name !== 'operation'),
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return router.call(this);
	}
}
