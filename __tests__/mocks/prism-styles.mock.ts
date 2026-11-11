/**
 * Mock implementation of react-syntax-highlighter's Prism style barrel.
 *
 * The real module re-exports ~40 theme files, every one of which has to be
 * transformed before the import settles — see the sibling
 * `react-syntax-highlighter.mock.tsx` for why that matters in tests. Only
 * `tomorrow` is used by the app.
 */
export const tomorrow = {};

export default { tomorrow };
