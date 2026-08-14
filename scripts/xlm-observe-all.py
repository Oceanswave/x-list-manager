#!/usr/bin/env python3.11
"""All-pages observe recorder for CDP-connected Chromium (Playwright).

Follows the user as THEY drive the UI in THEIR OWN tab/window. Injects the
gold banner + click/input instrumentation into EVERY page in the context
(and any new page that opens), streams events to a JSONL file.

Usage:
  python3 xlm-observe-all.py [--log /tmp/xlm-flow.jsonl]
Runs until killed (Ctrl+C) or the user says Done.
"""
import sys, time, json, argparse
from playwright.sync_api import sync_playwright

INSTRUMENT_JS = """() => {
    const ident = (el) => {
        if (!el) return 'none';
        if (el.nodeType !== 1) el = el.parentElement;
        const r = el.getBoundingClientRect();
        const attrs = {};
        for (const a of el.attributes || []) {
            if (!['class','style'].includes(a.name)) attrs[a.name] = a.value;
        }
        return {tag: el.tagName, attrs, text: (el.innerText || '').trim().replace(/\\s+/g,' ').slice(0,60),
                x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height)};
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
        console.log('HERMESOBS:' + JSON.stringify({kind: 'click', target: ident(tgt)}));
    };
    document.addEventListener('click', window.__hclicks, true);
    window.__hinputs = (e) => {
        console.log('HERMESOBS:' + JSON.stringify({kind: 'input', inputType: e.inputType,
            target: ident(e.target), val: (e.target.value || e.target.innerText || '').slice(0,40)}));
    };
    document.addEventListener('input', window.__hinputs, true);
    window.__hobs = new MutationObserver(() => {
        const dlg = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
        if (dlg.length) {
            console.log('HERMESOBS:' + JSON.stringify({kind: 'dialogs', dialogs: Array.from(dlg).map(d =>
                ({role: d.getAttribute('role'), text: (d.innerText||'').trim().replace(/\\s+/g,' ').slice(0,120)}))}));
        }
    });
    window.__hobs.observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true});
    console.log('HERMESOBS:' + JSON.stringify({kind: 'ready', url: location.href}));
}
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--log", default="/tmp/xlm-flow.jsonl")
    ap.add_argument("--cdp", default="http://localhost:9222")
    args = ap.parse_args()

    def log_event(d):
        with open(args.log, "a") as f:
            f.write(json.dumps({"t": int(time.time() * 1000), **d}) + "\n")

    def on_console(msg):
        t = msg.text
        if isinstance(t, str) and t.startswith("HERMESOBS:"):
            try:
                d = json.loads(t[len("HERMESOBS:"):])
                log_event(d)
            except Exception as e:
                print(f"OBSERVE_PARSE_ERR {e}: {t[:200]}", flush=True)

    def re_inject(pg):
        try:
            pg.evaluate(INSTRUMENT_JS)
            log_event({"kind": "reinjected", "url": pg.url})
        except Exception as e:
            log_event({"kind": "reinject_err", "err": str(e)[:120], "url": pg.url})

    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(args.cdp)
        ctx = browser.contexts[0] if browser.contexts else browser.new_context()

        def hook_page(pg):
            pg.on("console", on_console)
            pg.on("load", lambda: re_inject(pg))
            re_inject(pg)

        # Hook new pages BEFORE instrumenting existing ones
        ctx.on("page", hook_page)
        for pg in ctx.pages:
            hook_page(pg)
        try:
            ctx.pages[0].bring_to_front()
        except Exception:
            pass
        print(f"OBSERVING -> {args.log} | {len(ctx.pages)} pages instrumented. Do the flow in ANY tab; say Done to stop", flush=True)
        # SPA navigations (X client-side routing) do NOT fire a page load,
        # which wipes injected listeners. Poll every 2s and re-inject on any
        # page whose banner is missing.
        while True:
            try:
                for pg in ctx.pages:
                    try:
                        has = pg.evaluate("() => !!document.getElementById('hermes-obs-banner')")
                        if not has:
                            re_inject(pg)
                    except Exception:
                        pass
            except Exception:
                pass
            time.sleep(2)
        browser.close()


if __name__ == "__main__":
    main()
