import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	NodeOperationError,
	updateDisplayOptions,
} from 'n8n-workflow';

import { nkscNivsApiRequest } from '../../transports';
import { handleOperationError } from './operationError';
import { executeItems, sanitizeResponse } from './operationHelpers';
import { getReportForm, type ReportForm } from './reportForms';

export const externalTicketIdField = 'XSC_ExternalTicket_RecId';
export const defaultSearchLimit = 10;
const paginationPageSize = 100;
// Runaway guard for Return All in case a server ignores $skip; far above any realistic
// external-ticket → report count, so it never truncates a legitimate result set.
const maxReturnAllRecords = 10000;

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
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Search Limit',
		name: 'searchLimit',
		type: 'number',
		default: defaultSearchLimit,
		description: 'Maximum number of matching reports to return',
		displayOptions: {
			show: {
				returnAll: [false],
			},
		},
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
	return executeItems(this, (itemIndex) => executeItem.call(this, itemIndex));
}

async function executeItem(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	try {
		const reportForm = this.getNodeParameter('reportForm', itemIndex) as string;
		const form = getReportForm(reportForm);
		const externalTicketId = this.getNodeParameter('externalTicketId', itemIndex);

		if (typeof externalTicketId !== 'string' || externalTicketId.trim() === '') {
			throw new NodeOperationError(this.getNode(), 'External Ticket ID is required');
		}

		const records = await fetchMatchingReports(
			this,
			form,
			buildExternalTicketFilter(externalTicketId),
			itemIndex,
		);

		return this.helpers.constructExecutionMetaData(this.helpers.returnJsonArray(records), {
			itemData: { item: itemIndex },
		});
	} catch (error) {
		return handleOperationError(this, error, itemIndex);
	}
}

async function fetchMatchingReports(
	context: IExecuteFunctions,
	form: ReportForm,
	filter: string,
	itemIndex: number,
): Promise<IDataObject[]> {
	const returnAll = context.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const endpoint = `/odata/businessobject/${form.objectName}`;

	if (!returnAll) {
		const searchLimit = getSearchLimit.call(context, itemIndex);
		const response = await nkscNivsApiRequest.call(context, {
			method: 'GET',
			endpoint,
			qs: {
				$filter: filter,
				$top: searchLimit,
			},
		});

		return extractODataRecords(response);
	}

	const records: IDataObject[] = [];
	let skip = 0;

	for (;;) {
		// Pagination is inherently sequential: the next page's $skip depends on this page
		// completing, so the pages cannot be fetched concurrently.
		// eslint-disable-next-line no-await-in-loop
		const response = await nkscNivsApiRequest.call(context, {
			method: 'GET',
			endpoint,
			qs: {
				$filter: filter,
				$top: paginationPageSize,
				$skip: skip,
			},
		});

		const page = extractODataRecords(response);
		records.push(...page);

		if (page.length < paginationPageSize || records.length >= maxReturnAllRecords) {
			break;
		}

		skip += paginationPageSize;
	}

	return records;
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

	// A collection query normally returns { value: [...] }. An empty/no-content body sanitizes to {},
	// which should yield no records rather than a single blank record.
	if (Object.keys(responseData).length === 0) {
		return [];
	}

	return [responseData];
}
