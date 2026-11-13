/* Variant B: odd-only BITSET sieve (1 bit per odd). 312.5 KiB fits in L2.
 * Bit i (of odds) = 1 means composite. Counting via popcountll.
 */
#include <stdio.h>
#include <unistd.h>
#define MAXN 5000000
static unsigned char bits[((MAXN + 1) / 2 + 7) / 8];
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
    for (int p = 3; p <= sq; p += 2) {
        if (!(bits[(p >> 1) >> 3] & (1u << ((p >> 1) & 7)))) {
            long start = (long)p * p >> 1;
            for (long j = start; j < n_odd; j += p)
                bits[j >> 3] |= (unsigned char)(1u << (j & 7));
        }
    }
    /* count: bitset holds odds; index 0 is number 1 (not prime) -> mask it out.
       Count set bits = composites among odds 1..n, plus index0 forced. */
    long comp_cnt = 0;
    int nbytes = (n_odd + 7) / 8;
    /* popcount word-wise */
    int full_words = nbytes / 8;
    const unsigned long long *w = (const unsigned long long *)bits;
    for (int i = 0; i < full_words; ++i) comp_cnt += __builtin_popcountll(w[i]);
    for (int i = full_words * 8; i < nbytes; ++i) comp_cnt += __builtin_popcount(bits[i]);
    /* odds from 1..n excluding 1: (n_odd - 1) numbers; primes among them = (n_odd-1) - (composites excluding index0).
       index0 (number 1) is 0 in bits, so comp_cnt counts only true composites. */
    long count = 1 /* prime 2 */ + (n_odd - 1 - comp_cnt);
    char buf[32]; int len = 0; char rev[24]; int r = 0; long v = count;
    if (v == 0) rev[r++] = '0';
    while (v > 0) { rev[r++] = (char)('0' + v % 10); v /= 10; }
    while (r > 0) buf[len++] = rev[--r];
    buf[len++] = '\n';
    (void)!write(STDOUT_FILENO, buf, len);
    return 0;
}
