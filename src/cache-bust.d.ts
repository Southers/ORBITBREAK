/**
 * TypeScript cannot resolve browser cache-bust query strings on relative
 * imports. This ambient wildcard keeps checkJs passing while every src module
 * import shares the published canvas build token.
 */
declare module '*?v=20260819-ob134';
