// 広報管理の業務ロジック（lib/kouhou/domain/ ほか）を、GAS に貼り付ける1ファイル gas/kouhou/Domain.gs にまとめる。
// 画面と GAS で同じ判定・操作を使うため。lib/kouhou/domain/ を変えたら、これを実行して GAS の Domain.gs を貼り替える。
//   node scripts/build-kouhou-gas.mjs
// 出力先の gas/ は .gitignore 済み（GAS のコードは GitHub に上げない）。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'

const ROOT = resolve(import.meta.dirname, '..')
const ENTRY = 'lib/kouhou/domain/commands.ts'
const OUT = 'gas/kouhou/Domain.gs'

const modules = new Map()

function resolveImport(from, spec) {
  let p
  if (spec.startsWith('@/')) p = join(ROOT, spec.slice(2))
  else if (spec.startsWith('.')) p = resolve(dirname(join(ROOT, from)), spec)
  else throw new Error(`${from}: 外部パッケージ "${spec}" は GAS で使えません`)
  for (const cand of [p, `${p}.ts`, join(p, 'index.ts')]) {
    try {
      readFileSync(cand)
      return relative(ROOT, cand)
    } catch {}
  }
  throw new Error(`${from}: "${spec}" が見つかりません`)
}

function add(file) {
  if (modules.has(file)) return
  const src = readFileSync(join(ROOT, file), 'utf8')
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018, esModuleInterop: false, importHelpers: false },
    fileName: file,
  }).outputText
  const deps = {}
  modules.set(file, { code: out, deps })
  for (const m of out.matchAll(/require\("([^"]+)"\)/g)) {
    const target = resolveImport(file, m[1])
    deps[m[1]] = target
    add(target)
  }
}

add(ENTRY)

let body = ''
for (const [file, { code, deps }] of modules) {
  body += `\n  // ---- ${file}\n  __defs[${JSON.stringify(file)}] = { deps: ${JSON.stringify(deps)}, fn: function (exports, require) {\n${code}\n  } };\n`
}

const header = `// 自動生成：node scripts/build-kouhou-gas.mjs（lib/kouhou/domain/ から作成）。このファイルは編集しないこと。
// 生成日時 ${new Date().toISOString()}
`
const bundle = `${header}
var KouhouDomain = (function () {
  // GAS には structuredClone が無い（状態は JSON にできる値だけなので JSON で複製する）
  var structuredClone = function (v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)) };
  var __defs = {};
  var __cache = {};
  function __load(file) {
    if (__cache[file]) return __cache[file].exports;
    var def = __defs[file];
    var module = { exports: {} };
    __cache[file] = module;
    def.fn.call(module.exports, module.exports, function (spec) { return __load(def.deps[spec]); });
    return module.exports;
  }
${body}
  return __load(${JSON.stringify(ENTRY)});
})();
`
mkdirSync(join(ROOT, dirname(OUT)), { recursive: true })
writeFileSync(join(ROOT, OUT), bundle)
console.log(`build-kouhou-gas: ${modules.size} files -> ${OUT} (${Math.round(bundle.length / 1024)} KB)`)
