import ts from 'typescript'
import { defineConfig } from 'vitest/config'

const decoratorSyntax = /^\s*@[A-Za-z_$][\w$]*/m

/**
 * Transform standard TypeScript decorators (the `@Remote(...)` service
 * markers) before Vite's default parser sees source files. esbuild's
 * transform does not understand the TC39 decorator syntax, so the harness
 * pre-transpiles it with the TypeScript compiler (vendored pattern from
 * deepseek-harness' vitest.shared.ts, MIT).
 */
function standardDecoratorPlugin() {
  return {
    name: 'dsh-standard-decorators',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      const file = id.split('?', 1)[0]!
      if (!/\.[cm]?tsx?$/.test(file) || !decoratorSyntax.test(code)) return
      const result = ts.transpileModule(code, {
        fileName: file,
        compilerOptions: {
          target: ts.ScriptTarget.ES2024,
          module: ts.ModuleKind.ESNext,
          jsx: file.endsWith('x') ? ts.JsxEmit.ReactJSX : undefined,
          sourceMap: true,
        },
      })
      return {
        code: result.outputText
          .replace(
            /^(\s*)(__esDecorate\()/gmu,
            '$1/* v8 ignore next -- compiler-synthetic decorator accessors have no source behavior */ $2',
          )
          .replace(/\n?\/\/# sourceMappingURL=.*$/u, '\n'),
        map: result.sourceMapText,
      }
    },
  }
}

export default defineConfig({
  plugins: [standardDecoratorPlugin()],
  test: {
    include: [
      'tests/**/*.spec.ts',
      'tests/**/*.spec.tsx',
    ],
    // Client component specs opt into jsdom with a per-file pragma; the shared
    // default stays node.
    environment: 'node',
  },
})
