import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	INodePropertyOptions,
	NodeApiError,
	NodeOperationError,
	updateDisplayOptions,
} from 'n8n-workflow';

import { nkscIvantiApiRequest } from '../../transports';
import { getReportFieldProperties, reportForms, type ReportForm } from './reportForms';
import {
	getPayloadInput,
	getSelectedReportForm,
	sanitizeResponse,
} from './insert.operation';
import { buildReportPayload, type PayloadInput } from './payload';

const selectedFieldsUpdateMode = 'selectedFields';
const fullFormUpdateMode = 'fullForm';

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
		displayName: 'Update Mode',
		name: 'updateMode',
		type: 'options',
		default: 'selectedFields',
		required: true,
		options: [
			{
				name: 'Selected Fields',
				value: 'selectedFields',
				description: 'Only patch fields selected in Fields To Update',
			},
			{
				name: 'Full Form',
				value: 'fullForm',
				description: 'Patch the full selected report form payload',
			},
		],
	},
	...getFieldsToUpdateProperties(),
	{
		displayName: 'Validate Required Fields',
		name: 'validateRequiredFields',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				updateMode: [fullFormUpdateMode],
			},
		},
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

		const payloadInput = getPayloadInput.call(this, itemIndex, form);
		const body = buildUpdatePayload.call(this, form, payloadInput, itemIndex);
		const response = await nkscIvantiApiRequest.call(this, {
			method: 'PATCH',
			endpoint: `/odata/businessobject/${form.objectName}('${trimmedRecordId}')`,
			body,
		});
		const responseData = sanitizeResponse(response);

		return this.helpers.constructExecutionMetaData(
			this.helpers.returnJsonArray(responseData),
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

function buildUpdatePayload(
	this: IExecuteFunctions,
	form: ReportForm,
	payloadInput: PayloadInput,
	itemIndex: number,
) {
	const updateMode = this.getNodeParameter(
		'updateMode',
		itemIndex,
		selectedFieldsUpdateMode,
	) as string;

	if (updateMode === fullFormUpdateMode) {
		const validateRequiredFields = this.getNodeParameter(
			'validateRequiredFields',
			itemIndex,
		) as boolean;

		return buildReportPayload(form, payloadInput, validateRequiredFields);
	}

	if (updateMode !== selectedFieldsUpdateMode) {
		throw new NodeOperationError(this.getNode(), `Unsupported update mode: ${updateMode}`, {
			itemIndex,
		});
	}

	const rawFieldsToUpdate = this.getNodeParameter('fieldsToUpdate', itemIndex, []);
	const fieldsToUpdate = normalizeFieldsToUpdate(form, rawFieldsToUpdate);
	if (fieldsToUpdate.length === 0) {
		throw new NodeOperationError(this.getNode(), 'Fields To Update must include at least one field', {
			itemIndex,
		});
	}

	const body = buildReportPayload(form, payloadInput, false, {
		includedFields: fieldsToUpdate,
		includeFixedFields: false,
	});
	if (Object.keys(body).length === 0) {
		throw new NodeOperationError(
			this.getNode(),
			'At least one selected field must have a value to update',
			{ itemIndex },
		);
	}

	return body;
}

export function normalizeFieldsToUpdate(form: ReportForm, selection: unknown): string[] {
	const updateableFields = getUpdateableFields(form);
	const selectedFields: string[] = [];
	const invalidSelections: string[] = [];

	for (const token of getSelectionTokens(selection)) {
		const fieldName = resolveFieldSelectionToken(updateableFields, token);
		if (fieldName === undefined) {
			invalidSelections.push(String(token));
			continue;
		}

		if (!selectedFields.includes(fieldName)) {
			selectedFields.push(fieldName);
		}
	}

	if (invalidSelections.length > 0) {
		throw new Error(`Unknown Fields To Update selection: ${invalidSelections.join(', ')}`);
	}

	return selectedFields;
}

function getFieldsToUpdateProperties(): INodeProperties[] {
	return Object.values(reportForms).map((form) => ({
		displayName: 'Fields To Update',
		name: 'fieldsToUpdate',
		type: 'multiOptions',
		default: [],
		required: true,
		displayOptions: {
			show: {
				updateMode: [selectedFieldsUpdateMode],
				reportForm: [form.id],
			},
		},
		options: getFieldsToUpdateOptions(form),
		description:
			'Select the report fields to patch. Numbered labels can be used from expressions, for example 1,2,3 or [1,2,3].',
	}));
}

function getFieldsToUpdateOptions(form: ReportForm): INodePropertyOptions[] {
	return getUpdateableFields(form).map((field, index) => ({
		name: `${index + 1}. ${field.displayName}`,
		value: field.name,
		description: field.description,
	}));
}

function getUpdateableFields(form: ReportForm): ReportForm['fields'] {
	return form.fields.filter((field) => field.omitFromPayload !== true);
}

function getSelectionTokens(selection: unknown): Array<string | number> {
	if (Array.isArray(selection)) {
		return selection.flatMap((value) => getSelectionTokens(value));
	}

	if (typeof selection === 'number') {
		return [selection];
	}

	if (typeof selection !== 'string') {
		return [];
	}

	const trimmedSelection = selection.trim();
	if (trimmedSelection === '') {
		return [];
	}

	return trimmedSelection
		.replace(/^\[\s*/, '')
		.replace(/\s*\]$/, '')
		.split(',')
		.map((token) => token.trim())
		.filter((token) => token !== '');
}

function resolveFieldSelectionToken(
	fields: ReportForm['fields'],
	token: string | number,
): string | undefined {
	const numberValue = getNumberFromToken(token);
	if (numberValue !== undefined) {
		return fields[numberValue - 1]?.name;
	}

	const normalizedToken = String(token).trim().toLowerCase();
	const matchingField = fields.find(
		(field, index) =>
			field.name.toLowerCase() === normalizedToken ||
			field.displayName.toLowerCase() === normalizedToken ||
			`${index + 1}. ${field.displayName}`.toLowerCase() === normalizedToken,
	);

	return matchingField?.name;
}

function getNumberFromToken(token: string | number): number | undefined {
	if (typeof token === 'number') {
		return Number.isInteger(token) && token > 0 ? token : undefined;
	}

	const numberMatch = token.trim().match(/^(\d+)(?:\.\s*.*)?$/);
	if (!numberMatch) {
		return undefined;
	}

	return Number(numberMatch[1]);
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
