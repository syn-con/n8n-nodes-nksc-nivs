import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	NodeApiError,
	NodeOperationError,
} from 'n8n-workflow';

export function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

// In continue-on-fail mode the item output is the only place the failure is reported, so carry the
// description (which now includes the raw NIVS/Ivanti response body when no structured message is
// found) and HTTP status code alongside the message instead of dropping them.
function buildErrorJson(error: unknown): IDataObject {
	const json: IDataObject = { error: getErrorMessage(error) };

	if (error !== null && typeof error === 'object') {
		const { description, httpCode } = error as { description?: unknown; httpCode?: unknown };

		if (typeof description === 'string' && description !== '') {
			json.description = description;
		}

		if (typeof httpCode === 'string' && httpCode !== '') {
			json.httpCode = httpCode;
		}
	}

	return json;
}

export function handleOperationError(
	context: IExecuteFunctions,
	error: unknown,
	itemIndex: number,
): INodeExecutionData[] {
	if (context.continueOnFail()) {
		return [{ json: buildErrorJson(error), pairedItem: { item: itemIndex } }];
	}

	if (error instanceof NodeOperationError || error instanceof NodeApiError) {
		throw error;
	}

	throw new NodeOperationError(context.getNode(), error as Error, { itemIndex });
}
