/* bridge.c — local HTTP bridge for UltraLock agent
 * Single-file, no external deps. Listens on 127.0.0.1:0 and requires a generated token header.
 * Forwards browser bind requests to the agent unix socket (BINDADDR / UNBINDADDR / LIST).
 * Build: gcc -o bridge bridge.c
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <errno.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <sys/un.h>
#include <time.h>

#define BACKLOG 5
#define TOKEN_LEN 32

static void hex_random(char out[TOKEN_LEN+1]){
    unsigned char buf[TOKEN_LEN/2]; FILE *ur = fopen("/dev/urandom","rb"); if (!ur) { perror("/dev/urandom"); exit(1); } fread(buf,1,sizeof(buf),ur); fclose(ur);
    for (int i=0;i<(int)sizeof(buf);i++) sprintf(out + i*2, "%02x", buf[i]); out[TOKEN_LEN]='\0';
}

static int forward_to_agent(const char *sockpath, const char *cmd, char *resp, size_t resp_sz){
    int s = socket(AF_UNIX, SOCK_STREAM, 0); if (s < 0) return -1;
    struct sockaddr_un addr; memset(&addr,0,sizeof(addr)); addr.sun_family = AF_UNIX; strncpy(addr.sun_path, sockpath, sizeof(addr.sun_path)-1);
    if (connect(s, (struct sockaddr*)&addr, sizeof(addr)) < 0) { close(s); return -1; }
    send(s, cmd, strlen(cmd), 0);
    // read response (single read ok for our small responses)
    ssize_t r = recv(s, resp, resp_sz-1, 0);
    if (r <= 0) { close(s); return -1; }
    resp[r]='\0'; close(s); return 0;
}

int main(void){
    const char *sockpath = getenv("XDG_RUNTIME_DIR");
    char agent_sock[1024]; if (sockpath && sockpath[0]) snprintf(agent_sock, sizeof(agent_sock), "%s/ultralock.sock", sockpath); else {
        const char *home = getenv("HOME"); snprintf(agent_sock, sizeof(agent_sock), "%s/.local/share/ultralock.sock", home);
    }

    char token[TOKEN_LEN+1]; hex_random(token);
    // save token for potential local inspection
    const char *tokenfile = getenv("XDG_RUNTIME_DIR"); char tokenpath[1024]; if (tokenfile && tokenfile[0]) snprintf(tokenpath, sizeof(tokenpath), "%s/ultralock_http_token", tokenfile); else { const char *home = getenv("HOME"); snprintf(tokenpath, sizeof(tokenpath), "%s/.local/share/ultralock_http_token", home); }
    int tf = open(tokenpath, O_WRONLY|O_CREAT|O_TRUNC, 0600); if (tf >= 0) { write(tf, token, strlen(token)); write(tf, "\n", 1); close(tf); }

    int ls = socket(AF_INET, SOCK_STREAM, 0); if (ls < 0) { perror("socket"); return 1; }
    int one = 1; setsockopt(ls, SOL_SOCKET, SO_REUSEADDR, &one, sizeof(one));
    struct sockaddr_in sa; memset(&sa,0,sizeof(sa)); sa.sin_family = AF_INET; sa.sin_addr.s_addr = htonl(INADDR_LOOPBACK); sa.sin_port = 0; // ephemeral
    if (bind(ls, (struct sockaddr*)&sa, sizeof(sa)) < 0) { perror("bind"); close(ls); return 1; }
    socklen_t sl = sizeof(sa); if (getsockname(ls, (struct sockaddr*)&sa, &sl) < 0) { perror("getsockname"); close(ls); return 1; }
    int port = ntohs(sa.sin_port);
    if (listen(ls, BACKLOG) < 0) { perror("listen"); close(ls); return 1; }

    printf("UltraLock bridge listening on http://127.0.0.1:%d/\n", port);
    printf("Token: %s\n", token);
    fflush(stdout);

    while (1) {
        int c = accept(ls, NULL, NULL); if (c < 0) continue;
        // read request
        char buf[4096]; ssize_t r = recv(c, buf, sizeof(buf)-1, 0); if (r <= 0) { close(c); continue; }
        buf[r]='\0';
        // parse first line
        char method[16], path[1024]; if (sscanf(buf, "%15s %1023s", method, path) < 2) { close(c); continue; }
        // simple token check (either header or query param)
        char *hdr = strstr(buf, "X-Ultralock-Token:"); char hdrtok[128] = {0}; if (hdr) { hdr += strlen("X-Ultralock-Token:"); while (*hdr==' ') hdr++; sscanf(hdr, "%127s", hdrtok); }
        // query token
        char qtok[128] = {0}; char *qt = strstr(path, "token="); if (qt) { qt += strlen("token="); int i=0; while (qt[i] && qt[i] != '&' && i < 127) { qtok[i]=qt[i]; i++; } qtok[i]='\0'; }
        if (!(hdrtok[0] && strcmp(hdrtok, token)==0) && !(qtok[0] && strcmp(qtok, token)==0)) {
            const char *resp = "HTTP/1.1 403 Forbidden\r\nContent-Length: 9\r\n\r\nFORBIDDEN";
            send(c, resp, strlen(resp), 0); close(c); continue;
        }
        // route
        char resp_body[4096] = {0}; int ok = 0;
        if (strncmp(path, "/bindaddr", 9) == 0) {
            // extract address param
            char addr[2048] = {0}; char *a = strstr(path, "address="); if (a) { a += strlen("address="); int i=0; while (a[i] && a[i] != '&' && i < (int)sizeof(addr)-1) { addr[i]=a[i]; i++; } addr[i]='\0'; }
            if (!addr[0]) { snprintf(resp_body, sizeof(resp_body), "ERR invalid-addr\n"); }
            else {
                char cmd[4096]; snprintf(cmd, sizeof(cmd), "BINDADDR %s\n", addr);
                if (forward_to_agent(agent_sock, cmd, resp_body, sizeof(resp_body)) == 0) ok = 1; else snprintf(resp_body, sizeof(resp_body), "ERR agent\n");
            }
        } else if (strncmp(path, "/unbindaddr", 11) == 0) {
            char addr[2048] = {0}; char *a = strstr(path, "address="); if (a) { a += strlen("address="); int i=0; while (a[i] && a[i] != '&' && i < (int)sizeof(addr)-1) { addr[i]=a[i]; i++; } addr[i]='\0'; }
            if (!addr[0]) snprintf(resp_body, sizeof(resp_body), "ERR invalid-addr\n"); else { char cmd[4096]; snprintf(cmd, sizeof(cmd), "UNBINDADDR %s\n", addr); if (forward_to_agent(agent_sock, cmd, resp_body, sizeof(resp_body)) == 0) ok = 1; else snprintf(resp_body, sizeof(resp_body), "ERR agent\n"); }
        } else if (strncmp(path, "/list", 5) == 0) {
            char cmd[] = "LIST\n"; if (forward_to_agent(agent_sock, cmd, resp_body, sizeof(resp_body)) == 0) ok = 1; else snprintf(resp_body, sizeof(resp_body), "ERR agent\n");
        } else {
            snprintf(resp_body, sizeof(resp_body), "ERR unknown\n");
        }
        char hdrs[256]; snprintf(hdrs, sizeof(hdrs), "HTTP/1.1 %s\r\nContent-Length: %zu\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n", ok?"200 OK":"400 Bad Request", strlen(resp_body));
        send(c, hdrs, strlen(hdrs), 0); send(c, resp_body, strlen(resp_body), 0);
        close(c);
    }

    return 0;
}
