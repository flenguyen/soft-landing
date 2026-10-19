"""Scripted stand-in for the Anthropic Messages API, for local tests only.

Requests from the main conversation (they carry a Bash tool):
  - last user turn contains START-LONG     -> a Bash tool call running COMMAND
  - last user turn is a tool result        -> final text "LONG-TURN-DONE"
  - anything else                          -> short text "OK"
Side requests (titles, classifiers, ...)   -> short text "ok"

Every request is logged as one JSON line (time, kind, end of the last user
message, whether any user message mentions "soft-"), so the tests can tell
whether a Soft Landing command or note ever reached the model.

usage: fake_api.py <port> <log-file> [<bash command for START-LONG>]
"""
import json
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1])
LOG = sys.argv[2]
COMMAND = sys.argv[3] if len(sys.argv) > 3 else "sleep 20; echo slept"
lock = threading.Lock()


def log(obj):
    obj["t"] = round(time.time(), 3)
    with lock:
        with open(LOG, "a") as f:
            f.write(json.dumps(obj) + "\n")


def text_of(content):
    if isinstance(content, str):
        return content
    out = []
    for block in content or []:
        if block.get("type") == "text":
            out.append(block.get("text", ""))
        elif block.get("type") == "tool_result":
            out.append("[tool_result]")
    return " | ".join(out)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):
        pass

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        log({"kind": "GET", "path": self.path})
        self._json(200, {"data": [], "has_more": False})

    def do_HEAD(self):
        self.send_response(200)
        self.send_header("content-length", "0")
        self.end_headers()

    def do_POST(self):
        size = int(self.headers.get("content-length", 0))
        raw = self.rfile.read(size) if size else b"{}"
        try:
            req = json.loads(raw)
        except Exception:
            req = {}
        if "count_tokens" in self.path:
            log({"kind": "count_tokens"})
            return self._json(200, {"input_tokens": 100})
        if not self.path.startswith("/v1/messages"):
            log({"kind": "other", "path": self.path})
            return self._json(200, {})
        msgs = req.get("messages", [])
        tools = [t.get("name") for t in req.get("tools", []) or []]
        main = "Bash" in tools
        last = msgs[-1] if msgs else {}
        last_text = text_of(last.get("content")) if last.get("role") == "user" else ""
        users = [text_of(m.get("content")) for m in msgs if m.get("role") == "user"]
        if main and "[tool_result]" in last_text:
            reply = {"text": "LONG-TURN-DONE"}
        elif main and "START-LONG" in last_text:
            reply = {"tool": {"command": COMMAND, "description": "Wait"}}
        elif main:
            reply = {"text": "OK"}
        else:
            reply = {"text": "ok"}
        log({"kind": "main" if main else "side", "path": self.path, "model": req.get("model"),
             "last_user": last_text[-400:], "n_user": len(users),
             "any_soft": any("soft-" in u for u in users),
             "reply": "tool" if "tool" in reply else reply["text"]})
        model = req.get("model", "claude-fake")
        if req.get("stream"):
            return self._stream(model, reply)
        if "tool" in reply:
            content = [{"type": "tool_use", "id": "toolu_fake1", "name": "Bash", "input": reply["tool"]}]
        else:
            content = [{"type": "text", "text": reply["text"]}]
        return self._json(200, {"id": "msg_fake", "type": "message", "role": "assistant", "model": model,
                                "content": content,
                                "stop_reason": "tool_use" if "tool" in reply else "end_turn",
                                "stop_sequence": None,
                                "usage": {"input_tokens": 10, "output_tokens": 5}})

    def _stream(self, model, reply):
        self.send_response(200)
        self.send_header("content-type", "text/event-stream")
        self.send_header("cache-control", "no-cache")
        self.send_header("connection", "close")
        self.end_headers()

        def event(name, data):
            self.wfile.write(f"event: {name}\ndata: {json.dumps(data)}\n\n".encode())
            self.wfile.flush()

        stamp = int(time.time() * 1000)
        event("message_start", {"type": "message_start", "message": {
            "id": f"msg_{stamp}", "type": "message", "role": "assistant", "model": model,
            "content": [], "stop_reason": None, "stop_sequence": None,
            "usage": {"input_tokens": 10, "output_tokens": 1}}})
        if "tool" in reply:
            event("content_block_start", {"type": "content_block_start", "index": 0, "content_block": {
                "type": "tool_use", "id": f"toolu_{stamp}", "name": "Bash", "input": {}}})
            event("content_block_delta", {"type": "content_block_delta", "index": 0, "delta": {
                "type": "input_json_delta", "partial_json": json.dumps(reply["tool"])}})
            stop = "tool_use"
        else:
            event("content_block_start", {"type": "content_block_start", "index": 0, "content_block": {
                "type": "text", "text": ""}})
            event("content_block_delta", {"type": "content_block_delta", "index": 0, "delta": {
                "type": "text_delta", "text": reply["text"]}})
            stop = "end_turn"
        event("content_block_stop", {"type": "content_block_stop", "index": 0})
        event("message_delta", {"type": "message_delta", "delta": {"stop_reason": stop, "stop_sequence": None},
                                "usage": {"output_tokens": 5}})
        event("message_stop", {"type": "message_stop"})
        self.close_connection = True


ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
