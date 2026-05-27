import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	NodeApiError,
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
		description: 'Whether to validate the full selected report form before updating',
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

		const recordId = this.getNodeParameter('recordId', itemIndex);
		if (typeof recordId !== 'string' || recordId.trim() === '') {
			throw new NodeOperationError(this.getNode(), 'Record ID is required');
		}

		const trimmedRecordId = recordId.trim();
		if (!/^[0-9A-Fa-f]{32}$/.test(trimmedRecordId)) {
			throw new NodeOperationError(this.getNode(), 'Record ID must be a 32-character hex string', {
				itemIndex,
			});
		}

		const validateRequiredFields = this.getNodeParameter(
			'validateRequiredFields',
			itemIndex,
		) as boolean;
		const payloadInput = getPayloadInput.call(this, itemIndex, form);
		const body = buildReportPayload(form, payloadInput, validateRequiredFields);
		const response = await nkscIvantiApiRequest.call(this, {
			method: 'PATCH',
			endpoint: `/odata/businessobject/${form.objectName}('${trimmedRecordId}')`,
			body,
		});

		return this.helpers.constructExecutionMetaData(
			this.helpers.returnJsonArray(sanitizeResponse(response)),
			{ itemData: { item: itemIndex } },
		);
	} catch (error) {
		if (this.continueOnFail()) {
			return [{ json: { error: getErrorMessage(error) }, pairedItem: { item: itemIndex } }];
		}

		if (error instanceof NodeOperationError || error instanceof NodeApiError) {
			throw error;
		}

		throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
	}
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
