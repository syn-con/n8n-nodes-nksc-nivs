import type { INodeProperties } from 'n8n-workflow';

import * as insert from './insert.operation';
import * as search from './search.operation';
import * as update from './update.operation';

export { insert, search, update };

export const operationProperty: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	options: [
		{
			name: 'Insert NKSC Report',
			value: 'insert',
			description: 'Create an NKSC report',
			action: 'Insert NKSC report',
		},
		{
			name: 'Update NKSC Report',
			value: 'update',
			description: 'Update an NKSC report',
			action: 'Update NKSC report',
		},
		{
			name: 'Search NKSC Report',
			value: 'search',
			description: 'Search NKSC reports by external ticket ID',
			action: 'Search NKSC report',
		},
	],
	default: 'insert',
};

export const description: INodeProperties[] = [
	operationProperty,
	...insert.description,
	...update.description,
	...search.description,
];
