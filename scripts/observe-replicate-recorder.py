#!/usr/bin/env python3.11
"""Observe-and-replicate recorder for CDP-connected Chromium (Playwright).

Use when a web flow fights automation (clicks that ignore JS events, dialogs
that never register visible, cells that won't take typed input). Attach to a
tab, have the USER perform the flow manually in THAT tab (gold banner), capture
every click/input/table-mutation with caret info to a JSONL file, then
replicate the recorded sequence with Playwright.

Usage:
  python3 observe-replicate-recorder.py <start-url> [--log /tmp/flow-obs.jsonl]

Runs until killed (Ctrl+C) or the user says Done in the TUI -- NEVER auto-exit
on activity. Read the JSONL after killing; events stream as they happen.

Lessons baked in (all cost real debugging time on 2026-08-08):
- e.target.closest THROWS on text nodes; guard before calling it.
- Full page navigations wipe injected listeners; re-inject on every load
  with try/except (sync page.evaluate returns a value -- no .catch()).
- Stream to a file: killing the process must never lose captured data.
- Capture the caret/selection at every click -- the decisive variable for
  editor routing (in-cell vs adjacent-to-table changes paste behavior).
- Bring the instrumented tab to front; if the user insists on their own
  window, instrument ALL pages in the context instead.
"""
import sys, time, json, argparse
from playwright.sync_api import sync_playwright

INSTRUMENT_JS = """() => {
    const ident = (el) => {
        if (!el) return 'none';
        if (el.nodeType !== 1) el = el.parentElement;
        const r = el.getBoundingClientRect();
        return {tag: el.tagName, role: el.getAttribute && el.getAttribute('role') || '',
                inTable: !!el.closest('table'), ce: el.getAttribute && el.getAttribute('contenteditable'),
                cls: (el.className || '').toString().slice(0, 35), x: Math.round(r.x), y: Math.round(r.y),
                w: Math.round(r.width), h: Math.round(r.height)};
    };
    const selInfo = () => {
        const s = window.getSelection();
        if (!s || s.rangeCount === 0) return 'none';
        const r = s.getRangeAt(0);
        const cellOf = (n) => {
            let el = n;
            while (el && el.nodeType === 3) el = el.parentElement;
            return el ? (el.closest('td, th') ? el.closest('td, th').innerText.slice(0, 15) : 'no-cell') : 'none';
        };
        return {startCell: cellOf(r.startContainer), endCell: cellOf(r.endContainer), collapsed: r.collapsed};
    };
    const tableSnap = () => {
        const out = [];
        document.querySelectorAll('table').forEach((t, i) => {
            const rows = [];
            t.querySelectorAll('tr').forEach(r => {
                const cs = [];
                r.querySelectorAll('td, th').forEach(c => cs.push((c.innerText || '').trim().slice(0, 14)));
                rows.push(cs);
            });
            out.push({i, rows});
        });
        return out;
    };
    try { window.__hobs.disconnect(); } catch (e) {}
    if (window.__hclicks) document.removeEventListener('click', window.__hclicks, true);
    if (window.__hinputs) document.removeEventListener('input', window.__hinputs, true);
    let banner = document.getElementById('hermes-obs-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'hermes-obs-banner';
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#ffd700;' +
          'color:#000;font:bold 16px sans-serif;text-align:center;padding:10px;';
        banner.innerText = 'HERMES OBSERVING (until you say Done) - do the flow in THIS tab';
        document.body.appendChild(banner);
    }
    window.__hclicks = (e) => {
        const raw = e.target.nodeType === 3 ? e.target.parentElement : e.target;
        const tgt = raw.closest('[role="button"], [role="menuitem"], button, a, td, th, [contenteditable="true"]') || raw;
        const under = document.elementFromPoint(e.clientX, e.clientY);
        console.log('HERMESOBS:' + JSON.stringify({kind: 'click', target: ident(tgt),
            text: (tgt.innerText || '').trim().slice(0, 40), sel: selInfo(),
            active: ident(document.activeElement), under: ident(under)}));
    };
    document.addEventListener('click', window.__hclicks, true);
    window.__hinputs = (e) => {
        console.log('HERMESOBS:' + JSON.stringify({kind: 'input', inputType: e.inputType, target: ident(e.target),
            text: (e.target.innerText || e.target.value || '').slice(0, 40), sel: selInfo(), tables: tableSnap()}));
    };
    document.addEventListener('input', window.__hinputs, true);
    window.__hobs = new MutationObserver(() => {
        console.log('HERMESOBS:' + JSON.stringify({kind: 'tables', tables: tableSnap()}));
    });
    window.__hobs.observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true});
    console.log('HERMESOBS:' + JSON.stringify({kind: 'ready', tables: tableSnap()}));
}"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("--log", default="/tmp/flow-obs.jsonl")
    ap.add_argument("--cdp", default="http://localhost:9222")
    args = ap.parse_args()

    def log_event(kind, data):
        with open(args.log, "a") as f:
            f.write(json.dumps({"kind": kind, "t": int(time.time() * 1000) % 100000000, **data}) + "\n")

    def on_console(msg):
        t = msg.text
        if t.startswith("HERMESOBS:"):
            try:
                d = json.loads(t[len("HERMESOBS:"):])
                log_event(d.pop("kind", "event"), d)
            except Exception:
                pass

    def re_inject(pg):
        try:
            pg.evaluate(INSTRUMENT_JS)
            log_event("reinjected", {})
        except Exception as e:
            log_event("reinject_err", {"err": str(e)[:120]})

    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(args.cdp)
        ctx = browser.contexts[0] if browser.contexts else browser.new_context()
        page = ctx.new_page()
        page.on("console", on_console)
        page.on("load", re_inject)
        for i in range(3):
            try:
                page.goto(args.url, wait_until="domcontentloaded", timeout=60000)
                break
            except Exception:
                time.sleep(3)
        page.wait_for_timeout(5000)
        re_inject(page)
        try:
            page.bring_to_front()
        except Exception:
            pass
        print(f"OBSERVING -> {args.log} | do the flow in the gold-banner tab; say Done to stop", flush=True)
        try:
            while True:
                time.sleep(10)
                print("heartbeat:", sum(1 for _ in open(args.log)), "events", flush=True)
        except KeyboardInterrupt:
            pass
        page.close()
        browser.close()


if __name__ == "__main__":
    main()
