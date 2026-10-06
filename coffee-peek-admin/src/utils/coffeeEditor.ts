import { z } from 'zod';
import type { AdminClassification, AdminCoffee, CoffeeContent } from '../api/coffeeCatalog';

export const baseProtectedFields = ['Name', 'Description', 'ProductKind', 'ProductForm', 'CompositionKind', 'Processing', 'RoastLevel', 'Acidity', 'Body', 'QGraderScoreRaw', 'TasteDescriptors', 'BrewRecommendations', 'GrindOptions', 'Features', 'Countries', 'Photos'] as const;
const text = z.string().max(1000).nullable();
const texts = z.array(z.string().max(500)).max(100);
export const coffeeContentSchema = z.object({ name: z.string().trim().min(1, 'Введите название').max(250), description: z.string().nullable(), productKind: z.enum(['roasted_beans', 'green_beans']), productForm: z.enum(['whole_beans', 'ground_only']), compositionKind: z.string(),
  processing: text, roastLevel: text, acidity: text, body: text, qGraderScoreRaw: text, tasteDescriptors: texts, brewRecommendations: texts, grindOptions: texts, features: texts }).passthrough();
export interface CoffeeDraft { content: CoffeeContent; countryCodes: string[]; protectedFields: string[]; classification: AdminClassification['classification']; classificationProtected: AdminClassification['protectedFields']; variants: AdminClassification['variants'] }
export function coffeeDraft(coffee: AdminCoffee, classification: AdminClassification): CoffeeDraft {
  return structuredClone({ content: coffee.content, countryCodes: coffee.countries.map(country => country.code), protectedFields: coffee.protectedFields, classification: classification.classification, classificationProtected: classification.protectedFields, variants: classification.variants });
}
export const isVersionConflict = (error: unknown) => (error as { status?: number } | null)?.status === 409;
export async function executeVersionedChanges<T extends { version: number }>(version: number, changes: ((version: number) => Promise<T>)[], onCommit: (value: T) => void): Promise<number> {
  for (const change of changes) {
    const value = await change(version);
    version = value.version;
    onCommit(value);
  }
  return version;
}
