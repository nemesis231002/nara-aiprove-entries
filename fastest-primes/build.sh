#!/bin/sh
# Build the submission binary. Requires gcc (tested with gcc 13.3.0).
# -O3 only: no -march=native, so the binary runs on any x86-64 grader CPU.
set -e
cd "$(dirname "$0")"
gcc -O3 -o primes primes.c
