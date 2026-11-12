/**
 * `autocomplete` tokens of the fields the agent never types into and never
 * reads back. Handed to the injected page functions as an argument, since they
 * cannot import anything.
 */
export const SECRET_FIELDS = [
  'current-password',
  'new-password',
  'one-time-code',
  'cc-number',
  'cc-csc',
  'cc-exp',
  'cc-exp-month',
  'cc-exp-year',
  'cc-name',
  'cc-type',
];
