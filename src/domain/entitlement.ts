export interface Entitlements {
  maxSnapshots: number;
  maxBytes: number;
  favorites: boolean;
  namedSnapshots: boolean;
  advancedRestore: boolean;
}
export interface EntitlementProvider {
  get(): Entitlements;
}
export class LocalEntitlementProvider implements EntitlementProvider {
  get(): Entitlements {
    return {
      maxSnapshots: 20,
      maxBytes: 32 * 1024 * 1024,
      favorites: false,
      namedSnapshots: false,
      advancedRestore: false,
    };
  }
}
export const entitlements: EntitlementProvider = new LocalEntitlementProvider();
