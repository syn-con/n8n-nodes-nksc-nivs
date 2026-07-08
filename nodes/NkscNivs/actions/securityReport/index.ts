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
			name: 'Insert Report',
			value: 'insert',
			description: 'Create a report',
			action: 'Insert report',
		},
		{
			name: 'Update Report',
			value: 'update',
			description: 'Update a report',
			action: 'Update report',
		},
		{
			name: 'Search Report',
			value: 'search',
			description: 'Search reports by external ticket ID',
			action: 'Search report',
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
