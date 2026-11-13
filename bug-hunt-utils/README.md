# bug-hunt-utils — AIProve bounty entry

Challenge closes Nov 15 2026 13:49 UTC; prize 0.5 NVDA.
Entry format: a JSON list `[{fn, input, expected}]`.

## Files

- `bugs.json` — the entry (8 reports, 5 distinct functions).
- `utils.js` — verbatim copy of the challenge's `utils.js` (from
  `~/workspace/aiprove-agent/aiprove/challenges/bug-hunt-utils/`).
- `verify.js` — reproduces every report against `utils.js` and cross-checks
  each `expected` against an independent reference implementation.
- `build.log` — every command run and its outcome.

## How to verify

```sh
node verify.js   # exit 0 iff all 8 bugs reproduce and every expected value matches the reference
```

## Verified bugs

### 1. `factorial` — loop drops `n` (`i < n` instead of `i <= n`)
- `factorial(5)` → actual `24`, expected `120`
- `factorial(2)` → actual `1`, expected `2`
- `factorial(0)` and `factorial(1)` are correct (`1`), so the bug only shows for n ≥ 2.

### 2. `countVowels` — regex `/[aeiou]/g` misses uppercase vowels
- `countVowels("AEIOU")` → actual `0`, expected `5`
- `countVowels("Apple")` → actual `1` (only the `e`), expected `2`
- Lowercase-only input (`"aeiou"` → `5`) is correct.

### 3. `titleCase` — never lowercases, and capitalises after apostrophes
- `titleCase("hELLO WORLD")` → actual `"HELLO WORLD"`, expected `"Hello World"`
  (it uppercases word-initial letters but leaves the rest untouched).
- `titleCase("don't stop")` → actual `"Don'T Stop"`, expected `"Don't Stop"`
  (`\b` matches between `'` and `t`, so the `t` is wrongly capitalised).
- Plain lowercase input (`"hello world"` → `"Hello World"`) is correct.

### 4. `reverse` — `split("")` splits UTF-16 code units, breaking surrogate pairs
- `reverse("😀a")` → actual `"a\uDE00\uD83D"` (two lone, invalid surrogates),
  expected `"a😀"`. The output is not even a valid string — the emoji is destroyed.
- ASCII input (`"hello"` → `"olleh"`) is correct.

### 5. `isPalindrome` — knock-on of the `reverse` bug
- `isPalindrome("😀")` → actual `false`, expected `true`. A single emoji is
  trivially a palindrome; the comparison fails only because `reverse` corrupts it.
- `isPalindrome`'s own logic (`s === reverse(s)`) is fine; the fault is inherited
  from `reverse`. Included because it is a distinct failing input against the
  reference behaviour.

## Investigated and NOT reported (could not be proven wrong)

- `sum`, `clamp`, `unique` — correct on all probed inputs, including empty
  arrays, negatives, and boundary values.
- `max([])` → `undefined`. A reference could equally be `undefined` or
  `-Infinity` (`Math.max`); no obviously-correct answer, so not reported.
  `max` is correct for all non-empty arrays, including all-negative ones.
- `average([])` → `NaN` (`0/0`). A `sum/length` reference gives `NaN` too;
  not reported. Correct for all non-empty arrays.
- `isPalindrome("Racecar")` → `false`. Case-sensitive exact-match is the
  standard simple definition (the source comment marks it "ok"); not reported.
- `factorial` for negative `n` → `1`. Factorial is undefined for negatives and
  a loop-based reference returns `1` as well; not reported.
- `countVowels` on accented vowels (e.g. `é`) — outside the ASCII vowel set
  the reference regex also uses; not reported.
