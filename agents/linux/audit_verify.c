/* audit_verify.c — Verify the chained SHA-256 audit log produced by clipwatch
 * Build: gcc -o audit_verify audit_verify.c -O2
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <time.h>

/* minimal sha256 (same implementation as in clipwatch.c) */
#include <stdint.h>

typedef struct { unsigned int state[8]; unsigned long long bitcount; unsigned char buffer[64]; } SHA256_CTX;
static const unsigned int K[64] = { 0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2 };
static unsigned int rotr(unsigned int x, unsigned int n) { return (x >> n) | (x << (32 - n)); }
void sha256_init(SHA256_CTX *c) { c->state[0]=0x6a09e667; c->state[1]=0xbb67ae85; c->state[2]=0x3c6ef372; c->state[3]=0xa54ff53a; c->state[4]=0x510e527f; c->state[5]=0x9b05688c; c->state[6]=0x1f83d9ab; c->state[7]=0x5be0cd19; c->bitcount = 0; }
void sha256_transform(SHA256_CTX *c, const unsigned char *buf) { unsigned int w[64], s0, s1, maj, t1, t2, ch; for (int i=0;i<16;i++) w[i] = (unsigned int)buf[i*4]<<24 | (unsigned int)buf[i*4+1]<<16 | (unsigned int)buf[i*4+2]<<8 | (unsigned int)buf[i*4+3]; for (int i=16;i<64;i++) { s0 = rotr(w[i-15],7) ^ rotr(w[i-15],18) ^ (w[i-15]>>3); s1 = rotr(w[i-2],17) ^ rotr(w[i-2],19) ^ (w[i-2]>>10); w[i] = w[i-16] + s0 + w[i-7] + s1; } unsigned int state[8]; for (int i=0;i<8;i++) state[i]=c->state[i]; for (int i=0;i<64;i++) { s1 = rotr(state[4],6) ^ rotr(state[4],11) ^ rotr(state[4],25); ch = (state[4] & state[5]) ^ ((~state[4]) & state[6]); t1 = state[7] + s1 + ch + K[i] + w[i]; s0 = rotr(state[0],2) ^ rotr(state[0],13) ^ rotr(state[0],22); maj = (state[0] & state[1]) ^ (state[0] & state[2]) ^ (state[1] & state[2]); t2 = s0 + maj; state[7]=state[6]; state[6]=state[5]; state[5]=state[4]; state[4]=state[3]+t1; state[3]=state[2]; state[2]=state[1]; state[1]=state[0]; state[0]=t1 + t2; } for (int i=0;i<8;i++) c->state[i] += state[i]; }
void sha256_update(SHA256_CTX *c, const unsigned char *data, size_t len) { size_t i=0; while (len--) { c->buffer[(c->bitcount/8) % 64] = data[i++]; c->bitcount += 8; if ((c->bitcount % 512) == 0) sha256_transform(c, c->buffer); } }
void sha256_final(SHA256_CTX *c, unsigned char out[32]) { unsigned long long bits = c->bitcount; int idx = (bits/8) % 64; c->buffer[idx++] = 0x80; if (idx > 56) { while (idx < 64) c->buffer[idx++] = 0x00; sha256_transform(c, c->buffer); idx = 0; } while (idx < 56) c->buffer[idx++] = 0x00; for (int i=7;i>=0;i--) { c->buffer[idx++] = (unsigned char)(bits >> (i*8)); } sha256_transform(c, c->buffer); for (int i=0;i<8;i++) { out[i*4] = (unsigned char)(c->state[i] >> 24); out[i*4+1] = (unsigned char)(c->state[i] >> 16); out[i*4+2] = (unsigned char)(c->state[i] >> 8); out[i*4+3] = (unsigned char)(c->state[i]); } }
void sha256_hex(const char *in, char out[65]) { unsigned char digest[32]; SHA256_CTX ctx; sha256_init(&ctx); sha256_update(&ctx, (const unsigned char*)in, strlen(in)); sha256_final(&ctx, digest); for (int i=0;i<32;i++) sprintf(out + (i*2), "%02x", digest[i]); out[64]='\0'; }

int main(int argc, char **argv) {
    const char *xdg = getenv("XDG_RUNTIME_DIR");
    char path[1024];
    if (xdg && xdg[0]) snprintf(path, sizeof(path), "%s/ultralock_audit.log", xdg);
    else { const char *home = getenv("HOME"); snprintf(path, sizeof(path), "%s/.local/share/ultralock_audit.log", home); }
    FILE *f = fopen(path, "r"); if (!f) { fprintf(stderr, "audit file not found: %s\n", path); return 2; }
    char line[8192]; char prev_hash[65] = {0}; int lineno = 0;
    while (fgets(line, sizeof(line), f)) {
        lineno++;
        // strip newline
        size_t l = strlen(line); while (l && (line[l-1]=='\n' || line[l-1]=='\r')) { line[--l] = '\0'; }
        // split into 4 parts: ts|op|detail|hash
        char *p1 = strchr(line, '|'); if (!p1) { fprintf(stderr, "invalid format line %d\n", lineno); return 3; }
        *p1 = '\0'; char *ts = line; char *p2 = strchr(p1+1, '|'); if (!p2) { fprintf(stderr, "invalid format line %d\n", lineno); return 3; }
        *p2 = '\0'; char *op = p1+1; char *p3 = strchr(p2+1, '|'); if (!p3) { fprintf(stderr, "invalid format line %d\n", lineno); return 3; }
        *p3 = '\0'; char *detail = p2+1; char *hash = p3+1;
        char payload[8192]; snprintf(payload, sizeof(payload), "%s|%s|%s|%s", prev_hash, ts, op, detail);
        char expected[65]; sha256_hex(payload, expected);
        if (strcmp(expected, hash) != 0) { fprintf(stderr, "audit verification FAILED at line %d: expected %s got %s\n", lineno, expected, hash); return 4; }
        strncpy(prev_hash, hash, 65);
    }
    fclose(f);
    printf("audit OK\n");
    return 0;
}
