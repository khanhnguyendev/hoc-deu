/**
 * Check-in and item results (platform design §5.5; Part B-M5 tasks 5.2a–c): the server actions
 * (`'use server'`: a page passes them to its client components as props), their inputs, the note
 * rules the check-in sheet shares with the server (RF-3, `noteError`), and the check-in UI —
 * CheckInButton and CheckInSheet (client) and CheckInStatus (task 5.2b). Nothing here is
 * `server-only`; the event keys (`./event-keys`) stay out of it.
 */
export { checkInBlock, recordOutcome, type CheckInResult, type OutcomeResult } from './actions'
export {
  CheckInButton,
  type CheckInAction,
  type CheckInButtonProps,
} from './components/check-in-button'
export {
  CheckInSheet,
  type CheckInSheetBlock,
  type CheckInSheetProps,
} from './components/check-in-sheet'
export { CheckInStatus, type CheckInStatusProps } from './components/check-in-status'
export {
  graphemeCount,
  normalizeNote,
  noteError,
  NOTE_MAX_GRAPHEMES,
  type CheckInInput,
  type Outcome,
  type OutcomeInput,
} from './schema'
