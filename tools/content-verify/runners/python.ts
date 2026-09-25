/**
 * Python runner (Part B-M3 decision 19): the static `runner.py` and `check.py` are copied into the
 * work directory with the solution (fix 6: every file the sandbox runs lives there). Cases send a
 * JSON request on stdin; `check.py` is both the tested pre-check and the compile-only check.
 */
import { copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { SOLUTION_FILES } from '../discover'
import type { Command } from '../sandbox'
import {
  caseArguments,
  COMPILE_TIMEOUT_MS,
  functionCall,
  modeOf,
  noCases,
  signatureTargets,
  type Harness,
} from './harness'

const STATIC_DIR = join(import.meta.dirname, 'python')
const SOLUTION = SOLUTION_FILES.python
/** `-I`: isolated (no PYTHON* variables, user site-packages or script directory on sys.path);
 * `-B`: never write `__pycache__`. */
const PYTHON_FLAGS = ['-I', '-B']

export const pythonHarness: Harness = {
  lang: 'python',
  prepare(problem, workDir) {
    copyFileSync(join(problem.dir, SOLUTION), join(workDir, SOLUTION))
    for (const file of ['runner.py', 'check.py']) {
      copyFileSync(join(STATIC_DIR, file), join(workDir, file))
    }
    const check: Command = {
      cmd: 'python',
      args: [
        ...PYTHON_FLAGS,
        'check.py',
        SOLUTION,
        JSON.stringify(signatureTargets(problem.tests)),
      ],
      cwd: workDir,
      timeoutMs: COMPILE_TIMEOUT_MS.check,
    }

    if (modeOf(problem) === 'compile-only') {
      return {
        compile: [],
        warmUp: [],
        runCase: noCases,
        compileOnly: [check],
        signatureIssues: [],
        sharedDirs: [],
      }
    }
    const call = functionCall(problem.tests)
    return {
      compile: [check],
      warmUp: [],
      runCase: (index) => ({
        cmd: 'python',
        args: [...PYTHON_FLAGS, 'runner.py'],
        cwd: workDir,
        stdin: JSON.stringify({
          file: SOLUTION,
          method: call.name,
          args: caseArguments(problem.tests, index),
          output: call.output,
        }),
        timeoutMs: problem.tests.timeoutMs,
      }),
      compileOnly: [],
      signatureIssues: [],
      sharedDirs: [],
    }
  },
}
