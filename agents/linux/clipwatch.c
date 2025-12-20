/* clipwatch.c — UltraLock Linux clipboard watcher prototype (X11)
 * Single-file, minimal prototype. No external dependencies except Xlib and libc.
 * Build: gcc -o clipwatch clipwatch.c -lX11 -lm
 * Run: ./clipwatch
 *
 * Security model: session-local device-salt stored in $XDG_DATA_HOME/ultralock/device_salt (mode 600).
 * The agent computes the same fingerprint as UltraLock.js (canonical text + origin placeholder + device/session salts)
 * and enforces clipboard integrity by replacing suspicious clipboard content with a blocking message.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <time.h>
#include <stdint.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <sys/types.h>
#include <sys/select.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <netinet/in.h>
#include <X11/Xlib.h>
#include <X11/Xatom.h>

/* Minimal SHA-256 implementation (public-domain style, compact)
   Avoids dependency on OpenSSL so the prototype stays single-file and buildless.
   Implementation based on common public-domain reference.
*/

typedef struct {
    unsigned int state[8];
    unsigned long long bitcount;
    unsigned char buffer[64];
} SHA256_CTX;

static const unsigned int K[64] = {
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
};

static unsigned int rotr(unsigned int x, unsigned int n) { return (x >> n) | (x << (32 - n)); }

void sha256_init(SHA256_CTX *c) {
    c->state[0]=0x6a09e667; c->state[1]=0xbb67ae85; c->state[2]=0x3c6ef372; c->state[3]=0xa54ff53a;
    c->state[4]=0x510e527f; c->state[5]=0x9b05688c; c->state[6]=0x1f83d9ab; c->state[7]=0x5be0cd19;
    c->bitcount = 0;
}

void sha256_transform(SHA256_CTX *c, const unsigned char *buf) {
    unsigned int w[64], s0, s1, maj, t1, t2, ch;    for (int i=0;i<16;i++) {
        w[i] = (unsigned int)buf[i*4]<<24 | (unsigned int)buf[i*4+1]<<16 | (unsigned int)buf[i*4+2]<<8 | (unsigned int)buf[i*4+3];
    }
    for (int i=16;i<64;i++) {
        s0 = rotr(w[i-15],7) ^ rotr(w[i-15],18) ^ (w[i-15]>>3);
        s1 = rotr(w[i-2],17) ^ rotr(w[i-2],19) ^ (w[i-2]>>10);
        w[i] = w[i-16] + s0 + w[i-7] + s1;
    }
    unsigned int state[8]; for (int i=0;i<8;i++) state[i]=c->state[i];
    for (int i=0;i<64;i++) {
        s1 = rotr(state[4],6) ^ rotr(state[4],11) ^ rotr(state[4],25);
        ch = (state[4] & state[5]) ^ ((~state[4]) & state[6]);
        t1 = state[7] + s1 + ch + K[i] + w[i];
        s0 = rotr(state[0],2) ^ rotr(state[0],13) ^ rotr(state[0],22);
        maj = (state[0] & state[1]) ^ (state[0] & state[2]) ^ (state[1] & state[2]);
        t2 = s0 + maj;
        state[7]=state[6]; state[6]=state[5]; state[5]=state[4]; state[4]=state[3]+t1;
        state[3]=state[2]; state[2]=state[1]; state[1]=state[0]; state[0]=t1 + t2;
    }
    for (int i=0;i<8;i++) c->state[i] += state[i];
}

void sha256_update(SHA256_CTX *c, const unsigned char *data, size_t len) {
    size_t i=0;
    while (len--) {
        c->buffer[(c->bitcount/8) % 64] = data[i++];
        c->bitcount += 8;
        if ((c->bitcount % 512) == 0) sha256_transform(c, c->buffer);
    }
}

void sha256_final(SHA256_CTX *c, unsigned char out[32]) {
    unsigned long long bits = c->bitcount;
    int idx = (bits/8) % 64;
    c->buffer[idx++] = 0x80;
    if (idx > 56) {
        while (idx < 64) c->buffer[idx++] = 0x00;
        sha256_transform(c, c->buffer);
        idx = 0;
    }
    while (idx < 56) c->buffer[idx++] = 0x00;
    // append length
    for (int i=7;i>=0;i--) { c->buffer[idx++] = (unsigned char)(bits >> (i*8)); }
    sha256_transform(c, c->buffer);
    for (int i=0;i<8;i++) {
        out[i*4] = (unsigned char)(c->state[i] >> 24);
        out[i*4+1] = (unsigned char)(c->state[i] >> 16);
        out[i*4+2] = (unsigned char)(c->state[i] >> 8);
        out[i*4+3] = (unsigned char)(c->state[i]);
    }
}

void sha256_hex(const char *in, char out[65]) {
    unsigned char digest[32]; SHA256_CTX ctx; sha256_init(&ctx); sha256_update(&ctx, (const unsigned char*)in, strlen(in)); sha256_final(&ctx, digest);
    for (int i=0;i<32;i++) {
        sprintf(out + (i*2), "%02x", digest[i]);
    }
    out[64]='\0';
}

// Configuration
#define POLL_MS 500
#define DEVICE_DIR_ENV "XDG_DATA_HOME"
#define DEVICE_DIR_FALLBACK ".local/share"
#define DEVICE_SALT_FILE "ultralock_device_salt"
#define MAX_CLIP 4096

// IPC binds store
#define MAX_BINDS 256
struct bind_entry { char fp[65]; long ts; };

// Simple helper to read/write a file with restricted permissions
char *read_or_create_device_salt() {
    const char *xdg = getenv(DEVICE_DIR_ENV);
    char path[1024];
    if (xdg && xdg[0]) snprintf(path, sizeof(path), "%s/%s", xdg, DEVICE_SALT_FILE);
    else {
        const char *home = getenv("HOME");
        snprintf(path, sizeof(path), "%s/%s/%s", home, DEVICE_DIR_FALLBACK, DEVICE_SALT_FILE);
    }
    // ensure directory exists
    char dir[1024];
    strncpy(dir, path, sizeof(dir));
    char *p = strrchr(dir, '/'); if (p) *p = '\0';
    mkdir(dir, 0700);

    // open or create
    int fd = open(path, O_RDWR | O_CREAT, 0600);
    if (fd < 0) return NULL;
    char buf[65] = {0};
    ssize_t r = read(fd, buf, 64);
    if (r > 0) { close(fd); return strdup(buf); }
    // not present: generate random
    unsigned char randb[32];
    FILE *ur = fopen("/dev/urandom", "rb"); if (ur) { fread(randb, 1, sizeof(randb), ur); fclose(ur); }
    for (int i=0;i<32;i++) sprintf(buf + (i*2), "%02x", randb[i]);
    lseek(fd, 0, SEEK_SET); write(fd, buf, strlen(buf)); close(fd);
    return strdup(buf);
}


// Very conservative canonicalization: remove whitespace and some invisibles, lowercase for bech32/ln
void canonicalize(char *s) {
    char out[MAX_CLIP]; int j=0; size_t sl = strlen(s);
    for (size_t i=0;i<sl && j < MAX_CLIP-1; i++) {
        unsigned char c = s[i];
        // remove ASCII control and whitespace
        if (c <= 32) continue;
        // remove UTF-8 BOM 0xEF 0xBB 0xBF
        if (i+2 < sl && (unsigned char)s[i]==0xEF && (unsigned char)s[i+1]==0xBB && (unsigned char)s[i+2]==0xBF) { i+=2; continue; }
        // remove zero-width joiner U+200D (UTF-8 0xE2 0x80 0x8D) and U+200B (0xE2 0x80 0x8B)
        if (i+2 < sl && (unsigned char)s[i]==0xE2 && (unsigned char)s[i+1]==0x80 && ((unsigned char)s[i+2]==0x8B || (unsigned char)s[i+2]==0x8D)) { i+=2; continue; }
        out[j++] = c;
    }
    out[j] = '\0';
    // Lowercase ASCII letters only
    for (int i=0;i<j;i++) if (out[i] >= 'A' && out[i] <= 'Z') out[i] = out[i] - 'A' + 'a';
    strncpy(s, out, MAX_CLIP);
}

// Helper: test whether a given clipboard text would be allowed by current binds
int check_clipboard_text(const char *text, char *out_reason, size_t out_sz, const char *device_salt, const char *session_nonce, struct bind_entry *binds) {
    if (!text) return 1;
    char local[MAX_CLIP]; strncpy(local, text, MAX_CLIP); canonicalize(local);
    int is_addr = 0; if (strstr(local, "bc1") || strstr(local, "0x") || strstr(local, "lnbc")) is_addr = 1;
    if (!is_addr) return 1; // not an address, allow
    char composite[4096]; snprintf(composite, sizeof(composite), "%s||%s||%s||%s", local, "local-origin", device_salt, session_nonce);
    char fp[65]; sha256_hex(composite, fp);
    for (int b=0;b<MAX_BINDS;b++) { if (binds[b].fp[0] && strcmp(binds[b].fp, fp)==0) return 1; }
    if (out_reason && out_sz>0) snprintf(out_reason, out_sz, "[UltraLock ALERT] Clipboard content appears to be a protected address; paste blocked by UltraLock.");
    return 0;
}

int main(int argc, char **argv) {
    printf("UltraLock clipwatch prototype starting...\n");
    // allow a headless self-test mode: ./clipwatch --selftest
    int selftest = 0; if (argc > 1 && strcmp(argv[1], "--selftest") == 0) selftest = 1;

    char *device_salt = read_or_create_device_salt();
    if (!device_salt) { fprintf(stderr, "Failed to get device salt\n"); return 1; }
    char session_nonce[33];
    unsigned char rn[16]; FILE *ur = fopen("/dev/urandom", "rb"); if (ur) { fread(rn,1,16,ur); fclose(ur); }
    for (int i=0;i<16;i++) sprintf(session_nonce + (i*2), "%02x", rn[i]);
    session_nonce[32] = '\0';

    // Registered fingerprints (simple fixed-size store)
    struct bind_entry binds[MAX_BINDS]; memset(binds,0,sizeof(binds));

    // IPC socket setup (prepare path & server regardless of X state for headless tests)
    char sockpath[1024];
    const char *xdg_runtime = getenv("XDG_RUNTIME_DIR");
    if (xdg_runtime && xdg_runtime[0]) snprintf(sockpath, sizeof(sockpath), "%s/ultralock.sock", xdg_runtime);
    else {
        const char *home = getenv("HOME");
        snprintf(sockpath, sizeof(sockpath), "%s/.local/share/ultralock.sock", home);
    }
    // Ensure parent directory exists and has restricted perms
    char sockdir[1024]; strncpy(sockdir, sockpath, sizeof(sockdir)); char *ps = strrchr(sockdir, '/'); if (ps) *ps='\0'; mkdir(sockdir, 0700);
    // Remove stale socket
    unlink(sockpath);

    int srv = socket(AF_UNIX, SOCK_STREAM, 0);
    if (srv < 0) { perror("socket"); return 1; }
    struct sockaddr_un addr; memset(&addr,0,sizeof(addr)); addr.sun_family = AF_UNIX; strncpy(addr.sun_path, sockpath, sizeof(addr.sun_path)-1);
    if (bind(srv, (struct sockaddr*)&addr, sizeof(addr)) < 0) { perror("bind"); close(srv); return 1; }
    chmod(sockpath, 0600);
    if (listen(srv, 5) < 0) { perror("listen"); close(srv); return 1; }

    if (selftest) {
        // perform a headless integration test: bind a FP for a test address, then verify check allows it
        const char *test_addr = "bc1qw9cqf600jzcvkd53lpf6j9w93x806z5x5c0t8q";
        char canonical[MAX_CLIP]; strncpy(canonical, test_addr, MAX_CLIP); canonicalize(canonical);
        char composite[4096]; snprintf(composite, sizeof(composite), "%s||%s||%s||%s", canonical, "local-origin", device_salt, session_nonce);
        char fp[65]; sha256_hex(composite, fp);
        // bind it
        strncpy(binds[0].fp, fp, 65); binds[0].ts = time(NULL);
        char reason[256] = {0};
        int ok = check_clipboard_text(test_addr, reason, sizeof(reason), device_salt, session_nonce, binds);
        if (ok) {
            printf("address is safe and passed\n");
            return 0;
        } else {
            printf("address check FAILED: %s\n", reason);
            return 2;
        }
    }

    // Normal operation: open X display and proceed with event loop
    Display *dpy = XOpenDisplay(NULL);
    if (!dpy) { fprintf(stderr, "Failed to open X display\n"); return 1; }
    Window root = DefaultRootWindow(dpy);
    // create a simple window to receive SelectionNotify/Request events
    Window win = XCreateSimpleWindow(dpy, root, 0,0,1,1,0,0,0);
    XMapWindow(dpy, win);
    XFlush(dpy);

    Atom clip = XInternAtom(dpy, "CLIPBOARD", False);
    Atom utf8 = XInternAtom(dpy, "UTF8_STRING", False);

    char last_text[MAX_CLIP] = {0};
    int client_fds[8]; for (int i=0;i<8;i++) client_fds[i] = -1;

    while (1) {
        // Proper SelectionNotify flow: request UTF8_STRING conversion to our window property
        Atom property = XInternAtom(dpy, "ULTRALOCK_PROP", False);
        XConvertSelection(dpy, clip, utf8, property, win, CurrentTime);
        XFlush(dpy);

        // Build fd set including X11 connection, server socket, and any client sockets
        int x11fd = ConnectionNumber(dpy);
        fd_set readfds; FD_ZERO(&readfds);
        FD_SET(x11fd, &readfds);
        FD_SET(srv, &readfds);
        int maxfd = x11fd > srv ? x11fd : srv;
        for (int i=0;i<8;i++) if (client_fds[i] >= 0) { FD_SET(client_fds[i], &readfds); if (client_fds[i] > maxfd) maxfd = client_fds[i]; }

        // Wait for events with a timeout
        struct timeval tv; tv.tv_sec = 0; tv.tv_usec = POLL_MS * 1000;
        int sel = select(maxfd + 1, &readfds, NULL, NULL, &tv);
        if (sel <= 0) {
            // no events, but still process any pending X events (non-blocking)
            while (XPending(dpy)) {
                XEvent ev; XNextEvent(dpy, &ev);
                // handle events below (reuse same code path)
                if (ev.type == SelectionNotify) {
                    // fall through to current handler by pushing back event (simple approach: handle inline)
                }
            }
            continue;
        }

        // Accept new client connections
        if (FD_ISSET(srv, &readfds)) {
            int c = accept(srv, NULL, NULL);
            if (c >= 0) {
                int placed = 0;
                for (int i=0;i<8;i++) if (client_fds[i] < 0) { client_fds[i] = c; placed=1; break; }
                if (!placed) { close(c); }
                else { printf("[IPC] client connected\n"); }
            }
        }

        // process client data
        for (int i=0;i<8;i++) {
            int cfd = client_fds[i];
            if (cfd < 0) continue;
            if (!FD_ISSET(cfd, &readfds)) continue;
            char rbuf[1024]; ssize_t r = recv(cfd, rbuf, sizeof(rbuf)-1, 0);
            if (r <= 0) { close(cfd); client_fds[i] = -1; continue; }
            rbuf[r] = '\0';
            // simple line handling: split on newlines
            char *line = strtok(rbuf, "\r\n");
            while (line) {
                if (strncmp(line, "BIND ", 5) == 0) {
                    char *fp = line + 5;
                    if (strlen(fp) == 64) {
                        // store
                        int stored = 0;
                        for (int b=0;b<MAX_BINDS;b++) if (binds[b].fp[0]==0) { strcpy(binds[b].fp, fp); binds[b].ts = time(NULL); stored=1; break; }
                        if (stored) send(cfd, "OK\n", 3, 0); else send(cfd, "ERR full\n", 10, 0);
                    } else send(cfd, "ERR invalid-fp\n", 16, 0);
                } else if (strncmp(line, "UNBIND ", 7) == 0) {
                    char *fp = line + 7; int found=0;
                    for (int b=0;b<MAX_BINDS;b++) if (binds[b].fp[0] && strcmp(binds[b].fp, fp)==0) { binds[b].fp[0]=0; binds[b].ts=0; found=1; break; }
                    if (found) send(cfd, "OK\n", 3, 0); else send(cfd, "ERR notfound\n", 14, 0);
                } else if (strcmp(line, "LIST") == 0) {
                    for (int b=0;b<MAX_BINDS;b++) if (binds[b].fp[0]) { char out[128]; snprintf(out, sizeof(out), "FP %s %ld\n", binds[b].fp, binds[b].ts); send(cfd, out, strlen(out), 0); }
                    send(cfd, "END\n", 4, 0);
                } else {
                    send(cfd, "ERR unknown\n", 12, 0);
                }
                line = strtok(NULL, "\r\n");
            }
        }

        // Handle any pending X events
        while (XPending(dpy)) {
            XEvent ev; XNextEvent(dpy, &ev);
            if (ev.type == SelectionNotify) {
                XSelectionEvent *sev = (XSelectionEvent*)&ev;
                if (sev->property == None) continue; // conversion failed
                Atom actual_type; int actual_format; unsigned long nitems, bytes_after; unsigned char *prop = NULL;
                int rc = XGetWindowProperty(dpy, win, sev->property, 0, MAX_CLIP/4, False, AnyPropertyType,
                                            &actual_type, &actual_format, &nitems, &bytes_after, &prop);
                if (rc == Success && prop) {
                    char buf[MAX_CLIP]; memset(buf,0,sizeof(buf));
                    int len = (int) (nitems * (actual_format/8));
                    if (len >= MAX_CLIP) len = MAX_CLIP-1;
                    memcpy(buf, prop, len);
                    if (prop) XFree(prop);
                    if (strlen(buf) == 0) continue;
                    // Ignore if same as last
                    if (strcmp(buf, last_text) == 0) continue;
                    strncpy(last_text, buf, MAX_CLIP);
                    char canonical[MAX_CLIP]; strncpy(canonical, buf, MAX_CLIP); canonicalize(canonical);
                    char composite[4096]; snprintf(composite, sizeof(composite), "%s||%s||%s||%s", canonical, "local-origin", device_salt, session_nonce);
                    char fp[65]; sha256_hex(composite, fp);
                    int is_addr = 0; if (strstr(canonical, "bc1") || strstr(canonical, "0x") || strstr(canonical, "lnbc")) is_addr = 1;
                    if (is_addr) {
                        // Compute fingerprint and check registered binds
                        char fp[65]; sha256_hex(composite, fp);
                        int allowed = 0;
                        for (int b=0;b<MAX_BINDS;b++) { if (binds[b].fp[0] && strcmp(binds[b].fp, fp)==0) { allowed=1; break; } }
                        if (allowed) {
                            printf("[INFO] Clipboard contains bound address; allowing paste. Canonical: %s\n", canonical);
                        } else {
                            // Replace clipboard by owning selection and serving the alert text (fail-closed)
                            char *msg = "[UltraLock ALERT] Clipboard content appears to be a protected address; paste blocked by UltraLock.";
                            // become selection owner and store message
                            XSetSelectionOwner(dpy, clip, win, CurrentTime);
                            // store message in atom 'ULTRALOCK_CLIP'
                            Atom clip_atom = XInternAtom(dpy, "ULTRALOCK_CLIP", False);
                            XChangeProperty(dpy, win, clip_atom, utf8, 8, PropModeReplace, (unsigned char*)msg, strlen(msg));
                            printf("[ALERT] Replaced clipboard content due to unbound protected address. Canonical: %s\n", canonical);
                        }
                    } else {
                        printf("Clipboard changed: %s\n", canonical);
                    }
                }
            } else if (ev.type == SelectionRequest) {
                // Another application wants our selection (we may be the owner)
                XSelectionRequestEvent *req = (XSelectionRequestEvent*)&ev;
                XEvent resp;
                memset(&resp, 0, sizeof(resp));
                resp.xselection.type = SelectionNotify;
                resp.xselection.display = req->display;
                resp.xselection.requestor = req->requestor;
                resp.xselection.selection = req->selection;
                resp.xselection.time = req->time;
                resp.xselection.target = req->target;
                resp.xselection.property = None;

                // Provide UTF8_STRING or STRING
                Atom clip_atom = XInternAtom(dpy, "ULTRALOCK_CLIP", False);
                Atom actual_type; int actual_format; unsigned long nitems, bytes_after; unsigned char *prop = NULL;
                int rc = XGetWindowProperty(dpy, win, clip_atom, 0, MAX_CLIP/4, False, AnyPropertyType,
                                            &actual_type, &actual_format, &nitems, &bytes_after, &prop);
                if (rc == Success && prop) {
                    Atom textAtom = XInternAtom(dpy, "TEXT", False);
                    if (req->target == utf8 || req->target == XA_STRING || req->target == textAtom) {
                        // set property on requestor
                        XChangeProperty(dpy, req->requestor, req->property, req->target, 8, PropModeReplace, prop, (int)nitems);
                        resp.xselection.property = req->property;
                    }
                    XFree(prop);
                }
                XSendEvent(dpy, req->requestor, False, 0, &resp);
                XFlush(dpy);
            }
        }
    }

    XCloseDisplay(dpy);
    return 0;
}
