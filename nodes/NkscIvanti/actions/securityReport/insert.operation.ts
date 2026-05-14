import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	NodeOperationError,
	updateDisplayOptions,
} from 'n8n-workflow';

import { nkscIvantiApiRequest } from '../../transports';
import {
	defaultFormVersion,
	getReportFieldProperties,
	getReportForm,
	type ReportForm,
} from './reportForms';
import { buildReportPayload, type PayloadInput, type PayloadValue } from './payload';

export const properties: INodeProperties[] = [
	...getReportFieldProperties(),
];

const displayOptions = {
	show: {
		operation: ['insert'],
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

		const payloadInput = getPayloadInput.call(this, itemIndex, form);
		const body = buildReportPayload(form, payloadInput, true);
		const response = await nkscIvantiApiRequest.call(this, {
			method: 'POST',
			endpoint: `/odata/businessobject/${form.objectName}`,
			body,
		});
		const responseData = sanitizeResponse(response);

		return this.helpers.constructExecutionMetaData(
			this.helpers.returnJsonArray(responseData),
			{ itemData: { item: itemIndex } },
		);
	} catch (error) {
		if (this.continueOnFail()) {
			return [{ json: { error: (error as Error).message } }];
		}

		throw new NodeOperationError(this.getNode(), error as Error);
	}
}

export function getPayloadInput(
	this: IExecuteFunctions,
	itemIndex: number,
	form: ReportForm,
): PayloadInput {
	const input: PayloadInput = {};

	for (const field of form.fields) {
		input[field.name] = getPayloadFieldValue.call(this, itemIndex, field);
	}

	return input;
}

function getPayloadFieldValue(
	this: IExecuteFunctions,
	itemIndex: number,
	field: ReportForm['fields'][number],
): PayloadValue {
	const fallbackValue = getFieldFallbackValue(field);

	try {
		return this.getNodeParameter(field.name, itemIndex, fallbackValue) as PayloadValue;
	} catch {
		return fallbackValue;
	}
}

function getFieldFallbackValue(field: ReportForm['fields'][number]): PayloadValue {
	if (field.default !== undefined) {
		return field.default as PayloadValue;
	}

	if (field.type === 'multiOptions') {
		return [];
	}

	return '';
}

export function getSelectedReportForm(this: IExecuteFunctions, itemIndex: number): ReportForm {
	const formVersion = this.getNodeParameter('formVersion', itemIndex) as string;
	const reportForm = this.getNodeParameter('reportForm', itemIndex) as string;

	if (formVersion !== defaultFormVersion) {
		throw new NodeOperationError(
			this.getNode(),
			`Unsupported NKSC form version: ${formVersion}`,
		);
	}

	try {
		return getReportForm(reportForm);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error);
	}
}

export function sanitizeResponse(response: unknown): IDataObject {
	const responseData = (response ?? {}) as IDataObject;

	if (responseData['@odata.context']) {
		delete responseData['@odata.context'];
	}

	return responseData;
}
