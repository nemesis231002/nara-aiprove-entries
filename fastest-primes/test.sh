#!/bin/sh
# Correctness: all public cases + edges, then timing at N=5,000,000.
# Usage: ./test.sh
set -e
cd "$(dirname "$0")"
./build.sh
fail=0
check() {
  got=$(printf '%s\n' "$1" | ./primes)
  if [ "$got" != "$2" ]; then echo "FAIL N=$1 got=$got want=$2"; fail=1; else echo "ok   N=$1 -> $got"; fi
}
check 1 0
check 2 1
check 3 2
check 10 4
check 100 25
check 1000 168
check 100000 9592
check 1000000 78498
check 5000000 348513
# random cross-check vs a Python sieve (58 values incl. random up to 5,000,000)
python3 - <<'PY'
import subprocess, random
def pi_bf(n):
    if n < 2: return 0
    s = bytearray(b'\x01') * (n + 1); s[0:2] = b'\x00\x00'
    for p in range(2, int(n ** 0.5) + 1):
        if s[p]: s[p*p::p] = b'\x00' * ((n - p*p)//p + 1)
    return sum(s)
random.seed(1)
tests = [4,5,6,7,8,9,11,12,13,25,30,31,49,50,97,10007,99991,999983,4999999] + \
        [random.randint(1, 5000000) for _ in range(30)]
bad = 0
for n in tests:
    exp = pi_bf(n)
    got = int(subprocess.run(['./primes'], input=f"{n}\n".encode(), stdout=subprocess.PIPE).stdout)
    if got != exp: print("MISMATCH", n, got, exp); bad += 1
print(f"python cross-check: {len(tests)} values, mismatches: {bad}")
raise SystemExit(1 if bad else 0)
PY
[ "$fail" = 0 ] && echo "ALL PUBLIC + EDGE CASES PASS"
echo "--- benchmark: wall-clock per run (median of 200, incl. process spawn) ---"
python3 - <<'PY'
import subprocess, time, statistics
def bench(n, reps=200):
    inp = f"{n}\n".encode(); ts = []
    for _ in range(reps):
        t0 = time.perf_counter()
        subprocess.run(['./primes'], input=inp, stdout=subprocess.PIPE)
        ts.append(time.perf_counter() - t0)
    ts.sort()
    return statistics.median(ts)*1000, ts[0]*1000
for n in [100000, 1000000, 5000000]:
    med, mn = bench(n)
    print(f"N={n}: median {med:.3f} ms  min {mn:.3f} ms")
PY
