import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { INodePropertyOptions } from 'n8n-workflow';

import {
	defaultFormVersion,
	getReportForm,
	getReportFieldProperties,
	noValue,
	reportForms,
	reportFormOptions,
	yesValue,
} from '../nodes/NkscIvanti/actions/securityReport/reportForms';
import {
	getThreatCategoryOptions,
	isThreatCategoryForThreat,
	normalizeThreatCategoryValue,
	normalizeThreatValue,
	threatCategoryGroups,
} from '../nodes/NkscIvanti/actions/securityReport/reportOptions';
import {
	description as insertDescription,
	getPayloadInput,
} from '../nodes/NkscIvanti/actions/securityReport/insert.operation';
import { buildReportPayload } from '../nodes/NkscIvanti/actions/securityReport/payload';
import {
	buildExternalTicketFilter,
	externalTicketIdField,
	extractODataRecords,
} from '../nodes/NkscIvanti/actions/securityReport/search.operation';
import { description as operationDescription } from '../nodes/NkscIvanti/actions/securityReport';
import { NkscIvanti } from '../nodes/NkscIvanti/NkscIvanti.node';

const validMajorIncident = {
	Organization: 'NKSC test organizacija',
	Reporter: 'Test Reporter',
	ReporterEmail: 'reporter@example.com',
	ReporterPhone: '+37060000000',
	ReporterTitle: 'Security Lead',
	XSC_ExternalTicket_RecId: 'EXT-123',
	Summary: 'Didelis incidentas',
	DetectedOn: '2026-04-29T14:30:12.000+03:00',
	ScopeOptions: ['ScopeOption2'],
	InitialReportUpdateYesNo: noValue,
	CyberIncidentReputationYesNo: noValue,
	ImpactToPersonYesNo: noValue,
	CyberIncidentResolvedYesNo: yesValue,
	AffectedServices: 'Paveiktos paslaugos',
	FinancialLossYesNo: noValue,
	ImpactFromThirdPartyYesNo: noValue,
	CyberIncidentRecurrenceYesNo: noValue,
};

const validInitialReporter = {
	Organization: 'NKSC test organizacija',
	Reporter: 'Test Reporter',
	ReporterEmail: 'reporter@example.com',
	ReporterPhone: '+37060000000',
	ReporterTitle: 'Security Lead',
};

const minorIncidentThreatField = reportForms.minorIncident.fields.find(
	(field) => field.name === 'Threat',
);
const malwareThreatOption = minorIncidentThreatField?.options?.find(
	(option) => option.name === '2. Malware',
);
const malwareThreatValue = malwareThreatOption?.value as string;
const malwareCategoryOption = getThreatCategoryOptions().find(
	(option) => option.name === '1. Malware - Advanced Malware',
);
const malwareCategoryValue = malwareCategoryOption?.value as string;
const nearMissIncidentType = reportForms.nearMissIncident.fixedFields.TypeOfCyberIncident as string;

const backendRequiredReporterFields = [
	'Organization',
	'Reporter',
	'ReporterEmail',
	'ReporterPhone',
	'ReporterTitle',
];

test('uses v1 as latest version option', () => {
	assert.equal(defaultFormVersion, 'v1');
});

test('exposes all NKSC report forms', () => {
	assert.deepEqual(
		reportFormOptions.map((option) => option.value),
		['initialWarning', 'majorIncident', 'minorIncident', 'nearMissIncident'],
	);
});

test('rejects unsupported report forms', () => {
	assert.throws(() => getReportForm('unsupportedForm'), /Unsupported NKSC report form/);
});

test('builds a major incident payload with fixed incident type', () => {
	const payload = buildReportPayload(reportForms.majorIncident, validMajorIncident, true);

	assert.equal(payload.TypeOfCyberIncident, 'Didelis');
	assert.equal(payload.Summary, 'Didelis incidentas');
	assert.equal(payload.DetectedOn, '2026-04-29T11:30:12');
	assert.equal(payload.ScopeOption2, true);
	assert.equal(payload.ScopeOption1, false);
	assert.equal(payload.ScopeOptions, undefined);
	assert.equal(payload.InitialReportUpdateYesNo, noValue);
	assert.equal(payload.CyberIncidentResolvedYesNo, yesValue);
	assert.equal(payload.XSC_ExternalTicket_RecId, 'EXT-123');
});

test('subtracts the fixed n8n date picker offset before sending date/time fields', () => {
	const payload = buildReportPayload(
		reportForms.majorIncident,
		{
			...validMajorIncident,
			DetectedOn: '2026-05-05 03:00:00',
		},
		true,
	);

	assert.equal(payload.DetectedOn, '2026-05-05T00:00:00');
});

test('preserves explicit timezone offsets when serializing date/time fields', () => {
	const payload = buildReportPayload(
		reportForms.majorIncident,
		{
			...validMajorIncident,
			DetectedOn: '2026-04-29T14:30:12+05:30',
		},
		true,
	);

	assert.equal(payload.DetectedOn, '2026-04-29T09:00:12');
});

test('rejects future date/time field values', () => {
	assert.throws(
		() =>
			buildReportPayload(
				reportForms.majorIncident,
				{
					...validMajorIncident,
					DetectedOn: '2026-05-19T15:00:01Z',
				},
				true,
				{
					now: new Date('2026-05-19T12:00:00Z'),
				},
			),
		/Detected On cannot be in the future/,
	);
});

test('rejects invalid exact date/time field values', () => {
	assert.throws(
		() =>
			buildReportPayload(
				reportForms.majorIncident,
				{
					...validMajorIncident,
					DetectedOn: '2026-02-30 00:00:00',
				},
				true,
			),
		/Detected On must be a valid date\/time/,
	);
});

test('omits external ticket ID when it is empty', () => {
	const payload = buildReportPayload(
		reportForms.majorIncident,
		{
			...validMajorIncident,
			XSC_ExternalTicket_RecId: '',
		},
		true,
	);

	assert.equal(payload.XSC_ExternalTicket_RecId, undefined);
});

test('does not expose Not Set in boolean field options', () => {
	const booleanProperties = getReportFieldProperties().filter(
		(property) =>
			property.type === 'options' &&
			(property.options as INodePropertyOptions[] | undefined)?.some(
				(option) => option.value === yesValue,
			),
	);

	for (const property of booleanProperties) {
		assert.deepEqual(
			(property.options as INodePropertyOptions[] | undefined)?.map((option) => option.name),
			['Yes', 'No'],
			`${property.name} should only expose Yes and No`,
		);
	}
});

test('generates fallback n8n properties for field types without explicit defaults', () => {
	const originalFields = reportForms.initialWarning.fields;
	const fallbackFields = [
		{
			displayName: 'Fallback Multi',
			name: 'FallbackMulti',
			type: 'multiOptions',
			description: 'Coverage-only multi-select field',
		},
		{
			displayName: 'Fallback Yes No',
			name: 'FallbackYesNo',
			type: 'yesNo',
			description: 'Coverage-only Taip/Ne field',
		},
		{
			displayName: 'Fallback Boolean',
			name: 'FallbackBoolean',
			type: 'boolean',
			description: 'Coverage-only true/false field',
		},
		{
			displayName: 'Fallback Toggle',
			name: 'FallbackToggle',
			type: 'toggle',
			description: 'Coverage-only UI toggle field',
		},
		{
			displayName: 'Fallback Options',
			name: 'FallbackOptions',
			type: 'options',
			description: 'Coverage-only options field',
		},
		{
			displayName: 'Fallback Date',
			name: 'FallbackDate',
			type: 'dateTime',
			description: 'Coverage-only date field',
		},
		{
			displayName: 'Always Visible Field',
			name: 'AlwaysVisibleField',
			type: 'string',
			description: 'Coverage-only field with ignored conditional visibility',
			visibleWhen: { FallbackToggle: [true] },
			alwaysVisible: true,
		},
	] satisfies typeof reportForms.initialWarning.fields;

	try {
		reportForms.initialWarning.fields = [...originalFields, ...fallbackFields];
		const properties = getReportFieldProperties();
		const propertyByName = new Map(properties.map((property) => [property.name, property]));

		assert.deepEqual(propertyByName.get('FallbackMulti')?.default, []);
		assert.deepEqual(propertyByName.get('FallbackMulti')?.options, []);
		assert.equal(propertyByName.get('FallbackYesNo')?.default, noValue);
		assert.deepEqual(
			(propertyByName.get('FallbackYesNo')?.options as INodePropertyOptions[] | undefined)?.map(
				(option) => option.value,
			),
			[yesValue, noValue],
		);
		assert.equal(propertyByName.get('FallbackBoolean')?.default, false);
		assert.deepEqual(
			(propertyByName.get('FallbackBoolean')?.options as INodePropertyOptions[] | undefined)?.map(
				(option) => option.value,
			),
			[true, false],
		);
		assert.equal(propertyByName.get('FallbackToggle')?.type, 'boolean');
		assert.equal(propertyByName.get('FallbackToggle')?.default, false);
		assert.deepEqual(propertyByName.get('FallbackOptions')?.options, []);
		assert.equal(propertyByName.get('FallbackDate')?.default, '');
		assert.deepEqual(propertyByName.get('AlwaysVisibleField')?.displayOptions?.show, {
			reportForm: ['initialWarning'],
		});
	} finally {
		reportForms.initialWarning.fields = originalFields;
	}
});

test('uses numbered English labels and Lithuanian values for threat options', () => {
	const threatProperty = getReportFieldProperties().find((property) => property.name === 'Threat');
	const malwareOption = (threatProperty?.options as INodePropertyOptions[] | undefined)?.find(
		(option) => option.name === '2. Malware',
	);

	assert.equal(malwareOption?.name, '2. Malware');
	assert.equal(malwareOption?.value, malwareThreatValue);
	assert.notEqual(malwareOption?.name, malwareOption?.value);
});

test('marks required-by-default report fields as required in the n8n UI', () => {
	const fieldProperties = getReportFieldProperties();

	for (const form of Object.values(reportForms)) {
		for (const formField of form.fields) {
			const matchingProperties = fieldProperties.filter(
				(property) =>
					property.name === formField.name &&
					((property.displayOptions?.show?.reportForm as string[] | undefined) ?? []).includes(
						form.id,
					),
			);

			assert.equal(
				matchingProperties.length,
				1,
				`${form.id}.${formField.name} should have one visible n8n property`,
			);
			assert.equal(
				matchingProperties[0]?.required === true,
				formField.required === true,
				`${form.id}.${formField.name} required marker should match the form definition`,
			);
		}
	}
});

test('matches audited required-by-default fields from NKSC HTML forms', () => {
	const htmlRequiredFieldsByForm = {
		initialWarning: ['Summary', 'CriminalOffenceYesNo', 'CyberIncidentResolvedHelpYesNo'],
		majorIncident: [
			'Summary',
			'ScopeOptions',
			'InitialReportUpdateYesNo',
			'CyberIncidentReputationYesNo',
			'ImpactToPersonYesNo',
			'CyberIncidentResolvedYesNo',
			'AffectedServices',
			'FinancialLossYesNo',
			'ImpactFromThirdPartyYesNo',
			'CyberIncidentRecurrenceYesNo',
		],
		minorIncident: [
			'Summary',
			'ImpactToPersonYesNo',
			'CyberIncidentResolvedYesNo',
			'CriminalOffenceYesNo',
			'AffectedServices',
			'FinancialLossYesNo',
			'ImpactFromThirdPartyYesNo',
			'CyberIncidentResolvedHelpYesNo',
			'CyberIncidentReportedYesNo',
			'FinalReportUpdateYesNo',
		],
		nearMissIncident: ['Summary', 'DetailReportDescription'],
	};

	for (const [formId, htmlRequiredFields] of Object.entries(htmlRequiredFieldsByForm)) {
		const form = reportForms[formId as keyof typeof reportForms];
		const requiredFieldNames = form.fields
			.filter((field) => field.required === true)
			.map((field) => field.name);

		assert.deepEqual(requiredFieldNames, [...backendRequiredReporterFields, ...htmlRequiredFields]);
	}
});

test('keeps Taip/Ne fields distinct from true/false option flags', () => {
	const payload = buildReportPayload(reportForms.majorIncident, validMajorIncident, true);

	assert.equal(payload.InitialReportUpdateYesNo, noValue);
	assert.equal(payload.CyberIncidentResolvedYesNo, yesValue);
	assert.equal(payload.ScopeOption1, false);
	assert.equal(payload.ScopeOption2, true);
});

test('does not hide conditional fields behind Yes/No toggles', () => {
	const conditionalFieldNames = [
		'CyberIncidentReputationValue',
		'AffectedPersons',
		'CyberIncidentResolvedValue',
		'FinancialLossValue',
		'ImpactFromThirdPartyValue',
		'CyberIncidentResolvedHelpValue',
		'CyberIncidentReportedValue',
		'IntergovernmentalImpactValue',
	];

	for (const property of getReportFieldProperties()) {
		if (conditionalFieldNames.includes(property.name)) {
			assert.deepEqual(Object.keys(property.displayOptions?.show ?? {}), ['reportForm']);
		}
	}
});

test('expands scope and loss options behind boolean toggles', () => {
	const fieldProperties = getReportFieldProperties();
	const scopeOptionsProperty = fieldProperties.find((property) => property.name === 'ScopeOptions');
	const scopeToggleProperty = fieldProperties.find((property) => property.name === 'ScopeOption1');
	const lossOptionsProperty = fieldProperties.find((property) => property.name === 'LossOptions');
	const lossToggleProperty = fieldProperties.find((property) => property.name === 'LossOption1');

	assert.equal(scopeOptionsProperty?.displayOptions?.show?.ScopeOptionsExpanded?.[0], false);
	assert.equal(scopeToggleProperty?.displayOptions?.show?.ScopeOptionsExpanded?.[0], true);
	assert.equal(lossOptionsProperty?.displayOptions?.show?.LossOptionsExpanded?.[0], false);
	assert.equal(lossToggleProperty?.displayOptions?.show?.LossOptionsExpanded?.[0], true);
	assert.equal(scopeOptionsProperty?.type, 'multiOptions');
	assert.equal(scopeToggleProperty?.type, 'boolean');
});

test('omits expansion toggles from the Ivanti payload', () => {
	const payload = buildReportPayload(reportForms.majorIncident, validMajorIncident, true);

	assert.equal(payload.ScopeOptionsExpanded, undefined);
	assert.equal(payload.LossOptionsExpanded, undefined);
});

test('keeps field visibility scoped to the selected report form after operation wrapping', () => {
	const detailReportProperty = insertDescription.find(
		(property) => property.name === 'DetailReportDescription',
	);
	const scopeOptionsProperty = insertDescription.find(
		(property) => property.name === 'ScopeOptions',
	);
	const externalTicketProperty = insertDescription.find(
		(property) => property.name === externalTicketIdField,
	);

	assert.deepEqual(detailReportProperty?.displayOptions?.show?.reportForm, ['nearMissIncident']);
	assert.deepEqual(scopeOptionsProperty?.displayOptions?.show?.reportForm, ['majorIncident']);
	assert.deepEqual(externalTicketProperty?.displayOptions?.show?.reportForm, [
		'initialWarning',
		'majorIncident',
		'minorIncident',
		'nearMissIncident',
	]);
});

test('orders visible production fields logically', () => {
	const fieldNames = getReportFieldProperties().map((property) => property.name);

	assert.deepEqual(fieldNames.slice(0, 5), [
		'Organization',
		'Reporter',
		'ReporterEmail',
		'ReporterPhone',
		'ReporterTitle',
	]);
	assert.ok(fieldNames.indexOf('XSC_ExternalTicket_RecId') < fieldNames.indexOf('Summary'));
	assert.ok(fieldNames.indexOf('Evidence') < fieldNames.indexOf('ImpactToPersonYesNo'));
});

test('exposes search operation', () => {
	const operationProperty = operationDescription.find((property) => property.name === 'operation');
	const optionValues = (operationProperty?.options as INodePropertyOptions[] | undefined)?.map(
		(option) => option.value,
	);

	assert.deepEqual(optionValues, ['insert', 'update', 'search']);
});

test('hides form version for search because versions are local to the node', () => {
	const formVersionProperty = new NkscIvanti().description.properties.find(
		(property) => property.name === 'formVersion',
	);

	assert.deepEqual(formVersionProperty?.displayOptions?.hide?.operation, ['search']);
});

test('shows operation before report selection', () => {
	const propertyNames = new NkscIvanti().description.properties.map((property) => property.name);

	assert.deepEqual(propertyNames.slice(0, 3), ['operation', 'reportForm', 'formVersion']);
});

test('builds external ticket search filter with OData escaping', () => {
	assert.equal(buildExternalTicketFilter(" EXT-'123 "), "XSC_ExternalTicket_RecId eq 'EXT-''123'");
});

test('extracts all matching records from OData search responses', () => {
	const records = extractODataRecords({
		'@odata.context': 'metadata',
		value: [
			{ RecId: 'newsrv1', '@odata.context': 'metadata' },
			{ RecId: 'newsrv2', '@odata.context': 'metadata' },
		],
	});

	assert.deepEqual(records, [{ RecId: 'newsrv1' }, { RecId: 'newsrv2' }]);
});

test('extracts a single OData object response without mutating it', () => {
	const response = { '@odata.context': 'metadata', RecId: 'newsrv1' };

	const records = extractODataRecords(response);

	assert.deepEqual(records, [{ RecId: 'newsrv1' }]);
	assert.deepEqual(response, { '@odata.context': 'metadata', RecId: 'newsrv1' });
});

test('requires one scope option for major incident insert validation', () => {
	assert.throws(
		() =>
			buildReportPayload(
				reportForms.majorIncident,
				{
					...validMajorIncident,
					ScopeOptions: [],
				},
				true,
			),
		/At least one Scope Option must be selected/,
	);
});

test('reports all missing required fields at once', () => {
	assert.throws(
		() =>
			buildReportPayload(
				reportForms.majorIncident,
				{
					Organization: 'NKSC test organizacija',
					ScopeOptions: ['ScopeOption2'],
				},
				true,
			),
		(error) =>
			error instanceof Error &&
			error.message.includes('Missing required fields:') &&
			error.message.includes('Reporter is required') &&
			error.message.includes('Reporter Email is required') &&
			error.message.includes('Reporter Phone is required') &&
			error.message.includes('Reporter Title is required') &&
			error.message.includes('Summary is required'),
	);
});

test('continues collecting payload input when n8n parameter reads throw for missing fields', () => {
	const parameters = {
		Organization: 'NKSC test organizacija',
		ScopeOptions: ['ScopeOption2'],
	};
	const context = {
		getNodeParameter(name: string) {
			if (Object.hasOwn(parameters, name)) {
				return parameters[name as keyof typeof parameters];
			}

			throw new Error(`${name} is missing`);
		},
	};

	const payloadInput = getPayloadInput.call(
		context as Parameters<typeof getPayloadInput.call>[0],
		0,
		reportForms.majorIncident,
	);

	assert.throws(
		() => buildReportPayload(reportForms.majorIncident, payloadInput, true),
		(error) =>
			error instanceof Error &&
			error.message.includes('Reporter is required') &&
			error.message.includes('Reporter Email is required') &&
			error.message.includes('Summary is required'),
	);
});

test('requires conditional fields when toggles are selected', () => {
	assert.throws(
		() =>
			buildReportPayload(
				reportForms.majorIncident,
				{
					...validMajorIncident,
					ImpactToPersonYesNo: yesValue,
				},
				true,
			),
		(error) =>
			error instanceof Error &&
			error.message.includes('At least one Loss Option must be selected') &&
			error.message.includes('Affected Persons is required when Impact To Persons is Taip'),
	);
});

test('reports conditional fields only when their controller has the matching value', () => {
	assert.throws(
		() =>
			buildReportPayload(
				reportForms.minorIncident,
				{
					...validInitialReporter,
					Summary: 'Nedidelis incidentas',
					ImpactToPersonYesNo: noValue,
					CyberIncidentResolvedYesNo: yesValue,
					CriminalOffenceYesNo: noValue,
					AffectedServices: 'Paslaugos',
					FinancialLossYesNo: noValue,
					ImpactFromThirdPartyYesNo: noValue,
					CyberIncidentResolvedHelpYesNo: noValue,
					CyberIncidentReportedYesNo: noValue,
					FinalReportUpdateYesNo: noValue,
				},
				true,
			),
		(error) =>
			error instanceof Error &&
			error.message.includes('Threat is required') &&
			error.message.includes('Cyber Incident Impact is required') &&
			error.message.includes('Cyber Incident Mitigation is required') &&
			!error.message.includes('Threat Category is required'),
	);
});

test('does not require dependent details when a required Yes/No controller is missing', () => {
	assert.throws(
		() =>
			buildReportPayload(
				reportForms.majorIncident,
				{
					...validMajorIncident,
					CyberIncidentReputationYesNo: '',
				},
				true,
			),
		(error) =>
			error instanceof Error &&
			error.message.includes('Reputation Impact is required') &&
			!error.message.includes('Reputation Impact Details is required'),
	);
});

test('keeps visible conditional values even when controlling field is No', () => {
	const payload = buildReportPayload(
		reportForms.majorIncident,
		{
			...validMajorIncident,
			CyberIncidentReputationValue: 'provided reputation detail',
			ImpactToPersonYesNo: noValue,
			LossOptions: ['LossOption1'],
			AffectedPersons: 'provided affected persons',
			CyberIncidentResolvedValue: 'provided resolution plan',
			FinancialLossValue: 'provided financial loss',
			ImpactFromThirdPartyValue: 'provided third party',
		},
		true,
	);

	assert.equal(payload.CyberIncidentReputationValue, 'provided reputation detail');
	assert.equal(payload.LossOption1, true);
	assert.equal(payload.AffectedPersons, 'provided affected persons');
	assert.equal(payload.CyberIncidentResolvedValue, 'provided resolution plan');
	assert.equal(payload.FinancialLossValue, 'provided financial loss');
	assert.equal(payload.ImpactFromThirdPartyValue, 'provided third party');
});

test('builds initial warning payload against initial reports object', () => {
	const payload = buildReportPayload(
		reportForms.initialWarning,
		{
			Summary: 'Ankstyvas perspejimas',
			...validInitialReporter,
			CriminalOffenceYesNo: noValue,
			CyberIncidentResolvedHelpYesNo: noValue,
		},
		true,
	);

	assert.equal(reportForms.initialWarning.objectName, 'XSC_SecurityReport__InitialReports');
	assert.equal(payload.Summary, 'Ankstyvas perspejimas');
	assert.equal(payload.Organization, validInitialReporter.Organization);
	assert.equal(payload.CriminalOffenceYesNo, noValue);
	assert.equal(payload.TypeOfCyberIncident, undefined);
});

test('builds minor incident payload with fixed incident type', () => {
	const payload = buildReportPayload(
		reportForms.minorIncident,
		{
			...validInitialReporter,
			Summary: 'Nedidelis incidentas',
			ImpactToPersonYesNo: noValue,
			CyberIncidentResolvedYesNo: yesValue,
			CriminalOffenceYesNo: noValue,
			AffectedServices: 'Paslaugos',
			FinancialLossYesNo: noValue,
			ImpactFromThirdPartyYesNo: noValue,
			CyberIncidentResolvedHelpYesNo: noValue,
			CyberIncidentReportedYesNo: noValue,
			FinalReportUpdateYesNo: yesValue,
			Threat: malwareThreatValue,
			ThreatCategory: malwareCategoryValue,
		},
		true,
	);

	assert.equal(payload.TypeOfCyberIncident, 'Nedidelis');
	assert.equal(payload.Threat, malwareThreatValue);
	assert.equal(payload.ThreatCategory, malwareCategoryValue);
});

test('normalizes English threat and category aliases from expressions', () => {
	const payload = buildReportPayload(
		reportForms.minorIncident,
		{
			...validInitialReporter,
			Summary: 'Nedidelis incidentas',
			ImpactToPersonYesNo: noValue,
			CyberIncidentResolvedYesNo: yesValue,
			CriminalOffenceYesNo: noValue,
			AffectedServices: 'Paslaugos',
			FinancialLossYesNo: noValue,
			ImpactFromThirdPartyYesNo: noValue,
			CyberIncidentResolvedHelpYesNo: noValue,
			CyberIncidentReportedYesNo: noValue,
			FinalReportUpdateYesNo: yesValue,
			Threat: 'Malware',
			ThreatCategory: 'Malware - Advanced Malware',
		},
		true,
	);

	assert.equal(payload.Threat, malwareThreatValue);
	assert.equal(payload.ThreatCategory, malwareCategoryValue);
});

test('normalizes numeric threat and category aliases from expressions', () => {
	const payload = buildReportPayload(
		reportForms.minorIncident,
		{
			...validInitialReporter,
			Summary: 'Nedidelis incidentas',
			ImpactToPersonYesNo: noValue,
			CyberIncidentResolvedYesNo: yesValue,
			CriminalOffenceYesNo: noValue,
			AffectedServices: 'Paslaugos',
			FinancialLossYesNo: noValue,
			ImpactFromThirdPartyYesNo: noValue,
			CyberIncidentResolvedHelpYesNo: noValue,
			CyberIncidentReportedYesNo: noValue,
			FinalReportUpdateYesNo: yesValue,
			Threat: 2,
			ThreatCategory: 1,
		},
		true,
	);

	assert.equal(payload.Threat, malwareThreatValue);
	assert.equal(payload.ThreatCategory, malwareCategoryValue);
});

test('normalizes threat and category expression inputs defensively', () => {
	assert.equal(normalizeThreatValue(` 2. Malware `), malwareThreatValue);
	assert.equal(normalizeThreatValue(malwareThreatValue), malwareThreatValue);
	assert.equal(normalizeThreatValue(Number.POSITIVE_INFINITY), undefined);
	assert.equal(normalizeThreatValue({}), undefined);
	assert.equal(normalizeThreatValue('Unknown Threat'), undefined);

	assert.equal(normalizeThreatCategoryValue('Advanced Malware'), malwareCategoryValue);
	assert.equal(normalizeThreatCategoryValue(malwareCategoryValue), malwareCategoryValue);
	assert.equal(normalizeThreatCategoryValue('0'), '');
	assert.equal(normalizeThreatCategoryValue({}), undefined);
	assert.equal(normalizeThreatCategoryValue('Unknown Category'), undefined);

	assert.equal(isThreatCategoryForThreat('Malware', 'Advanced Malware'), true);
	assert.equal(isThreatCategoryForThreat('Unknown Threat', malwareCategoryValue), false);
});

test('omits the none threat category option from payload', () => {
	const payload = buildReportPayload(
		reportForms.minorIncident,
		{
			...validInitialReporter,
			Summary: 'Nedidelis incidentas',
			ImpactToPersonYesNo: noValue,
			CyberIncidentResolvedYesNo: yesValue,
			CriminalOffenceYesNo: noValue,
			AffectedServices: 'Paslaugos',
			FinancialLossYesNo: noValue,
			ImpactFromThirdPartyYesNo: noValue,
			CyberIncidentResolvedHelpYesNo: noValue,
			CyberIncidentReportedYesNo: noValue,
			FinalReportUpdateYesNo: yesValue,
			Threat: 1,
			ThreatCategory: 0,
		},
		true,
	);

	assert.equal(payload.Threat, minorIncidentThreatField?.options?.[0]?.value);
	assert.equal(payload.ThreatCategory, undefined);
});

test('allows final report update without threat fields for minor incident', () => {
	const payload = buildReportPayload(
		reportForms.minorIncident,
		{
			...validInitialReporter,
			Summary: 'Nedidelis incidentas',
			ImpactToPersonYesNo: noValue,
			CyberIncidentResolvedYesNo: yesValue,
			CriminalOffenceYesNo: noValue,
			AffectedServices: 'Paslaugos',
			FinancialLossYesNo: noValue,
			ImpactFromThirdPartyYesNo: noValue,
			CyberIncidentResolvedHelpYesNo: noValue,
			CyberIncidentReportedYesNo: noValue,
			FinalReportUpdateYesNo: yesValue,
		},
		true,
	);

	assert.equal(payload.FinalReportUpdateYesNo, yesValue);
	assert.equal(payload.Threat, undefined);
	assert.equal(payload.ThreatCategory, undefined);
});

test('requires threat category when category-backed threat is selected', () => {
	assert.throws(
		() =>
			buildReportPayload(
				reportForms.minorIncident,
				{
					...validInitialReporter,
					Summary: 'Nedidelis incidentas',
					ImpactToPersonYesNo: noValue,
					CyberIncidentResolvedYesNo: yesValue,
					CriminalOffenceYesNo: noValue,
					AffectedServices: 'Paslaugos',
					FinancialLossYesNo: noValue,
					ImpactFromThirdPartyYesNo: noValue,
					CyberIncidentResolvedHelpYesNo: noValue,
					CyberIncidentReportedYesNo: noValue,
					FinalReportUpdateYesNo: yesValue,
					Threat: malwareThreatValue,
				},
				true,
			),
		/Threat Category is required/,
	);
});

test('rejects threat category values that do not match the selected threat', () => {
	const differentThreatCategoryValue = threatCategoryGroups.find(
		(group) => group.threat !== malwareThreatValue,
	)?.options[0]?.value as string;

	assert.throws(
		() =>
			buildReportPayload(
				reportForms.minorIncident,
				{
					...validInitialReporter,
					Summary: 'Nedidelis incidentas',
					ImpactToPersonYesNo: noValue,
					CyberIncidentResolvedYesNo: yesValue,
					CriminalOffenceYesNo: noValue,
					AffectedServices: 'Paslaugos',
					FinancialLossYesNo: noValue,
					ImpactFromThirdPartyYesNo: noValue,
					CyberIncidentResolvedHelpYesNo: noValue,
					CyberIncidentReportedYesNo: noValue,
					FinalReportUpdateYesNo: yesValue,
					Threat: malwareThreatValue,
					ThreatCategory: differentThreatCategoryValue,
				},
				true,
			),
		/Threat Category must match the selected Threat/,
	);
});

test('keeps final report update selectable', () => {
	const finalReportUpdateProperty = getReportFieldProperties().find(
		(property) => property.name === 'FinalReportUpdateYesNo',
	);

	assert.equal(finalReportUpdateProperty?.default, noValue);
	assert.deepEqual(
		(finalReportUpdateProperty?.options as INodePropertyOptions[] | undefined)?.map(
			(option) => option.value,
		),
		[yesValue, noValue],
	);
});

test('exposes one all-category threat category field while payload rules stay conditional', () => {
	const threatCategoryProperties = getReportFieldProperties().filter(
		(property) => property.displayName === 'Threat Category',
	);
	const threatCategoryProperty = threatCategoryProperties[0];

	assert.equal(threatCategoryProperties.length, 1);
	assert.equal(threatCategoryProperty?.name, 'ThreatCategory');
	assert.equal(threatCategoryProperty?.displayOptions?.show?.Threat, undefined);
	assert.deepEqual(threatCategoryProperty?.displayOptions?.show?.reportForm, ['minorIncident']);
	assert.deepEqual((threatCategoryProperty?.options as INodePropertyOptions[] | undefined)?.[0], {
		name: '0. None',
		value: '',
		description: 'No Threat Category',
	});
	assert.deepEqual(
		(threatCategoryProperty?.options as INodePropertyOptions[] | undefined)?.map(
			(option) => option.name,
		),
		getThreatCategoryOptions().map((option) => option.name),
	);
	assert.equal(threatCategoryProperty?.typeOptions?.loadOptionsMethod, undefined);
});

test('builds near miss payload with fixed incident type', () => {
	const payload = buildReportPayload(
		reportForms.nearMissIncident,
		{
			...validInitialReporter,
			Summary: 'Vos neivyko',
			DetailReportDescription: 'Pranesimas',
		},
		true,
	);

	assert.equal(payload.TypeOfCyberIncident, nearMissIncidentType);
	assert.equal(payload.DetailReportDescription, 'Pranesimas');
});

test('allows partial update payloads when full validation is disabled', () => {
	const payload = buildReportPayload(
		reportForms.majorIncident,
		{
			Summary: 'Tik pavadinimo atnaujinimas',
		},
		false,
	);

	assert.deepEqual(payload, {
		TypeOfCyberIncident: 'Didelis',
		Summary: 'Tik pavadinimo atnaujinimas',
		InitialReportUpdateYesNo: noValue,
		CyberIncidentReputationYesNo: noValue,
		ImpactToPersonYesNo: noValue,
		CyberIncidentResolvedYesNo: noValue,
		FinancialLossYesNo: noValue,
		ImpactFromThirdPartyYesNo: noValue,
		CyberIncidentRecurrenceYesNo: noValue,
	});
});

test('enforces max length validation on insert payloads', () => {
	assert.throws(
		() =>
			buildReportPayload(
				reportForms.majorIncident,
				{
					...validMajorIncident,
					Summary: 'x'.repeat(256),
				},
				true,
			),
		/Summary must be 255 characters or fewer/,
	);
});

test('enforces max length validation on partial update payloads', () => {
	assert.throws(
		() =>
			buildReportPayload(
				reportForms.majorIncident,
				{
					Summary: 'x'.repeat(256),
				},
				false,
			),
		/Summary must be 255 characters or fewer/,
	);
});

test('allows max length boundary values', () => {
	const payload = buildReportPayload(
		reportForms.majorIncident,
		{
			...validMajorIncident,
			Summary: 'x'.repeat(255),
		},
		true,
	);

	assert.equal(payload.Summary, 'x'.repeat(255));
});
