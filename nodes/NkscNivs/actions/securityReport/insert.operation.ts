import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	updateDisplayOptions,
} from 'n8n-workflow';

import { nkscNivsApiRequest } from '../../transports';
import { handleOperationError } from './operationError';
import {
	executeItems,
	getPayloadInput,
	getSelectedReportForm,
	sanitizeResponse,
} from './operationHelpers';
import { getReportFieldProperties } from './reportForms';
import { buildReportPayload } from './payload';

export const properties: INodeProperties[] = [...getReportFieldProperties()];

const displayOptions = {
	show: {
		operation: ['insert'],
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
		const form = getSelectedReportForm(this, itemIndex);

		const payloadInput = getPayloadInput(this, itemIndex, form);
		const body = buildReportPayload(form, payloadInput, true);
		const response = await nkscNivsApiRequest.call(this, {
			method: 'POST',
			endpoint: `/odata/businessobject/${form.objectName}`,
			body,
		});
		const responseData = sanitizeResponse(response);

		return this.helpers.constructExecutionMetaData(this.helpers.returnJsonArray(responseData), {
			itemData: { item: itemIndex },
		});
	} catch (error) {
		return handleOperationError(this, error, itemIndex);
	}
}
