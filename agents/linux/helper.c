/* helper.c — minimal signed native helper (simple, small, no deps)
 * Usage: helper bindaddr <address>
 * Reads token from $XDG_RUNTIME_DIR/ultralock_http_token and port from $XDG_RUNTIME_DIR/ultralock_http_port
 * Sends GET /bindaddr?address=... with header X-Ultralock-Token: <token>
 * Built with: gcc -o helper helper.c
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/socket.h>
#include <arpa/inet.h>
#include <netdb.h>

static int read_file_trim(const char *path, char *out, size_t sz) {
    FILE *f = fopen(path, "r"); if (!f) return -1; if (!fgets(out, sz, f)) { fclose(f); return -1; } fclose(f);
    // trim
    size_t l = strlen(out); while (l && (out[l-1]=='\n' || out[l-1]=='\r')) out[--l]='\0'; return 0;
}

static void urlencode(const char *src, char *dst, size_t dsz) {
    const char *hex = "0123456789ABCDEF";
    size_t j=0;
    for (size_t i=0; src[i] && j+4<dsz; i++) {
        unsigned char c = src[i];
        if ((c>='a' && c<='z') || (c>='A' && c<='Z') || (c>='0' && c<='9') || c=='-' || c=='_' || c=='.' || c=='~') { dst[j++]=c; }
        else { dst[j++]='%'; dst[j++]=hex[c>>4]; dst[j++]=hex[c&15]; }
    }
    dst[j]='\0';
}

static int http_get(const char *host, int port, const char *path, const char *token, char *resp, size_t rsz) {
    int s = socket(AF_INET, SOCK_STREAM, 0); if (s<0) return -1;
    struct sockaddr_in sa; memset(&sa,0,sizeof(sa)); sa.sin_family = AF_INET; sa.sin_port = htons(port);
    if (inet_pton(AF_INET, host, &sa.sin_addr) <= 0) { close(s); return -1; }
    if (connect(s, (struct sockaddr*)&sa, sizeof(sa)) < 0) { close(s); return -1; }
    char req[4096]; snprintf(req, sizeof(req), "GET %s HTTP/1.1\r\nHost: %s\r\nX-Ultralock-Token: %s\r\nConnection: close\r\n\r\n", path, host, token);
    send(s, req, strlen(req), 0);
    ssize_t r = recv(s, resp, rsz-1, 0);
    if (r<=0) { close(s); return -1; }
    resp[r]='\0'; close(s); return 0;
}

int main(int argc, char **argv) {
    if (argc < 3) { fprintf(stderr, "Usage: %s bindaddr <address>\n", argv[0]); return 2; }
    const char *cmd = argv[1]; const char *addr = argv[2];
    const char *xdg = getenv("XDG_RUNTIME_DIR"); char tokenpath[1024]; char portpath[1024];
    if (xdg && xdg[0]) { snprintf(tokenpath, sizeof(tokenpath), "%s/ultralock_http_token", xdg); snprintf(portpath, sizeof(portpath), "%s/ultralock_http_port", xdg); }
    else { const char *home = getenv("HOME"); snprintf(tokenpath, sizeof(tokenpath), "%s/.local/share/ultralock_http_token", home); snprintf(portpath, sizeof(portpath), "%s/.local/share/ultralock_http_port", home); }
    char token[256] = {0}; if (read_file_trim(tokenpath, token, sizeof(token)) < 0) { fprintf(stderr, "Token file not found (%s)\n", tokenpath); return 2; }
    char portbuf[64] = {0}; if (read_file_trim(portpath, portbuf, sizeof(portbuf)) < 0) { fprintf(stderr, "Port file not found (%s)\n", portpath); return 2; }
    int port = atoi(portbuf); if (port <= 0) { fprintf(stderr, "Invalid port\n"); return 2; }
    if (strcmp(cmd, "bindaddr") == 0) {
        // prompt user for confirmation
        printf("Bind address '%s'? Type YES to confirm: ", addr); fflush(stdout);
        char ans[16]; if (!fgets(ans, sizeof(ans), stdin)) return 2; if (strncmp(ans, "YES", 3) != 0) { printf("Aborted\n"); return 1; }
        char encoded[2048]; urlencode(addr, encoded, sizeof(encoded));
        char path[4096]; snprintf(path, sizeof(path), "/bindaddr?address=%s", encoded);
        char resp[8192]; if (http_get("127.0.0.1", port, path, token, resp, sizeof(resp)) < 0) { fprintf(stderr, "Request failed\n"); return 2; }
        // print response body (simple parse)
        char *body = strstr(resp, "\r\n\r\n"); if (body) body += 4; else body = resp;
        printf("%s", body);
        return 0;
    }
    fprintf(stderr, "Unknown command\n"); return 2;
}
