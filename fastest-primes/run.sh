#!/bin/sh
# Run command for the grader (binary must already be built via ./build.sh).
# Reads one integer N on stdin, prints pi(N) on stdout.
exec "$(dirname "$0")/primes"
