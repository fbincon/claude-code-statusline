"""Human Terminal.app / isolated tmux popup evidence for the TS-02 prototype.

launch --node ABS_NODE --output NEW_DIR --mode direct|popup opens Terminal.app.
No keys are injected. The user follows the visible prompts. OS focus queries,
screenshots, raw events, full termios restoration and human answers stay separate.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import shlex
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "tools/migration/ts-02"


def write(path, value):
    with path.open("x", encoding="utf-8") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write("\n")


def hash_file(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def attrs_json(attrs):
    return [*attrs[:6], [value.hex() if isinstance(value, bytes) else value for value in attrs[6]]]


def events(path):
    return [json.loads(line) for line in path.read_text().splitlines()] if path.exists() else []


def assess(folder, mode):
    record = json.loads((folder / "interaction.json").read_text())
    saved, cancelled = events(folder / "save.jsonl"), events(folder / "cancel.jsonl")
    keys = "".join(row["data"] for row in saved if row["event"] == "key")
    sizes = [row["data"] for row in saved if row["event"] == "resize"]
    checks = {"human_answers": all(record["human"].get(name) == "yes" for name in
                                   ("automatic_focus", "unicode_display", "restored_display")),
              "restored_echo": record["echo"] == "TS02-RESTORED",
              "arrows": all("\x1b[" + code in keys or "\x1bO" + code in keys for code in "ABCD"),
              "unicode_input": all(value in keys for value in ("中文", "e\u0301", "👩🏽‍💻")),
              "ctrl_s": any(row == {"event": "restored", "data": "save"} for row in saved),
              "ctrl_c": any(row == {"event": "restored", "data": "cancel"} for row in cancelled),
              "exit_codes": [item["exit_code"] for item in record["runs"]] == [0, 130, 1],
              "termios_restored": all(item["restored_without_harness_repair"] for item in record["runs"])}
    launch = json.loads((folder / "launch.json").read_text())
    focus = json.loads((folder / "focus.json").read_text()) if (folder / "focus.json").exists() else {}
    checks["nonce_tty_handshake"] = (focus.get("nonce") == launch["prepared"]["request"]["nonce"]
                                      and focus.get("input_tty") is True and focus.get("output_tty") is True)
    checks["os_observed_focus"] = focus.get("status") == 0 and focus.get("frontmost") == "Terminal"
    source = json.loads((folder / "source.json").read_text())
    checks["source_unchanged"] = all(hash_file(ROOT / name) == expected for name, expected in source["files"].items())
    if mode == "direct":
        checks["small_and_large_resize"] = (any(c < 64 or r < 18 for c, r in sizes)
                                             and any(c >= 80 and r >= 24 for c, r in sizes))
    else:
        parent = json.loads((folder / "popup-parent.json").read_text())
        checks["popup_closed_to_parent"] = parent["exit_code"] == 0 and parent["echo"] == "TS02-PARENT"
        checks["popup_visual"] = parent["human_visual"] == "yes"
    return {"status": "pass" if all(checks.values()) else "fail", "checks": checks,
            "mode": mode, "input_origin": "user-operated real Terminal.app; no injected keys",
            "sizes": sizes, "scope": "this macOS guest desktop only"}


def exercise(config, request, nonce):
    import termios
    folder = Path(config["output"])
    node = config["node"]
    cli = str(PACKAGE / "dist/cli.js")
    subprocess.run([node, cli, "launch-helper", request, nonce], check=True)
    print("\nTS-02 真人终端验收 / Human terminal check", flush=True)
    print("第 1 屏：按 ↑ ↓ ← →，用中文输入法输入 中文，然后输入或粘贴 é 👩🏽‍💻。")
    if config["mode"] == "direct":
        print("拖动窗口到很小（显示 Need 64x18），再放大至至少 80x24；最后 Ctrl+S。")
    else:
        print("确认处于 tmux popup 内、能获得按键焦点；最后 Ctrl+S。无需缩放 popup。")
    print("按键不会在试验屏回显，原始事件会保存。第 2 屏按 Ctrl+C。")
    input("准备后按 Enter / Press Enter when ready: ")
    original = termios.tcgetattr(0)
    runs = []
    for name, log in (("save", folder / "save.jsonl"), ("cancel", folder / "cancel.jsonl"),
                      ("log-failure", folder / "missing" / "events.jsonl")):
        if name == "cancel":
            input("下一屏只按 Ctrl+C。准备后按 Enter: ")
        before = termios.tcgetattr(0)
        result = subprocess.run([node, cli, "terminal", str(log)])
        after = termios.tcgetattr(0)
        restored = before == after
        runs.append({"name": name, "exit_code": result.returncode, "before": attrs_json(before),
                     "after": attrs_json(after), "restored_without_harness_repair": restored})
        if not restored:
            termios.tcsetattr(0, termios.TCSANOW, original)
            print("恢复检查失败；采集器已恢复属性以便退出，该项仍记为失败。")
    echo = input("现在应可正常回显。请输入 TS02-RESTORED 后 Enter: ")
    human = {}
    for name, question in (("automatic_focus", "Terminal/popup 是否自动打开且取得输入焦点？"),
                           ("unicode_display", "中文、组合字符 é、emoji 👩🏽‍💻 的显示及宽度是否正常？"),
                           ("restored_display", "退出和日志失败后，屏幕、光标、正常输入是否都恢复？")):
        human[name] = input(question + " yes/no/skip: ").strip().lower()
    write(folder / "interaction.json", {"runs": runs, "echo": echo, "human": human,
                                        "completed_unix_ns": time.time_ns()})


def child(config, tail):
    marker, request, nonce = tail
    if marker != "launch-helper":
        raise ValueError("Expected nonce-bound launcher arguments")
    if config["mode"] == "direct":
        exercise(config, request, nonce)
    else:
        argv = [sys.executable, str(Path(__file__).resolve()), "popup-host", "--config", config["config"],
                marker, request, nonce]
        result = subprocess.run([config["tmux"], "-L", config["socket"], "-f", "/dev/null",
                                 "new-session", "-s", "ts02", shlex.join(argv)])
        write(Path(config["output"]) / "tmux-client.json", {"exit_code": result.returncode})
    report = assess(Path(config["output"]), config["mode"])
    write(Path(config["output"]) / "manual-evidence.json", report)
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)
    write(Path(config["output"]) / "done.json", {"completed_unix_ns": time.time_ns()})


def popup_host(config, tail):
    argv = [sys.executable, str(Path(__file__).resolve()), "popup-child", "--config", config["config"], *tail]
    # Keep at least 18 interior rows in a default 80x24 Terminal window.
    result = subprocess.run([config["tmux"], "display-popup", "-E", "-w", "90%", "-h", "95%", shlex.join(argv)])
    print("\n已返回 popup 外层 tmux session。")
    echo = input("请输入 TS02-PARENT 验证父终端输入恢复: ")
    visual = input("popup 边框、焦点、关闭后父屏幕是否正常？yes/no/skip: ").strip().lower()
    write(Path(config["output"]) / "popup-parent.json", {"exit_code": result.returncode, "echo": echo, "human_visual": visual})


def launch(args):
    folder = args.output.resolve()
    folder.mkdir(mode=0o700)
    config_path = folder / "config.json"
    config = {"node": str(args.node.resolve(strict=True)), "output": str(folder), "mode": args.mode,
              "config": str(config_path), "socket": "ts02-" + str(time.time_ns()),
              "python": sys.executable, "tool": str(Path(__file__).resolve()), "tmux": shutil.which("tmux")}
    if args.mode == "popup" and not config["tmux"]:
        raise RuntimeError("tmux is unavailable")
    write(config_path, config)
    files = [Path(__file__), *[PACKAGE / "dist" / (name + ".js") for name in
                              ("cli", "launchers", "launch", "clocks", "native", "terminal", "generated/unicode", "generated/generated-unicode")]]
    write(folder / "source.json", {"commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
                                    "dirty": bool(subprocess.check_output(["git", "status", "--porcelain=v1"], cwd=ROOT)),
                                    "files": {str(path.relative_to(ROOT)): hash_file(path) for path in files},
                                    "node_sha256": hash_file(args.node.resolve()), "python_sha256": hash_file(Path(sys.executable).resolve())})
    # This uses the actual candidate's prepare/helper/.command implementation.
    # Keep its parent alive until the human session ends, preserving PID identity.
    module = f"""
import {{prepare,launcherArgv}} from {json.dumps((PACKAGE / 'dist/launchers.js').as_uri())};
import {{readFileSync,writeFileSync,existsSync}} from 'node:fs';
import {{spawnSync}} from 'node:child_process';
const config=JSON.parse(readFileSync(process.argv[2],'utf8'));
const save=(name,value)=>writeFileSync(config.output+'/'+name,JSON.stringify(value,null,2)+'\\n',{{flag:'wx'}});
const prepared=prepare(config.output,{{executable:config.python,args:[config.tool,'child','--config',config.config]}});
const argv=launcherArgv('macos',prepared.command,config.output);
save('launch.json',{{argv,prepared,parent:process.pid,started_unix_ms:Date.now()}});
const opened=spawnSync(argv[0],argv.slice(1),{{encoding:'utf8'}});
save('open-result.json',{{status:opened.status,stdout:opened.stdout,stderr:opened.stderr}});
if(opened.status!==0)process.exit(1);
const seen=new Set(); let focused=false;
for(let i=0;i<7200 && !existsSync(config.output+'/done.json');i++){{
  await new Promise(resolve=>setTimeout(resolve,500));
  if(!focused && existsSync(prepared.request.result)){{
    const focus=spawnSync('/usr/bin/osascript',['-e','tell application "System Events" to get name of first application process whose frontmost is true'],{{encoding:'utf8'}});
    save('focus.json',{{...JSON.parse(readFileSync(prepared.request.result,'utf8')),observed_unix_ms:Date.now(),status:focus.status,frontmost:focus.stdout.trim(),stderr:focus.stderr}}); focused=true;
  }}
  for(const name of ['save','cancel']){{
    const path=config.output+'/'+name+'.jsonl'; if(!existsSync(path))continue;
    let rows;try{{rows=readFileSync(path,'utf8').trim().split('\\n').map(JSON.parse)}}catch{{continue}}
    if(!rows.some(r=>r.event==='ready'))continue;
    const size=rows.filter(r=>r.event==='resize').at(-1)?.data;
    const key=name+'-'+size?.join('x'); if(seen.has(key) || seen.size>=12)continue; seen.add(key);
    const win=spawnSync('/usr/bin/osascript',['-e','tell application "Terminal" to get id of front window'],{{encoding:'utf8'}});
    const id=win.stdout.trim();
    if(win.status===0 && /^\\d+$/.test(id)){{
      const shot=spawnSync('/usr/sbin/screencapture',['-x','-l',id,config.output+'/'+key+'.png'],{{encoding:'utf8'}});
      save(key+'-screenshot.json',{{window:id,status:shot.status,stderr:shot.stderr,captured_unix_ms:Date.now()}});
    }}else save(key+'-screenshot.json',{{window_status:win.status,stderr:win.stderr}});
  }}
}}
if(!existsSync(config.output+'/done.json')){{save('timeout.json',{{human_completed:false}});process.exit(1)}}
"""
    script = folder / "launcher.mjs"
    script.write_text(module)
    with (folder / "launcher.log").open("xb") as log:
        result = subprocess.run([config["node"], str(script), str(config_path)], stdout=log, stderr=subprocess.STDOUT)
    return result.returncode


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=("launch", "child", "popup-host", "popup-child"))
    parser.add_argument("--output", type=Path)
    parser.add_argument("--node", type=Path)
    parser.add_argument("--mode", choices=("direct", "popup"))
    parser.add_argument("--config", type=Path)
    parser.add_argument("tail", nargs="*")
    args, extra = parser.parse_known_args()
    if sys.platform != "darwin":
        parser.error("Real macOS Terminal.app required")
    if args.phase == "launch":
        if not args.output or not args.node or not args.node.is_absolute() or not args.mode or extra:
            parser.error("launch requires --output NEW_DIR --node ABS_NODE --mode direct|popup")
        return launch(args)
    config = json.loads(args.config.read_text())
    tail = args.tail + extra
    if args.phase == "child":
        child(config, tail)
    elif args.phase == "popup-host":
        popup_host(config, tail)
    else:
        marker, request, nonce = tail
        if marker != "launch-helper":
            raise ValueError("Expected launcher nonce")
        exercise(config, request, nonce)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
