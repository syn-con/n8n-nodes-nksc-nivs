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
	description: 'Cyber threat subcategory',
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
		description: 'Organization reporting the incident',
	}),
	reporter: field({
		displayName: 'Reporter',
		name: 'Reporter',
		type: 'string',
		default: '',
		required: true,
		maxLength: 255,
		description: 'Full name of the person reporting the incident',
	}),
	reporterEmail: field({
		displayName: 'Reporter Email',
		name: 'ReporterEmail',
		type: 'string',
		default: '',
		required: true,
		maxLength: 255,
		description: 'Email address of the person reporting the incident',
	}),
	reporterPhone: field({
		displayName: 'Reporter Phone',
		name: 'ReporterPhone',
		type: 'string',
		default: '',
		required: true,
		maxLength: 100,
		description: 'Phone number of the person reporting the incident',
	}),
	reporterTitle: field({
		displayName: 'Reporter Title',
		name: 'ReporterTitle',
		type: 'string',
		default: '',
		required: true,
		maxLength: 255,
		description: 'Job title of the person reporting the incident',
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
		description: 'Title of the report',
	}),
	detectedOn: field({
		displayName: 'Detected On',
		name: 'DetectedOn',
		type: 'dateTime',
		default: '',
		description: 'Date and time the cyber incident occurred or was detected',
	}),
	affectedEntities: field({
		displayName: 'Affected Entities',
		name: 'AffectedEntities',
		type: 'string',
		default: '',
		rows: 3,
		description:
			'Location, equipment or information system where the incident occurred or was detected',
	}),
	criminalOffence: field({
		displayName: 'Criminal Offence',
		name: 'CriminalOffenceYesNo',
		type: 'yesNo',
		default: noValue,
		required: true,
		description:
			'Whether the incident is suspected to have been caused by illegal or malicious actions',
	}),
	evidence: field({
		displayName: 'Evidence',
		name: 'Evidence',
		type: 'string',
		default: '',
		rows: 3,
		description: 'Available evidence of illegal or malicious actions, if any',
	}),
	intergovernmentalImpact: field({
		displayName: 'Intergovernmental Impact',
		name: 'IntergovernmentalImpactYesNo',
		type: 'yesNo',
		default: noValue,
		description: 'Whether the incident could have a cross-border impact',
	}),
	intergovernmentalImpactValue: field({
		displayName: 'Intergovernmental Impact Details',
		name: 'IntergovernmentalImpactValue',
		type: 'string',
		default: '',
		rows: 3,
		description: 'Cross-border impact',
	}),
	helpNeeded: field({
		displayName: 'Help Needed',
		name: 'CyberIncidentResolvedHelpYesNo',
		type: 'yesNo',
		default: noValue,
		required: true,
		description: 'Whether assistance is needed to contain the incident',
	}),
	helpDetails: field({
		displayName: 'Help Details',
		name: 'CyberIncidentResolvedHelpValue',
		type: 'string',
		default: '',
		rows: 3,
		description: 'Assistance measures or actions',
	}),
	reported: field({
		displayName: 'Reported To Other Institutions',
		name: 'CyberIncidentReportedYesNo',
		type: 'yesNo',
		default: noValue,
		description: 'Whether other institutions were informed about the incident',
	}),
	reportedValue: field({
		displayName: 'Reported Institutions',
		name: 'CyberIncidentReportedValue',
		type: 'string',
		default: '',
		rows: 3,
		description: 'Institutions that were informed',
	}),
	otherInformation: field({
		displayName: 'Other Information',
		name: 'OtherInformation',
		type: 'string',
		default: '',
		rows: 3,
		description: 'Other relevant information',
	}),
	typeOfCyberIncident: field({
		displayName: 'Type Of Cyber Incident',
		name: 'TypeOfCyberIncident',
		type: 'string',
		default: '',
		description: 'Severity type assigned to the cyber incident (Major, Minor or Near Miss)',
	}),
	impactToPersons: field({
		displayName: 'Impact To Persons',
		name: 'ImpactToPersonYesNo',
		type: 'yesNo',
		default: noValue,
		required: true,
		description: 'Whether the incident has affected or could affect other natural or legal persons',
	}),
	affectedPersons: field({
		displayName: 'Affected Persons',
		name: 'AffectedPersons',
		type: 'string',
		default: '',
		rows: 3,
		description: 'Affected persons and the extent of the damage',
	}),
	resolved: field({
		displayName: 'Incident Resolved',
		name: 'CyberIncidentResolvedYesNo',
		type: 'yesNo',
		default: noValue,
		required: true,
		description: 'Whether the cyber incident has been contained',
	}),
	resolvedValue: field({
		displayName: 'Incident Resolution Plan',
		name: 'CyberIncidentResolvedValue',
		type: 'string',
		default: '',
		rows: 3,
		description: 'Measures or actions that will be taken to contain the incident',
	}),
	affectedServices: field({
		displayName: 'Affected Services',
		name: 'AffectedServices',
		type: 'string',
		default: '',
		required: true,
		rows: 3,
		description: 'Affected services and the extent of their disruption',
	}),
	financialLoss: field({
		displayName: 'Financial Loss',
		name: 'FinancialLossYesNo',
		type: 'yesNo',
		default: noValue,
		required: true,
		description: 'Whether financial losses have been or could be incurred',
	}),
	financialLossValue: field({
		displayName: 'Financial Loss Details',
		name: 'FinancialLossValue',
		type: 'string',
		default: '',
		maxLength: 1000,
		rows: 3,
		description: 'Amount of the losses',
	}),
	thirdPartyImpact: field({
		displayName: 'Third-Party Impact',
		name: 'ImpactFromThirdPartyYesNo',
		type: 'yesNo',
		default: noValue,
		required: true,
		description: 'Whether the incident was caused by third parties',
	}),
	thirdPartyValue: field({
		displayName: 'Third-Party Details',
		name: 'ImpactFromThirdPartyValue',
		type: 'string',
		default: '',
		rows: 3,
		description: 'Third parties involved',
	}),
	recurrence: field({
		displayName: 'Incident Recurrence',
		name: 'CyberIncidentRecurrenceYesNo',
		type: 'yesNo',
		default: noValue,
		description: 'Whether the cyber incident is recurring',
	}),
};
