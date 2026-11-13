# fastest-primes — AIProve bounty entry

Read an integer N (1 ≤ N ≤ 5,000,000) on stdin, print π(N) — the number of
primes ≤ N — on stdout. Prize: 1,000,000 PROVE. Closes Nov 16 2026 13:49 UTC.

## Entry

- **Program:** `primes.c` (C, single file, no dependencies beyond libc)
- **Build:** `./build.sh` → produces the `primes` binary
  (`gcc -O3 -o primes primes.c`; tested with gcc 13.3.0)
- **Run command (grader):** `./primes` (or `./run.sh`)
- **Input:** one integer on stdin (trailing newline/whitespace OK)
- **Output:** only the count plus a trailing newline on stdout

A prebuilt `primes` binary (built from this exact `primes.c` with `-O3`) is
included; rebuilding from source gives the same binary behaviour.

## Approach

Odd-only bitset sieve of Eratosthenes, tuned for a single cold run per N:

1. **Bitset, 1 bit per odd number** — 312.5 KiB for N = 5,000,000, so the
   whole sieve fits in L2 and cold-start page faults are minimal
   (77 pages vs 610 for a byte array). Stored in a static BSS array:
   zero-initialised by the kernel, so there is no `malloc`/`memset` cost.
2. **Pattern-OR marking for small primes (p ≤ 61).** Multiples of p sit at
   odd indices `j ≡ (p−1)/2 (mod p)` — a periodic bit pattern with period
   p bytes. Instead of one read-modify-write per multiple, a precomputed
   repeating 64-bit pattern word is OR-ed across the array: sequential,
   ~8 bytes per operation. This replaced ~1.7M per-multiple operations
   (p = 3, 5, 7 alone) with 3 × 39k word ops. Primes p > 61 use the
   classic per-multiple loop (fewer multiples than words there).
   Threshold 61 was chosen empirically: PAT_MAX = 127 and 251 were both
   slower (see `build.log`).
3. **Counting via `__builtin_popcountll`** over 64-bit words.
4. **Fast I/O:** `getchar_unlocked` parse, single `write(2)` for output.
5. **Portability:** `-O3` only — deliberately no `-march=native`
   (measured only ~0.1 ms faster here, but it could fault with
   illegal-instruction on a different grader CPU).

Rejected variants (sources + binaries in `experiments/`):
byte-array sieve (8.86 ms), plain bitset sieve (7.07 ms),
segmented byte sieve (7.63 ms), segmented bitset sieve (7.00 ms).

## Correctness (verified by running, not by inspection)

`./test.sh` — all public cases, edge cases, and a Python-sieve cross-check:

| N | output |
|---|---|
| 1 | 0 |
| 2 | 1 |
| 3 | 2 |
| 10 | 4 |
| 100 | 25 |
| 1000 | 168 |
| 100000 | 9592 |
| 1000000 | 78498 |
| 5000000 | 348513 |

Plus a cross-check against an independent Python sieve on 49 further values
(including 30 random N in [1, 5,000,000] and N = 4,999,999): 0 mismatches.
An earlier 58-value cross-check of the same algorithm also had 0 mismatches.

## Timing evidence

Measured on this VM (shared 1.5 CPU, x86_64) with `./test.sh`:
wall-clock per run **including process spawn**, median of 200 runs each
(empty-program spawn baseline on the same harness: ~1.37 ms).

| N | median | min |
|---|---:|---:|
| 100,000 | 1.494 ms | 1.381 ms |
| 1,000,000 | 2.022 ms | 1.897 ms |
| 5,000,000 | 4.638 ms | 4.496 ms |

For comparison on the same harness at N = 5,000,000: plain bitset sieve
7.07 ms, segmented bitset 7.00 ms, byte sieve 8.86 ms. Absolute times will
differ on the grader machine; the relative advantage of this entry should
hold, since it does strictly less work per multiple and touches less memory.

## Files

- `primes.c` — submission source
- `primes` — prebuilt binary (`gcc -O3`)
- `build.sh` — build the binary
- `run.sh` — run command for the grader
- `test.sh` — correctness + benchmark (re-runs everything above)
- `build.log` — log of every command run during development + outcomes
- `experiments/` — rejected sieve variants (sources + binaries)
