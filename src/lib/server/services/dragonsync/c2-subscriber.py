#!/usr/bin/env python3
"""
Argos C2 ZMQ subscriber helper.

Spawned by the Argos Node process. Subscribes to tcp://127.0.0.1:4227
(argos-c2-scanner XPUB output), prints each received JSON message on its
own line to stdout. Node side parses line-by-line and caches.

No intermediate processing — schema translation is done Node-side to keep
this helper dependency-free (just pyzmq).

Exits on SIGINT/SIGTERM or broken ZMQ connection.
"""

from __future__ import annotations

import signal
import sys

import zmq


def main() -> int:
    endpoint = "tcp://127.0.0.1:4227"
    ctx = zmq.Context.instance()
    sub = ctx.socket(zmq.SUB)
    sub.setsockopt(zmq.SUBSCRIBE, b"")
    sub.setsockopt(zmq.RCVHWM, 200)
    sub.connect(endpoint)

    def _terminate(_sig, _frm):
        sub.close(linger=0)
        ctx.term()
        sys.exit(0)

    signal.signal(signal.SIGTERM, _terminate)
    signal.signal(signal.SIGINT, _terminate)

    try:
        while True:
            msg = sub.recv_string()
            print(msg, flush=True)
    except KeyboardInterrupt:
        return 0
    except zmq.ZMQError:
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
