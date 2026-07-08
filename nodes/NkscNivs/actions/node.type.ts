export const nkscNivsOperations = ['insert', 'update', 'search'] as const;

export type NkscNivsOperation = (typeof nkscNivsOperations)[number];
