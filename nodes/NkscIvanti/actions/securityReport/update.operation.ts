import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	NodeOperationError,
	updateDisplayOptions,
} from 'n8n-workflow';

import { nkscIvantiApiRequest } from '../../transports';
import { getReportFieldProperties } from './reportForms';
import { getPayloadInput, getSelectedReportForm, sanitizeResponse } from './insert.operation';
import { buildReportPayload } from './payload';

export const properties: INodeProperties[] = [
	{
		displayName: 'Record ID',
		name: 'recordId',
		type: 'string',
		default: '',
		required: true,
		description: 'Ivanti RecId of the report to update',
	},
	{
		displayName: 'Validate Required Fields',
		name: 'validateRequiredFields',
		type: 'boolean',
		default: false,
		description: 'Whether to validate the full major incident form before updating',
	},
	...getReportFieldProperties(),
];

const displayOptions = {
	show: {
		operation: ['update'],
	},
};

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(this: IExecuteFunctions): Promise<INodeExecutionData[]> {
	const items = this.getInputData();

	const itemResults = await Promise.all(
		items.map(async (_item, itemIndex) => executeItem.call(this, itemIndex)),
	);

	return itemResults.flat();
}

async function executeItem(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	try {
		const form = getSelectedReportForm.call(this, itemIndex);

		const recordId = this.getNodeParameter('recordId', itemIndex) as string;
		if (!recordId) {
			throw new NodeOperationError(this.getNode(), 'Record ID is required');
		}

		const validateRequiredFields = this.getNodeParameter(
			'validateRequiredFields',
			itemIndex,
		) as boolean;
		const payloadInput = getPayloadInput.call(this, itemIndex, form);
		const body = buildReportPayload(form, payloadInput, validateRequiredFields);
		const response = await nkscIvantiApiRequest.call(this, {
			method: 'PATCH',
			endpoint: `/odata/businessobject/${form.objectName}('${recordId}')`,
			body,
		});

		return this.helpers.constructExecutionMetaData(
			this.helpers.returnJsonArray(sanitizeResponse(response)),
			{ itemData: { item: itemIndex } },
		);
	} catch (error) {
		if (this.continueOnFail()) {
			return [{ json: { error: (error as Error).message } }];
		}

		throw new NodeOperationError(this.getNode(), error as Error);
	}
}
