import type { IDataObject } from 'n8n-workflow';

import type { ReportField, ReportForm } from './reportForms';

export type PayloadValue = string | boolean | number | string[] | null | undefined;

export type PayloadInput = Record<string, PayloadValue>;

export type PayloadValidationResult = {
	valid: boolean;
	errors: string[];
};

export function buildReportPayload(
	form: ReportForm,
	input: PayloadInput,
	validateRequiredFields: boolean,
): IDataObject {
	const resolvedInput: PayloadInput = { ...input };
	for (const field of form.fields) {
		if (resolvedInput[field.name] === undefined && field.default !== undefined) {
			resolvedInput[field.name] = field.default as PayloadValue;
		}
	}

	const payload: IDataObject = {
		...form.fixedFields,
	};

	for (const field of form.fields) {
		if (field.omitFromPayload === true) {
			continue;
		}

		if (!isFieldApplicable(field, resolvedInput)) {
			continue;
		}

		const payloadName = getPayloadName(field);
		const value = resolvedInput[field.name];
		if (isEmptyValue(value)) {
			continue;
		}

		if (field.type === 'multiOptions') {
			applySelectedOptions(payload, value, field.optionFields ?? []);
			continue;
		}

		payload[payloadName] = field.type === 'dateTime' ? formatDateTime(value) : value;
	}

	const validation = validateReportPayload(form, payload, validateRequiredFields);
	if (!validation.valid) {
		throw new Error(formatValidationErrors(validation.errors));
	}

	return payload;
}

export function validateReportPayload(
	form: ReportForm,
	payload: IDataObject,
	validateRequiredFields: boolean,
): PayloadValidationResult {
	const errors: string[] = [];

	validateFieldLengths(form.fields, payload, errors);

	if (!validateRequiredFields) {
		return { valid: errors.length === 0, errors };
	}

	for (const field of form.fields) {
		if (field.required === true && field.type !== 'multiOptions') {
			requireValue(payload, getPayloadName(field), field.displayName, errors);
		}
	}

	if (form.requiredOneOf) {
		requireAtLeastOneTrue(payload, form.requiredOneOf.fields, form.requiredOneOf.message, errors);
	}

	for (const rule of form.conditionalRequired ?? []) {
		if (payload[rule.when] !== rule.is) {
			continue;
		}

		for (const fieldName of rule.require) {
			requireValue(payload, fieldName, getFieldDisplayName(form, fieldName), errors);
		}

		if (rule.requireOneOf) {
			requireAtLeastOneTrue(
				payload,
				rule.requireOneOf,
				rule.message ?? `At least one of ${rule.requireOneOf.join(', ')} is required`,
				errors,
			);
		}
	}

	return { valid: errors.length === 0, errors };
}

function formatValidationErrors(errors: string[]): string {
	if (errors.length === 1) {
		return errors[0];
	}

	return `Missing required fields: ${errors.join('; ')}`;
}

function getFieldDisplayName(form: ReportForm, fieldName: string): string {
	return (
		form.fields.find((field) => field.name === fieldName || field.payloadName === fieldName)
			?.displayName ?? fieldName
	);
}

function getPayloadName(field: ReportField): string {
	return field.payloadName ?? field.name;
}

function isFieldApplicable(field: ReportField, input: PayloadInput): boolean {
	for (const [name, allowedValues] of Object.entries(field.visibleWhen ?? {})) {
		if (!allowedValues.includes(input[name] as string | boolean)) {
			return false;
		}
	}

	return true;
}

function formatDateTime(value: PayloadValue): PayloadValue {
	if (typeof value !== 'string') {
		return value;
	}

	return value.trim().slice(0, 19);
}

function isEmptyValue(value: PayloadValue): boolean {
	return (
		value === '' ||
		value === undefined ||
		value === null ||
		(Array.isArray(value) && value.length === 0)
	);
}

function applySelectedOptions(
	payload: IDataObject,
	value: PayloadValue,
	allowedFields: readonly string[],
): void {
	if (!Array.isArray(value)) {
		return;
	}

	for (const field of allowedFields) {
		payload[field] = false;
	}

	for (const selectedField of value) {
		if (allowedFields.includes(selectedField)) {
			payload[selectedField] = true;
		}
	}
}

function validateFieldLengths(fields: ReportField[], payload: IDataObject, errors: string[]): void {
	for (const field of fields) {
		if (field.maxLength === undefined) {
			continue;
		}

		const value = payload[getPayloadName(field)];
		if (typeof value === 'string' && value.length > field.maxLength) {
			errors.push(`${field.displayName} must be ${field.maxLength} characters or fewer`);
		}
	}
}

function requireValue(
	payload: IDataObject,
	name: string,
	displayName: string,
	errors: string[],
): void {
	const value = payload[name];
	if (value === undefined || value === null || value === '') {
		errors.push(`${displayName} is required`);
	}
}

function requireAtLeastOneTrue(
	payload: IDataObject,
	names: readonly string[],
	message: string,
	errors: string[],
): void {
	if (!names.some((name) => payload[name] === true)) {
		errors.push(message);
	}
}
