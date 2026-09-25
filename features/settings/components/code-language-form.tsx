'use client'

import { useId, useState } from 'react'
import { ChoiceCard } from '@/components/patterns/choice-card'
import { FormActions } from '@/components/patterns/form-actions'
import { FormFieldError } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { CodeLanguage } from '@/lib/auth/dal'
import { vi } from '@/lib/i18n/vi'
import { CODE_LANGUAGES, type SettingsAction } from '../schema'
import { failureOf, fieldErrorsOf, useSettingsAction } from './use-settings-action'

const copy = vi.settings.codeLanguage

type CodeLanguageFormProps = {
  /** The profile's language; `null` reads as Python (the default). */
  codeLanguage: CodeLanguage | null
  /** The page's per-render UUID (decision 9). */
  requestId: string
  updateCodeLanguage: SettingsAction
}

const isCodeLanguage = (value: string): value is CodeLanguage =>
  CODE_LANGUAGES.some((language) => language === value)

/** Python / Java / Go for solutions and sample code (§2.4), saved with "Lưu". */
function CodeLanguageForm({ codeLanguage, requestId, updateCodeLanguage }: CodeLanguageFormProps) {
  const uid = useId()
  const saved = codeLanguage ?? 'python'
  const [value, setValue] = useState<CodeLanguage>(saved)
  const [shown, setShown] = useState<CodeLanguage>(saved)
  if (shown !== saved) {
    setShown(saved)
    setValue(saved)
  }
  const { result, pending, onSubmit } = useSettingsAction(updateCodeLanguage)
  const error = fieldErrorsOf(result).codeLanguage
  const failure = failureOf(result)
  const errorId = `${uid}-error`

  return (
    <form
      data-slot="code-language-form"
      aria-label={copy.title}
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <div className="flex flex-col gap-2">
        <RadioGroup
          name="codeLanguage"
          aria-label={copy.title}
          aria-describedby={error === undefined ? undefined : errorId}
          value={value}
          onValueChange={(next) => isCodeLanguage(next) && setValue(next)}
          className="grid gap-3 sm:grid-cols-3"
        >
          {CODE_LANGUAGES.map((language) => (
            <ChoiceCard
              key={language}
              htmlFor={`${uid}-${language}`}
              control={
                <RadioGroupItem
                  id={`${uid}-${language}`}
                  value={language}
                  aria-invalid={error === undefined ? undefined : true}
                  className="mt-0.5"
                />
              }
              title={vi.onboarding.language[language]}
            />
          ))}
        </RadioGroup>
        {error !== undefined && <FormFieldError id={errorId}>{error}</FormFieldError>}
      </div>
      <FormActions error={failure}>
        <Button type="submit" loading={pending}>
          {copy.save}
        </Button>
      </FormActions>
    </form>
  )
}

export { CodeLanguageForm }
export type { CodeLanguageFormProps }
