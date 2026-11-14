#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""stdio <-> HTTP bridge for the RibbitFlip MCP endpoint.

RibbitFlip serves MCP over Streamable HTTP (POST http://127.0.0.1:<port>/mcp). Clients that
only speak the stdio transport can use this script instead: it reads newline-delimited
JSON-RPC from stdin, forwards each message to the running app, and writes the reply back to
stdout as one line.

It talks ONLY to http://127.0.0.1:<port>/mcp (the address is fixed below, only the port is
configurable), adds no capability of its own and passes every message through the app's MCP
gate, so the MCP switch in the app (off by default, `--no-mcp`) still decides everything.

Usage:  python tools/mcp_stdio_bridge.py [--port 8770]
        (falls back to the RIBBITFLIP_PORT environment variable)

Client config example:
    {"mcpServers": {"ribbitflip": {"command": "python",
                                   "args": ["C:/path/to/tools/mcp_stdio_bridge.py"]}}}
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request


def _write(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def main():
    p = argparse.ArgumentParser(description="Bridge stdio MCP clients to RibbitFlip's /mcp endpoint")
    p.add_argument("--port", type=int, default=int(os.environ.get("RIBBITFLIP_PORT") or 8770),
                   help="port of the running RibbitFlip app (default 8770)")
    args = p.parse_args()
    url = "http://127.0.0.1:%d/mcp" % args.port

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except Exception as e:
            _write({"jsonrpc": "2.0", "id": None,
                    "error": {"code": -32700, "message": "Parse error: %s" % e}})
            continue
        rid = msg.get("id") if isinstance(msg, dict) else None
        req = urllib.request.Request(
            url, data=json.dumps(msg, ensure_ascii=False).encode("utf-8"),
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST")
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                status = r.status
                body = r.read()
        except urllib.error.HTTPError as e:
            status = e.code
            body = e.read()
        except Exception as e:
            # Connection refused / app closed: answer in-band so the client sees a real error
            # instead of a hung request.
            _write({"jsonrpc": "2.0", "id": rid,
                    "error": {"code": -32001,
                              "message": "RibbitFlip is not running on port %d (%s). Start the app, "
                                         "then retry." % (args.port, e)}})
            continue
        if status == 202 or not body:      # notification acknowledged — nothing to relay
            continue
        try:
            _write(json.loads(body.decode("utf-8")))
        except Exception:
            _write({"jsonrpc": "2.0", "id": rid,
                    "error": {"code": -32603, "message": "Malformed reply from RibbitFlip"}})


if __name__ == "__main__":
    main()
