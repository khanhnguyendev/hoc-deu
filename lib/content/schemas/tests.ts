/**
 * `tests.yaml` — the per-problem verification contract (platform design §3.5, §3.7). Pure schema
 * and pure helpers only: no file I/O, no execution. Wave-1 task (3.5a): imports nothing from 3.1
 * (same wave) — the identifier pattern is declared locally here rather than reused from another
 * wave-1 task's module.
 */
import { z } from 'zod'

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/
const identifierSchema = z.string().regex(IDENTIFIER, 'must be an identifier')

/** Scalar value types a `tests.yaml` signature can declare (platform design §3.5). */
export const SCALAR_TYPES = ['int', 'long', 'double', 'bool', 'string', 'char'] as const
export type ScalarType = (typeof SCALAR_TYPES)[number]
export type ValueType = { base: ScalarType; dims: 0 | 1 | 2 }

const SCALAR_TYPE_SET = new Set<string>(SCALAR_TYPES)
const isScalarType = (value: string): value is ScalarType => SCALAR_TYPE_SET.has(value)

const VALUE_TYPE_TEXT = /^([a-z]+)((?:\[\])*)$/

/** Parses a `tests.yaml` type string, e.g. `'int[][]'` → `{ base: 'int', dims: 2 }`; unknown text (an
 * unrecognised base, more than 2 dimensions, or anything not matching `<base><[]>*`) → `null`. */
export function parseValueType(text: string): ValueType | null {
  const match = VALUE_TYPE_TEXT.exec(text)
  if (match === null) return null
  const [, base, brackets] = match
  if (base === undefined || !isScalarType(base)) return null
  const dims = (brackets ?? '').length / 2
  if (dims !== 0 && dims !== 1 && dims !== 2) return null
  return { base, dims: dims as 0 | 1 | 2 }
}

function scalarMatches(value: unknown, base: ScalarType): boolean {
  switch (base) {
    case 'int':
    case 'long':
      return typeof value === 'number' && Number.isSafeInteger(value)
    case 'double':
      return typeof value === 'number' && Number.isFinite(value)
    case 'bool':
      return typeof value === 'boolean'
    case 'string':
      return typeof value === 'string'
    case 'char':
      return typeof value === 'string' && value.length === 1
  }
}

/** Whether `value` (already-parsed JSON/YAML) matches `type`: scalars per §3.5 (`int`/`long` are
 * safe integers, `double` finite, `char` a one-code-unit string), arrays checked per `dims`. */
export function valueMatches(value: unknown, type: ValueType): boolean {
  if (type.dims > 0) {
    if (!Array.isArray(value)) return false
    const inner: ValueType = { base: type.base, dims: (type.dims - 1) as 0 | 1 }
    return value.every((item) => valueMatches(item, inner))
  }
  return scalarMatches(value, type.base)
}

const valueTypeTextSchema = z
  .string()
  .refine((text) => parseValueType(text) !== null, { message: 'not a valid value type' })
const returnsSchema = z.union([valueTypeTextSchema, z.literal('void')])
const paramsSchema = z.record(identifierSchema, valueTypeTextSchema)

/** `signature.kind` values (platform design §3.5, §3.7). M3a supports `function`; the rest parse
 * (so `tests.yaml` for later phases is shaped now) but only run `compile-only` until M3b/M3c. */
export const SIGNATURE_KINDS = [
  'function',
  'linked-list',
  'tree',
  'graph-node',
  'random-list',
  'design-class',
] as const
export type SignatureKind = (typeof SIGNATURE_KINDS)[number]

const functionSignatureSchema = z.strictObject({
  kind: z.literal('function'),
  name: identifierSchema,
  params: paramsSchema,
  returns: returnsSchema,
})

const STRUCTURED_KINDS = ['linked-list', 'tree', 'graph-node', 'random-list'] as const

const structuredSignatureSchema = z.strictObject({
  kind: z.enum(STRUCTURED_KINDS),
  name: identifierSchema,
  params: z.record(identifierSchema, z.string().min(1)),
  returns: z.string().min(1),
})

const methodSchema = z.strictObject({
  params: paramsSchema.default({}),
  returns: returnsSchema,
})

const designClassSignatureSchema = z.strictObject({
  kind: z.literal('design-class'),
  className: z.string().regex(/^[A-Z][A-Za-z0-9]*$/, 'must be PascalCase'),
  constructor: paramsSchema.default({}),
  methods: z.record(identifierSchema, methodSchema),
})

const signatureSchema = z.discriminatedUnion('kind', [
  functionSignatureSchema,
  structuredSignatureSchema,
  designClassSignatureSchema,
])

const SIMPLE_COMPARE_KINDS = ['exact', 'unordered', 'unordered-nested'] as const
const simpleCompareKindSchema = z.enum(SIMPLE_COMPARE_KINDS)

const compareShorthandSchema = simpleCompareKindSchema.transform((kind) => ({ kind }))
const compareObjectSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: simpleCompareKindSchema }),
  z.strictObject({ kind: z.literal('float'), tolerance: z.number().gt(0).lte(1) }),
  z.strictObject({
    kind: z.literal('in-place'),
    arg: identifierSchema,
    compare: simpleCompareKindSchema.default('exact'),
  }),
  z.strictObject({
    kind: z.literal('validator'),
    name: z.string().regex(/^[a-z][a-z0-9-]*$/, 'must be a lowercase-kebab name'),
  }),
])

const compareSpecSchema = z.union([compareShorthandSchema, compareObjectSchema])

const CASE_NAME = /^[a-z0-9][a-z0-9-]*$/
const caseNameSchema = z.string().regex(CASE_NAME, 'must be lowercase-kebab')

const structuredCaseSchema = z.strictObject({
  name: caseNameSchema,
  input: z.record(z.string(), z.unknown()),
  expected: z.unknown(),
})

const designClassCaseSchema = z.strictObject({
  name: caseNameSchema,
  ops: z.array(identifierSchema).min(1),
  args: z.array(z.array(z.unknown())),
  expected: z.array(z.unknown()),
})

const caseSchema = z.union([structuredCaseSchema, designClassCaseSchema])

type StructuredCase = z.infer<typeof structuredCaseSchema>
type DesignClassCase = z.infer<typeof designClassCaseSchema>

const isDesignClassCase = (value: StructuredCase | DesignClassCase): value is DesignClassCase =>
  'ops' in value

/** `{ $result: n }` — a design-class case argument that refers to an earlier operation's result
 * (decision 20; used for codec round-trips such as 271). */
function isResultRef(value: unknown): value is { $result: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    typeof (value as Record<string, unknown>).$result === 'number'
  )
}

/** `{ $any: true }` — a design-class expected value the runner skips comparing (decision 20). */
function isAnyMarker(value: unknown): value is { $any: true } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    (value as Record<string, unknown>).$any === true
  )
}

function collectResultRefs(value: unknown): number[] {
  if (isResultRef(value)) return [value.$result]
  if (Array.isArray(value)) return value.flatMap(collectResultRefs)
  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap(collectResultRefs)
  }
  return []
}

function containsAnyMarker(value: unknown): boolean {
  if (isAnyMarker(value)) return true
  if (Array.isArray(value)) return value.some(containsAnyMarker)
  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(containsAnyMarker)
  }
  return false
}

/** §3.5 minimum: at least one case named `example-<n>` (every LeetCode example — an owner check,
 * not verified here), at least 2 other cases, and at least 4 cases in total. */
export function testsMinimumIssues(cases: readonly { name: string }[]): string[] {
  const issues: string[] = []
  const exampleCount = cases.filter((testCase) => /^example-\d+$/.test(testCase.name)).length
  const otherCount = cases.length - exampleCount
  if (exampleCount < 1) issues.push('needs at least one case named example-<n>')
  if (otherCount < 2) issues.push('needs at least 2 cases besides the LeetCode examples')
  if (cases.length < 4) issues.push('needs at least 4 cases in total')
  return issues
}

function checkFunctionCases(
  signature: z.infer<typeof functionSignatureSchema>,
  compare: z.infer<typeof compareSpecSchema>,
  cases: readonly StructuredCase[],
  ctx: z.core.$RefinementCtx,
  caseIndexOf: (testCase: StructuredCase) => number,
): void {
  const paramNames = Object.keys(signature.params)
  const paramTypes = new Map(
    Object.entries(signature.params).map(([name, text]) => [name, parseValueType(text)]),
  )

  let inPlaceArgType: ValueType | null = null
  if (compare.kind === 'in-place') {
    const argType = paramTypes.get(compare.arg)
    if (argType === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['compare', 'arg'],
        message: `"${compare.arg}" is not a parameter of "${signature.name}"`,
      })
    } else {
      inPlaceArgType = argType
    }
  }
  const returnsType = signature.returns === 'void' ? null : parseValueType(signature.returns)
  const expectedType = returnsType ?? inPlaceArgType

  for (const testCase of cases) {
    const index = caseIndexOf(testCase)
    const path = ['cases', index] as const
    const inputKeys = Object.keys(testCase.input)
    for (const name of paramNames) {
      if (!inputKeys.includes(name)) {
        ctx.addIssue({
          code: 'custom',
          path: [...path, 'input'],
          message: `missing input "${name}"`,
        })
      }
    }
    for (const name of inputKeys) {
      if (!paramNames.includes(name)) {
        ctx.addIssue({
          code: 'custom',
          path: [...path, 'input', name],
          message: `unexpected input "${name}"`,
        })
        continue
      }
      const type = paramTypes.get(name)
      if (type !== undefined && type !== null && !valueMatches(testCase.input[name], type)) {
        ctx.addIssue({
          code: 'custom',
          path: [...path, 'input', name],
          message: `input "${name}" does not match its declared type`,
        })
      }
    }
    if (expectedType !== null && !valueMatches(testCase.expected, expectedType)) {
      ctx.addIssue({
        code: 'custom',
        path: [...path, 'expected'],
        message: 'expected does not match the return type',
      })
    }
  }
}

function checkDesignClassCases(
  signature: z.infer<typeof designClassSignatureSchema>,
  cases: readonly DesignClassCase[],
  ctx: z.core.$RefinementCtx,
  caseIndexOf: (testCase: DesignClassCase) => number,
): void {
  for (const testCase of cases) {
    const index = caseIndexOf(testCase)
    const path = ['cases', index] as const
    const { ops, args, expected } = testCase

    if (ops[0] !== signature.className) {
      ctx.addIssue({
        code: 'custom',
        path: [...path, 'ops', 0],
        message: `ops[0] must be the class name "${signature.className}"`,
      })
    }
    if (ops.length !== args.length || args.length !== expected.length) {
      ctx.addIssue({
        code: 'custom',
        path: [...path],
        message: 'ops, args and expected must have the same length',
      })
    }

    const length = Math.min(ops.length, args.length, expected.length)
    for (let opIndex = 0; opIndex < length; opIndex++) {
      const opName = ops[opIndex]
      const argList = args[opIndex] ?? []
      const paramCount =
        opIndex === 0
          ? Object.keys(signature.constructor).length
          : (() => {
              const method = signature.methods[opName ?? '']
              if (method === undefined) return undefined
              return Object.keys(method.params).length
            })()

      if (opIndex > 0 && (opName === undefined || signature.methods[opName] === undefined)) {
        ctx.addIssue({
          code: 'custom',
          path: [...path, 'ops', opIndex],
          message: `"${opName}" is not a method of "${signature.className}"`,
        })
      } else if (paramCount !== undefined && argList.length !== paramCount) {
        ctx.addIssue({
          code: 'custom',
          path: [...path, 'args', opIndex],
          message: `expected ${paramCount} argument(s)`,
        })
      }

      if (containsAnyMarker(argList)) {
        ctx.addIssue({
          code: 'custom',
          path: [...path, 'args', opIndex],
          message: '{ $any: true } is only allowed in expected',
        })
      }
      for (const ref of collectResultRefs(argList)) {
        if (!(Number.isInteger(ref) && ref >= 0 && ref < opIndex)) {
          ctx.addIssue({
            code: 'custom',
            path: [...path, 'args', opIndex],
            message: `{ $result: ${ref} } must refer to an earlier operation`,
          })
        }
      }
      if (collectResultRefs(expected[opIndex]).length > 0) {
        ctx.addIssue({
          code: 'custom',
          path: [...path, 'expected', opIndex],
          message: '{ $result } is only allowed in args',
        })
      }
    }
  }
}

/** `tests.yaml` (platform design §3.5, §3.7). Strict at the top level; cross-field rules (unique
 * case names, the §3.5 minimum, per-kind case shape and value checks) run in `superRefine`. */
export const testsFileSchema = z
  .strictObject({
    signature: signatureSchema,
    compare: compareSpecSchema.default({ kind: 'exact' }),
    cases: z.array(caseSchema),
    timeoutMs: z.number().int().min(100).max(10000).default(2000),
  })
  .superRefine((data, ctx) => {
    const { signature, compare, cases } = data

    const seen = new Set<string>()
    cases.forEach((testCase, index) => {
      if (seen.has(testCase.name)) {
        ctx.addIssue({
          code: 'custom',
          path: ['cases', index, 'name'],
          message: `duplicate case name "${testCase.name}"`,
        })
      }
      seen.add(testCase.name)
    })

    for (const message of testsMinimumIssues(cases)) {
      ctx.addIssue({ code: 'custom', path: ['cases'], message })
    }

    const designCases: DesignClassCase[] = []
    const structuredCases: StructuredCase[] = []
    cases.forEach((testCase, index) => {
      const wantsDesignClass = signature.kind === 'design-class'
      const isDesign = isDesignClassCase(testCase)
      if (wantsDesignClass && !isDesign) {
        ctx.addIssue({
          code: 'custom',
          path: ['cases', index],
          message: 'design-class tests need { name, ops, args, expected }',
        })
      } else if (!wantsDesignClass && isDesign) {
        ctx.addIssue({
          code: 'custom',
          path: ['cases', index],
          message: 'expected { name, input, expected }',
        })
      } else if (isDesign) {
        designCases.push(testCase)
      } else {
        structuredCases.push(testCase)
      }
    })

    if (signature.kind === 'function') {
      checkFunctionCases(signature, compare, structuredCases, ctx, (testCase) =>
        cases.indexOf(testCase),
      )
    } else if (signature.kind === 'design-class') {
      checkDesignClassCases(signature, designCases, ctx, (testCase) => cases.indexOf(testCase))
    }
  })

export type TestsFile = z.infer<typeof testsFileSchema>
export type CompareSpec = TestsFile['compare']
