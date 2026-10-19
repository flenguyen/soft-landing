"""Turn run-matrix.sh's JSON lines into a readable table."""
import json
import sys

rows = [json.loads(line) for line in sys.stdin if line.strip()]


def verdict(r):
    log = " | ".join(text for _, text in r.get("plugin_log", []))
    opened = "opened" in log
    if r["scenario"] == "idle":
        if opened and r["model_requests"] == 0:
            return "Soft Landing answered, no Claude reply"
        return f"skill ran, {r['model_requests']} request(s) to Claude"
    if r["scenario"] == "midturn":
        ended, pane = r.get("turn_ended_at"), r.get("pane_shown_at")
        if pane and ended and pane < ended:
            return f"ran mid-turn at {pane}s (turn ended {ended}s)"
        return f"waited for the turn to end ({ended}s)"
    if r["scenario"] == "band":
        if r.get("band_error"):
            return "app drawing not supported"
        if not r.get("band_buttons"):
            return "no buttons drawn"
        ok = r.get("press_handled") and r.get("pane_shown_at") and r.get("turn_ended_at") \
            and r["pane_shown_at"] < r["turn_ended_at"]
        return f"buttons {r['band_buttons']}, " + ("pane opened mid-turn" if ok else "pane did not open mid-turn")
    if r["scenario"] == "breath":
        frames = r.get("frames") or []
        if len(frames) < 4 or not any(f[1] for f in frames):
            return "app drawing not supported" if r.get("attach") != "success" else "pane did not draw"
        words = [" / ".join(t for t in f[1] if not t.startswith("[") and t != "soft-landing") for f in frames]
        rings = [next((t for t in f[1] if t.startswith("[Svg")), "") for f in frames]
        # One self-animating SVG for the whole breath, still before and after.
        steady = rings[1].startswith("[Svg animated") and len(set(rings[1:-1])) == 1 and "still" in rings[-1]
        return f"{'one animated ring' if steady else 'ring source changed: ' + ' '.join(rings)}, ended: {words[-1]}"
    return json.dumps(r)[:120]


print(f"{'version':10} {'scenario':9} {'app':8} result")
for r in rows:
    print(f"{r['version']:10} {r['scenario']:9} {r['surface']:8} {verdict(r)}")
