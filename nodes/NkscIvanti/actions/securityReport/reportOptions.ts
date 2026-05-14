import type { INodePropertyOptions } from 'n8n-workflow';

export const yesValue = 'Taip';
export const noValue = 'Ne';

export const booleanOptions = [{ name: 'Yes', value: true }, { name: 'No', value: false }];
export const validatedYesNoOptions = [{ name: 'Yes', value: yesValue }, { name: 'No', value: noValue }];

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
		description: 'Paslaugos trikdomos visoje Lietuvos teritorijoje ir (ar) bent vienoje ES arba NATO salyje',
	},
	{
		name: '(Option 2) System Disrupted for 2+ Hours',
		value: 'ScopeOption2',
		description: 'Tinklu ir informacines sistemos veikla trikdoma 2 ar daugiau valandu',
	},
	{
		name: '(Option 3) 1,000 or 25% Users/Workplaces Affected',
		value: 'ScopeOption3',
		description: 'Paveiktu paslaugu gaveju ar darbo vietu skaicius lygus arba didesnis nei 1 000, arba 25 procentai',
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

export const threatOptions: INodePropertyOptions[] = [
	{
		name: 'Distribution of Unwanted, Misleading or Offensive Information',
		value: 'Nepageidaujamų laiškų, klaidinančios ar žeidžiančios informacijos platinimas',
	},
	{ name: 'Malware', value: 'Kenkimo programinė įranga' },
	{ name: 'Information Gathering', value: 'Informacijos rinkimas' },
	{ name: 'Intrusion Attempt', value: 'Mėginimas įsilaužti' },
	{ name: 'Intrusion', value: 'Įsilaužimas' },
	{
		name: 'Service Disruption / Availability Violations',
		value: 'Paslaugų trikdymas, prieinamumo pažeidimai',
	},
	{ name: 'Supply Chain Attacks', value: 'Tiekimo grandinės atakos' },
	{
		name: 'Information Content Security Violations',
		value: 'Informacijos turinio saugumo pažeidimai',
	},
	{ name: 'Illegal Activity / Fraud', value: 'Neteisėta veikla, sukčiavimas' },
	{ name: 'Other Threats or Causes', value: 'Kitos grėsmės ar priežastys' },
];

export const threatCategoryGroups = [
	{
		fieldName: 'ThreatCategoryMalware',
		threat: 'Kenkimo programinė įranga',
		options: [
			'Pažangi kenkimo programinė įranga',
			'Duomenis šifruojantis ar naikinantis kodas',
			'Informacinės sistemos dalys, aktyviai kontroliuojamos įsibrovėlių',
			'Kenkimo programinės įrangos platinimas',
		],
	},
	{
		fieldName: 'ThreatCategoryIntrusionAttempt',
		threat: 'Mėginimas įsilaužti',
		options: [
			'Išnaudojama viena ar kelios nežinomos spragos',
			'Tinklų ir informacinės sistemos žvalgyba',
			'Išnaudojamos žinomos ir viešai publikuotos spragos',
			'Mėginimas įsilaužti',
		],
	},
	{
		fieldName: 'ThreatCategoryIntrusion',
		threat: 'Įsilaužimas',
		options: [
			'Veiksmai prieš tinklų ir informacinę sistemą ar jos saugumo priemones',
			'Gaunama neteisėta prieiga',
		],
	},
	{
		fieldName: 'ThreatCategoryServiceDisruption',
		threat: 'Paslaugų trikdymas, prieinamumo pažeidimai',
		options: [
			'Teikiamų paslaugų nutraukimas',
			'Teikiamų paslaugų nepertraukiamo teikimo trikdymas',
		],
	},
] as const;
