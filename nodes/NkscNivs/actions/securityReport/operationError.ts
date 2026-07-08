import {
	IExecuteFunctions,
	INodeExecutionData,
	NodeApiError,
	NodeOperationError,
} from 'n8n-workflow';

export function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export function handleOperationError(
	context: IExecuteFunctions,
	error: unknown,
	itemIndex: number,
): INodeExecutionData[] {
	if (context.continueOnFail()) {
		return [{ json: { error: getErrorMessage(error) }, pairedItem: { item: itemIndex } }];
	}

	if (error instanceof NodeOperationError || error instanceof NodeApiError) {
		throw error;
	}

	throw new NodeOperationError(context.getNode(), error as Error, { itemIndex });
}
