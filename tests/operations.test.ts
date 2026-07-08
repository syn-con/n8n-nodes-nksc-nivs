import assert from 'node:assert/strict';
import { test, vi } from 'vitest';

import { router } from '../nodes/NkscNivs/actions/router';
import * as insertOperation from '../nodes/NkscNivs/actions/securityReport/insert.operation';
import * as searchOperation from '../nodes/NkscNivs/actions/securityReport/search.operation';
import * as updateOperation from '../nodes/NkscNivs/actions/securityReport/update.operation';
import { getErrorMessage } from '../nodes/NkscNivs/actions/securityReport/operationError';
import {
	getPayloadInput,
	getSelectedReportForm,
	sanitizeResponse,
} from '../nodes/NkscNivs/actions/securityReport/operationHelpers';
import { reportForms } from '../nodes/NkscNivs/actions/securityReport/reportForms';

function createExecuteContext(
	parameters: Record<string, unknown>,
	options?: { continueOnFail?: boolean },
) {
	const httpRequest = vi.fn();
	const getCredentials = vi.fn().mockResolvedValue({
		tenant: 'https://nivs.example.local/HEAT/api',
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
		getNode: () => ({ name: 'NKSC NIVS' }),
		continueOnFail: () => options?.continueOnFail ?? false,
		helpers: {
			httpRequest,
			httpRequestWithAuthentication: httpRequest,
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
		DetectedOn: '2026-04-29T14:30:12+03:00',
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
	assert.equal(httpRequest.mock.calls[0][0], 'nkscNivsApi');
	assert.equal(httpRequest.mock.calls[0][1].method, 'POST');
	assert.equal(
		httpRequest.mock.calls[0][1].url,
		'https://nivs.example.local/HEAT/api/odata/businessobject/XSC_SecurityReport__InitialReports',
	);
	assert.equal(httpRequest.mock.calls[0][1].body.DetectedOn, '2026-04-29T11:30:12');
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

	const input = getPayloadInput(context as any, 0, form);

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
		() => getSelectedReportForm(context, 0),
		/Unsupported NKSC report form: unsupportedForm/,
	);
});

test('response sanitizer leaves responses without OData context unchanged', () => {
	const response = { RecId: 'record-1' };

	assert.notEqual(sanitizeResponse(response), response);
	assert.deepEqual(response, { RecId: 'record-1' });
});

test('response sanitizer returns an empty object for missing responses', () => {
	assert.deepEqual(sanitizeResponse(undefined), {});
});

test('getErrorMessage stringifies non-Error values and reads Error messages', () => {
	assert.equal(getErrorMessage('plain failure'), 'plain failure');
	assert.equal(getErrorMessage(new Error('boom')), 'boom');
});

test('update execution patches the selected record', async () => {
	const context = createExecuteContext({
		formVersion: 'v1',
		reportForm: 'majorIncident',
		recordId: '0123456789abcdef0123456789ABCDEF',
		updateMode: 'selectedFields',
		fieldsToUpdate: ['Summary', 'CyberIncidentResolvedYesNo'],
		Summary: 'Major incident',
		CyberIncidentResolvedYesNo: 'Taip',
	});
	const httpRequest = context.helpers.httpRequest as ReturnType<typeof vi.fn>;
	httpRequest.mockResolvedValue({
		statusCode: 200,
		body: {
			'@odata.context': 'context',
			RecId: '0123456789abcdef0123456789ABCDEF',
		},
	});

	const result = await updateOperation.execute.call(context);

	assert.deepEqual(result, [{ json: { RecId: '0123456789abcdef0123456789ABCDEF' } }]);
	assert.equal(httpRequest.mock.calls[0][0], 'nkscNivsApi');
	assert.equal(httpRequest.mock.calls[0][1].method, 'PATCH');
	assert.equal(
		httpRequest.mock.calls[0][1].url,
		"https://nivs.example.local/HEAT/api/odata/businessobject/XSC_SecurityReport__DetailReports('0123456789abcdef0123456789ABCDEF')",
	);
	assert.deepEqual(httpRequest.mock.calls[0][1].body, {
		Summary: 'Major incident',
		CyberIncidentResolvedYesNo: 'Taip',
	});
});

test('update execution accepts numbered field selections from expressions', async () => {
	const context = createExecuteContext({
		formVersion: 'v1',
		reportForm: 'majorIncident',
		recordId: '0123456789abcdef0123456789ABCDEF',
		updateMode: 'selectedFields',
		fieldsToUpdate: '7',
		Summary: 'Major incident',
	});
	const httpRequest = context.helpers.httpRequest as ReturnType<typeof vi.fn>;
	httpRequest.mockResolvedValue({
		statusCode: 200,
		body: {
			RecId: '0123456789abcdef0123456789ABCDEF',
		},
	});

	await updateOperation.execute.call(context);

	assert.deepEqual(httpRequest.mock.calls[0][1].body, { Summary: 'Major incident' });
});

test('update execution validates the full selected form when requested', async () => {
	const context = createExecuteContext({
		formVersion: 'v1',
		reportForm: 'majorIncident',
		recordId: '0123456789abcdef0123456789ABCDEF',
		updateMode: 'fullForm',
		validateRequiredFields: true,
		Organization: 'Org',
		Reporter: 'Reporter',
		ReporterEmail: 'reporter@example.com',
		ReporterPhone: '+37060000000',
		ReporterTitle: 'Lead',
		Summary: 'Major incident',
		ScopeOptions: ['ScopeOption2'],
		InitialReportUpdateYesNo: 'Ne',
		CyberIncidentReputationYesNo: 'Ne',
		ImpactToPersonYesNo: 'Ne',
		CyberIncidentResolvedYesNo: 'Taip',
		AffectedServices: 'Affected services',
		FinancialLossYesNo: 'Ne',
		ImpactFromThirdPartyYesNo: 'Ne',
		CyberIncidentRecurrenceYesNo: 'Ne',
	});
	const httpRequest = context.helpers.httpRequest as ReturnType<typeof vi.fn>;
	httpRequest.mockResolvedValue({
		statusCode: 200,
		body: {
			RecId: '0123456789abcdef0123456789ABCDEF',
		},
	});

	const result = await updateOperation.execute.call(context);

	assert.deepEqual(result, [{ json: { RecId: '0123456789abcdef0123456789ABCDEF' } }]);
	assert.equal(httpRequest.mock.calls.length, 1);
});

test('update execution rejects incomplete full-form validation before PATCH', async () => {
	const context = createExecuteContext(
		{
			formVersion: 'v1',
			reportForm: 'majorIncident',
			recordId: '0123456789abcdef0123456789ABCDEF',
			updateMode: 'fullForm',
			validateRequiredFields: true,
			Summary: 'Major incident',
		},
		{ continueOnFail: true },
	);

	const result = await updateOperation.execute.call(context);

	assert.match(String(result[0]?.json?.error), /Reporter is required/);
	assert.equal((context.helpers.httpRequest as ReturnType<typeof vi.fn>).mock.calls.length, 0);
});

test('update execution wraps validation errors when continue on fail is disabled', async () => {
	const context = createExecuteContext({
		formVersion: 'v1',
		reportForm: 'majorIncident',
		recordId: '0123456789abcdef0123456789ABCDEF',
		updateMode: 'fullForm',
		validateRequiredFields: true,
		Summary: 'Major incident',
	});

	await assert.rejects(() => updateOperation.execute.call(context), /Reporter is required/);
});

test('update execution rejects non-hex record IDs before building an OData path', async () => {
	const context = createExecuteContext(
		{
			formVersion: 'v1',
			reportForm: 'majorIncident',
			recordId: "ABC') or 1 eq 1 or ('",
			validateRequiredFields: false,
		},
		{ continueOnFail: true },
	);

	const result = await updateOperation.execute.call(context);

	assert.equal(result[0]?.json?.error, 'Record ID must be a 32-character hex string');
	assert.equal((context.helpers.httpRequest as ReturnType<typeof vi.fn>).mock.calls.length, 0);
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

test('update execution rejects empty selected-field payloads before PATCH', async () => {
	const context = createExecuteContext(
		{
			formVersion: 'v1',
			reportForm: 'majorIncident',
			recordId: '0123456789abcdef0123456789ABCDEF',
			updateMode: 'selectedFields',
			fieldsToUpdate: ['Summary'],
			Summary: '',
		},
		{ continueOnFail: true },
	);

	const result = await updateOperation.execute.call(context);

	assert.equal(result[0]?.json?.error, 'At least one selected field must have a value to update');
	assert.equal((context.helpers.httpRequest as ReturnType<typeof vi.fn>).mock.calls.length, 0);
});

test('update execution patches an expand-gated field selected in Selected Fields mode', async () => {
	const context = createExecuteContext({
		formVersion: 'v1',
		reportForm: 'majorIncident',
		recordId: '0123456789abcdef0123456789ABCDEF',
		updateMode: 'selectedFields',
		fieldsToUpdate: ['ScopeOption1'],
		ScopeOption1: true,
		ScopeOptionsExpanded: false,
	});
	const httpRequest = context.helpers.httpRequest as ReturnType<typeof vi.fn>;
	httpRequest.mockResolvedValue({
		statusCode: 200,
		body: { RecId: '0123456789abcdef0123456789ABCDEF' },
	});

	await updateOperation.execute.call(context);

	// ScopeOption1 is gated by visibleWhen ScopeOptionsExpanded=[true]; explicitly selecting it in
	// Selected Fields mode must patch it even though the expand toggle is left off.
	assert.deepEqual(httpRequest.mock.calls[0][1].body, { ScopeOption1: true });
});

test('update execution rejects an unsupported update mode', async () => {
	const context = createExecuteContext(
		{
			formVersion: 'v1',
			reportForm: 'majorIncident',
			recordId: '0123456789abcdef0123456789ABCDEF',
			updateMode: 'bogusMode',
		},
		{ continueOnFail: true },
	);

	const result = await updateOperation.execute.call(context);

	assert.equal(result[0]?.json?.error, 'Unsupported update mode: bogusMode');
	assert.equal((context.helpers.httpRequest as ReturnType<typeof vi.fn>).mock.calls.length, 0);
});

test('update execution rejects an empty Fields To Update selection', async () => {
	const context = createExecuteContext(
		{
			formVersion: 'v1',
			reportForm: 'majorIncident',
			recordId: '0123456789abcdef0123456789ABCDEF',
			updateMode: 'selectedFields',
			fieldsToUpdate: [],
		},
		{ continueOnFail: true },
	);

	const result = await updateOperation.execute.call(context);

	assert.equal(result[0]?.json?.error, 'Fields To Update must include at least one field');
	assert.equal((context.helpers.httpRequest as ReturnType<typeof vi.fn>).mock.calls.length, 0);
});

test('normalizes update field selections from labels, field names, and numbers', () => {
	assert.deepEqual(
		updateOperation.normalizeFieldsToUpdate(reportForms.majorIncident, [
			'1. Organization',
			'Summary',
			7,
			'[8]',
		]),
		['Organization', 'Summary', 'DetectedOn'],
	);

	assert.throws(
		() => updateOperation.normalizeFieldsToUpdate(reportForms.majorIncident, '999'),
		/Unknown Fields To Update selection: 999/,
	);
});

test('resolves numbered update selections by full label and rejects stale ones', () => {
	// "7. Summary" is the correct label for position 7, so it resolves; "7. Organization" is a stale
	// label (Organization is position 1) and must fail loudly instead of silently patching position 7.
	assert.deepEqual(
		updateOperation.normalizeFieldsToUpdate(reportForms.majorIncident, '7. Summary'),
		['Summary'],
	);

	assert.throws(
		() => updateOperation.normalizeFieldsToUpdate(reportForms.majorIncident, '7. Organization'),
		/Unknown Fields To Update selection: 7\. Organization/,
	);
});

test('normalizeFieldsToUpdate ignores non-string tokens, blank input, and non-positive numbers', () => {
	assert.deepEqual(updateOperation.normalizeFieldsToUpdate(reportForms.majorIncident, [true]), []);
	assert.deepEqual(updateOperation.normalizeFieldsToUpdate(reportForms.majorIncident, '   '), []);

	assert.throws(
		() => updateOperation.normalizeFieldsToUpdate(reportForms.majorIncident, [0]),
		/Unknown Fields To Update selection: 0/,
	);
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
	assert.equal(httpRequest.mock.calls[0][0], 'nkscNivsApi');
	assert.equal(httpRequest.mock.calls[0][1].method, 'GET');
	assert.deepEqual(httpRequest.mock.calls[0][1].qs, {
		$filter: "XSC_ExternalTicket_RecId eq 'EXT-123'",
		$top: 10,
	});
	assert.equal(
		httpRequest.mock.calls[0][1].url,
		'https://nivs.example.local/HEAT/api/odata/businessobject/XSC_SecurityReport__DetailReports',
	);
});

test('search execution respects an explicit search limit', async () => {
	const context = createExecuteContext({
		reportForm: 'minorIncident',
		externalTicketId: 'EXT-123',
		searchLimit: 25,
	});
	const httpRequest = context.helpers.httpRequest as ReturnType<typeof vi.fn>;
	httpRequest.mockResolvedValue({
		statusCode: 200,
		body: {
			'@odata.context': 'context',
			value: [{ RecId: 'A' }],
		},
	});

	await searchOperation.execute.call(context);

	assert.deepEqual(httpRequest.mock.calls[0][1].qs, {
		$filter: "XSC_ExternalTicket_RecId eq 'EXT-123'",
		$top: 25,
	});
});

test('search execution coerces a string search limit to a number', async () => {
	const context = createExecuteContext({
		reportForm: 'minorIncident',
		externalTicketId: 'EXT-123',
		searchLimit: '5',
	});
	const httpRequest = context.helpers.httpRequest as ReturnType<typeof vi.fn>;
	httpRequest.mockResolvedValue({
		statusCode: 200,
		body: { value: [{ RecId: 'A' }] },
	});

	await searchOperation.execute.call(context);

	assert.equal(httpRequest.mock.calls[0][1].qs.$top, 5);
});

test('search execution pages through every record when Return All is enabled', async () => {
	const context = createExecuteContext({
		reportForm: 'minorIncident',
		externalTicketId: 'EXT-123',
		returnAll: true,
	});
	const httpRequest = context.helpers.httpRequest as ReturnType<typeof vi.fn>;
	const firstPage = Array.from({ length: 100 }, (_value, index) => ({ RecId: `A${index}` }));
	const secondPage = [{ RecId: 'B0' }, { RecId: 'B1' }];
	httpRequest
		.mockResolvedValueOnce({ statusCode: 200, body: { value: firstPage } })
		.mockResolvedValueOnce({ statusCode: 200, body: { value: secondPage } });

	const result = await searchOperation.execute.call(context);

	assert.equal(result.length, 102);
	assert.equal(httpRequest.mock.calls.length, 2);
	assert.deepEqual(httpRequest.mock.calls[0][1].qs, {
		$filter: "XSC_ExternalTicket_RecId eq 'EXT-123'",
		$top: 100,
		$skip: 0,
	});
	assert.deepEqual(httpRequest.mock.calls[1][1].qs, {
		$filter: "XSC_ExternalTicket_RecId eq 'EXT-123'",
		$top: 100,
		$skip: 100,
	});
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

test('search execution returns an error item when the search limit is invalid and continue on fail is enabled', async () => {
	const context = createExecuteContext(
		{
			reportForm: 'minorIncident',
			externalTicketId: 'EXT-123',
			searchLimit: 0,
		},
		{ continueOnFail: true },
	);

	const result = await searchOperation.execute.call(context);

	assert.equal(result[0]?.json?.error, 'Search Limit must be a positive integer');
	assert.equal((context.helpers.httpRequest as ReturnType<typeof vi.fn>).mock.calls.length, 0);
});

test('search execution wraps unsupported report form errors when continue on fail is disabled', async () => {
	const context = createExecuteContext({
		reportForm: 'unsupportedForm',
		externalTicketId: 'EXT-123',
	});

	await assert.rejects(
		() => searchOperation.execute.call(context),
		/Unsupported NKSC report form: unsupportedForm/,
	);
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
			getNode: () => ({ name: 'NKSC NIVS' }),
		} as any);
		assert.deepEqual(insertResult, [[{ json: { operation: 'insert' } }]]);
		assert.equal(insertSpy.mock.calls.length, 1);

		const updateResult = await router.call({
			getNodeParameter: (name: string) => (name === 'operation' ? 'update' : undefined),
			getNode: () => ({ name: 'NKSC NIVS' }),
		} as any);
		assert.deepEqual(updateResult, [[{ json: { operation: 'update' } }]]);
		assert.equal(updateSpy.mock.calls.length, 1);

		const searchResult = await router.call({
			getNodeParameter: (name: string) => (name === 'operation' ? 'search' : undefined),
			getNode: () => ({ name: 'NKSC NIVS' }),
		} as any);
		assert.deepEqual(searchResult, [[{ json: { operation: 'search' } }]]);
		assert.equal(searchSpy.mock.calls.length, 1);

		await assert.rejects(
			() =>
				router.call({
					getNodeParameter: (name: string) => (name === 'operation' ? 'invalid' : undefined),
					getNode: () => ({ name: 'NKSC NIVS' }),
				} as any),
			/Unsupported operation: invalid/,
		);
	} finally {
		insertSpy.mockRestore();
		updateSpy.mockRestore();
		searchSpy.mockRestore();
	}
});
