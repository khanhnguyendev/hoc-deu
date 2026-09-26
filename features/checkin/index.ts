/**
 * Check-in and item results (platform design §5.5; Part B-M5 tasks 5.2a–c): the server actions
 * (`'use server'`: a page passes them to its client components as props), their inputs and the
 * note rules the check-in sheet shares with the server (RF-3, `noteError`). Nothing here is
 * `server-only`; the event keys (`./event-keys`) stay out of it.
 */
export { checkInBlock, recordOutcome, type CheckInResult, type OutcomeResult } from './actions'
export {
  graphemeCount,
  normalizeNote,
  noteError,
  NOTE_MAX_GRAPHEMES,
  type CheckInInput,
  type Outcome,
  type OutcomeInput,
} from './schema'
