import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	NodeOperationError,
} from 'n8n-workflow';

import { defaultFormVersion, getReportForm, type ReportForm } from './reportForms';
import type { PayloadInput, PayloadValue } from './payload';

/**
 * Runs executeItem once per input item, sequentially. Items are processed one at a time (rather than
 * with Promise.all) so a large input batch never fires one concurrent NKSC NIVS request per item, which
 * would risk tripping rate limits, and so a non-continueOnFail failure stops deterministically.
 */
export async function executeItems(
	context: IExecuteFunctions,
	executeItem: (itemIndex: number) => Promise<INodeExecutionData[]>,
): Promise<INodeExecutionData[]> {
	const items = context.getInputData();
	const returnData: INodeExecutionData[] = [];

	for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
		// eslint-disable-next-line no-await-in-loop
		const itemResult = await executeItem(itemIndex);
		returnData.push(...itemResult);
	}

	return returnData;
}

export function getSelectedReportForm(context: IExecuteFunctions, itemIndex: number): ReportForm {
	const formVersion = context.getNodeParameter('formVersion', itemIndex) as string;
	const reportForm = context.getNodeParameter('reportForm', itemIndex) as string;

	if (formVersion !== defaultFormVersion) {
		throw new NodeOperationError(
			context.getNode(),
			`Unsupported NKSC form version: ${formVersion}`,
		);
	}

	try {
		return getReportForm(reportForm);
	} catch (error) {
		throw new NodeOperationError(context.getNode(), error as Error);
	}
}

export function getPayloadInput(
	context: IExecuteFunctions,
	itemIndex: number,
	form: ReportForm,
): PayloadInput {
	const input: PayloadInput = {};

	for (const field of form.fields) {
		input[field.name] = getPayloadFieldValue(context, itemIndex, field);
	}

	return input;
}

function getPayloadFieldValue(
	context: IExecuteFunctions,
	itemIndex: number,
	field: ReportForm['fields'][number],
): PayloadValue {
	const fallbackValue = getFieldFallbackValue(field);

	try {
		return context.getNodeParameter(field.name, itemIndex, fallbackValue) as PayloadValue;
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

export function sanitizeResponse(response: unknown): IDataObject {
	const responseData = (response ?? {}) as IDataObject;
	const { '@odata.context': _context, ...sanitizedResponse } = responseData;

	return sanitizedResponse;
}
