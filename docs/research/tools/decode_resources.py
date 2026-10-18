"""Decode ACCELERATOR and MENU payloads at REA-reported file ranges, verifying SHA-256.

Only public, user-visible information (shortcut keys, menu labels) is extracted.
"""
import json, sys, hashlib, re

VK = {0x08: "Backspace", 0x09: "Tab", 0x0D: "Enter", 0x1B: "Esc", 0x20: "Space", 0x21: "PgUp", 0x22: "PgDn",
      0x23: "End", 0x24: "Home", 0x25: "Left", 0x26: "Up", 0x27: "Right", 0x28: "Down", 0x2D: "Insert",
      0x2E: "Delete", 0x5D: "Apps", 0x6B: "Num+", 0x6D: "Num-", 0x6A: "Num*", 0xA6: "BrowserBack",
      0xA7: "BrowserForward", 0xA8: "BrowserRefresh", 0xAA: "BrowserSearch", 0xBB: "=", 0xBD: "-",
      0xBF: "/", 0xBC: ",", 0xBE: "."}
for i in range(1, 25):
    VK[0x6F + i] = f"F{i}"


def key_name(flags, key):
    parts = []
    if flags & 0x08: parts.append("Ctrl")
    if flags & 0x04: parts.append("Shift")
    if flags & 0x10: parts.append("Alt")
    if flags & 0x01:
        k = VK.get(key) or (chr(key) if 0x30 <= key <= 0x5A else f"VK_{key:#x}")
    else:
        k = f"char:{chr(key)!r}"
    parts.append(k)
    return "+".join(parts)


for path in sys.argv[1:]:
    d = json.load(open(path, encoding="utf-8"))
    nr = d["normalized_result"]
    blob = open(nr["artifact"]["path"], "rb").read()
    print("===", nr["artifact"]["path"], "evidence", d["evidence_id"])
    for r in nr["resources"]:
        t = r["type"].get("id")
        if t not in (4, 9):
            continue
        loc = r["payload"]["location"]
        data = blob[loc["offset"]:loc["offset"] + loc["bytes"]]
        ok = hashlib.sha256(data).hexdigest() == r["payload"]["sha256"]
        rid = r["name"].get("id", r["name"].get("name"))
        if t == 9:
            keys = []
            for o in range(0, len(data) - 7, 8):
                fl, key, cmd = int.from_bytes(data[o:o+2], "little"), int.from_bytes(data[o+2:o+4], "little"), int.from_bytes(data[o+4:o+6], "little")
                keys.append(f"{key_name(fl, key)}->{cmd}")
                if fl & 0x80: break
            print(f"ACCEL {rid} sha_ok={ok}: " + ", ".join(keys))
        else:
            text = data.decode("utf-16le", errors="ignore")
            labels = [s for s in re.findall(r"[\w&][\w &.\-'()/…]{1,60}", text) if any(c.isalpha() for c in s)]
            print(f"MENU {rid} sha_ok={ok}: " + " | ".join(labels))
