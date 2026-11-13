/* fastest-primes: odd-only bitset sieve with pattern-OR marking for small p.
 *
 * Bit j (odd index, number 2j+1) = 1 means composite. Only 312.5 KiB for
 * N=5,000,000, so the whole sieve fits in L2 and cold-start page faults
 * are minimal (77 pages vs 610 for a byte array).
 *
 * Marking: for a prime p, its multiples sit at odd indices j with
 * j = (p-1)/2 (mod p). In the bitset this is a periodic bit pattern with
 * period p bytes. For small p (<= 61) we OR a precomputed repeating
 * 64-bit pattern word across the array -- sequential, ~8 bytes per op --
 * instead of one read-modify-write per multiple. Larger primes use the
 * classic per-multiple loop (fewer multiples than words).
 * Counting is a popcount over 64-bit words.
 * Static BSS storage: zero-initialised by the kernel, no malloc/memset.
 */
#include <stdio.h>
#include <unistd.h>
#define MAXN 5000000
#define PAT_MAX 61
static unsigned char bits[((MAXN + 1) / 2 + 7) / 8 + 16];
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
    int nbytes = (n_odd + 7) / 8;
    int nwords = (nbytes + 7) / 8;
    int sq = 1;
    while ((long)(sq + 1) * (sq + 1) <= n) ++sq;

    /* small primes up to sqrt(n) */
    static unsigned char small[2237];
    int primes[400], nsp = 0;
    for (int p = 3; p <= sq; p += 2)
        if (!small[p]) { primes[nsp++] = p; if ((long)p * p <= sq) for (int q = p * p; q <= sq; q += 2 * p) small[q] = 1; }

    unsigned long long *dst = (unsigned long long *)bits;
    unsigned char pat[PAT_MAX];
    unsigned long long tab[PAT_MAX];
    for (int k = 0; k < nsp; ++k) {
        int p = primes[k];
        long start = ((long)p * p - 1) / 2; /* odd index of p*p */
        if (start >= n_odd) break;
        if (!(bits[(p >> 1) >> 3] & (1u << ((p >> 1) & 7)))) {
            if (p <= PAT_MAX) {
                int half = (p - 1) / 2;
                for (int q = 0; q < p; ++q) {
                    unsigned char b = 0;
                    for (int bit = 0; bit < 8; ++bit)
                        if ((8 * q + bit) % p == half) b |= (unsigned char)(1u << bit);
                    pat[q] = b;
                }
                for (int r = 0; r < p; ++r) {
                    unsigned long long w = 0;
                    for (int t = 0; t < 8; ++t)
                        w |= (unsigned long long)pat[(r + t) % p] << (8 * t);
                    tab[r] = w;
                }
                int start_byte = (int)(start >> 3);
                int start_bit = (int)(start & 7);
                int w0 = start_byte >> 3;
                int ph = (8 * w0) % p;
                unsigned long long mask = ~0ULL << ((start_byte & 7) * 8 + start_bit);
                for (int w = w0; w < nwords; ++w) {
                    unsigned long long v = tab[ph];
                    if (w == w0) v &= mask;
                    dst[w] |= v;
                    ph += 8; while (ph >= p) ph -= p;
                }
            } else {
                for (long j = start; j < n_odd; j += p)
                    bits[j >> 3] |= (unsigned char)(1u << (j & 7));
            }
        }
    }
    /* clear any pattern-set bits past n_odd in the last byte */
    int excess = nbytes * 8 - n_odd;
    if (excess > 0) bits[nbytes - 1] &= (unsigned char)(0xFFu >> excess);

    long comp_cnt = 0;
    int fw = nbytes / 8;
    for (int i = 0; i < fw; ++i) comp_cnt += __builtin_popcountll(dst[i]);
    for (int i = fw * 8; i < nbytes; ++i) comp_cnt += __builtin_popcount(bits[i]);
    long count = 1 + (n_odd - 1 - comp_cnt);
    char buf[32]; int len = 0; char rev[24]; int r = 0; long v = count;
    if (v == 0) rev[r++] = '0';
    while (v > 0) { rev[r++] = (char)('0' + v % 10); v /= 10; }
    while (r > 0) buf[len++] = rev[--r];
    buf[len++] = '\n';
    (void)!write(STDOUT_FILENO, buf, len);
    return 0;
}
