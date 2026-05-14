import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	NodeOperationError,
	updateDisplayOptions,
} from 'n8n-workflow';

import { nkscIvantiApiRequest } from '../../transports';
import { sanitizeResponse } from './insert.operation';
import { getReportForm } from './reportForms';

export const externalTicketIdField = 'XSC_ExternalTicket_RecId';

export const properties: INodeProperties[] = [
	{
		displayName: 'External Ticket ID',
		name: 'externalTicketId',
		type: 'string',
		default: '',
		required: true,
		description: 'External ticket RecId to search for',
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
		const externalTicketId = this.getNodeParameter('externalTicketId', itemIndex) as string;

		if (!externalTicketId.trim()) {
			throw new NodeOperationError(this.getNode(), 'External Ticket ID is required');
		}

		const response = await nkscIvantiApiRequest.call(this, {
			method: 'GET',
			endpoint: `/odata/businessobject/${form.objectName}`,
			qs: {
				$filter: buildExternalTicketFilter(externalTicketId),
			},
		});

		const records = extractODataRecords(response);

		return this.helpers.constructExecutionMetaData(
			this.helpers.returnJsonArray(records),
			{ itemData: { item: itemIndex } },
		);
	} catch (error) {
		if (this.continueOnFail()) {
			return [{ json: { error: (error as Error).message } }];
		}

		throw new NodeOperationError(this.getNode(), error as Error);
	}
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
