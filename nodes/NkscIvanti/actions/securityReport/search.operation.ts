import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	NodeApiError,
	NodeOperationError,
	updateDisplayOptions,
} from 'n8n-workflow';

import { nkscIvantiApiRequest } from '../../transports';
import { sanitizeResponse } from './insert.operation';
import { getReportForm } from './reportForms';

export const externalTicketIdField = 'XSC_ExternalTicket_RecId';
export const defaultSearchLimit = 10;

export const properties: INodeProperties[] = [
	{
		displayName: 'External Ticket ID',
		name: 'externalTicketId',
		type: 'string',
		default: '',
		required: true,
		description: 'External ticket RecId to search for',
	},
	{
		displayName: 'Search Limit',
		name: 'searchLimit',
		type: 'number',
		default: defaultSearchLimit,
		description: 'Maximum number of matching reports to return',
		typeOptions: {
			minValue: 1,
		},
	},
];

const displayOptions = {
	show: {
		operation: ['search'],
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
		const reportForm = this.getNodeParameter('reportForm', itemIndex) as string;
		const form = getReportForm(reportForm);
		const externalTicketId = this.getNodeParameter('externalTicketId', itemIndex);
		const searchLimit = getSearchLimit.call(this, itemIndex);

		if (typeof externalTicketId !== 'string' || externalTicketId.trim() === '') {
			throw new NodeOperationError(this.getNode(), 'External Ticket ID is required');
		}

		const response = await nkscIvantiApiRequest.call(this, {
			method: 'GET',
			endpoint: `/odata/businessobject/${form.objectName}`,
			qs: {
				$filter: buildExternalTicketFilter(externalTicketId),
				$top: searchLimit,
			},
		});

		const records = extractODataRecords(response);

		return this.helpers.constructExecutionMetaData(this.helpers.returnJsonArray(records), {
			itemData: { item: itemIndex },
		});
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

export function getSearchLimit(this: IExecuteFunctions, itemIndex: number): number {
	const rawLimit = this.getNodeParameter('searchLimit', itemIndex, defaultSearchLimit);
	const limit = typeof rawLimit === 'number' ? rawLimit : Number(rawLimit);

	if (!Number.isInteger(limit) || limit < 1) {
		throw new NodeOperationError(this.getNode(), 'Search Limit must be a positive integer');
	}

	return limit;
}

export function buildExternalTicketFilter(externalTicketId: string): string {
	return `${externalTicketIdField} eq '${escapeODataString(externalTicketId.trim())}'`;
}

function escapeODataString(value: string): string {
	return value.replace(/'/g, "''");
}

export function extractODataRecords(response: unknown): IDataObject[] {
	const responseData = sanitizeResponse(response);
	const { value } = responseData;

	if (Array.isArray(value)) {
		return value.map((record) => sanitizeResponse(record));
	}

	return [responseData];
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
