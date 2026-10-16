/*
 * Read-only post-DSP tap for the PiCeiver CM106 USB sound card.
 * Emits only the six-channel S16_LE playback stream to stdout. The helper
 * never opens ALSA playback/capture or sends a USB command to the card.
 */
#define _POSIX_C_SOURCE 200809L
#include <errno.h>
#include <fcntl.h>
#include <pwd.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/prctl.h>
#include <unistd.h>

struct usbmon_packet {
    uint64_t id;
    unsigned char type, xfer_type, epnum, devnum;
    uint16_t busnum;
    char flag_setup, flag_data;
    int64_t ts_sec;
    int32_t ts_usec, status;
    uint32_t length, len_cap;
    unsigned char extra[24];
};

struct mon_get_arg {
    struct usbmon_packet *hdr;
    void *data;
    size_t alloc;
};

#define MON_IOCX_GETX _IOW(0x92, 10, struct mon_get_arg)
#define DATA_CAP 16384

static int read_line(const char *path, char *out, size_t size) {
    FILE *file = fopen(path, "r");
    if (!file) return -1;
    int ok = fgets(out, (int)size, file) != NULL;
    fclose(file);
    if (!ok) return -1;
    out[strcspn(out, "\r\n")] = '\0';
    return 0;
}

static int find_target(unsigned *bus, unsigned *device) {
    char path[128], id[64], usb_id[64], address[64];
    for (unsigned card = 0; card < 32; card++) {
        snprintf(path, sizeof(path), "/proc/asound/card%u/id", card);
        if (read_line(path, id, sizeof(id)) || strcmp(id, "ICUSBAUDIO7D")) continue;
        snprintf(path, sizeof(path), "/proc/asound/card%u/usbid", card);
        if (read_line(path, usb_id, sizeof(usb_id)) || strcmp(usb_id, "0d8c:0102")) continue;
        snprintf(path, sizeof(path), "/proc/asound/card%u/usbbus", card);
        if (read_line(path, address, sizeof(address))) continue;
        if (sscanf(address, "%u/%u", bus, device) == 2 && *bus > 0 && *device > 0)
            return 0;
    }
    return -1;
}

static int write_all(const unsigned char *data, size_t length) {
    while (length) {
        ssize_t sent = write(STDOUT_FILENO, data, length);
        if (sent < 0 && errno == EINTR) continue;
        if (sent <= 0) return -1;
        data += sent;
        length -= (size_t)sent;
    }
    return 0;
}

int main(void) {
    unsigned bus = 0, device = 0;
    if (find_target(&bus, &device)) {
        fputs("PiCeiver USB sound card not found\n", stderr);
        return 1;
    }

    char path[32];
    snprintf(path, sizeof(path), "/dev/usbmon%u", bus);
    int monitor = open(path, O_RDONLY | O_CLOEXEC);
    if (monitor < 0) {
        perror("usbmon open");
        return 1;
    }

    /* Limit the privileged lifetime to the open operation. */
    struct passwd *account = getpwnam("elvis");
    if (!account || setgid(account->pw_gid) || setuid(account->pw_uid)) {
        fputs("could not drop privileges\n", stderr);
        close(monitor);
        return 1;
    }
    prctl(PR_SET_PDEATHSIG, SIGTERM);
    signal(SIGPIPE, SIG_IGN);
    setvbuf(stdout, NULL, _IONBF, 0);

    unsigned char data[DATA_CAP];
    struct usbmon_packet packet;
    struct mon_get_arg request = { .hdr = &packet, .data = data, .alloc = sizeof(data) };
    for (;;) {
        memset(&packet, 0, sizeof(packet));
        if (ioctl(monitor, MON_IOCX_GETX, &request) < 0) {
            if (errno == EINTR) continue;
            perror("usbmon read");
            break;
        }
        if (packet.type != 'S' || packet.xfer_type != 0 || packet.epnum != 0x06 ||
            packet.busnum != bus || packet.devnum != device || packet.len_cap == 0 ||
            packet.len_cap > sizeof(data) || packet.len_cap % 12 != 0 ||
            packet.flag_data != 0) continue;
        if (write_all(data, packet.len_cap)) break;
    }
    close(monitor);
    return 0;
}
