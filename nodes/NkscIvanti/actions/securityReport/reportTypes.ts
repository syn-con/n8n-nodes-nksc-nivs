import type { IDataObject, INodePropertyOptions } from 'n8n-workflow';

export const reportFormIds = [
	'initialWarning',
	'majorIncident',
	'minorIncident',
	'nearMissIncident',
] as const;

export const reportFieldTypes = [
	'string',
	'dateTime',
	'boolean',
	'toggle',
	'yesNo',
	'multiOptions',
	'options',
] as const;

export type ReportFormId =
	(typeof reportFormIds)[number];

export type ReportFieldType =
	(typeof reportFieldTypes)[number];

export type ReportField = {
	displayName: string;
	name: string;
	payloadName?: string;
	type: ReportFieldType;
	default?: string | boolean | string[];
	description: string;
	required?: boolean;
	maxLength?: number;
	rows?: number;
	options?: INodePropertyOptions[];
	optionFields?: readonly string[];
	visibleWhen?: Record<string, Array<string | boolean>>;
	alwaysVisible?: boolean;
	omitFromPayload?: boolean;
};

export type ConditionalRequiredRule = {
	when: string;
	is: string | boolean;
	require: string[];
	requireOneOf?: readonly string[];
	message?: string;
};

export type ReportForm = {
	id: ReportFormId;
	displayName: string;
	objectName: string;
	fixedFields: IDataObject;
	fields: ReportField[];
	requiredOneOf?: {
		fields: readonly string[];
		message: string;
	};
	conditionalRequired?: ConditionalRequiredRule[];
};
