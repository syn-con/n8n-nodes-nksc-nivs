import { NodeOperationError, type IExecuteFunctions, type INodeExecutionData } from 'n8n-workflow';

import type { NkscIvantiOperation } from './node.type';
import * as securityReport from './securityReport';

export async function router(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	let returnData: INodeExecutionData[] = [];

	try {
		const operation = this.getNodeParameter('operation', 0) as NkscIvantiOperation;

		switch (operation) {
			case 'insert':
			case 'search':
			case 'update':
				returnData = await securityReport[operation].execute.call(this);
				break;
			default:
				throw new NodeOperationError(this.getNode(), `Unsupported operation: ${String(operation)}`);
		}
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error);
	}

	return [returnData];
}
