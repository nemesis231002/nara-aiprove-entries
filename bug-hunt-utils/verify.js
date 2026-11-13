// verify.js — reproduces every bug in bugs.json against the local copy of
// utils.js, and cross-checks each `expected` value against an independent
// reference implementation written here (not copied from utils.js).
// Exit 0 only if EVERY entry is a genuine bug: utils.js disagrees with the
// reference, and the reference agrees with the `expected` in bugs.json.
// Usage: node verify.js
const utils = require('./utils.js');
const bugs = require('./bugs.json');

// Independent reference implementations (obviously-correct behaviour).
const ref = {
  factorial(n) { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; },
  countVowels(s) { return (s.match(/[aeiou]/gi) || []).length; },
  titleCase(s) {
    return s.toLowerCase().split(' ')
      .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
  },
  reverse(s) { return [...s].reverse().join(''); },
  isPalindrome(s) { return s === [...s].reverse().join(''); },
};

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let reproduced = 0;

for (const { fn, input, expected } of bugs) {
  const actual = utils[fn](input);
  const refVal = ref[fn](input);
  const isBug = !eq(actual, expected);          // utils.js gets it wrong
  const expectedOk = eq(refVal, expected);      // our expected is right
  console.log(`${fn}(${JSON.stringify(input)}) => actual: ${JSON.stringify(actual)} | expected: ${JSON.stringify(expected)} | reference: ${JSON.stringify(refVal)} | BUG REPRODUCED: ${isBug && expectedOk}`);
  if (isBug && expectedOk) reproduced++;
}

console.log(`\n${reproduced}/${bugs.length} reported bugs reproduced and confirmed against the reference.`);
process.exit(reproduced === bugs.length ? 0 : 1);
