import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';

import { booleanOptions, noValue, validatedYesNoOptions, yesValue } from './reportFields';
import { reportForms } from './reportFormDefinitions';
import type { ReportField, ReportFieldType, ReportForm, ReportFormId } from './reportTypes';

export type { ReportField, ReportFieldType, ReportForm, ReportFormId };
export { noValue, yesValue };
export { lossOptionFields, scopeOptionFields } from './reportFields';

export const formVersionOptions: INodePropertyOptions[] = [
	{
		name: 'V1 (Latest)',
		value: 'v1',
	},
];

export const defaultFormVersion = 'v1';

export { reportForms };

export const reportFormOptions: INodePropertyOptions[] = Object.values(reportForms).map((form) => ({
	name: form.displayName,
	value: form.id,
}));

export const defaultReportForm: ReportFormId = 'majorIncident';

export function getReportForm(formId: string): ReportForm {
	const form = reportForms[formId as ReportFormId];
	if (!form) {
		throw new Error(`Unsupported NKSC report form: ${formId}`);
	}

	return form;
}

export function getReportFieldProperties(): INodeProperties[] {
	// First pass: collect every form that uses each merged field (fields sharing a merge key have
	// identical name/required/visibleWhen). Second pass builds one property per key with the full
	// reportForm list, so there is no read-back-and-mutate step.
	const fieldByKey = new Map<string, ReportField>();
	const formIdsByKey = new Map<string, ReportFormId[]>();
	const orderedKeys: string[] = [];

	for (const form of Object.values(reportForms)) {
		for (const formField of form.fields) {
			const propertyKey = getPropertyMergeKey(formField);
			const formIds = formIdsByKey.get(propertyKey);
			if (formIds) {
				formIds.push(form.id);
				continue;
			}

			fieldByKey.set(propertyKey, formField);
			formIdsByKey.set(propertyKey, [form.id]);
			orderedKeys.push(propertyKey);
		}
	}

	return orderedKeys.map((propertyKey) => {
		const formField = fieldByKey.get(propertyKey) as ReportField;
		const show = {
			reportForm: formIdsByKey.get(propertyKey) as ReportFormId[],
			...(formField.alwaysVisible === true ? {} : (formField.visibleWhen ?? {})),
		};

		return createReportFieldProperty(formField, { show });
	});
}

function createReportFieldProperty(
	formField: ReportField,
	displayOptions?: INodeProperties['displayOptions'],
): INodeProperties {
	const property: INodeProperties = {
		displayName: formField.displayName,
		name: formField.name,
		type: getNodePropertyType(formField.type),
		default: getDefaultValue(formField),
		description: formField.description,
		displayOptions,
		...(formField.required === true ? { required: true } : {}),
	};

	if (formField.type === 'boolean') {
		property.options = booleanOptions;
	}

	if (formField.type === 'yesNo') {
		property.options = validatedYesNoOptions;
	}

	if (formField.type === 'multiOptions' || formField.type === 'options') {
		property.options = formField.options ?? [];
	}

	const typeOptions: NonNullable<INodeProperties['typeOptions']> = {};

	if (formField.type === 'string' && formField.rows !== undefined) {
		typeOptions.rows = formField.rows;
	}

	if (Object.keys(typeOptions).length > 0) {
		property.typeOptions = typeOptions;
	}

	return property;
}

function getPropertyMergeKey(formField: ReportField): string {
	return JSON.stringify({
		name: formField.name,
		required: formField.required === true,
		visibleWhen: formField.visibleWhen ?? {},
	});
}

function getDefaultValue(formField: ReportField): string | boolean | string[] {
	if (formField.default !== undefined) {
		return formField.default;
	}

	if (formField.type === 'multiOptions') {
		return [];
	}

	if (formField.type === 'yesNo') {
		return noValue;
	}

	if (formField.type === 'boolean') {
		return false;
	}

	if (formField.type === 'toggle') {
		return false;
	}

	return '';
}

function getNodePropertyType(fieldType: ReportFieldType): INodeProperties['type'] {
	if (fieldType === 'toggle') {
		return 'boolean';
	}

	if (fieldType === 'boolean' || fieldType === 'yesNo') {
		return 'options';
	}

	return fieldType;
}
