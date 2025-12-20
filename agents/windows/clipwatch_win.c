/* clipwatch_win.c — Windows clipboard monitor scaffold
 * NOTE: This is a scaffold demonstrating how to listen for clipboard changes using Win32 APIs.
 * Real implementation must compute canonicalization and SHA-256 fingerprint consistent with ultralock.js
 */

#include <windows.h>
#include <stdio.h>

int main(void) {
    MSG msg;
    HWND hwnd = GetConsoleWindow();
    if (!hwnd) return 1;

    AddClipboardFormatListener(hwnd);
    printf("Listening for clipboard changes...\n");

    while (GetMessage(&msg, NULL, 0, 0)) {
        if (msg.message == WM_CLIPBOARDUPDATE) {
            // TODO: read clipboard, compute fingerprint, compare to stored metadata
            printf("Clipboard updated\n");
        }
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }
    RemoveClipboardFormatListener(hwnd);
    return 0;
}
