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

/** `signature.kind` values (platform design §3.5, §3.7). M3a runs `function`, M3b the structured
 * kinds; `design-class` parses (so its `tests.yaml` is shaped now) but runs `compile-only` until
 * M3c. */
export const SIGNATURE_KINDS = [
  'function',
  'linked-list',
  'tree',
  'graph-node',
  'random-list',
  'design-class',
] as const
export type SignatureKind = (typeof SIGNATURE_KINDS)[number]

/** The structure a `ListNode` / `TreeNode` / `Node` type names, per structured kind (spec §3.5,
 * decision 25) — LeetCode's own encodings, so `tests.yaml` copies the page:
 * - `list`: an array of values (`[]` = null); as an input, `{ values, pos }` adds a cycle (141);
 * - `lists`: `ListNode[]`, an array of lists (23);
 * - `tree`: the level-order array with `null` gaps (`[3,9,20,null,null,15,7]`);
 * - `graph`: the adjacency list, node `i + 1` at index `i` (133);
 * - `random-list`: `[[val, randomIndex | null], …]` (138). */
export type Structure = 'list' | 'lists' | 'tree' | 'graph' | 'random-list'

const STRUCTURE_TYPES: Readonly<
  Partial<Record<SignatureKind, Readonly<Record<string, Structure>>>>
> = {
  'linked-list': { ListNode: 'list', 'ListNode[]': 'lists' },
  tree: { TreeNode: 'tree' },
  'graph-node': { Node: 'graph' },
  'random-list': { Node: 'random-list' },
}

/** A parameter or return type: a value type, or (structured kinds) a structure. */
export type ParamType =
  { kind: 'value'; type: ValueType } | { kind: 'structure'; structure: Structure }

/** Parses a parameter / return type under a signature kind: value types for `function` and the
 * structured kinds, plus the structure types of that kind; anything else → `null`. */
export function parseParamType(kind: SignatureKind, text: string): ParamType | null {
  if (kind === 'design-class') return null
  const structure = STRUCTURE_TYPES[kind]?.[text]
  if (structure !== undefined) return { kind: 'structure', structure }
  const type = parseValueType(text)
  return type === null ? null : { kind: 'value', type }
}

const isInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value)
const isIntegerArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every(isInteger)
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function listIssue(value: unknown, role: 'input' | 'expected'): string | null {
  if (isIntegerArray(value)) return null
  if (role === 'expected') return 'a returned linked list is an array of integers'
  const shape = 'a linked list is an array of integers, or { values, pos } for a cycle'
  if (!isPlainObject(value)) return shape
  const keys = Object.keys(value).sort()
  if (keys.length !== 2 || keys[0] !== 'pos' || keys[1] !== 'values') return shape
  const { values, pos } = value
  if (!isIntegerArray(values) || !isInteger(pos)) return shape
  if (values.length === 0) return pos === -1 ? null : 'pos must be -1 (no cycle) for an empty list'
  if (pos < -1 || pos >= values.length) {
    return `pos must be -1 (no cycle) or the index of a node (0–${values.length - 1})`
  }
  return null
}

function treeIssue(value: unknown): string | null {
  if (!Array.isArray(value) || !value.every((item) => item === null || isInteger(item))) {
    return 'a tree is a level-order array of integers and nulls'
  }
  if (value.length === 0) return null
  if (value[0] === null) return 'the root of a non-empty tree cannot be null ([] is the empty tree)'
  if (value.at(-1) === null) return "drop the trailing nulls (LeetCode's level-order form)"
  // Each non-null value opens two child places, filled in order; a value beyond them has no parent.
  let places = 1
  for (let index = 0; index < value.length; index++) {
    if (index >= places) return `value ${index} has no parent: every null ends its branch`
    if (value[index] !== null) places += 2
  }
  return null
}

function graphIssue(value: unknown): string | null {
  if (!Array.isArray(value) || !value.every(isIntegerArray)) {
    return 'a graph is an adjacency list: node i + 1 at index i, an array of neighbour numbers'
  }
  const count = value.length
  for (const [index, neighbours] of value.entries()) {
    const node = index + 1
    const seen = new Set<number>()
    for (const neighbour of neighbours) {
      if (neighbour < 1 || neighbour > count) {
        return `node ${node} lists neighbour ${neighbour}: neighbours are node numbers 1–${count}`
      }
      if (neighbour === node) return `node ${node} lists itself as a neighbour`
      if (seen.has(neighbour)) return `node ${node} lists neighbour ${neighbour} twice`
      seen.add(neighbour)
    }
  }
  if (count === 0) return null
  // The runner encodes what it reaches from the returned node, so every node must be reachable.
  const reached = new Set<number>([1])
  const stack = [1]
  while (stack.length > 0) {
    const node = stack.pop() as number
    for (const neighbour of value[node - 1] as number[]) {
      if (!reached.has(neighbour)) {
        reached.add(neighbour)
        stack.push(neighbour)
      }
    }
  }
  for (let node = 1; node <= count; node++) {
    if (!reached.has(node)) return `node ${node} cannot be reached from node 1`
  }
  return null
}

function randomListIssue(value: unknown): string | null {
  const shape = 'a random-pointer list is [[val, randomIndex | null], …]'
  if (!Array.isArray(value)) return shape
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length !== 2 || !isInteger(entry[0])) return shape
    if (entry[1] !== null && !isInteger(entry[1])) return shape
  }
  for (const [index, entry] of (value as [number, number | null][]).entries()) {
    const random = entry[1]
    if (random !== null && (random < 0 || random >= value.length)) {
      return `node ${index} has random index ${random}: random is null or a node index (0–${value.length - 1})`
    }
  }
  return null
}

/** Why `value` is not a valid encoding of `structure` (`null` when it is). A cycle
 * (`{ values, pos }`) is an input form only: a returned list is a plain array. */
export function structureIssue(
  structure: Structure,
  value: unknown,
  role: 'input' | 'expected',
): string | null {
  switch (structure) {
    case 'list':
      return listIssue(value, role)
    case 'lists':
      return Array.isArray(value) && value.every(isIntegerArray)
        ? null
        : 'ListNode[] is an array of linked lists (arrays of integers)'
    case 'tree':
      return treeIssue(value)
    case 'graph':
      return graphIssue(value)
    case 'random-list':
      return randomListIssue(value)
  }
}

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

/** Every plain object inherits `constructor` (`Object.prototype.constructor`), so an omitted key
 * reaches the schema as that function, never `undefined`: read it as "no parameters". Parsed YAML
 * never holds a function. */
const constructorSchema = z.preprocess(
  (value) => (typeof value === 'function' ? undefined : value),
  paramsSchema.default({}),
)

const designClassSignatureSchema = z.strictObject({
  kind: z.literal('design-class'),
  className: z.string().regex(/^[A-Z][A-Za-z0-9]*$/, 'must be PascalCase'),
  constructor: constructorSchema,
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

/** Why `value` does not fit `type` (`null` when it does); `label` names the value in the message. */
function valueIssue(
  value: unknown,
  type: ParamType,
  text: string,
  role: 'input' | 'expected',
  label: string,
): string | null {
  if (type.kind === 'value') {
    if (valueMatches(value, type.type)) return null
    return role === 'input'
      ? `${label} does not match its declared type`
      : 'expected does not match the return type'
  }
  const issue = structureIssue(type.structure, value, role)
  return issue === null ? null : `${label} is not a valid ${text}: ${issue}`
}

/** The case checks of a `function` or structured signature: inputs by parameter name, each value
 * against its type (a structure against its encoding), `expected` against the return type — or,
 * for an in-place compare, against the argument's type. Unknown types are signature issues. */
function checkCallCases(
  signature: z.infer<typeof functionSignatureSchema> | z.infer<typeof structuredSignatureSchema>,
  compare: z.infer<typeof compareSpecSchema>,
  cases: readonly StructuredCase[],
  ctx: z.core.$RefinementCtx,
  caseIndexOf: (testCase: StructuredCase) => number,
): void {
  const typeNames =
    signature.kind === 'function'
      ? ''
      : ` (${Object.keys(STRUCTURE_TYPES[signature.kind] ?? {}).join(', ')} or a value type such as int[])`
  const unknownType = `not a ${signature.kind} type${typeNames}`
  const paramNames = Object.keys(signature.params)
  const paramTypes = new Map<string, { type: ParamType; text: string } | null>()
  for (const [name, text] of Object.entries(signature.params)) {
    const type = parseParamType(signature.kind, text)
    // `function` parameters are already checked by paramsSchema.
    if (type === null && signature.kind !== 'function') {
      ctx.addIssue({ code: 'custom', path: ['signature', 'params', name], message: unknownType })
    }
    paramTypes.set(name, type === null ? null : { type, text })
  }

  let inPlaceArg: { type: ParamType; text: string } | null = null
  if (compare.kind === 'in-place') {
    const argType = paramTypes.get(compare.arg)
    if (argType === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['compare', 'arg'],
        message: `"${compare.arg}" is not a parameter of "${signature.name}"`,
      })
    } else {
      inPlaceArg = argType
    }
  }
  let returns: { type: ParamType; text: string } | null = null
  if (signature.returns !== 'void') {
    const type = parseParamType(signature.kind, signature.returns)
    if (type === null && signature.kind !== 'function') {
      ctx.addIssue({ code: 'custom', path: ['signature', 'returns'], message: unknownType })
    }
    returns = type === null ? null : { type, text: signature.returns }
  }
  const expectedType = returns ?? inPlaceArg

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
      if (type === undefined || type === null) continue
      const issue = valueIssue(
        testCase.input[name],
        type.type,
        type.text,
        'input',
        `input "${name}"`,
      )
      if (issue !== null) {
        ctx.addIssue({ code: 'custom', path: [...path, 'input', name], message: issue })
      }
    }
    if (expectedType !== null) {
      const issue = valueIssue(
        testCase.expected,
        expectedType.type,
        expectedType.text,
        'expected',
        'expected',
      )
      if (issue !== null) {
        ctx.addIssue({ code: 'custom', path: [...path, 'expected'], message: issue })
      }
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

    if (signature.kind === 'design-class') {
      checkDesignClassCases(signature, designCases, ctx, (testCase) => cases.indexOf(testCase))
    } else {
      checkCallCases(signature, compare, structuredCases, ctx, (testCase) =>
        cases.indexOf(testCase),
      )
    }
  })

export type TestsFile = z.infer<typeof testsFileSchema>
export type CompareSpec = TestsFile['compare']
