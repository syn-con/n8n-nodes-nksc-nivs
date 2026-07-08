import type { INodePropertyOptions } from 'n8n-workflow';

export const yesValue = 'Taip';
export const noValue = 'Ne';

export const booleanOptions = [
	{ name: 'Yes', value: true },
	{ name: 'No', value: false },
];
export const validatedYesNoOptions = [
	{ name: 'Yes', value: yesValue },
	{ name: 'No', value: noValue },
];

export const scopeOptionFields = [
	'ScopeOption1',
	'ScopeOption2',
	'ScopeOption3',
	'ScopeOption4',
	'ScopeOption5',
	'ScopeOption6',
	'ScopeOption7',
	'ScopeOption11',
] as const;

export const lossOptionFields = ['LossOption1', 'LossOption2', 'LossOption3'] as const;

export const scopeOptions: INodePropertyOptions[] = [
	{
		name: '(Option 1) Services Disrupted Across Lithuania/EU/NATO',
		value: 'ScopeOption1',
		description:
			'Paslaugos trikdomos visoje Lietuvos teritorijoje ir (ar) bent vienoje ES arba NATO salyje',
	},
	{
		name: '(Option 2) System Disrupted for 2+ Hours',
		value: 'ScopeOption2',
		description: 'Tinklu ir informacines sistemos veikla trikdoma 2 ar daugiau valandu',
	},
	{
		name: '(Option 3) 1,000 or 25% Users/Workplaces Affected',
		value: 'ScopeOption3',
		description:
			'Paveiktu paslaugu gaveju ar darbo vietu skaicius lygus arba didesnis nei 1 000, arba 25 procentai',
	},
	{
		name: '(Option 4) 1,000 or 25% Recipient Data Affected',
		value: 'ScopeOption4',
		description: 'Paveikti paslaugu gaveju asmens duomenys ar kiti saugomi duomenys',
	},
	{
		name: '(Option 5) Legal Requirements Cannot Be Met',
		value: 'ScopeOption5',
		description: 'Subjektas nebegali uztikrinti teises aktuose nustatytu reikalavimu igyvendinimo',
	},
	{
		name: '(Option 6) Trade Secrets or Classified Information Lost',
		value: 'ScopeOption6',
		description: 'Prarastos arba atskleistos komercines paslaptys arba islaptinta informacija',
	},
	{
		name: '(Option 7) Recurring Similar Incident With Major Loss',
		value: 'ScopeOption7',
		description: 'Per 6 menesius patiriamas daugiau nei vienas analogiskas incidentas',
	},
	{
		name: '(Option 11) Major Financial Loss',
		value: 'ScopeOption11',
		description: 'Subjektas patiria ar gali patirti dideliu finansiniu nuostoliu',
	},
];

export const lossOptions: INodePropertyOptions[] = [
	{ name: '(Option 1) Material Damage >= 400 Basic Social Benefits', value: 'LossOption1' },
	{ name: '(Option 2) Non-Material Damage >= EUR 10,000', value: 'LossOption2' },
	{ name: '(Option 3) Person Injured or Deceased', value: 'LossOption3' },
];

type NumberedOption = {
	number: number;
	name: string;
	value: string;
	description?: string;
};

const numberOption = (option: NumberedOption): INodePropertyOptions => ({
	name: `${option.number}. ${option.name}`,
	value: option.value,
	...(option.description !== undefined ? { description: option.description } : {}),
});

const inputToString = (value: unknown): string | undefined => {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return String(value);
	}

	if (typeof value === 'string') {
		return value.trim();
	}

	return undefined;
};

const matchesNumberedOption = (input: string, option: NumberedOption): boolean =>
	input === option.value ||
	input === option.name ||
	input === `${option.number}. ${option.name}` ||
	input === String(option.number);

const threatOptionDefinitions: NumberedOption[] = [
	{
		number: 1,
		name: 'Distribution of Unwanted, Misleading or Offensive Information',
		value:
			'Nepageidaujam\u0173 lai\u0161k\u0173, klaidinan\u010dios ar \u017eeid\u017eian\u010dios informacijos platinimas',
	},
	{ number: 2, name: 'Malware', value: 'Kenkimo programin\u0117 \u012franga' },
	{ number: 3, name: 'Information Gathering', value: 'Informacijos rinkimas' },
	{ number: 4, name: 'Intrusion Attempt', value: 'M\u0117ginimas \u012fsilau\u017eti' },
	{ number: 5, name: 'Intrusion', value: '\u012esilau\u017eimas' },
	{
		number: 6,
		name: 'Service Disruption / Availability Violations',
		value: 'Paslaug\u0173 trikdymas, prieinamumo pa\u017eeidimai',
	},
	{ number: 7, name: 'Supply Chain Attacks', value: 'Tiekimo grandin\u0117s atakos' },
	{
		number: 8,
		name: 'Information Content Security Violations',
		value: 'Informacijos turinio saugumo pa\u017eeidimai',
	},
	{ number: 9, name: 'Illegal Activity / Fraud', value: 'Neteis\u0117ta veikla, suk\u010diavimas' },
	{
		number: 10,
		name: 'Other Threats or Causes',
		value: 'Kitos gr\u0117sm\u0117s ar prie\u017eastys',
	},
];

export const threatOptions: INodePropertyOptions[] = threatOptionDefinitions.map(numberOption);

export const threatCategoryGroups = [
	{
		name: 'Malware',
		threat: 'Kenkimo programin\u0117 \u012franga',
		options: [
			{
				name: 'Advanced Malware',
				value: 'Pa\u017eangi kenkimo programin\u0117 \u012franga',
			},
			{
				name: 'Data-Encrypting or Data-Destructive Code',
				value: 'Duomenis \u0161ifruojantis ar naikinantis kodas',
			},
			{
				name: 'Information System Components Actively Controlled by Intruders',
				value:
					'Informacin\u0117s sistemos dalys, aktyviai kontroliuojamos \u012fsibrov\u0117li\u0173',
			},
			{
				name: 'Malware Distribution',
				value: 'Kenkimo programin\u0117s \u012frangos platinimas',
			},
		],
	},
	{
		name: 'Intrusion Attempt',
		threat: 'M\u0117ginimas \u012fsilau\u017eti',
		options: [
			{
				name: 'One or More Unknown Vulnerabilities Exploited',
				value: 'I\u0161naudojama viena ar kelios ne\u017einomos spragos',
			},
			{
				name: 'Network and Information System Reconnaissance',
				value: 'Tinkl\u0173 ir informacin\u0117s sistemos \u017evalgyba',
			},
			{
				name: 'Known and Publicly Disclosed Vulnerabilities Exploited',
				value: 'I\u0161naudojamos \u017einomos ir vie\u0161ai publikuotos spragos',
			},
			{
				name: 'Intrusion Attempt',
				value: 'M\u0117ginimas \u012fsilau\u017eti',
			},
		],
	},
	{
		name: 'Intrusion',
		threat: '\u012esilau\u017eimas',
		options: [
			{
				name: 'Actions Against a Network and Information System or Its Security Measures',
				value:
					'Veiksmai prie\u0161 tinkl\u0173 ir informacin\u0119 sistem\u0105 ar jos saugumo priemones',
			},
			{
				name: 'Unauthorized Access Obtained',
				value: 'Gaunama neteis\u0117ta prieiga',
			},
		],
	},
	{
		name: 'Service Disruption / Availability Violations',
		threat: 'Paslaug\u0173 trikdymas, prieinamumo pa\u017eeidimai',
		options: [
			{
				name: 'Service Interruption',
				value: 'Teikiam\u0173 paslaug\u0173 nutraukimas',
			},
			{
				name: 'Continuous Service Delivery Disruption',
				value: 'Teikiam\u0173 paslaug\u0173 nepertraukiamo teikimo trikdymas',
			},
		],
	},
] as const;

function getThreatCategoryOptionDefinitions(): NumberedOption[] {
	let nextNumber = 1;
	const categoryOptions: NumberedOption[] = [
		{
			number: 0,
			name: 'None',
			value: '',
			description: 'No Threat Category',
		},
	];

	for (const group of threatCategoryGroups) {
		for (const option of group.options) {
			categoryOptions.push({
				number: nextNumber,
				name: `${group.name} - ${option.name}`,
				value: option.value,
				description: group.name,
			});
			nextNumber += 1;
		}
	}

	return categoryOptions;
}

export function getThreatCategoryOptions(): INodePropertyOptions[] {
	return getThreatCategoryOptionDefinitions().map(numberOption);
}

export function normalizeThreatValue(threat: unknown): string | undefined {
	const input = inputToString(threat);
	if (input === undefined) {
		return undefined;
	}

	return threatOptionDefinitions.find((option) => matchesNumberedOption(input, option))?.value;
}

export function normalizeThreatCategoryValue(category: unknown): string | undefined {
	const input = inputToString(category);
	if (input === undefined) {
		return undefined;
	}

	const categoryOptions = getThreatCategoryOptionDefinitions();
	const exactMatch = categoryOptions.find((option) => matchesNumberedOption(input, option));
	if (exactMatch) {
		return exactMatch.value;
	}

	const bareNameMatches = threatCategoryGroups.flatMap((group) =>
		group.options.filter((option) => option.name === input),
	);
	if (bareNameMatches.length === 1) {
		return bareNameMatches[0]?.value;
	}

	return undefined;
}

export function isThreatCategoryForThreat(threat: string, category: string): boolean {
	const normalizedThreat = normalizeThreatValue(threat) ?? threat;
	const normalizedCategory = normalizeThreatCategoryValue(category) ?? category;
	const group = threatCategoryGroups.find((candidate) => candidate.threat === normalizedThreat);

	return group?.options.some((option) => option.value === normalizedCategory) ?? false;
}
