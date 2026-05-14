import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'vitest';

import { NkscIvantiApi } from '../credentials/NkscIvantiApi.credentials';
import { NkscIvanti } from '../nodes/NkscIvanti/NkscIvanti.node';
import { nkscIvantiOperations } from '../nodes/NkscIvanti/actions/node.type';
import { reportFieldTypes, reportFormIds } from '../nodes/NkscIvanti/actions/securityReport/reportTypes';

const require = createRequire(import.meta.url);

test('exports the expected prettier config', () => {
	const prettierConfig = require('../.prettierrc.js') as Record<string, unknown>;

	assert.deepEqual(prettierConfig, {
		semi: true,
		trailingComma: 'all',
		bracketSpacing: true,
		useTabs: true,
		tabWidth: 2,
		arrowParens: 'always',
		singleQuote: true,
		quoteProps: 'as-needed',
		endOfLine: 'lf',
		printWidth: 100,
	});
});

test('re-exports the node and credential classes from the package entrypoint', async () => {
	const entrypoint = await import('../index');

	assert.equal(entrypoint.NkscIvanti, NkscIvanti);
	assert.equal(entrypoint.NkscIvantiApi, NkscIvantiApi);
});

test('describes the API credential as a full endpoint-based setup', () => {
	const credential = new NkscIvantiApi();

	assert.equal(credential.name, 'nkscIvantiApi');
	assert.equal(credential.displayName, 'NKSC Ivanti API');
	assert.deepEqual(
		credential.properties.map((property) => property.name),
		['tenant', 'apiKey'],
	);
	assert.equal(credential.properties[0]?.displayName, 'API Endpoint');
	assert.equal(credential.properties[0]?.default, 'https://incidentai.nksc.lt/HEAT/api');
	assert.equal(credential.properties[1]?.typeOptions?.password, true);
	assert.ok(String(credential.test.request.baseURL).includes('/odata/businessobject'));
	assert.equal(credential.test.request.method, 'GET');
	assert.equal(credential.test.request.url, '/XSC_SecurityReport__DetailReports');
});

test('exposes the runtime constants used by type-only modules', () => {
	assert.deepEqual([...nkscIvantiOperations], ['insert', 'update', 'search']);
	assert.deepEqual([...reportFormIds], [
		'initialWarning',
		'majorIncident',
		'minorIncident',
		'nearMissIncident',
	]);
	assert.deepEqual([...reportFieldTypes], [
		'string',
		'dateTime',
		'boolean',
		'toggle',
		'yesNo',
		'multiOptions',
		'options',
	]);
});

test('registers the icon build task and points it at node and credential assets', () => {
	const moduleBuiltin = require('module') as {
		_load: typeof import('node:module').Module._load;
	};
	const originalLoad = moduleBuiltin._load;
	const taskMap = new Map<string, (...args: unknown[]) => unknown>();
	const calls: Array<[string, string]> = [];

	moduleBuiltin._load = function patchedLoad(request, parent, isMain) {
		if (request === 'gulp') {
			return {
				task(name: string, fn: (...args: unknown[]) => unknown) {
					taskMap.set(name, fn);
				},
				src(pattern: string) {
					calls.push(['src', pattern]);
					return {
						pipe(transform: unknown) {
							calls.push(['pipe', String(transform)]);
							return transform;
						},
					};
				},
				dest(destination: string) {
					calls.push(['dest', destination]);
					return { destination };
				},
			};
		}

		return originalLoad.call(this, request, parent, isMain);
	};

	try {
		const gulpfilePath = require.resolve('../gulpfile.js');
		delete require.cache[gulpfilePath];
		require(gulpfilePath);

		const buildIconsTask = taskMap.get('build:icons');
		assert.equal(typeof buildIconsTask, 'function');

		buildIconsTask?.();

		const srcPatterns = calls.filter(([kind]) => kind === 'src').map(([, pattern]) => pattern);
		const destPaths = calls.filter(([kind]) => kind === 'dest').map(([, destination]) => destination);

		assert.equal(srcPatterns.length, 2);
		assert.ok(srcPatterns[0]?.includes('nodes'));
		assert.ok(srcPatterns[0]?.includes('*.{png,svg}'));
		assert.ok(srcPatterns[1]?.includes('credentials'));
		assert.ok(srcPatterns[1]?.includes('*.{png,svg}'));
		assert.equal(destPaths.length, 2);
		assert.ok(destPaths[0]?.includes('dist'));
		assert.ok(destPaths[1]?.includes('dist'));
	} finally {
		moduleBuiltin._load = originalLoad;
		delete require.cache[require.resolve('../gulpfile.js')];
	}
});
