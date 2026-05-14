export const nkscIvantiOperations = ['insert', 'update', 'search'] as const;

export type NkscIvantiOperation = (typeof nkscIvantiOperations)[number];
