/* clipwatch.m — macOS clipboard monitor scaffold (Objective-C)
 * NOTE: scaffold only. Real agent must implement secure storage and stable fingerprinting.
 */
#import <Foundation/Foundation.h>

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        NSPasteboard *pb = [NSPasteboard generalPasteboard];
        NSInteger last = [pb changeCount];
        while (1) {
            NSInteger now = [pb changeCount];
            if (now != last) {
                last = now;
                NSString *str = [pb stringForType:NSPasteboardTypeString];
                NSLog(@"Clipboard changed: %@", str);
                // TODO: compute fingerprint and verify
            }
            [NSThread sleepForTimeInterval:0.5];
        }
    }
    return 0;
}
