import { describe, expect, it } from 'vitest'
import type { ValueType } from '@/lib/content/schemas/tests'
import { goLiteral, goType, javaArgument, javaLiteral, javaType } from './literals'

const int2: ValueType = { base: 'int', dims: 2 }
const int1: ValueType = { base: 'int', dims: 1 }
const char2: ValueType = { base: 'char', dims: 2 }
const long0: ValueType = { base: 'long', dims: 0 }
const double0: ValueType = { base: 'double', dims: 0 }
const bool0: ValueType = { base: 'bool', dims: 0 }
const string0: ValueType = { base: 'string', dims: 0 }

describe('javaType / goType', () => {
  it('render the type name per §3.7', () => {
    expect(javaType(int2)).toBe('int[][]')
    expect(goType(int2)).toBe('[][]int')
    expect(javaType(long0)).toBe('long')
    expect(goType(long0)).toBe('int64')
    expect(javaType(double0)).toBe('double')
    expect(goType(double0)).toBe('float64')
    expect(javaType(bool0)).toBe('boolean')
    expect(goType(bool0)).toBe('bool')
    expect(javaType(string0)).toBe('String')
    expect(goType(string0)).toBe('string')
    expect(javaType(char2)).toBe('char[][]')
    expect(goType(char2)).toBe('[][]byte')
  })
})

describe('javaLiteral / goLiteral — int[][]', () => {
  const value = [[1, 2], [3]]

  it('nests without repeating the type name', () => {
    expect(javaLiteral(value, int2)).toBe('new int[][]{{1,2},{3}}')
    expect(goLiteral(value, int2)).toBe('[][]int{{1,2},{3}}')
  })

  it('renders an empty int[]', () => {
    expect(javaLiteral([], int1)).toBe('new int[]{}')
    expect(goLiteral([], int1)).toBe('[]int{}')
  })

  it('renders an empty int[][]', () => {
    expect(javaLiteral([], int2)).toBe('new int[][]{}')
    expect(goLiteral([], int2)).toBe('[][]int{}')
  })
})

describe('javaLiteral / goLiteral — char[][]', () => {
  it("renders [['5', '.']]", () => {
    const value = [['5', '.']]
    expect(javaLiteral(value, char2)).toBe("new char[][]{{'5','.'}}")
    expect(goLiteral(value, char2)).toBe('[][]byte{{byte(53),byte(46)}}')
  })
})

describe('javaLiteral / goLiteral — strings', () => {
  it('escapes a quote, a newline, and passes through Vietnamese text', () => {
    const value = 'a"b\nXin chào'
    expect(javaLiteral(value, string0)).toBe('"a\\"b\\nXin chào"')
    expect(goLiteral(value, string0)).toBe('"a\\"b\\nXin chào"')
  })
})

describe('javaLiteral / goLiteral — scalars', () => {
  it('long', () => {
    expect(javaLiteral(5, long0)).toBe('5L')
    expect(goLiteral(5, long0)).toBe('int64(5)')
  })

  it('double (2 → 2.0 / float64(2))', () => {
    expect(javaLiteral(2, double0)).toBe('2.0')
    expect(goLiteral(2, double0)).toBe('float64(2)')
  })

  it('bool', () => {
    expect(javaLiteral(true, bool0)).toBe('true')
    expect(goLiteral(false, bool0)).toBe('false')
  })
})

describe('javaArgument — the List<String> bridge (M3 follow-up)', () => {
  const string1: ValueType = { base: 'string', dims: 1 }
  const string2: ValueType = { base: 'string', dims: 2 }

  it('keeps the array literal when the solution declares an array (or nothing is known)', () => {
    expect(javaArgument(['a'], string1, 'String[]')).toEqual({
      type: 'String[]',
      expression: 'new String[]{"a"}',
    })
    expect(javaArgument([1, 2], int1, null)).toEqual({
      type: 'int[]',
      expression: 'new int[]{1,2}',
    })
  })

  it('builds a mutable java.util.List when the solution declares List<String>', () => {
    expect(javaArgument(['cat', 'dog'], string1, 'List<String>')).toEqual({
      type: 'java.util.List<String>',
      expression: 'new java.util.ArrayList<String>(java.util.Arrays.<String>asList("cat","dog"))',
    })
    expect(javaArgument([], string1, 'java.util.List<String>').expression).toBe(
      'new java.util.ArrayList<String>(java.util.Arrays.<String>asList())',
    )
  })

  it('boxes scalar elements and nests lists (List<List<String>>, List<Integer>, List<int[]>)', () => {
    expect(javaArgument([['a'], []], string2, 'List<List<String>>')).toEqual({
      type: 'java.util.List<java.util.List<String>>',
      expression:
        'new java.util.ArrayList<java.util.List<String>>(java.util.Arrays.<java.util.List<String>>asList(' +
        'new java.util.ArrayList<String>(java.util.Arrays.<String>asList("a")),' +
        'new java.util.ArrayList<String>(java.util.Arrays.<String>asList())))',
    })
    expect(javaArgument([3], int1, 'List<Integer>').type).toBe('java.util.List<Integer>')
    expect(javaArgument([[1]], int2, 'List<int[]>')).toEqual({
      type: 'java.util.List<int[]>',
      expression: 'new java.util.ArrayList<int[]>(java.util.Arrays.<int[]>asList(new int[]{1}))',
    })
  })

  it('keeps the declared container (ArrayList, LinkedList, Collection, Iterable), never a scalar', () => {
    expect(javaArgument(['x'], string1, 'ArrayList<String>')).toEqual({
      type: 'java.util.ArrayList<String>',
      expression: 'new java.util.ArrayList<String>(java.util.Arrays.<String>asList("x"))',
    })
    expect(javaArgument(['x'], string1, 'LinkedList<String>').expression).toBe(
      'new java.util.LinkedList<String>(java.util.Arrays.<String>asList("x"))',
    )
    expect(javaArgument(['x'], string1, 'Collection<String>').type).toBe(
      'java.util.Collection<String>',
    )
    expect(javaArgument(['x'], string1, 'Iterable<String>').type).toBe('java.lang.Iterable<String>')
    expect(javaArgument([['x']], string2, 'List<ArrayList<String>>').type).toBe(
      'java.util.List<java.util.ArrayList<String>>',
    )
    expect(javaArgument('x', string0, 'List<String>')).toEqual({
      type: 'String',
      expression: '"x"',
    })
  })
})
