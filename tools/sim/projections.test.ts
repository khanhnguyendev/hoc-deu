/**
 * The committed simulation outputs match the content they were generated from (platform design
 * §5.10, §5.11; ADR-0037): the projection table's inputs hash and rules version, and the inputs
 * the simulation tests read. An owner PR that changes a DSA roadmap, a problem's difficulty or the
 * manifest's srs / review / estimates / weeklyTemplate / defaults regenerates both in the same PR.
 */
import { describe, expect, it } from 'vitest'
import { CATALOG } from '@/.generated/catalog'
import {
  ENGLISH_MODEL_CATALOG,
  ENGLISH_MODEL_TEMPLATE,
} from '@/lib/domain/plan/__tests__/englishModel'
import projections from '@/lib/domain/plan/projections.generated.json'
import simInputsFile from '@/lib/domain/plan/sim-inputs.generated.json'
import { RULES_VERSION } from '@/lib/domain/rules'
import { inputsHash, simInputs } from './inputs'

const STALE = 'stale — run pnpm sim:projections'
const INPUTS = simInputs(CATALOG)

describe('projections.generated.json', () => {
  it('matches the projection inputs hash of the current content', () => {
    expect(projections.inputsHash, STALE).toBe(inputsHash(INPUTS))
  })

  it('was generated under the current rules', () => {
    expect(projections.rulesVersion, STALE).toBe(RULES_VERSION)
  })
})

describe('sim-inputs.generated.json', () => {
  it('equals the inputs extracted from the current content', () => {
    expect(simInputsFile, STALE).toEqual(INPUTS)
  })
})

describe('the English simulation model (lib/domain/plan/__tests__/englishModel.ts)', () => {
  const english = CATALOG.tracks.find((track) => track.id === 'english')
  const MESSAGE = 'the English manifest changed — update englishModel.ts to match'

  it('runs the real English template', () => {
    expect(ENGLISH_MODEL_TEMPLATE, MESSAGE).toEqual(english?.weeklyTemplate)
  })

  it('runs the real English defaults (25 min, newPerDay 8, throttle > 40 → 4, > 60 → 0)', () => {
    expect(ENGLISH_MODEL_CATALOG.tracks.english?.defaults, MESSAGE).toEqual(english?.defaults)
  })
})
