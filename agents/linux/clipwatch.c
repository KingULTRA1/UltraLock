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
#include <X11/Xlib.h>
#include <X11/Xatom.h>
#include <openssl/sha.h>

// Configuration
#define POLL_MS 500
#define DEVICE_DIR_ENV "XDG_DATA_HOME"
#define DEVICE_DIR_FALLBACK ".local/share"
#define DEVICE_SALT_FILE "ultralock_device_salt"
#define MAX_CLIP 4096

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

void sha256_hex(const char *in, char out[65]) {
    unsigned char hash[SHA256_DIGEST_LENGTH];
    SHA256((unsigned char*)in, strlen(in), hash);
    for (int i=0;i<SHA256_DIGEST_LENGTH;i++) sprintf(out + (i*2), "%02x", hash[i]);
    out[64] = '\0';
}

// Very conservative canonicalization: remove whitespace and invisibles, lowercase for bech32/ln
void canonicalize(char *s) {
    char out[MAX_CLIP]; int j=0; for (int i=0;i<strlen(s) && j < MAX_CLIP-1; i++) {
        unsigned char c = s[i];
        if (c <= 32) continue; // strip spaces and controls
        // skip zero-widths roughly
        if ((unsigned)c >= 0x200B && (unsigned)c <= 0x200F) continue;
        out[j++] = c;
    }
    out[j] = '\0';
    // Lowercase
    for (int i=0;i<j;i++) if (out[i] >= 'A' && out[i] <= 'Z') out[i] = out[i] - 'A' + 'a';
    strncpy(s, out, MAX_CLIP);
}

int main(void) {
    printf("UltraLock clipwatch prototype starting...\n");
    char *device_salt = read_or_create_device_salt();
    if (!device_salt) { fprintf(stderr, "Failed to get device salt\n"); return 1; }
    char session_nonce[33];
    unsigned char rn[16]; FILE *ur = fopen("/dev/urandom", "rb"); if (ur) { fread(rn,1,16,ur); fclose(ur); }
    for (int i=0;i<16;i++) sprintf(session_nonce + (i*2), "%02x", rn[i]); session_nonce[32] = '\0';

    Display *dpy = XOpenDisplay(NULL);
    if (!dpy) { fprintf(stderr, "Failed to open X display\n"); return 1; }
    Window root = DefaultRootWindow(dpy);

    Atom clip = XInternAtom(dpy, "CLIPBOARD", False);
    Atom utf8 = XInternAtom(dpy, "UTF8_STRING", False);

    char last_text[MAX_CLIP] = {0};

    while (1) {
        // Simple approach: request clipboard text via X11 selection
        XConvertSelection(dpy, clip, utf8, XA_PRIMARY, root, CurrentTime);
        XFlush(dpy);
        // Sleep briefly and then read selection property (selection handling is complex; simplified approach)
        usleep(POLL_MS * 1000);

        // Use xclip-like approach: ask clipboard owner for STRING
        // For this prototype, attempt to read via XGetSelectionOwner and SelectionConvert/SelectionNotify is required; skipping complete flow due to complexity
        // Instead, call xclip or xsel as a helper if available
        FILE *p = popen("xclip -selection clipboard -o 2>/dev/null || xsel --clipboard --output 2>/dev/null", "r");
        if (!p) { usleep(POLL_MS * 1000); continue; }
        char buf[MAX_CLIP]; memset(buf,0,sizeof(buf)); fgets(buf, sizeof(buf)-1, p); pclose(p);
        if (!buf[0]) { usleep(POLL_MS * 1000); continue; }
        // Truncate newline
        char *nl = strchr(buf, '\n'); if (nl) *nl = '\0';
        if (strcmp(buf, last_text) == 0) { usleep(POLL_MS * 1000); continue; }
        strncpy(last_text, buf, MAX_CLIP);
        char canonical[MAX_CLIP]; strncpy(canonical, buf, MAX_CLIP); canonicalize(canonical);
        char composite[4096]; snprintf(composite, sizeof(composite), "%s||%s||%s||%s", canonical, "local-origin", device_salt, session_nonce);
        char fp[65]; sha256_hex(composite, fp);
        // For this prototype: if fp doesn't match an in-memory bound fingerprint, treat as unbound and replace with blocking msg
        // (Binding would be performed by browser writing the fingerprint to a known local file or via IPC; simplified here)
        // Crime: we have no bound map; we show detection when clipboard contains addresses
        int is_addr = 0; if (strstr(canonical, "bc1") || strstr(canonical, "0x") || strstr(canonical, "lnbc")) is_addr = 1;
        if (is_addr) {
            // Replace clipboard with blocking message (use xclip/xsel to set clipboard)
            char msg[512]; snprintf(msg, sizeof(msg), "[UltraLock ALERT] Clipboard content appears to be a protected address; paste blocked by UltraLock.");
            FILE *w = popen("xclip -selection clipboard -i 2>/dev/null || xsel --clipboard --input 2>/dev/null", "w");
            if (w) { fputs(msg, w); pclose(w); }
            printf("[ALERT] Replaced clipboard content due to unbound protected address. Canonical: %s\n", canonical);
        } else {
            printf("Clipboard changed: %s\n", canonical);
        }

        usleep(POLL_MS * 1000);
    }

    XCloseDisplay(dpy);
    return 0;
}
