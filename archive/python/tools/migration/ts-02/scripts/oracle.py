"""Test-only adapter. Imports only an explicitly exported immutable Python oracle."""
import json
import os
from pathlib import Path
import sys
import time

root = Path(os.environ["TS02_REFERENCE_ROOT"])
if (root / ".reference").read_text().strip() != "9b6d2fab4bf165be280d428a874521bfbf02c7e1":
    raise RuntimeError("Wrong reference")
sys.path.insert(0, str(root / "src"))
command, *args = sys.argv[1:]
if command == "clock":
    from claude_statusline.platforms.clocks import now_clocks
    from claude_statusline.platforms.processes import process_start_token
    wall, boot, domain = now_clocks()
    print(json.dumps(dict(wall_ns=wall, boot_ns=boot, boot_id=domain,
                         token=process_start_token(int(args[0])))))
elif command == "lock":
    from claude_statusline.platforms.files import exclusive_file_lock, atomic_write_bytes
    with exclusive_file_lock(args[0]):
        if args[1] == "hold":
            print("locked", flush=True)
            time.sleep(60)
        elif args[1] == "increment":
            path = Path(args[2])
            atomic_write_bytes(path, str(int(path.read_text()) + 1).encode())
        else:
            print("locked", flush=True)
elif command == "revision":
    import hashlib
    value = json.loads(sys.stdin.read())
    print(hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                    separators=(",", ":"), allow_nan=False).encode()).hexdigest())
elif command == "render":
    from claude_statusline.rendering.items import configured_rows
    from claude_statusline.config.display import validate_display_config
    config = validate_display_config(json.loads(Path(args[0]).read_text(encoding="utf-8")))
    payload = json.loads(sys.stdin.read().lstrip("\ufeff"))
    # This is a configured_rows adapter, not the platform's console newline
    # translator. Both language adapters serialize the returned rows as UTF-8 LF.
    sys.stdout.buffer.write(("\n".join(configured_rows(payload, config, int(args[1]))) + "\n").encode("utf-8"))
else:
    raise ValueError(command)

if os.environ.get("TS02_MEASURE") == "1":
    if sys.platform == "win32":
        import ctypes
        class Counters(ctypes.Structure):
            _fields_ = [("cb", ctypes.c_uint32), ("faults", ctypes.c_uint32)] + [
                (name, ctypes.c_size_t) for name in ("peak", "working", "peak_paged", "paged", "peak_nonpaged", "nonpaged", "pagefile", "peak_pagefile")]
        info = Counters()
        info.cb = ctypes.sizeof(info)
        current = ctypes.windll.kernel32.GetCurrentProcess
        current.restype = ctypes.c_void_p
        query = ctypes.windll.psapi.GetProcessMemoryInfo
        query.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_uint32]
        if not query(current(), ctypes.byref(info), info.cb):
            raise RuntimeError("RSS unavailable")
        rss = info.peak
    else:
        import resource
        rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * (1 if sys.platform == "darwin" else 1024)
    print(json.dumps({"peak_rss_bytes": rss}), file=sys.stderr)
