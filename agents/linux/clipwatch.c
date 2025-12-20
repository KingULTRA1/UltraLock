/* clipwatch.c — minimal clipboard watcher prototype (Linux/X11)
 * NOTE: This is a scaffold and a starting implementation. It demonstrates how a
 * native agent could monitor clipboard changes, compute fingerprints, and take
 * action. It intentionally avoids any network operations.
 *
 * Build: gcc -o clipwatch clipwatch.c -lX11 -lm
 * Run: ./clipwatch
 *
 * Security: store per-device salt in a local file (e.g., $XDG_DATA_HOME/ultralock/device_salt)
 * and restrict file permissions to the agent user only.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>
#include <X11/Xlib.h>
#include <X11/Xatom.h>

// A real implementation must perform safe canonicalization and SHA-256 fingerprinting
// consistent with ultralock.js. For brevity this file shows the I/O structure only.

int main(void) {
    Display *dpy = XOpenDisplay(NULL);
    if (!dpy) {
        fprintf(stderr, "Unable to open X display\n");
        return 1;
    }

    Window root = DefaultRootWindow(dpy);

    Atom clip = XInternAtom(dpy, "CLIPBOARD", False);
    Atom targets = XInternAtom(dpy, "TARGETS", False);
    Atom utf8 = XInternAtom(dpy, "UTF8_STRING", False);

    XEvent ev;
    // A simple loop that polls the clipboard content periodically.
    while (1) {
        // Request clipboard content from the owner
        XConvertSelection(dpy, clip, utf8, XA_PRIMARY, root, CurrentTime);
        XFlush(dpy);
        usleep(500 * 1000); // 500ms

        while (XPending(dpy)) {
            XNextEvent(dpy, &ev);
            // In a real implementation handle SelectionNotify and read the content
        }

        // TODO: read selection, compute fingerprint, compare to stored meta, and act accordingly

        // Sleep briefly to reduce CPU
        usleep(500 * 1000);
    }

    XCloseDisplay(dpy);
    return 0;
}
