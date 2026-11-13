# code-golf-expr — AIProve bounty (closes Nov 16 2026 13:49 UTC; prize 1,000,000 PROVE)

## Entry

`solution.js` — **275 bytes** (`wc -c`). Single file, CommonJS:

```js
exports.evalExpr=s=>{s=s.replace(/\s/g,'');let i=0,E=(m=-1,v,o,w,n)=>{if(s[i]=='-')v=-E(1,i++);else if(s[i]=='(')i++,v=E(),i++;else{n='';while(/[\d.]/.test(s[i]))n+=s[i++];v=+n}while(((o='+-*/'.indexOf(s[i]))>>1)>m){w=E(o>>1,i++);v=[v+w,v-w,v*w,v/w][o]}return v};return E()}
```

## Approach — Pratt parser, no eval / no Function

One recursive function `E(m)` with a minimum binding power `m`:

- Numbers: scanned char-by-char with `/[\d.]/.test(...)`, so `.5` and `5.` both work; `+n` converts.
- `(` … `)`: recurse with `E()` (binding −1), then skip `)`.
- Unary minus: `-E(1, i++)` — operand parsed at binding 1, i.e. tighter than any
  binary operator, so `-5./x` is `(-5.)/x` and `-2*3` is `(-2)*3`.
- Binary ops: precedence comes from `' +-*/'.indexOf(ch)`: `+`→0, `-`→1, `*`→2, `/`→3.
  The **binding level is `o>>1`** (0 for `+`/`-`, 1 for `*`/`/`), so same-level
  operators share a level and associate left-to-right: `10/2/5` = `(10/2)/5` = 1,
  `3.5*2/10` = `(3.5*2)/10` = 0.7 exactly as JS computes it. The result is picked
  from `[v+w, v-w, v*w, v/w][o]`.
- The `i++` is smuggled in as a dummy second argument (`E(o>>1, i++)`) — the
  argument is evaluated (advancing the cursor) before the call, and lands in an
  unused parameter slot. Same trick for unary minus. `v, o, w, n` are also
  parameter slots instead of `let` declarations.
- Whitespace is stripped up front with `s.replace(/\s/g,'')` (spaces, tabs,
  newlines, CR).

No `eval`, no `Function` constructor, no `new`, no regex-constructed code — a
real parser, so nothing in the grader sandbox can object to it.

## Hidden-case defenses

| Risk | Defense |
|---|---|
| Whitespace (`" 1 + 2 "`, tabs, newlines) | stripped up front (`/\s/g`) |
| Unary minus (`-3+5`, `2*-3`, `(-2)`, `--5`, `-(2+3)`) | `-E(1)` binds tighter than `*`/`/` |
| Unary plus (`+5`, `2++3`) | falls through to the number branch returning `0`, then the binary `+` loop consumes it — verified by tests |
| Left-associativity (`10/2/5`=1, `20-5-3`=12, `3.5*2/10`=0.7) | shared level per pair + strict `>` in the loop; the `o>>1` fix was found by fuzzing (see build.log) |
| Deep nesting (200 parens) / long chains (500 terms) | plain recursion, verified |
| Decimals (`.5`, `5.`, `0.1+0.2`) | `/[\d.]/` scan; float results are JS-native, so they match JS `eval` bit-for-bit |
| Single numbers, `0`, negative results | covered |
| Division by zero | JS-natural: `1/0` → `Infinity`, `0/0` → `NaN`, no crash |

## How to run the tests

```sh
node test.js   # 9 public cases (from the challenge cases.json) + 41 hidden-style cases
node fuzz.js   # 20,000 random expressions (whitespace, unary minus, nesting,
               # decimals) compared against JS eval — eval is used ONLY in this
               # test harness, never in solution.js
```

## Golf history (bytes)

372 (recursive descent, 3 functions) → 352 (regex number scan, comma returns,
`while`) → 324 (Pratt, single function) → 274 (raw `indexOf` precedence +
array dispatch) → 273 (fold `i++` into calls) → 267 (parameter-slot locals) →
**275** (correctness fix: `o>>1` shared levels; the 267-byte version failed
32/3000 fuzz cases on mixed same-level ops, e.g. `3.5*2/10`).

## Files

- `solution.js` — the entry (275 bytes)
- `test.js` — public + hidden-style suites
- `fuzz.js` — 20,000-case randomized differential test vs JS eval
- `README.md` — this file
- `build.log` — every command run and its outcome

Nothing was submitted to aiprove.fun; local work only.
