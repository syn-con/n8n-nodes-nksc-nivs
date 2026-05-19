import type { INodePropertyOptions } from 'n8n-workflow';

import type { ReportField } from './reportTypes';
import { getThreatCategoryOptions, lossOptions, noValue, scopeOptions } from './reportOptions';

export {
	booleanOptions,
	lossOptionFields,
	lossOptions,
	noValue,
	scopeOptionFields,
	scopeOptions,
	threatCategoryGroups,
	threatOptions,
	validatedYesNoOptions,
	yesValue,
} from './reportOptions';

export const field = (definition: ReportField): ReportField => definition;

export const threatCategoryField = field({
	displayName: 'Threat Category',
	name: 'ThreatCategory',
	type: 'options',
	default: '',
	maxLength: 1000,
	description: 'Kibernetines gresmes pogrupis',
	options: getThreatCategoryOptions(),
});

function createExpandedOptionFields(
	options: readonly INodePropertyOptions[],
	expandToggleName: string,
): ReportField[] {
	return options.map((option) =>
		field({
			displayName: option.name,
			name: String(option.value),
			type: 'toggle',
			default: false,
			description: String(option.description ?? option.name),
			visibleWhen: { [expandToggleName]: [true] },
		}),
	);
}

export const scopeOptionsExpandedField = field({
	displayName: 'Expand Scope Options',
	name: 'ScopeOptionsExpanded',
	type: 'toggle',
	default: false,
	description: 'Show each scope option as its own switch instead of the compact multi-select',
	omitFromPayload: true,
});

export const scopeOptionToggleFields = createExpandedOptionFields(
	scopeOptions,
	'ScopeOptionsExpanded',
);

export const lossOptionsExpandedField = field({
	displayName: 'Expand Loss Options',
	name: 'LossOptionsExpanded',
	type: 'toggle',
	default: false,
	description: 'Show each loss option as its own switch instead of the compact multi-select',
	omitFromPayload: true,
});

export const lossOptionToggleFields = createExpandedOptionFields(
	lossOptions,
	'LossOptionsExpanded',
);

export const baseFields = {
	organization: field({
		displayName: 'Organization',
		name: 'Organization',
		type: 'string',
		default: '',
		required: true,
		maxLength: 255,
		description: 'Pranesejo organizacija',
	}),
	reporter: field({
		displayName: 'Reporter',
		name: 'Reporter',
		type: 'string',
		default: '',
		required: true,
		maxLength: 255,
		description: 'Pranesejo vardas ir pavarde',
	}),
	reporterEmail: field({
		displayName: 'Reporter Email',
		name: 'ReporterEmail',
		type: 'string',
		default: '',
		required: true,
		maxLength: 255,
		description: 'Pranesejo el. pastas.',
	}),
	reporterPhone: field({
		displayName: 'Reporter Phone',
		name: 'ReporterPhone',
		type: 'string',
		default: '',
		required: true,
		maxLength: 100,
		description: 'Pranesejo telefono numeris',
	}),
	reporterTitle: field({
		displayName: 'Reporter Title',
		name: 'ReporterTitle',
		type: 'string',
		default: '',
		required: true,
		maxLength: 255,
		description: 'Pranesejo pareigos',
	}),
	externalTicketId: field({
		displayName: 'External Ticket ID',
		name: 'XSC_ExternalTicket_RecId',
		type: 'string',
		default: '',
		maxLength: 255,
		description: 'External ticket RecId linked to this NKSC report',
	}),
	summary: field({
		displayName: 'Summary',
		name: 'Summary',
		type: 'string',
		default: '',
		required: true,
		maxLength: 255,
		description: 'Pavadinimas',
	}),
	detectedOn: field({
		displayName: 'Detected On',
		name: 'DetectedOn',
		type: 'dateTime',
		default: '',
		description: 'Data ir laikas, kada kibernetinis incidentas ivyko ar buvo nustatytas',
	}),
	affectedEntities: field({
		displayName: 'Affected Entities',
		name: 'AffectedEntities',
		type: 'string',
		default: '',
		rows: 3,
		description: 'Vieta, iranga ar informacine sistema, kur incidentas ivyko ar buvo nustatytas',
	}),
	criminalOffence: field({
		displayName: 'Criminal Offence',
		name: 'CriminalOffenceYesNo',
		type: 'yesNo',
		default: noValue,
		required: true,
		description: 'Ar incidenta, kaip itariama, sukele neteiseti ar piktavaliski veiksmai?',
	}),
	evidence: field({
		displayName: 'Evidence',
		name: 'Evidence',
		type: 'string',
		default: '',
		rows: 3,
		description: 'Turimi neteisetu ar piktavaliskiu veiksmu irodymai, jei tokiu yra',
	}),
	intergovernmentalImpact: field({
		displayName: 'Intergovernmental Impact',
		name: 'IntergovernmentalImpactYesNo',
		type: 'yesNo',
		default: noValue,
		description: 'Ar incidentas galetu daryti tarpvalstybini poveiki?',
	}),
	intergovernmentalImpactValue: field({
		displayName: 'Intergovernmental Impact Details',
		name: 'IntergovernmentalImpactValue',
		type: 'string',
		default: '',
		rows: 3,
		description: 'Tarpvalstybinis poveikis',
	}),
	helpNeeded: field({
		displayName: 'Help Needed',
		name: 'CyberIncidentResolvedHelpYesNo',
		type: 'yesNo',
		default: noValue,
		required: true,
		description: 'Ar reikalinga pagalba suvaldant incidenta?',
	}),
	helpDetails: field({
		displayName: 'Help Details',
		name: 'CyberIncidentResolvedHelpValue',
		type: 'string',
		default: '',
		rows: 3,
		description: 'Pagalbos priemones ar veiksmai',
	}),
	reported: field({
		displayName: 'Reported To Other Institutions',
		name: 'CyberIncidentReportedYesNo',
		type: 'yesNo',
		default: noValue,
		description: 'Ar apie incidenta buvo informuotos kitos istaigos?',
	}),
	reportedValue: field({
		displayName: 'Reported Institutions',
		name: 'CyberIncidentReportedValue',
		type: 'string',
		default: '',
		rows: 3,
		description: 'Istaigos',
	}),
	otherInformation: field({
		displayName: 'Other Information',
		name: 'OtherInformation',
		type: 'string',
		default: '',
		rows: 3,
		description: 'Kita svarbi informacija',
	}),
	typeOfCyberIncident: field({
		displayName: 'Type Of Cyber Incident',
		name: 'TypeOfCyberIncident',
		type: 'string',
		default: '',
		description: 'Kibernetinio incidento tipas',
	}),
	impactToPersons: field({
		displayName: 'Impact To Persons',
		name: 'ImpactToPersonYesNo',
		type: 'yesNo',
		default: noValue,
		required: true,
		description: 'Ar incidentas paveike arba gali paveikti kitus fizinius ar juridinius asmenis?',
	}),
	affectedPersons: field({
		displayName: 'Affected Persons',
		name: 'AffectedPersons',
		type: 'string',
		default: '',
		rows: 3,
		description: 'Paveikti asmenys ir zalos dydis',
	}),
	resolved: field({
		displayName: 'Incident Resolved',
		name: 'CyberIncidentResolvedYesNo',
		type: 'yesNo',
		default: noValue,
		required: true,
		description: 'Ar kibernetinis incidentas suvaldytas?',
	}),
	resolvedValue: field({
		displayName: 'Incident Resolution Plan',
		name: 'CyberIncidentResolvedValue',
		type: 'string',
		default: '',
		rows: 3,
		description: 'Priemones ar veiksmai, kurie bus atlikti siekiant suvaldyti incidenta',
	}),
	affectedServices: field({
		displayName: 'Affected Services',
		name: 'AffectedServices',
		type: 'string',
		default: '',
		required: true,
		rows: 3,
		description: 'Paveiktos paslaugos ir ju sutrikimu apimtys',
	}),
	financialLoss: field({
		displayName: 'Financial Loss',
		name: 'FinancialLossYesNo',
		type: 'yesNo',
		default: noValue,
		required: true,
		description: 'Ar patirti ar gali buti patirti finansiniai nuostoliai?',
	}),
	financialLossValue: field({
		displayName: 'Financial Loss Details',
		name: 'FinancialLossValue',
		type: 'string',
		default: '',
		maxLength: 1000,
		rows: 3,
		description: 'Nuostoliu dydis',
	}),
	thirdPartyImpact: field({
		displayName: 'Third-Party Impact',
		name: 'ImpactFromThirdPartyYesNo',
		type: 'yesNo',
		default: noValue,
		required: true,
		description: 'Ar incidenta sukele treciosios salys?',
	}),
	thirdPartyValue: field({
		displayName: 'Third-Party Details',
		name: 'ImpactFromThirdPartyValue',
		type: 'string',
		default: '',
		rows: 3,
		description: 'Treciosios salys',
	}),
	recurrence: field({
		displayName: 'Incident Recurrence',
		name: 'CyberIncidentRecurrenceYesNo',
		type: 'yesNo',
		default: noValue,
		description: 'Ar kibernetinis incidentas pasikartoja?',
	}),
};
