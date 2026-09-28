/**
 * Renders a `tests.yaml` value as a Java or Go source literal, and a `ValueType` as the matching
 * Java/Go type name (platform design §3.7). Used by 3.5b's generated Java and Go harnesses — pure
 * text rendering only, no execution.
 */
import type { ScalarType, Structure, ValueType } from '@/lib/content/schemas/tests'

const JAVA_BASE: Record<ScalarType, string> = {
  int: 'int',
  long: 'long',
  double: 'double',
  bool: 'boolean',
  string: 'String',
  char: 'char',
}

const GO_BASE: Record<ScalarType, string> = {
  int: 'int',
  long: 'int64',
  double: 'float64',
  bool: 'bool',
  string: 'string',
  char: 'byte',
}

/** The Java type for `type`, e.g. `{ base: 'int', dims: 2 }` → `'int[][]'`. */
export function javaType(type: ValueType): string {
  return `${JAVA_BASE[type.base]}${'[]'.repeat(type.dims)}`
}

/** The Go type for `type`, e.g. `{ base: 'int', dims: 2 }` → `'[][]int'`. */
export function goType(type: ValueType): string {
  return `${'[]'.repeat(type.dims)}${GO_BASE[type.base]}`
}

function escapeString(value: string): string {
  let out = ''
  for (const ch of value) {
    switch (ch) {
      case '\\':
        out += '\\\\'
        break
      case '"':
        out += '\\"'
        break
      case '\n':
        out += '\\n'
        break
      case '\r':
        out += '\\r'
        break
      case '\t':
        out += '\\t'
        break
      default:
        out += ch
    }
  }
  return `"${out}"`
}

function javaCharLiteral(value: string): string {
  if (value === '\\') return "'\\\\'"
  if (value === "'") return "'\\''"
  if (value === '\n') return "'\\n'"
  return `'${value}'`
}

function javaDoubleLiteral(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : `${value}`
}

function javaScalarLiteral(value: unknown, base: ScalarType): string {
  switch (base) {
    case 'int':
      return `${value as number}`
    case 'long':
      return `${value as number}L`
    case 'double':
      return javaDoubleLiteral(value as number)
    case 'bool':
      return `${value as boolean}`
    case 'string':
      return escapeString(value as string)
    case 'char':
      return javaCharLiteral(value as string)
  }
}

function goScalarLiteral(value: unknown, base: ScalarType): string {
  switch (base) {
    case 'int':
      return `${value as number}`
    case 'long':
      return `int64(${value as number})`
    case 'double':
      return `float64(${value as number})`
    case 'bool':
      return `${value as boolean}`
    case 'string':
      return escapeString(value as string)
    case 'char':
      return `byte(${(value as string).charCodeAt(0)})`
  }
}

function arrayBody(
  value: unknown[],
  elementType: ValueType,
  scalarLiteral: (value: unknown, base: ScalarType) => string,
): string {
  if (elementType.dims > 0) {
    const inner: ValueType = { base: elementType.base, dims: (elementType.dims - 1) as 0 | 1 }
    const items = (value as unknown[][]).map((item) => arrayBody(item, inner, scalarLiteral))
    return `{${items.join(',')}}`
  }
  return `{${value.map((item) => scalarLiteral(item, elementType.base)).join(',')}}`
}

/** A Java source literal for `value` at `type`, e.g. `[[1, 2], [3]]` at `int[][]` →
 * `'new int[][]{{1,2},{3}}'`. */
export function javaLiteral(value: unknown, type: ValueType): string {
  if (type.dims === 0) return javaScalarLiteral(value, type.base)
  const inner: ValueType = { base: type.base, dims: (type.dims - 1) as 0 | 1 }
  return `new ${javaType(type)}${arrayBody(value as unknown[], inner, javaScalarLiteral)}`
}

/** A Go source literal for `value` at `type`, e.g. `[[1, 2], [3]]` at `int[][]` →
 * `'[][]int{{1,2},{3}}'`. */
export function goLiteral(value: unknown, type: ValueType): string {
  if (type.dims === 0) return goScalarLiteral(value, type.base)
  const inner: ValueType = { base: type.base, dims: (type.dims - 1) as 0 | 1 }
  return `${goType(type)}${arrayBody(value as unknown[], inner, goScalarLiteral)}`
}

const JAVA_BOXED: Record<ScalarType, string> = {
  int: 'Integer',
  long: 'Long',
  double: 'Double',
  bool: 'Boolean',
  string: 'String',
  char: 'Character',
}

/** Collection types a Java solution may declare for a `tests.yaml` array, the qualified name its
 * variable is declared with and the class it is built from (mutable: a solution may edit it). */
const JAVA_COLLECTIONS: Record<string, { qualified: string; build: string }> = {
  List: { qualified: 'java.util.List', build: 'java.util.ArrayList' },
  ArrayList: { qualified: 'java.util.ArrayList', build: 'java.util.ArrayList' },
  LinkedList: { qualified: 'java.util.LinkedList', build: 'java.util.LinkedList' },
  Collection: { qualified: 'java.util.Collection', build: 'java.util.ArrayList' },
  Iterable: { qualified: 'java.lang.Iterable', build: 'java.util.ArrayList' },
}

const JAVA_COLLECTION_TYPE = /^(?:java\.(?:util|lang)\.)?(\w+)\s*<\s*(.+?)\s*>$/

/** `{ container, element }` when `declared` is a supported collection type, e.g.
 * `'List<String>'` → List of `'String'`. */
function javaCollection(declared: string | null) {
  const match = declared === null ? null : JAVA_COLLECTION_TYPE.exec(declared.trim())
  if (match === null) return null
  const container = JAVA_COLLECTIONS[match[1] ?? '']
  return container === undefined ? null : { container, element: match[2] ?? '' }
}

/**
 * A Java variable type and initialiser for `value` at `type`, bridged to what the solution
 * declares (M3 follow-up, problems 139, 127, 271): `tests.yaml` has arrays only, but a LeetCode
 * Java signature often takes `List<String>` — then the argument is a mutable `java.util.List`
 * (nested for `List<List<String>>`, boxed for `List<Integer>`). Anything else, or no declaration
 * (`null`), keeps the array literal.
 */
export function javaArgument(
  value: unknown,
  type: ValueType,
  declared: string | null,
): { type: string; expression: string } {
  const collection = type.dims > 0 ? javaCollection(declared) : null
  if (collection === null) return { type: javaType(type), expression: javaLiteral(value, type) }
  const elementType: ValueType = { base: type.base, dims: (type.dims - 1) as 0 | 1 }
  const items = (value as unknown[]).map((item) =>
    javaArgument(item, elementType, collection.element),
  )
  const element =
    elementType.dims === 0
      ? JAVA_BOXED[elementType.base]
      : javaArgument([], elementType, collection.element).type
  return {
    type: `${collection.container.qualified}<${element}>`,
    expression: `new ${collection.container.build}<${element}>(java.util.Arrays.<${element}>asList(${items.map((item) => item.expression).join(',')}))`,
  }
}

const INT_2D: ValueType = { base: 'int', dims: 2 }
const INT_1D: ValueType = { base: 'int', dims: 1 }

/** The Java classes behind each structure (static files in `runners/java/`, M3b). */
export const JAVA_STRUCTURES: Readonly<Record<Structure, { type: string; codec: string }>> = {
  list: { type: 'ListNode', codec: 'HarnessLists' },
  lists: { type: 'ListNode[]', codec: 'HarnessLists' },
  tree: { type: 'TreeNode', codec: 'HarnessTrees' },
  graph: { type: 'Node', codec: 'HarnessGraphs' },
  'random-list': { type: 'Node', codec: 'HarnessRandomLists' },
}

const nullable = (item: unknown, none: string): string =>
  item === null ? none : `${item as number}`

/** A cycle input (`{ values, pos }`) or a plain list: its values and cycle position. */
function listParts(value: unknown): { values: number[]; pos: number | null } {
  if (Array.isArray(value)) return { values: value as number[], pos: null }
  const { values, pos } = value as { values: number[]; pos: number }
  return { values, pos }
}

/** A Java expression that decodes a structure's `tests.yaml` encoding, e.g. a tree
 * `[1, null, 2]` → `'HarnessTrees.decode(new Integer[]{1,null,2})'`. */
export function javaStructureLiteral(value: unknown, structure: Structure): string {
  const { codec } = JAVA_STRUCTURES[structure]
  switch (structure) {
    case 'list': {
      const { values, pos } = listParts(value)
      const array = javaLiteral(values, INT_1D)
      return pos === null ? `${codec}.decode(${array})` : `${codec}.decode(${array}, ${pos})`
    }
    case 'lists':
      return `${codec}.decodeAll(${javaLiteral(value, INT_2D)})`
    case 'tree':
      return `${codec}.decode(new Integer[]{${(value as unknown[]).map((item) => nullable(item, 'null')).join(',')}})`
    case 'graph':
      return `${codec}.decode(${javaLiteral(value, INT_2D)})`
    case 'random-list': {
      const entries = (value as unknown[][]).map(
        ([val, random]) => `{${nullable(val, 'null')},${nullable(random, 'null')}}`,
      )
      return `${codec}.decode(new Integer[][]{${entries.join(',')}})`
    }
  }
}

/** The Go structure types and codec function suffixes (static `runners/go/harness_*.go`, M3b). */
export const GO_STRUCTURES: Readonly<Record<Structure, { codec: string; file: string }>> = {
  list: { codec: 'List', file: 'harness_list.go' },
  lists: { codec: 'Lists', file: 'harness_list.go' },
  tree: { codec: 'Tree', file: 'harness_tree.go' },
  graph: { codec: 'Graph', file: 'harness_graph.go' },
  'random-list': { codec: 'RandomList', file: 'harness_random_list.go' },
}

/** A Go expression that decodes a structure's `tests.yaml` encoding, e.g. a tree `[1, null, 2]` →
 * `'harnessDecodeTree([]any{1,nil,2})'`. */
export function goStructureLiteral(value: unknown, structure: Structure): string {
  const decode = `harnessDecode${GO_STRUCTURES[structure].codec}`
  switch (structure) {
    case 'list': {
      const { values, pos } = listParts(value)
      return `${decode}(${goLiteral(values, INT_1D)}, ${pos ?? -1})`
    }
    case 'lists':
    case 'graph':
      return `${decode}(${goLiteral(value, INT_2D)})`
    case 'tree':
      return `${decode}([]any{${(value as unknown[]).map((item) => nullable(item, 'nil')).join(',')}})`
    case 'random-list': {
      const entries = (value as unknown[][]).map(
        ([val, random]) => `{${nullable(val, 'nil')},${nullable(random, 'nil')}}`,
      )
      return `${decode}([][]any{${entries.join(',')}})`
    }
  }
}
