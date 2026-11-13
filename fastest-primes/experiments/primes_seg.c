/* Segmented odd-only byte sieve. Block of odds fits L1/L2, so each prime's
 * marking pass streams through cache-hot memory instead of the whole 2.5 MB
 * array. Static BSS array: zero-initialised, no memset/malloc at startup. */
#include <stdio.h>
#include <unistd.h>
#define MAXN 5000000
#define BLK (1<<15) /* odds per block */
static unsigned char is_composite[(MAXN + 1) / 2];
static int read_int(void) {
    int c, x = 0;
    c = getchar_unlocked();
    while (c != '-' && (c < '0' || c > '9')) { if (c == EOF) return 0; c = getchar_unlocked(); }
    while (c >= '0' && c <= '9') { x = x * 10 + (c - '0'); c = getchar_unlocked(); }
    return x;
}
int main(void) {
    int n = read_int();
    if (n < 2) { char o[] = "0\n"; (void)!write(STDOUT_FILENO, o, 2); return 0; }
    int n_odd = (n + 1) / 2;
    int sq = 1;
    while ((long)(sq + 1) * (sq + 1) <= n) ++sq;
    unsigned char * __restrict__ comp = is_composite;
    /* small primes up to sqrt(n) via tiny sieve on the stack */
    static unsigned char small[2237];
    int primes[400], nsp = 0;
    for (int p = 3; p <= sq; p += 2)
        if (!small[p]) { primes[nsp++] = p; if ((long)p * p <= sq) for (int q = p * p; q <= sq; q += 2 * p) small[q] = 1; }
    for (int lo = 1; lo < n_odd; lo += BLK) {
        int hi = lo + BLK; if (hi > n_odd) hi = n_odd;
        for (int k = 0; k < nsp; ++k) {
            int p = primes[k];
            long start = (long)p * p >> 1;
            if (start < lo) { long rem = (lo - start) % p; start = lo + (rem ? p - rem : 0); }
            for (long j = start; j < hi; j += p) comp[j] = 1;
        }
    }
    long count = 1;
    for (int i = 1; i < n_odd; ++i) count += !comp[i];
    char buf[32]; int len = 0; char rev[24]; int r = 0; long v = count;
    if (v == 0) rev[r++] = '0';
    while (v > 0) { rev[r++] = (char)('0' + v % 10); v /= 10; }
    while (r > 0) buf[len++] = rev[--r];
    buf[len++] = '\n';
    (void)!write(STDOUT_FILENO, buf, len);
    return 0;
}
