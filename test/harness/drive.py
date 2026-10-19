"""Drive a real Claude Code against the scripted stand-in model, the way an
app (the desktop Code tab, the phone app) drives it: stream-json in and out,
plus the app's own control messages for drawing.

Scenarios:
  idle        Send one command to an idle session.
  midturn     Start a 20 s turn, send the command 6 s in. Does it run before
              the turn ends?
  band        Start a turn, ask for the band above the prompt mid-turn, press
              its first button. Does the pane open while Claude works?
  permission  A turn whose Bash call needs approval, answered by the "app"
              after 4 s. Which hook and mod signals fire?
  switch      During a long turn, press Pause, then Begin, then Land 5 s
              later. Does the pane switch to Land?
  breath      Open the pane with the command, press Begin, and read the
              pane at 1, 5, 12 and 32 s (Land: 1, 5, 45, 85 and 125 s):
              words, buttons, ring.

Options:
  --surface desktop|mobile|none   attach as this app before the turn (default
                                  desktop; "none" attaches nothing, like -p)
  --command TEXT                  command to send (default /pause)

It prints one JSON summary line, and keeps everything it saw in --out.

usage: drive.py <scenario> --claude BIN --plugin DIR --out DIR --port N [options]
"""
import argparse
import datetime as dt
import json
import os
import re
import subprocess
import sys
import tempfile
import threading
import time

HERE = os.path.dirname(os.path.abspath(__file__))

ap = argparse.ArgumentParser()
ap.add_argument("scenario", choices=["idle", "midturn", "band", "permission", "breath", "switch"])
ap.add_argument("--claude", required=True)
ap.add_argument("--plugin", required=True, action="append", help="plugin folder; repeat to load more than one")
ap.add_argument("--out", required=True)
ap.add_argument("--port", required=True)
ap.add_argument("--surface", default="desktop", choices=["desktop", "mobile", "vscode", "none"])
ap.add_argument("--command", default="/pause")
ap.add_argument("--then", help="idle: a second prompt to send once the command's turn ends")
ap.add_argument("--seconds", type=int, default=20, help="how long the long turn's Bash call sleeps")
args = ap.parse_args()

os.makedirs(args.out, exist_ok=True)
api_log = os.path.join(args.out, "api.jsonl")
debug_log = os.path.join(args.out, "debug.log")
home = tempfile.mkdtemp(prefix="home-", dir=args.out)
work = tempfile.mkdtemp(prefix="work-", dir=args.out)

bash_cmd = f"sleep {args.seconds}; echo slept"
if args.scenario == "permission":
    bash_cmd = "sleep 2; curl -s https://example.com -o /dev/null"  # curl needs approval
api = subprocess.Popen([sys.executable, "-I", os.path.join(HERE, "fake_api.py"), args.port, api_log, bash_cmd])
time.sleep(1.0)

# A clean environment: nothing from the shell's own Claude session leaks in.
env = {k: v for k, v in os.environ.items()
       if not (k.startswith("CLAUDE") or k.startswith("ANTHROPIC") or k.startswith("CCR"))}
env.update({"HOME": home, "ANTHROPIC_BASE_URL": f"http://127.0.0.1:{args.port}",
            "ANTHROPIC_API_KEY": "sk-ant-fake-key-for-local-test",
            "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1", "DISABLE_AUTOUPDATER": "1",
            "CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL": "1"})
env.update(json.loads(os.environ.get("DRIVE_EXTRA_ENV", "{}")))

cmd = [args.claude, "-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose",
       *[a for p in args.plugin for a in ("--plugin-dir", p)], "--debug-file", debug_log, "--model", "claude-sonnet-4-5"]
cmd += ["--permission-prompt-tool", "stdio"] if args.scenario == "permission" else ["--allowedTools", "Bash"]

t0 = time.time()
proc = subprocess.Popen(cmd, cwd=work, env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE, text=True, bufsize=1)
events, responses, results = [], {}, []
done = threading.Event()
lock = threading.Lock()


def now():
    return round(time.time() - t0, 2)


def write(obj, label):
    with lock:
        proc.stdin.write(json.dumps(obj) + "\n")
        proc.stdin.flush()
    events.append((now(), {"SENT": label}))


def reader():
    for line in proc.stdout:
        try:
            obj = json.loads(line)
        except Exception:
            obj = {"raw": line.strip()[:300]}
        events.append((now(), obj))
        if obj.get("type") == "control_response":
            r = obj.get("response", {})
            responses[r.get("request_id")] = r
        elif obj.get("type") == "control_request" and obj["request"].get("subtype") == "can_use_tool":
            def answer(rid=obj["request_id"], inp=obj["request"].get("input")):
                time.sleep(4)
                write({"type": "control_response", "response": {"subtype": "success", "request_id": rid,
                       "response": {"behavior": "allow", "updatedInput": inp}}}, "allow tool")
            threading.Thread(target=answer, daemon=True).start()
        elif obj.get("type") == "result":
            results.append(now())
            done.set()
    done.set()


threading.Thread(target=reader, daemon=True).start()
threading.Thread(target=lambda: proc.stderr.read(), daemon=True).start()


def control(rid, req, wait=5.0):
    write({"type": "control_request", "request_id": rid, "request": req}, f"control {req['subtype']}")
    end = time.time() + wait
    while time.time() < end and rid not in responses:
        time.sleep(0.05)
    return responses.get(rid)


def find_buttons(node, acc):
    if isinstance(node, dict):
        if isinstance(node.get("press"), dict) and "handle" in node["press"]:
            acc.append(node)
        for v in node.values():
            find_buttons(v, acc)
    elif isinstance(node, list):
        for v in node:
            find_buttons(v, acc)
    return acc


def texts(node, acc):
    if isinstance(node, dict):
        if node.get("type") == "Svg":
            src = node.get("props", {}).get("source", "")
            run = re.search(r'data-run="(\d+)"', src)
            moving = "animation:breathe" in src
            acc.append(f"[Svg {'animated' if moving else 'still'} run={run.group(1) if run else '?'} len={len(src)}]")
        for v in node.values():
            texts(v, acc)
    elif isinstance(node, list):
        for v in node:
            texts(v, acc) if not isinstance(v, str) else acc.append(v)
    return acc


def render_pane(rid):
    r = control(rid, {"subtype": "ui_render", "surface": args.surface, "client_id": client, "component": "Pane",
                      "instance_id": "soft-landing", "viewport": viewport,
                      "props": {"title": "Soft Landing", "isFocused": True, "bodyColumns": 60, "placement": "dock",
                                "scroll": {"offset": 0, "bodyRows": 30}, "view": {}}})
    return r or {}


def user(text, label):
    write({"type": "user", "message": {"role": "user", "content": text}}, label)


summary = {"scenario": args.scenario, "surface": args.surface, "command": args.command}
client = f"{args.surface}-harness"
# The desktop app docks panes (isFullscreen true); the phone app reports false.
viewport = {"columns": 100, "rows": 40, "isFullscreen": args.surface == "desktop"}

control("init-1", {"subtype": "initialize"})
if args.surface != "none":
    att = control("attach-1", {"subtype": "ui_attach", "surface": args.surface, "client_id": client,
                               "viewport": viewport})
    summary["attach"] = (att or {}).get("subtype")
    control("panes-0", {"subtype": "ui_panes", "client_id": client})

if args.scenario == "idle":
    user(args.command, "command")
    if args.then:
        end = time.time() + 30
        while not results and time.time() < end:
            time.sleep(0.1)
        done.clear()
        user(args.then, "then")
        while len(results) < 2 and time.time() < end + 30:
            time.sleep(0.1)
elif args.scenario == "midturn":
    user("START-LONG please run the long wait", "long turn")
    time.sleep(6)
    user(args.command, "command mid-turn")
elif args.scenario == "band":
    user("START-LONG please run the long wait", "long turn")
    time.sleep(6)
    band = control("render-1", {"subtype": "ui_render", "surface": args.surface if args.surface != "none" else "desktop",
                                "client_id": client, "component": "AbovePrompt", "instance_id": "above-prompt",
                                "props": {"hasSurvey": False, "isWorking": True, "maxRows": 6, "bodyColumns": 96},
                                "viewport": viewport})
    buttons = find_buttons(band or {}, [])
    summary["band_buttons"] = [b.get("props", {}).get("label") for b in buttons]
    summary["band_error"] = (band or {}).get("error")
    if buttons:
        b = buttons[0]
        press = control("press-1", {"subtype": "ui_press", "plugin": b["press"].get("plugin"),
                                    "handle": b["press"]["handle"], "key": b.get("props", {}).get("key"),
                                    "surface": args.surface, "client_id": client})
        summary["press_handled"] = ((press or {}).get("response") or {}).get("handled")
        summary["pressed_at"] = now()
elif args.scenario == "permission":
    user("START-LONG needs permission", "long turn")
elif args.scenario == "switch":
    def band_buttons(rid):
        r = control(rid, {"subtype": "ui_render", "surface": args.surface, "client_id": client, "component": "AbovePrompt",
                          "instance_id": "above-prompt", "viewport": viewport,
                          "props": {"hasSurvey": False, "isWorking": True, "maxRows": 6, "bodyColumns": 96}})
        return {b.get("props", {}).get("label"): b for b in find_buttons(r or {}, [])}

    def press_button(rid, b):
        return control(rid, {"subtype": "ui_press", "plugin": b["press"].get("plugin"), "handle": b["press"]["handle"],
                             "key": b.get("props", {}).get("key"), "surface": args.surface, "client_id": client})

    user("START-LONG please run the long wait", "long turn")
    time.sleep(3)
    steps = []
    press_button("press-pause", band_buttons("band-1")["Pause"])
    pane = render_pane("pane-a")
    steps.append(["after Pause", texts(pane, [])])
    begin = [b for b in find_buttons(pane, []) if b.get("props", {}).get("key") == "soft-landing-begin"]
    if begin:
        press_button("press-begin", begin[0])
    time.sleep(5)
    steps.append(["breathing", texts(render_pane("pane-b"), [])])
    land = band_buttons("band-2").get("Land")
    summary["land_press"] = (press_button("press-land", land) or {}).get("response") if land else "no Land button"
    time.sleep(1)
    steps.append(["after Land", texts(render_pane("pane-c"), [])])
    summary["steps"] = steps
elif args.scenario == "breath":
    user(args.command, "command")
    time.sleep(3)
    first = render_pane("pane-0")
    summary["pane_error"] = first.get("error")
    frames = [[0, texts(first, [])]]
    begin = [b for b in find_buttons(first, []) if b.get("props", {}).get("key") == "soft-landing-begin"]
    if begin:
        b = begin[0]
        control("press-begin", {"subtype": "ui_press", "plugin": b["press"].get("plugin"), "handle": b["press"]["handle"],
                                "key": "soft-landing-begin", "surface": args.surface, "client_id": client})
        began = time.time()
        for at in ((1, 5, 45, 85, 125) if "land" in args.command else (1, 5, 12, 32)):
            time.sleep(max(0, began + at - time.time()))
            frames.append([at, texts(render_pane(f"pane-{at}"), [])])
    summary["frames"] = frames

done.wait(timeout=args.seconds + 150)
time.sleep(2)
try:
    proc.stdin.close()
except Exception:
    pass
try:
    proc.wait(timeout=20)
except subprocess.TimeoutExpired:
    proc.kill()
api.kill()

with open(os.path.join(args.out, "stream.jsonl"), "w") as f:
    for t, o in events:
        f.write(json.dumps({"t": t, **o}) + "\n")


def since_start(iso):
    stamp = dt.datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp()
    return round(stamp - t0, 2)


plugin_lines, placed = [], []
if os.path.exists(debug_log):
    for line in open(debug_log, errors="replace"):
        m = re.match(r"(\S+) \[DEBUG\] \[[^\]]+\] \$\.ui\.log \(to debug\): (.*)", line)
        if m:
            plugin_lines.append((since_start(m.group(1)), m.group(2).strip()))
        if "ui.open" in line and "placed" in line:
            placed.append(line.split("] ", 1)[-1].strip()[:160])
api_rows = [json.loads(l) for l in open(api_log)] if os.path.exists(api_log) else []
main_rows = [r for r in api_rows if r["kind"] == "main"]
panes = [t for t, o in events if o.get("type") == "system" and o.get("subtype") == "ui_panes" and o.get("panes")]
summary.update({
    "turn_ended_at": results[0] if results else None,
    "model_requests": len(main_rows),
    "command_reached_model": any(r.get("any_soft") for r in api_rows),
    "plugin_log": plugin_lines,
    "pane_shown_at": panes[0] if panes else None,
    "pane_placement": placed[:2],
    "exit": proc.returncode,
})
if args.scenario == "permission":
    summary["host_asked"] = any(o.get("type") == "control_request" and o["request"].get("subtype") == "can_use_tool"
                                for _, o in events)
print(json.dumps(summary))
