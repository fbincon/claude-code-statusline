"""Human GNOME Terminal and tmux popup acceptance; never inject input.

On Wayland, focus and visual quality are confirmed by the operator. These
answers are kept separate from nonce/TTY, key and termios measurements.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "tools/migration/ts-02"
sys.path.insert(0, str(ROOT))
from tools.ts02_macos_terminal_smoke import events, exercise, hash_file, write


def assess(folder, mode):
    record = json.loads((folder / "interaction.json").read_text())
    saved, cancelled = events(folder / "save.jsonl"), events(folder / "cancel.jsonl")
    keys = "".join(row["data"] for row in saved if row["event"] == "key")
    sizes = [row["data"] for row in saved if row["event"] == "resize"]
    launch = json.loads((folder / "launch.json").read_text())
    handshake = json.loads((folder / "handshake.json").read_text())
    source = json.loads((folder / "source.json").read_text())
    checks = {
        "human_focus_and_visuals": all(record["human"].get(name) == "yes" for name in
                                      ("automatic_focus", "unicode_display", "restored_display")),
        "restored_echo": record["echo"] == "TS02-RESTORED",
        "arrows": all("\x1b[" + code in keys or "\x1bO" + code in keys for code in "ABCD"),
        "unicode_input": all(value in keys for value in ("中文", "e\u0301", "👩🏽‍💻")),
        "ctrl_s": {"event": "restored", "data": "save"} in saved,
        "ctrl_c": {"event": "restored", "data": "cancel"} in cancelled,
        "exit_codes": [item["exit_code"] for item in record["runs"]] == [0, 130, 1],
        "termios_restored": all(item["restored_without_harness_repair"] for item in record["runs"]),
        "nonce_tty_handshake": (handshake.get("nonce") == launch["prepared"]["request"]["nonce"]
                                and handshake.get("input_tty") is True and handshake.get("output_tty") is True),
        "source_unchanged": all(hash_file(ROOT / name) == expected for name, expected in source["files"].items()),
    }
    if mode == "direct":
        checks["small_and_large_resize"] = (any(c < 64 or r < 18 for c, r in sizes)
                                            and any(c >= 80 and r >= 24 for c, r in sizes))
    else:
        parent = json.loads((folder / "popup-parent.json").read_text())
        checks["popup_closed_to_parent"] = parent["exit_code"] == 0 and parent["echo"] == "TS02-PARENT"
        checks["popup_visual"] = parent["human_visual"] == "yes"
    return {"status": "pass" if all(checks.values()) else "fail", "checks": checks, "mode": mode,
            "input_origin": "human GNOME Terminal session; no injected keys", "sizes": sizes,
            "focus_evidence": "operator confirmation; no OS active-window query claimed on Wayland",
            "scope": "this Linux GNOME desktop only"}


def popup_host(config, tail):
    argv = [config["python"], config["tool"], "popup-child", "--config", config["config"], *tail]
    result = subprocess.run([config["tmux"], "display-popup", "-E", "-w", "90%", "-h", "95%", shlex.join(argv)])
    print("\n已返回 popup 外层 tmux。")
    echo = input("请输入 TS02-PARENT 验证父终端正常输入: ")
    visual = input("popup 边框、焦点和关闭后的父屏幕是否正常？yes/no/skip: ").strip().lower()
    write(Path(config["output"]) / "popup-parent.json", {"exit_code": result.returncode, "echo": echo, "human_visual": visual})


def child(config, tail):
    folder = Path(config["output"])
    if not tail or tail[0] != "launch-helper":
        raise ValueError("Expected nonce-bound launch arguments")
    if config["mode"] == "direct":
        exercise(config, *tail[1:])
    else:
        argv = [config["python"], config["tool"], "popup-host", "--config", config["config"], *tail]
        result = subprocess.run([config["tmux"], "-L", config["socket"], "-f", "/dev/null",
                                 "new-session", "-s", "ts02", shlex.join(argv)])
        write(folder / "tmux-client.json", {"exit_code": result.returncode})
    request = json.loads(Path(tail[1]).read_text())
    write(folder / "handshake.json", json.loads(Path(request["result"]).read_text()))
    report = assess(folder, config["mode"])
    report["artifacts"] = {p.name: hash_file(p) for p in folder.iterdir() if p.is_file() and p.name != "launcher.log"}
    write(folder / "manual-evidence.json", report)
    print("\n结果：" + report["status"] + "；原始记录已保存。", flush=True)
    input("按 Enter 关闭此窗口并返回聊天: ")
    return int(report["status"] != "pass")


def launch(args):
    folder = args.output.resolve()
    folder.mkdir(mode=0o700)
    config_path = folder / "config.json"
    config = {"node": str(args.node.resolve(strict=True)), "output": str(folder), "mode": args.mode,
              "config": str(config_path), "socket": "ts02-" + str(time.time_ns()), "python": sys.executable,
              "tool": str(Path(__file__).resolve()), "tmux": shutil.which("tmux"),
              "session_type": os.environ.get("XDG_SESSION_TYPE")}
    if not shutil.which("gnome-terminal") or (args.mode == "popup" and not config["tmux"]):
        raise RuntimeError("GNOME Terminal and tmux must be installed")
    write(config_path, config)
    files = [Path(__file__), ROOT / "tools/ts02_macos_terminal_smoke.py", *[PACKAGE / "dist" / (name + ".js") for name in
              ("cli", "launchers", "launch", "clocks", "native", "terminal", "generated/unicode", "generated/generated-unicode")]]
    write(folder / "source.json", {"commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
                                    "dirty": bool(subprocess.check_output(["git", "status", "--porcelain=v1"], cwd=ROOT)),
                                    "files": {str(path.relative_to(ROOT)): hash_file(path) for path in files},
                                    "node_sha256": hash_file(args.node.resolve()), "python_sha256": hash_file(Path(sys.executable).resolve())})
    module = f"""
import {{prepare,launcherArgv}} from {json.dumps((PACKAGE / 'dist/launchers.js').as_uri())};
import {{readFileSync,writeFileSync}} from 'node:fs';
import {{spawnSync}} from 'node:child_process';
const config=JSON.parse(readFileSync(process.argv[2],'utf8'));
const save=(name,value)=>writeFileSync(config.output+'/'+name,JSON.stringify(value,null,2)+'\\n',{{flag:'wx'}});
const prepared=prepare(config.output,{{executable:config.python,args:[config.tool,'child','--config',config.config]}});
const argv=launcherArgv('gnome',prepared.command,config.output);
save('launch.json',{{argv,prepared,parent:process.pid,started_unix_ms:Date.now()}});
const result=spawnSync(argv[0],argv.slice(1),{{encoding:'utf8',timeout:1800000}});
save('open-result.json',{{status:result.status,error:result.error?.message,stdout:result.stdout,stderr:result.stderr}});
process.exitCode=result.status??1;
"""
    script = folder / "launcher.mjs"
    script.write_text(module)
    with (folder / "launcher.log").open("xb") as log:
        result = subprocess.run([config["node"], str(script), str(config_path)], stdout=log, stderr=subprocess.STDOUT)
    report = folder / "manual-evidence.json"
    if report.exists():
        print(report.read_text())
    else:
        print("Incomplete manual run; original files retained: " + str(folder))
    return result.returncode


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=("launch", "child", "popup-host", "popup-child"))
    parser.add_argument("--output", type=Path)
    parser.add_argument("--node", type=Path)
    parser.add_argument("--mode", choices=("direct", "popup"))
    parser.add_argument("--config", type=Path)
    args, tail = parser.parse_known_args()
    if sys.platform != "linux":
        parser.error("Linux GNOME desktop required")
    if args.phase == "launch":
        if not args.output or not args.node or not args.node.is_absolute() or not args.mode or tail:
            parser.error("launch requires --output NEW_DIR --node ABS_NODE --mode direct|popup")
        return launch(args)
    config = json.loads(args.config.read_text())
    if args.phase == "child":
        return child(config, tail)
    if args.phase == "popup-host":
        popup_host(config, tail)
    else:
        if not tail or tail[0] != "launch-helper":
            raise ValueError("Expected launcher nonce")
        exercise(config, *tail[1:])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
