import { tryToParseDateTime, type IDataObject } from 'n8n-workflow';

import type { ReportField, ReportForm } from './reportForms';
import {
	isThreatCategoryForThreat,
	normalizeThreatCategoryValue,
	normalizeThreatValue,
} from './reportOptions';

export type PayloadValue = string | boolean | number | string[] | Date | null | undefined;

export type PayloadInput = Record<string, PayloadValue>;

export type PayloadBuildOptions = {
	now?: Date;
	includedFields?: readonly string[];
	includeFixedFields?: boolean;
};

export type PayloadValidationResult = {
	valid: boolean;
	errors: string[];
};

type OneOfRequirement = {
	fields: readonly string[];
	message: string;
};

type RequiredField = {
	name: string;
	message?: string;
};

const lithuanianTimeZone = 'Europe/Vilnius';
const dateTimeFormat = "yyyy-MM-dd'T'HH:mm:ss";

export function buildReportPayload(
	form: ReportForm,
	input: PayloadInput,
	validateRequiredFields: boolean,
	options: PayloadBuildOptions = {},
): IDataObject {
	const includedFields =
		options.includedFields === undefined ? undefined : new Set(options.includedFields);
	const resolvedInput = resolvePayloadInput(form, input, includedFields);
	const payload: IDataObject = options.includeFixedFields === false ? {} : { ...form.fixedFields };

	for (const field of form.fields) {
		if (!shouldSerializeField(field, includedFields, resolvedInput)) {
			continue;
		}

		const payloadName = getPayloadName(field);
		const value = normalizePayloadValue(field, resolvedInput[field.name]);
		if (isEmptyValue(value)) {
			continue;
		}

		if (field.type === 'multiOptions') {
			applySelectedOptions(payload, value, field.optionFields ?? []);
			continue;
		}

		payload[payloadName] =
			field.type === 'dateTime' ? formatDateTime(field, value, options) : value;
	}

	validateThreatCategory(form, payload);

	const validation = validateReportPayload(form, payload, validateRequiredFields);
	if (!validation.valid) {
		throw new Error(formatValidationErrors(validation.errors));
	}

	return payload;
}

function resolvePayloadInput(
	form: ReportForm,
	input: PayloadInput,
	includedFields: Set<string> | undefined,
): PayloadInput {
	const resolvedInput: PayloadInput = { ...input };

	for (const field of form.fields) {
		if (shouldApplyFieldDefault(field, includedFields, resolvedInput)) {
			resolvedInput[field.name] = field.default as PayloadValue;
		}
	}

	return resolvedInput;
}

function shouldApplyFieldDefault(
	field: ReportField,
	includedFields: Set<string> | undefined,
	input: PayloadInput,
): boolean {
	return (
		shouldIncludeFieldInPayload(field, includedFields) &&
		input[field.name] === undefined &&
		field.default !== undefined
	);
}

function shouldSerializeField(
	field: ReportField,
	includedFields: Set<string> | undefined,
	input: PayloadInput,
): boolean {
	return (
		shouldIncludeFieldInPayload(field, includedFields) &&
		field.omitFromPayload !== true &&
		isFieldApplicable(field, input)
	);
}

function shouldIncludeFieldInPayload(
	field: ReportField,
	includedFields: Set<string> | undefined,
): boolean {
	return (
		includedFields === undefined ||
		includedFields.has(field.name) ||
		includedFields.has(getPayloadName(field))
	);
}

export function validateReportPayload(
	form: ReportForm,
	payload: IDataObject,
	validateRequiredFields: boolean,
): PayloadValidationResult {
	const errors: string[] = [];
	const errorSet = new Set<string>();

	validateFieldLengths(form.fields, payload, errors, errorSet);

	if (!validateRequiredFields) {
		return { valid: errors.length === 0, errors };
	}

	const requiredFields = getExpandedRequiredFields(form, payload);

	for (const field of requiredFields.fields.values()) {
		requireValue(
			payload,
			field.name,
			field.message ?? `${getFieldDisplayName(form, field.name)} is required`,
			errors,
			errorSet,
		);
	}

	for (const requirement of requiredFields.oneOf) {
		requireAtLeastOneTrue(payload, requirement.fields, requirement.message, errors, errorSet);
	}

	return { valid: errors.length === 0, errors };
}

function getExpandedRequiredFields(
	form: ReportForm,
	payload: IDataObject,
): { fields: Map<string, RequiredField>; oneOf: OneOfRequirement[] } {
	const fields = new Map<string, RequiredField>();
	const oneOf = new Map<string, OneOfRequirement>();

	for (const field of form.fields) {
		if (field.required === true && field.type !== 'multiOptions') {
			const name = getPayloadName(field);
			fields.set(name, { name });
		}
	}

	if (form.requiredOneOf) {
		addOneOfRequirement(oneOf, form.requiredOneOf.fields, form.requiredOneOf.message);
	}

	let changed = true;
	while (changed) {
		changed = false;

		for (const rule of form.conditionalRequired ?? []) {
			if (payload[rule.when] !== rule.is) {
				continue;
			}

			for (const fieldName of rule.require) {
				const previousSize = fields.size;
				fields.set(fieldName, {
					name: fieldName,
					message: `${getFieldDisplayName(form, fieldName)} is required when ${getFieldDisplayName(form, rule.when)} is ${formatConditionValue(rule.is)}`,
				});
				changed ||= fields.size !== previousSize;
			}

			if (rule.requireOneOf) {
				changed ||=
					addOneOfRequirement(
						oneOf,
						rule.requireOneOf,
						rule.message ?? `At least one of ${rule.requireOneOf.join(', ')} is required`,
					) !== undefined;
			}
		}
	}

	return { fields, oneOf: [...oneOf.values()] };
}

function addOneOfRequirement(
	requirements: Map<string, OneOfRequirement>,
	fields: readonly string[],
	message: string,
): OneOfRequirement | undefined {
	const key = `${message}:${fields.join(',')}`;

	if (requirements.has(key)) {
		return undefined;
	}

	const requirement = { fields, message };
	requirements.set(key, requirement);

	return requirement;
}

function formatValidationErrors(errors: string[]): string {
	if (errors.length === 1) {
		return errors[0];
	}

	return `Missing required fields: ${errors.join('; ')}`;
}

function formatConditionValue(value: string | boolean): string {
	if (value === true) {
		return 'Yes';
	}

	if (value === false) {
		return 'No';
	}

	return value;
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

function normalizePayloadValue(field: ReportField, value: PayloadValue): PayloadValue {
	const payloadName = getPayloadName(field);

	if (payloadName === 'Threat') {
		return normalizeThreatValue(value) ?? value;
	}

	if (payloadName === 'ThreatCategory') {
		return normalizeThreatCategoryValue(value) ?? value;
	}

	return value;
}

function isFieldApplicable(field: ReportField, input: PayloadInput): boolean {
	for (const [name, allowedValues] of Object.entries(field.visibleWhen ?? {})) {
		if (!allowedValues.includes(input[name] as string | boolean)) {
			return false;
		}
	}

	return true;
}

function formatDateTime(
	field: ReportField,
	value: PayloadValue,
	options: PayloadBuildOptions,
): PayloadValue {
	if (value === undefined || value === null) {
		return value;
	}

	try {
		const localWallClockValue = getLithuanianLocalWallClockValue(value);
		// Ivanti stores the submitted timestamp as if it were local time and adds its own offset.
		// Interpret exact string inputs as Lithuania local wall-clock time, stripping any supplied timezone,
		// then subtract the real Lithuania offset (2h or 3h depending on DST) before sending.
		const localDateTime = tryToParseDateTime(localWallClockValue, lithuanianTimeZone);
		if (localDateTime.toFormat(dateTimeFormat) !== localWallClockValue) {
			throw new Error(`${field.displayName} must be a valid date/time`);
		}

		const parsedDateTime = localDateTime.toUTC();
		const now = tryToParseDateTime(options.now ?? new Date(), 'UTC').toUTC();

		if (parsedDateTime.toMillis() > now.toMillis()) {
			const latestAcceptedLocalTime = now.setZone(lithuanianTimeZone).toFormat(dateTimeFormat);
			throw new Error(
				`${field.displayName} cannot be in the future. Latest allowed value is ${latestAcceptedLocalTime}`,
			);
		}

		return parsedDateTime.toFormat(dateTimeFormat);
	} catch (error) {
		if (error instanceof Error && error.message.includes('cannot be in the future')) {
			throw error;
		}

		throw new Error(`${field.displayName} must be a valid date/time`);
	}
}

function getLithuanianLocalWallClockValue(value: PayloadValue): string {
	if (typeof value === 'string') {
		const exactDateTime = getLocalWallClockFromString(value);
		if (exactDateTime !== undefined) {
			return exactDateTime;
		}
	}

	return tryToParseDateTime(value, 'UTC').toUTC().setZone(lithuanianTimeZone).toFormat(dateTimeFormat);
}

function getLocalWallClockFromString(value: string): string | undefined {
	const match = value
		.trim()
		.match(
			/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?(?:\s*(Z|[+-]\d{2}:?\d{2}))?$/,
		);
	if (!match) {
		return undefined;
	}

	const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;

	return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
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

function validateFieldLengths(
	fields: ReportField[],
	payload: IDataObject,
	errors: string[],
	errorSet: Set<string>,
): void {
	for (const field of fields) {
		if (field.maxLength === undefined) {
			continue;
		}

		const value = payload[getPayloadName(field)];
		if (typeof value === 'string' && value.length > field.maxLength) {
			addValidationError(
				errors,
				errorSet,
				`${field.displayName} must be ${field.maxLength} characters or fewer`,
			);
		}
	}
}

function requireValue(
	payload: IDataObject,
	name: string,
	message: string,
	errors: string[],
	errorSet: Set<string>,
): void {
	const value = payload[name];
	if (isEmptyValue(value as PayloadValue)) {
		addValidationError(errors, errorSet, message);
	}
}

function requireAtLeastOneTrue(
	payload: IDataObject,
	names: readonly string[],
	message: string,
	errors: string[],
	errorSet: Set<string>,
): void {
	if (!names.some((name) => payload[name] === true)) {
		addValidationError(errors, errorSet, message);
	}
}

function addValidationError(errors: string[], errorSet: Set<string>, message: string): void {
	if (errorSet.has(message)) {
		return;
	}

	errorSet.add(message);
	errors.push(message);
}

function validateThreatCategory(form: ReportForm, payload: IDataObject): void {
	const threat = payload.Threat;
	const threatCategory = payload.ThreatCategory;

	if (typeof threat !== 'string' || typeof threatCategory !== 'string') {
		return;
	}

	if (!isThreatCategoryForThreat(threat, threatCategory)) {
		throw new Error('Threat Category must match the selected Threat');
	}
}
