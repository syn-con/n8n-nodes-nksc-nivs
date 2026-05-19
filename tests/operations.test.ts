import assert from 'node:assert/strict';
import { test, vi } from 'vitest';

import { router } from '../nodes/NkscIvanti/actions/router';
import * as insertOperation from '../nodes/NkscIvanti/actions/securityReport/insert.operation';
import * as searchOperation from '../nodes/NkscIvanti/actions/securityReport/search.operation';
import * as updateOperation from '../nodes/NkscIvanti/actions/securityReport/update.operation';
import { reportForms } from '../nodes/NkscIvanti/actions/securityReport/reportForms';

function createExecuteContext(
	parameters: Record<string, unknown>,
	options?: { continueOnFail?: boolean },
) {
	const httpRequest = vi.fn();
	const getCredentials = vi.fn().mockResolvedValue({
		tenant: 'https://ivanti.example.local/HEAT/api',
		apiKey: 'secret',
	});

	return {
		getInputData: () => [{ json: {} }],
		getNodeParameter(name: string, _itemIndex: number, fallbackValue?: unknown) {
			if (Object.hasOwn(parameters, name)) {
				return parameters[name];
			}

			if (fallbackValue !== undefined) {
				return fallbackValue;
			}

			throw new Error(`${name} is missing`);
		},
		getCredentials,
		getTimezone: () => 'UTC',
		getNode: () => ({ name: 'NKSC Ivanti' }),
		continueOnFail: () => options?.continueOnFail ?? false,
		helpers: {
			httpRequest,
			returnJsonArray(records: unknown) {
				if (Array.isArray(records)) {
					return records.map((json) => ({ json }));
				}

				return [{ json: records }];
			},
			constructExecutionMetaData(items: unknown) {
				return items;
			},
		},
	} as any;
}

test('insert execution posts the selected form payload and returns the sanitized response', async () => {
	const context = createExecuteContext({
		formVersion: 'v1',
		reportForm: 'initialWarning',
		Organization: 'Org',
		Reporter: 'Reporter',
		ReporterEmail: 'reporter@example.com',
		ReporterPhone: '+37060000000',
		ReporterTitle: 'Lead',
		Summary: 'Initial warning',
		CriminalOffenceYesNo: 'Ne',
		CyberIncidentResolvedHelpYesNo: 'Taip',
		CyberIncidentResolvedHelpValue: 'Support provided',
	});
	const httpRequest = context.helpers.httpRequest as ReturnType<typeof vi.fn>;
	httpRequest.mockResolvedValue({
		statusCode: 200,
		body: {
			'@odata.context': 'context',
			RecId: 'new-record',
			Summary: 'Initial warning',
		},
	});

	const result = await insertOperation.execute.call(context);

	assert.deepEqual(result, [{ json: { RecId: 'new-record', Summary: 'Initial warning' } }]);
	assert.equal(httpRequest.mock.calls[0][0].method, 'POST');
	assert.equal(
		httpRequest.mock.calls[0][0].url,
		'https://ivanti.example.local/HEAT/api/odata/businessobject/XSC_SecurityReport__InitialReports',
	);
	assert.equal(httpRequest.mock.calls[0][0].headers.Authorization, 'rest_api_key=secret');
});

test('insert execution returns an error item when continue on fail is enabled', async () => {
	const context = createExecuteContext(
		{
			formVersion: 'v2',
			reportForm: 'initialWarning',
		},
		{ continueOnFail: true },
	);

	const result = await insertOperation.execute.call(context);

	assert.equal(result[0]?.json?.error, 'Unsupported NKSC form version: v2');
});

test('insert execution throws wrapped node errors when continue on fail is disabled', async () => {
	const context = createExecuteContext({
		formVersion: 'v2',
		reportForm: 'initialWarning',
	});

	await assert.rejects(
		() => insertOperation.execute.call(context),
		/Unsupported NKSC form version: v2/,
	);
});

test('insert payload input uses field fallback values when n8n parameters are missing', () => {
	const form = {
		...reportForms.initialWarning,
		fields: [
			{
				displayName: 'Fallback Multi',
				name: 'FallbackMulti',
				type: 'multiOptions',
				description: 'Coverage-only multi-select field',
			},
			{
				displayName: 'Fallback String',
				name: 'FallbackString',
				type: 'string',
				description: 'Coverage-only text field',
			},
			{
				displayName: 'Fallback Default',
				name: 'FallbackDefault',
				type: 'string',
				default: 'default value',
				description: 'Coverage-only defaulted field',
			},
		],
	} as typeof reportForms.initialWarning;
	const context = {
		getNodeParameter() {
			throw new Error('parameter missing');
		},
	};

	const input = insertOperation.getPayloadInput.call(context as any, 0, form);

	assert.deepEqual(input, {
		FallbackMulti: [],
		FallbackString: '',
		FallbackDefault: 'default value',
	});
});

test('insert report form selection wraps unsupported form errors', () => {
	const context = createExecuteContext({
		formVersion: 'v1',
		reportForm: 'unsupportedForm',
	});

	assert.throws(
		() => insertOperation.getSelectedReportForm.call(context, 0),
		/Unsupported NKSC report form: unsupportedForm/,
	);
});

test('insert response sanitizer leaves responses without OData context unchanged', () => {
	const response = { RecId: 'record-1' };

	assert.equal(insertOperation.sanitizeResponse(response), response);
	assert.deepEqual(response, { RecId: 'record-1' });
});

test('update execution patches the selected record', async () => {
	const context = createExecuteContext({
		formVersion: 'v1',
		reportForm: 'majorIncident',
		recordId: 'RID-123',
		validateRequiredFields: false,
		Organization: 'Org',
		Reporter: 'Reporter',
		ReporterEmail: 'reporter@example.com',
		ReporterPhone: '+37060000000',
		ReporterTitle: 'Lead',
		Summary: 'Major incident',
		InitialReportUpdateYesNo: 'Ne',
		CyberIncidentReputationYesNo: 'Ne',
		ImpactToPersonYesNo: 'Ne',
		CyberIncidentResolvedYesNo: 'Ne',
		AffectedServices: 'Affected services',
		FinancialLossYesNo: 'Ne',
		ImpactFromThirdPartyYesNo: 'Ne',
		CyberIncidentRecurrenceYesNo: 'Ne',
	});
	const httpRequest = context.helpers.httpRequest as ReturnType<typeof vi.fn>;
	httpRequest.mockResolvedValue({
		statusCode: 200,
		body: {
			'@odata.context': 'context',
			RecId: 'RID-123',
		},
	});

	const result = await updateOperation.execute.call(context);

	assert.deepEqual(result, [{ json: { RecId: 'RID-123' } }]);
	assert.equal(httpRequest.mock.calls[0][0].method, 'PATCH');
	assert.equal(
		httpRequest.mock.calls[0][0].url,
		"https://ivanti.example.local/HEAT/api/odata/businessobject/XSC_SecurityReport__DetailReports('RID-123')",
	);
});

test('update execution returns an error item when record ID is missing and continue on fail is enabled', async () => {
	const context = createExecuteContext(
		{
			formVersion: 'v1',
			reportForm: 'majorIncident',
			recordId: '',
		},
		{ continueOnFail: true },
	);

	const result = await updateOperation.execute.call(context);

	assert.equal(result[0]?.json?.error, 'Record ID is required');
});

test('search execution returns every matching record', async () => {
	const context = createExecuteContext({
		reportForm: 'minorIncident',
		externalTicketId: 'EXT-123',
	});
	const httpRequest = context.helpers.httpRequest as ReturnType<typeof vi.fn>;
	httpRequest.mockResolvedValue({
		statusCode: 200,
		body: {
			'@odata.context': 'context',
			value: [{ RecId: 'A' }, { RecId: 'B' }],
		},
	});

	const result = await searchOperation.execute.call(context);

	assert.deepEqual(result, [{ json: { RecId: 'A' } }, { json: { RecId: 'B' } }]);
	assert.equal(httpRequest.mock.calls[0][0].method, 'GET');
	assert.deepEqual(httpRequest.mock.calls[0][0].qs, {
		$filter: "XSC_ExternalTicket_RecId eq 'EXT-123'",
	});
	assert.equal(
		httpRequest.mock.calls[0][0].url,
		'https://ivanti.example.local/HEAT/api/odata/businessobject/XSC_SecurityReport__DetailReports',
	);
});

test('search execution returns an error item when the external ticket ID is empty and continue on fail is enabled', async () => {
	const context = createExecuteContext(
		{
			reportForm: 'minorIncident',
			externalTicketId: '   ',
		},
		{ continueOnFail: true },
	);

	const result = await searchOperation.execute.call(context);

	assert.equal(result[0]?.json?.error, 'External Ticket ID is required');
});

test('router dispatches operations and rejects unsupported ones', async () => {
	const insertSpy = vi
		.spyOn(insertOperation, 'execute')
		.mockResolvedValue([{ json: { operation: 'insert' } }]);
	const updateSpy = vi
		.spyOn(updateOperation, 'execute')
		.mockResolvedValue([{ json: { operation: 'update' } }]);
	const searchSpy = vi
		.spyOn(searchOperation, 'execute')
		.mockResolvedValue([{ json: { operation: 'search' } }]);

	try {
		const insertResult = await router.call({
			getNodeParameter: (name: string) => (name === 'operation' ? 'insert' : undefined),
			getNode: () => ({ name: 'NKSC Ivanti' }),
		} as any);
		assert.deepEqual(insertResult, [[{ json: { operation: 'insert' } }]]);
		assert.equal(insertSpy.mock.calls.length, 1);

		const updateResult = await router.call({
			getNodeParameter: (name: string) => (name === 'operation' ? 'update' : undefined),
			getNode: () => ({ name: 'NKSC Ivanti' }),
		} as any);
		assert.deepEqual(updateResult, [[{ json: { operation: 'update' } }]]);
		assert.equal(updateSpy.mock.calls.length, 1);

		const searchResult = await router.call({
			getNodeParameter: (name: string) => (name === 'operation' ? 'search' : undefined),
			getNode: () => ({ name: 'NKSC Ivanti' }),
		} as any);
		assert.deepEqual(searchResult, [[{ json: { operation: 'search' } }]]);
		assert.equal(searchSpy.mock.calls.length, 1);

		await assert.rejects(
			() =>
				router.call({
					getNodeParameter: (name: string) => (name === 'operation' ? 'invalid' : undefined),
					getNode: () => ({ name: 'NKSC Ivanti' }),
				} as any),
			/Unsupported operation: invalid/,
		);
	} finally {
		insertSpy.mockRestore();
		updateSpy.mockRestore();
		searchSpy.mockRestore();
	}
});
