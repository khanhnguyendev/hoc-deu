/**
 * Shared track pieces for onboarding (2.10) and settings (2.11). Client components import this
 * file, so it exports **client-safe items only**: re-exporting a `server-only` module here would
 * break the client build. The server loader (`loadTrackOptions`) lives in
 * `lib/content/track-options.ts`.
 */
export { VariantPicker, type VariantPickerProps } from './components/variant-picker'
export {
  WeeklyTemplatePreview,
  type WeeklyTemplatePreviewProps,
} from './components/weekly-template-preview'
