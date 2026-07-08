import {
	IExecuteFunctions,
	INodeExecutionData,
	INodePropertyOptions,
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

// Subtitle shows the selected operation's label so the node name on the canvas changes with the
// operation. Built from the operation options so the labels have a single source of truth.
function buildOperationSubtitle(): string {
	const options = securityReport.operationProperty.options as INodePropertyOptions[];
	const branches = options
		.map(
			(option) =>
				`$parameter["operation"] === ${JSON.stringify(option.value)} ? ${JSON.stringify(option.name)} : `,
		)
		.join('');

	return `={{ ${branches}$parameter["operation"] }}`;
}

export class NkscNivs implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NKSC NIVS',
		name: 'nkscNivs',
		group: ['transform'],
		icon: 'file:nksc-nivs.svg',
		version: 1,
		subtitle: buildOperationSubtitle(),
		description: 'Register NKSC cyber incident reports in NKSC NIVS',
		defaults: {
			name: 'NKSC NIVS',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'nkscNivsApi',
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
