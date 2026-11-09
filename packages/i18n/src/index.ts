/**
 * Barrel for server code and tooling. Client code must import `@vcraft/i18n/routing` instead: this barrel
 * also pulls in both message files (~250 KB), which a client bundle would then ship.
 */
export * from './messages';
export * from './routing';
