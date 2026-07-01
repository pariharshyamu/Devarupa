// --- देवभाषा prelude (host-independent) ---
const __RT = {
  // परिणाम (Result): explicit success/failure values for fallible operations.
  // keys are the raw Sanskrit field names, since member access (फल.सफल) emits
  // the property name unchanged.
  ok(v)  { return { "सफल": true,  "मूल्यम्": v,    "दोषः": null }; },
  err(e) { return { "सफल": false, "मूल्यम्": null, "दोषः": e }; },
  // result अथवा fallback — the Result's value if सफल, else the (lazy) fallback.
  // A non-Result value is returned as-is (so अथवा is also a null/Err guard).
  orElse(r, fb) {
    if (r && typeof r === "object" && "सफल" in r) return r["सफल"] ? r["मूल्यम्"] : fb();
    return r == null ? fb() : r;
  },
  // प्रकारः — a value's kind, named in Sanskrit (for reflection / tests).
  typeOf(v) {
    if (v === null || v === undefined) return "रिक्त";       // null/undefined
    if (Array.isArray(v)) return "सूची";                      // array
    const t = typeof v;
    if (t === "number") return "अङ्क";                        // number
    if (t === "string") return "वाक्";                        // string
    if (t === "boolean") return "सत्यासत्य";                   // boolean
    if (t === "function") return "कार्य";                     // function
    return "कोष";                                            // object/record
  },
  // प्रदत्त (data) — JSON parse/serialize, both returning परिणाम since
  // JSON.parse throws and the language has no exceptions.
  json: {
    विश्लेषय(text) {           // parse
      try { return __RT.ok(JSON.parse(text)); }
      catch (e) { return __RT.err(String(e && e.message || e)); }
    },
    सूत्रय(v, pretty) {         // stringify (pretty by default)
      try { return __RT.ok(JSON.stringify(v, null, pretty === false ? undefined : 2)); }
      catch (e) { return __RT.err(String(e && e.message || e)); }
    },
  },
  // अङ्कय — parse a string to a number → परिणाम (Err if not a number).
  toNumber(s) {
    const n = Number(s);
    return Number.isNaN(n) ? __RT.err("अङ्कः न (not a number): " + s) : __RT.ok(n);
  },
};
// --- देवभाषा runtime ---
const __DB = {
  el(tag, ...rest) {
    const node = document.createElement(tag);
    for (const r of rest) {
      if (r == null) continue;
      if (typeof r === 'object' && !(r instanceof Node) && !Array.isArray(r)) {
        // props/attrs object
        for (const [k, v] of Object.entries(r)) {
          if (k.startsWith('on') && typeof v === 'function') {
            node.addEventListener(k.slice(2).toLowerCase(), v);
          } else if (k === 'style' && typeof v === 'object') {
            Object.assign(node.style, v);
          } else {
            node.setAttribute(k, v);
          }
        }
      } else if (Array.isArray(r)) {
        r.forEach(c => node.append(c instanceof Node ? c : document.createTextNode(String(c))));
      } else {
        node.append(r instanceof Node ? r : document.createTextNode(String(r)));
      }
    }
    return node;
  },
  mount(node, target) {
    const t = typeof target === 'string' ? document.querySelector(target) : (target || document.body);
    t.append(node);
    return node;
  },
  listen(node, event, handler) {
    node.addEventListener(event, handler);
    return node;
  },
  construct({ tag, content, contentBind, event, handler, parent, prop, source, children, style, styleBind }) {
    const node = document.createElement(tag);
    if (contentBind != null) {
      // fine-grained: a bound text node that updates in place on dep change
      node.append(__DB.bindText(contentBind));
    } else if (content != null && content.__isSutra) {
      // a सूत्र reactive reference passed as content → bind fine-grained
      node.append(__DB.bindText(content));
    } else if (content != null) {
      if (Array.isArray(content)) content.forEach(c => node.append(c instanceof Node ? c : document.createTextNode(String(c))));
      else node.append(content instanceof Node ? content : document.createTextNode(String(content)));
    }
    if (children) {
      // DOM append moves nodes, so nested child constructs are correctly
      // re-parented into this element (समास composition). An array child is
      // flattened — this is what makes list rendering (.प्रतिचित्रय → nodes) work.
      const appendChild = c => {
        if (c == null) return;
        if (Array.isArray(c)) { c.forEach(appendChild); return; }
        node.append(c instanceof Node ? c : document.createTextNode(String(c)));
      };
      for (const c of children) appendChild(c);
    }
    if (style && typeof style === 'object') {
      Object.assign(node.style, style);
    }
    if (styleBind && typeof styleBind === 'object') {
      // each dynamic style property gets its own effect → only that property
      // updates when its dependencies change (fine-grained, no rebuild).
      for (const [k, thunk] of Object.entries(styleBind)) {
        __DB.effect(() => { node.style[k] = thunk(); });
      }
    }
    if (prop && typeof prop === 'object') {
      for (const [k, v] of Object.entries(prop)) node.setAttribute(k, v);
    }
    if (event && handler) node.addEventListener(event, handler);
    if (parent != null) {
      const t = typeof parent === 'string' ? document.querySelector(parent) : parent;
      (t || document.body).append(node);
    }
    return node;
  },

  // ----- reactivity -----
  // A subscriber stack: whatever is on top when a भाव cell is READ becomes a
  // dependency of that subscriber. Both the coarse दृश्य (a whole-view render)
  // and a fine-grained प्रभाव (effect) push themselves here. A subscriber is an
  // object { run, deps } where deps is the set of cells it currently reads.
  _subStack: [],
  _currentSub() { return __DB._subStack.length ? __DB._subStack[__DB._subStack.length - 1] : null; },
  state(initial) {
    let value = initial;
    const subs = new Set();             // subscribers depending on this cell
    const cell = (...args) => {
      if (args.length === 0) {            // read — track the current subscriber
        const sub = __DB._currentSub();
        if (sub) { subs.add(sub); if (sub.deps) sub.deps.add(cell); }
        return value;
      }
      const next = args[0];               // write
      // skip re-render only when an unchanged PRIMITIVE is written; object/
      // array state is usually mutated in place, so always re-render those.
      if (next === value && (next === null || typeof next !== 'object')) return value;
      value = next;
      // notify every subscriber (snapshot first — re-running mutates the set)
      for (const sub of Array.from(subs)) {
        if (typeof sub === 'function') sub();          // legacy view render
        else if (sub && sub.run) sub.run();            // effect / binding
      }
      return value;
    };
    cell.__isState = true;
    cell.__unsubscribe = (sub) => subs.delete(sub);
    return cell;
  },
  // प्रभाव — a fine-grained effect. Runs fn now, tracking which भाव cells it
  // reads, and re-runs ONLY fn when any of those change. Before each re-run it
  // unsubscribes from its previous dependencies (so conditional reads don't
  // leave stale subscriptions) and re-tracks fresh ones.
  effect(fn) {
    const sub = {
      deps: new Set(),
      cleanups: [],
      run() {
        // run any registered cleanups from the previous run (teardown)
        for (const c of sub.cleanups) { try { c(); } catch (e) {} }
        sub.cleanups = [];
        // drop old subscriptions, then re-track on this run
        for (const cell of sub.deps) if (cell.__unsubscribe) cell.__unsubscribe(sub);
        sub.deps.clear();
        __DB._subStack.push(sub);
        const prevEffect = __DB._activeEffect; __DB._activeEffect = sub;
        try { fn(); } finally { __DB._activeEffect = prevEffect; __DB._subStack.pop(); }
      },
    };
    sub.run();
    return sub;
  },
  _activeEffect: null,
  // सफाई — register a cleanup that runs before the current effect's next run
  // (and could run on disposal). The standard teardown hook for timers/listeners.
  onCleanup(fn) { if (__DB._activeEffect) __DB._activeEffect.cleanups.push(fn); },
  // सूत्र — tag a thunk as a reactive reference so content slots / बन्ध bind it.
  sutra(thunk) { thunk.__isSutra = true; return thunk; },
  // आलस्यचित्रम् — a lazy-loaded image. Renders an img showing the placeholder
  // (or nothing) and swaps in the real src only once it scrolls into view, via
  // IntersectionObserver. opts: { alt, placeholder, rootMargin }. Falls back to
  // eager loading where IntersectionObserver is unavailable.
  lazyImage(src, opts) {
    opts = opts || {};
    const img = document.createElement('img');
    if (opts.alt != null) img.setAttribute('alt', opts.alt);
    if (opts.placeholder) img.setAttribute('src', opts.placeholder);
    img.setAttribute('data-src', src);
    img.setAttribute('loading', 'lazy');           // native hint where supported
    const load = () => { if (img.getAttribute('src') !== src) img.setAttribute('src', src); };
    if (typeof IntersectionObserver === 'function') {
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting) { load(); io.unobserve(img); }
        }
      }, { rootMargin: opts.rootMargin || '200px' });
      io.observe(img);
    } else {
      load();                                       // no observer → load now
    }
    return img;
  },
  // bindText — fine-grained: a text node whose content is produced by thunk();
  // only this node's text updates when the thunk's dependencies change.
  bindText(thunk) {
    const node = document.createTextNode('');
    __DB.effect(() => { node.textContent = String(thunk()); });
    return node;
  },
  // आवली — keyed list reconciliation. dataThunk() returns the current array;
  // keyFn(item, i) gives a STABLE identity; renderFn(item, i) builds a node for
  // a new key. Wrapped in an effect, so it re-runs when the data signal changes.
  // On each run it reuses the DOM nodes of surviving keys (preserving their
  // state/focus), creates nodes for new keys, removes vanished ones, and
  // reorders children to match the new sequence — without rebuilding everything.
  keyedList(dataThunk, keyFn, renderFn) {
    const host = document.createElement('div');
    host.style.display = 'contents';      // transparent wrapper, no layout box
    let prev = new Map();                  // key → node (from the last run)
    __DB.effect(() => {
      const items = dataThunk() || [];
      const next = new Map();
      const ordered = [];
      items.forEach((item, i) => {
        const k = String(keyFn(item, i));
        let node = prev.get(k);
        if (node === undefined) node = renderFn(item, i);   // new key → build
        next.set(k, node);
        ordered.push(node);
      });
      // remove nodes whose key vanished
      for (const [k, node] of prev) {
        if (!next.has(k) && node.parentNode === host) host.removeChild(node);
      }
      // place nodes in the new order (reusing/moving existing ones)
      let ref = null;                       // insert before the previous sibling
      for (let i = ordered.length - 1; i >= 0; i--) {
        const node = ordered[i];
        if (node.nextSibling !== ref || node.parentNode !== host) host.insertBefore(node, ref);
        ref = node;
      }
      prev = next;
    });
    return host;
  },
  view(container, viewFn) {
    const host = container ? (typeof container === 'string' ? document.querySelector(container) : container) : document.body;
    const render = () => {
      __DB._subStack.push(render);
      let out;
      try { out = viewFn(); } finally { __DB._subStack.pop(); }
      host.innerHTML = '';
      const append = c => {
        if (c == null) return;
        if (Array.isArray(c)) { c.forEach(append); return; }
        host.append(c instanceof Node ? c : document.createTextNode(String(c)));
      };
      append(out);
    };
    render();
    return host;
  },
  // ----- timing & input (for animation loops / games) -----
  interval(fn, ms) { return setInterval(fn, ms); },
  clearTimer(id) { clearInterval(id); },
  onKey(fn) {
    const h = (e) => fn(e.key);
    document.addEventListener('keydown', h);
    return h;
  }
};



const __mod_0 = (function () {
const varnnapattah = { "पृष्ठः": "var(--db-page)", "पृष्ठतलम्": "var(--db-surface)", "पाठ्यः": "var(--db-text)", "पाठ्यमृदु": "var(--db-text-muted)", "सीमा": "var(--db-border)", "प्राथमिकः": "var(--db-primary)", "प्राथमिकगहनः": "var(--db-primary-dark)", "द्वितीयकः": "var(--db-secondary)", "द्वितीयकगहनः": "var(--db-secondary-dark)", "सफलता": "var(--db-success)", "चेतावनी": "var(--db-warning)", "संकटः": "var(--db-danger)", "सूचना": "var(--db-info)", "श्वेतः": "var(--db-on-accent)" };
const prakaashah = { "page": "#f8fafc", "surface": "#ffffff", "text": "#0f172a", "textMuted": "#64748b", "border": "#e2e8f0", "primary": "#6366f1", "primaryDark": "#4338ca", "secondary": "#64748b", "secondaryDark": "#475569", "success": "#10b981", "warning": "#f59e0b", "danger": "#ef4444", "info": "#3b82f6", "onAccent": "#ffffff" };
const raatrih = { "page": "#0f172a", "surface": "#1e293b", "text": "#f1f5f9", "textMuted": "#94a3b8", "border": "#334155", "primary": "#818cf8", "primaryDark": "#6366f1", "secondary": "#475569", "secondaryDark": "#334155", "success": "#34d399", "warning": "#fbbf24", "danger": "#f87171", "info": "#60a5fa", "onAccent": "#0f172a" };
const svarnnimah = { "page": "#fdf6ec", "surface": "#fffaf2", "text": "#3d2c1e", "textMuted": "#8a6d51", "border": "#ecddc4", "primary": "#c2792d", "primaryDark": "#9c5e1f", "secondary": "#8a6d51", "secondaryDark": "#6b5440", "success": "#7c9a3c", "warning": "#d68a1f", "danger": "#c0452c", "info": "#4f86a8", "onAccent": "#fffaf2" };
const himah = { "page": "#eef4f8", "surface": "#ffffff", "text": "#1c2b36", "textMuted": "#5c7a8a", "border": "#cfe1ea", "primary": "#1f8fc4", "primaryDark": "#166f9b", "secondary": "#5c7a8a", "secondaryDark": "#3e5965", "success": "#1f9e7d", "warning": "#d99a1b", "danger": "#cf4452", "info": "#2f6fb0", "onAccent": "#ffffff" };
function vissayalaaguu(varnnaah) {
  let muulam = document.documentElement;
  muulam.style.setProperty("--db-page", varnnaah.page);
  muulam.style.setProperty("--db-surface", varnnaah.surface);
  muulam.style.setProperty("--db-text", varnnaah.text);
  muulam.style.setProperty("--db-text-muted", varnnaah.textMuted);
  muulam.style.setProperty("--db-border", varnnaah.border);
  muulam.style.setProperty("--db-primary", varnnaah.primary);
  muulam.style.setProperty("--db-primary-dark", varnnaah.primaryDark);
  muulam.style.setProperty("--db-secondary", varnnaah.secondary);
  muulam.style.setProperty("--db-secondary-dark", varnnaah.secondaryDark);
  muulam.style.setProperty("--db-success", varnnaah.success);
  muulam.style.setProperty("--db-warning", varnnaah.warning);
  muulam.style.setProperty("--db-danger", varnnaah.danger);
  muulam.style.setProperty("--db-info", varnnaah.info);
  muulam.style.setProperty("--db-on-accent", varnnaah.onAccent);
}
const antaraalah = { "अतिलघु": "4px", "लघु": "8px", "मध्यम": "16px", "बृहत्": "24px", "अतिबृहत्": "36px" };
const konnaah = { "लघु": "6px", "मध्यम": "10px", "बृहत्": "16px", "पूर्णम्": "999px" };
const chaayaah = { "लघु": "0 1px 3px rgba(15,23,42,0.10)", "मध्यम": "0 6px 18px rgba(15,23,42,0.12)", "बृहत्": "0 18px 42px rgba(15,23,42,0.18)" };
const akssarakulam = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
function varnnapraapti(vargah) {
  if ((vargah == "प्राथमिक")) {
    return { "मुख्यः": varnnapattah.प्राथमिकः, "गहनः": varnnapattah.प्राथमिकगहनः, "पाठ्यः": varnnapattah.श्वेतः };
  }
  if ((vargah == "द्वितीयक")) {
    return { "मुख्यः": varnnapattah.द्वितीयकः, "गहनः": varnnapattah.द्वितीयकगहनः, "पाठ्यः": varnnapattah.श्वेतः };
  }
  if ((vargah == "सफलता")) {
    return { "मुख्यः": varnnapattah.सफलता, "गहनः": varnnapattah.सफलता, "पाठ्यः": varnnapattah.श्वेतः };
  }
  if ((vargah == "चेतावनी")) {
    return { "मुख्यः": varnnapattah.चेतावनी, "गहनः": varnnapattah.चेतावनी, "पाठ्यः": varnnapattah.श्वेतः };
  }
  if ((vargah == "संकट")) {
    return { "मुख्यः": varnnapattah.संकटः, "गहनः": varnnapattah.संकटः, "पाठ्यः": varnnapattah.श्वेतः };
  }
  if ((vargah == "सूचना")) {
    return { "मुख्यः": varnnapattah.सूचना, "गहनः": varnnapattah.सूचना, "पाठ्यः": varnnapattah.श्वेतः };
  }
  return { "मुख्यः": varnnapattah.प्राथमिकः, "गहनः": varnnapattah.प्राथमिकगहनः, "पाठ्यः": varnnapattah.श्वेतः };
}

return { "varnnapattah": varnnapattah, "prakaashah": prakaashah, "raatrih": raatrih, "svarnnimah": svarnnimah, "himah": himah, "vissayalaaguu": vissayalaaguu, "antaraalah": antaraalah, "konnaah": konnaah, "chaayaah": chaayaah, "akssarakulam": akssarakulam, "varnnapraapti": varnnapraapti };
})();

const __mod_1 = (function () {
const varnnapattah = __mod_0["varnnapattah"];
const varnnapraapti = __mod_0["varnnapraapti"];
const antaraalah = __mod_0["antaraalah"];
const konnaah = __mod_0["konnaah"];
const chaayaah = __mod_0["chaayaah"];
const akssarakulam = __mod_0["akssarakulam"];

function piiddakam(paatthah, hastakah, vikalpaah) {
  let vi = (vikalpaah ?? {  });
  let vargah = (vi.वर्गः ?? "प्राथमिक");
  let aakaarah = (vi.आकारः ?? "मध्यम");
  let vapa = varnnapattah;
  let ranggaah = varnnapraapti(vargah);
  let antaraalamuulyam = "10px 18px";
  let akssaramaanamuulyam = "15px";
  if ((aakaarah == "लघु")) {
    antaraalamuulyam = "6px 12px";
    akssaramaanamuulyam = "13px";
  }
  if ((aakaarah == "बृहत्")) {
    antaraalamuulyam = "14px 26px";
    akssaramaanamuulyam = "17px";
  }
  let prisstthabhuumimuulyam = ranggaah.मुख्यः;
  let paatthyamuulyam = ranggaah.पाठ्यः;
  let siimaamuulyam = ("2px solid " + ranggaah.मुख्यः);
  if ((vargah == "बाह्यरेखा")) {
    prisstthabhuumimuulyam = "transparent";
    paatthyamuulyam = vapa.प्राथमिकः;
    siimaamuulyam = ("2px solid " + vapa.प्राथमिकः);
  }
  if ((vargah == "भूत")) {
    prisstthabhuumimuulyam = "transparent";
    paatthyamuulyam = vapa.पाठ्यः;
    siimaamuulyam = "2px solid transparent";
  }
  let na = __DB.construct({ tag: "button", content: paatthah, event: "click", handler: function (ghattanaa) {
  if (nisskriya(vi)) {
    return null;
  }
  if (hastakah) {
    hastakah(ghattanaa);
  }
}, style: { "padding": antaraalamuulyam, "fontSize": akssaramaanamuulyam, "fontWeight": "bold", "backgroundColor": prisstthabhuumimuulyam, "color": paatthyamuulyam, "border": siimaamuulyam, "borderRadius": konnaah.मध्यम, "cursor": (nisskriya(vi) ? "not-allowed" : "pointer"), "transition": "transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease", "opacity": (nisskriya(vi) ? 0.5 : 1), "width": ((vi.चौडम् == true) ? "100%" : "auto"), "textAlign": "center" } });
  if (!nisskriya(vi)) {
    __DB.listen(na, "mouseenter", function (gha) {
  na.style.transform = "translateY(-1px)";
  na.style.boxShadow = chaayaah.लघु;
});
    __DB.listen(na, "mouseleave", function (gha) {
  na.style.transform = "translateY(0px)";
  na.style.boxShadow = "none";
});
    __DB.listen(na, "mousedown", function (gha) {
  na.style.transform = "translateY(0px) scale(0.97)";
});
    __DB.listen(na, "mouseup", function (gha) {
  na.style.transform = "translateY(-1px) scale(1)";
});
  }
  return na;
}
function nisskriya(vi) {
  return (vi.निष्क्रियः == true);
}
function cihnam(paatthah, vargah) {
  let ranggaah = varnnapraapti((vargah ?? "प्राथमिक"));
  return __DB.construct({ tag: "span", content: paatthah, style: { "padding": "3px 10px", "fontSize": "12px", "fontWeight": "bold", "backgroundColor": ranggaah.मुख्यः, "color": ranggaah.पाठ्यः, "borderRadius": konnaah.पूर्णम्, "display": "inline-block" } });
}
function patrakam(vikalpaah) {
  let vi = (vikalpaah ?? {  });
  let vapa = varnnapattah;
  let baalakaah = [];
  if (vi.शीर्षकम्) {
    baalakaah.push(__DB.construct({ tag: "h1", content: vi.शीर्षकम्, style: { "fontSize": "18px", "fontWeight": "bold", "color": vapa.पाठ्यः, "margin": (("0 0 " + antaraalah.लघु) + " 0") } }));
  }
  if (vi.सामग्री) {
    baalakaah.push(vi.सामग्री);
  }
  if (vi.पादः) {
    baalakaah.push(__DB.construct({ tag: "div", style: { "margin": (antaraalah.मध्यम + " 0 0 0"), "padding": (antaraalah.मध्यम + " 0 0 0"), "border": "none" }, children: [vi.पादः] }));
  }
  return __DB.construct({ tag: "div", style: { "backgroundColor": vapa.पृष्ठतलम्, "border": ("1px solid " + vapa.सीमा), "borderRadius": konnaah.बृहत्, "padding": antaraalah.बृहत्, "boxShadow": chaayaah.लघु }, children: [baalakaah] });
}
function suucanaapattttii(paatthah, vargah, bandaniiyah) {
  let vapa = varnnapattah;
  let ranggaah = varnnapraapti((vargah ?? "सूचना"));
  let paatthakhannddah = __DB.construct({ tag: "p", content: paatthah, style: { "color": ranggaah.मुख्यः, "fontWeight": "bold", "width": "100%" } });
  let baalakaah = [paatthakhannddah];
  let muulanoddah = null;
  if ((bandaniiyah == true)) {
    let bandapiiddakah = __DB.construct({ tag: "button", content: "✕", event: "click", handler: function (gha) {
  muulanoddah.style.display = "none";
}, style: { "backgroundColor": "transparent", "border": "none", "color": ranggaah.मुख्यः, "fontSize": "16px", "cursor": "pointer", "padding": "0 0 0 12px" } });
    baalakaah.push(bandapiiddakah);
  }
  muulanoddah = __DB.construct({ tag: "div", style: { "display": "flex", "alignItems": "center", "justifyContent": "space-between", "backgroundColor": (("color-mix(in srgb, " + ranggaah.मुख्यः) + " 13%, transparent)"), "border": ("1px solid " + ranggaah.मुख्यः), "borderRadius": konnaah.मध्यम, "padding": antaraalah.मध्यम }, children: [baalakaah] });
  return muulanoddah;
}
function aadaanakssetram(vikalpaah) {
  let vi = (vikalpaah ?? {  });
  let vapa = varnnapattah;
  let naamapatranoddah = __DB.construct({ tag: "p", content: (vi.नामपत्रम् ?? ""), style: { "fontSize": "13px", "fontWeight": "bold", "color": vapa.पाठ्यमृदु, "margin": "0 0 4px 0" } });
  let gannakanoddah = __DB.construct({ tag: "span", content: "", style: { "fontSize": "11px", "color": vapa.पाठ्यमृदु, "textAlign": "right" } });
  let inaputtanoddah = __DB.construct({ tag: "input", event: "input", handler: function (ghattanaa) {
  if (vi.max) {
    gannakanoddah.textContent = ((ghattanaa.target.value.length + " / ") + vi.max);
  }
}, style: { "width": "100%", "padding": "9px 12px", "fontSize": "14px", "border": ("1px solid " + vapa.सीमा), "borderRadius": konnaah.मध्यम, "backgroundColor": vapa.पृष्ठतलम्, "color": vapa.पाठ्यः } });
  inaputtanoddah.setAttribute("placeholder", (vi.स्थानधारी ?? ""));
  inaputtanoddah.setAttribute("type", (vi.प्रकारः ?? "text"));
  if (vi.प्रारम्भः) {
    inaputtanoddah.value = vi.प्रारम्भः;
  }
  __DB.listen(inaputtanoddah, "focus", function (gha) {
  inaputtanoddah.style.border = ("1px solid " + vapa.प्राथमिकः);
});
  __DB.listen(inaputtanoddah, "blur", function (gha) {
  inaputtanoddah.style.border = ("1px solid " + vapa.सीमा);
});
  let aavarannam = __DB.construct({ tag: "div", style: { "display": "flex", "flexDirection": "column", "gap": "4px" }, children: [naamapatranoddah, inaputtanoddah, gannakanoddah] });
  return { "अंशः": aavarannam, "इनपुटः": inaputtanoddah, "मूल्यम्": function () {
  return inaputtanoddah.value;
} };
}
function parivartakam(praarambhah, hastakah) {
  let vapa = varnnapattah;
  let sakriyah = (praarambhah == true);
  let binduh = __DB.construct({ tag: "div", style: { "width": "18px", "height": "18px", "borderRadius": konnaah.पूर्णम्, "backgroundColor": vapa.श्वेतः, "position": "absolute", "top": "3px", "left": (sakriyah ? "23px" : "3px"), "transition": "left 0.16s ease" } });
  let pattah = __DB.construct({ tag: "div", event: "click", handler: function (gha) {
  sakriyah = !sakriyah;
  binduh.style.left = (sakriyah ? "23px" : "3px");
  pattah.style.backgroundColor = (sakriyah ? vapa.प्राथमिकः : vapa.सीमा);
  if (hastakah) {
    hastakah(sakriyah);
  }
}, style: { "width": "44px", "height": "24px", "borderRadius": konnaah.पूर्णम्, "backgroundColor": (sakriyah ? vapa.प्राथमिकः : vapa.सीमा), "position": "relative", "cursor": "pointer", "transition": "background-color 0.16s ease" }, children: [binduh] });
  return { "अंशः": pattah, "स्थितिः": function () {
  return sakriyah;
} };
}
function pragatipattttii(pratishatah) {
  let vapa = varnnapattah;
  let bhiitarii = __DB.construct({ tag: "div", style: { "width": (pratishatah + "%"), "height": "100%", "backgroundColor": vapa.प्राथमिकः, "borderRadius": konnaah.पूर्णम्, "transition": "width 0.25s ease" } });
  let baahya = __DB.construct({ tag: "div", style: { "width": "100%", "height": "10px", "backgroundColor": vapa.सीमा, "borderRadius": konnaah.पूर्णम्, "overflow": "hidden" }, children: [bhiitarii] });
  return { "अंशः": baahya, "मूल्यसेट": function (navapratishatah) {
  bhiitarii.style.width = (navapratishatah + "%");
} };
}
function avataarah(aadyaakssaram, vargah) {
  let ranggaah = varnnapraapti((vargah ?? "प्राथमिक"));
  return __DB.construct({ tag: "div", content: aadyaakssaram, style: { "width": "40px", "height": "40px", "borderRadius": konnaah.पूर्णम्, "backgroundColor": ranggaah.मुख्यः, "color": ranggaah.पाठ्यः, "display": "flex", "justifyContent": "center", "alignItems": "center", "fontWeight": "bold", "fontSize": "15px" } });
}
function vibhaajakah() {
  let vapa = varnnapattah;
  return __DB.construct({ tag: "div", style: { "height": "1px", "backgroundColor": vapa.सीमा, "margin": (antaraalah.मध्यम + " 0") } });
}
function cakrikaa() {
  let vapa = varnnapattah;
  let konnah = 0;
  let na = __DB.construct({ tag: "div", style: { "width": "28px", "height": "28px", "borderRadius": konnaah.पूर्णम्, "border": ("3px solid " + vapa.सीमा), "border": ("3px solid " + vapa.सीमा) } });
  na.style.borderTopColor = vapa.प्राथमिकः;
  let pahicaanah = __DB.interval(function () {
  konnah = (konnah + 18);
  na.style.transform = (("rotate(" + konnah) + "deg)");
}, 30);
  return { "अंशः": na, "नष्ट": function () {
  __DB.clearTimer(pahicaanah);
} };
}
function ttaibasamuuhah(ttaibaah) {
  let vapa = varnnapattah;
  let shiirssakanoddaah = [];
  let pattalaani = [];
  let pattalakssetram = __DB.construct({ tag: "div", style: { "margin": (antaraalah.मध्यम + " 0 0 0") } });
  let sakriyasuucaka = function (cayitah) {
  let i = 0;
  while ((i < shiirssakanoddaah.length)) {
    if ((i == cayitah)) {
      shiirssakanoddaah[i].style.borderBottom = ("2px solid " + vapa.प्राथमिकः);
      shiirssakanoddaah[i].style.color = vapa.प्राथमिकः;
      pattalaani[i].style.display = "block";
    } else {
      shiirssakanoddaah[i].style.borderBottom = "2px solid transparent";
      shiirssakanoddaah[i].style.color = vapa.पाठ्यमृदु;
      pattalaani[i].style.display = "none";
    }
    i = (i + 1);
  }
};
  let i = 0;
  while ((i < ttaibaah.length)) {
    let suucaka = i;
    let sha = __DB.construct({ tag: "button", content: ttaibaah[i].शीर्षकम्, event: "click", handler: function (gha) {
  sakriyasuucaka(suucaka);
}, style: { "backgroundColor": "transparent", "border": "none", "padding": "10px 16px", "fontSize": "14px", "fontWeight": "bold", "cursor": "pointer", "borderBottom": "2px solid transparent" } });
    shiirssakanoddaah.push(sha);
    pattalaani.push(ttaibaah[i].सामग्री);
    pattalakssetram.append(ttaibaah[i].सामग्री);
    i = (i + 1);
  }
  let shiirssapangkti = __DB.construct({ tag: "div", style: { "display": "flex", "border": "none", "borderBottom": ("1px solid " + vapa.सीमा) }, children: [shiirssakanoddaah] });
  sakriyasuucaka(0);
  return { "अंशः": __DB.construct({ tag: "div", children: [shiirssapangkti, pattalakssetram] }) };
}
function vidhivaataayanam(vikalpaah) {
  let vi = (vikalpaah ?? {  });
  let vapa = varnnapattah;
  let aavarakah = null;
  let bandapiiddakah = __DB.construct({ tag: "button", content: "✕", style: { "backgroundColor": "transparent", "border": "none", "fontSize": "18px", "cursor": "pointer", "color": vapa.पाठ्यमृदु, "position": "absolute", "right": "16px", "top": "14px" } });
  let pattalam = __DB.construct({ tag: "div", style: { "backgroundColor": vapa.पृष्ठतलम्, "borderRadius": konnaah.बृहत्, "padding": antaraalah.बृहत्, "maxWidth": "440px", "width": "90%", "boxShadow": chaayaah.बृहत्, "position": "relative" }, children: [bandapiiddakah, (vi.शीर्षकम् ? __DB.construct({ tag: "h1", content: vi.शीर्षकम्, style: { "fontSize": "19px", "fontWeight": "bold", "color": vapa.पाठ्यः, "margin": (("0 0 " + antaraalah.मध्यम) + " 0") } }) : null), vi.सामग्री] });
  aavarakah = __DB.construct({ tag: "div", style: { "position": "fixed", "top": "0px", "left": "0px", "width": "100%", "height": "100%", "backgroundColor": "rgba(15,23,42,0.55)", "display": "none", "justifyContent": "center", "alignItems": "center", "zIndex": "999" }, children: [pattalam] });
  __DB.listen(bandapiiddakah, "click", function (gha) {
  aavarakah.style.display = "none";
});
  __DB.listen(aavarakah, "click", function (gha) {
  if ((gha.target == aavarakah)) {
    aavarakah.style.display = "none";
  }
});
  return { "अंशः": aavarakah, "विवृणु": function () {
  aavarakah.style.display = "flex";
}, "संवृणु": function () {
  aavarakah.style.display = "none";
} };
}
function upakarannasuucanaa(muulaghattakah, paatthah) {
  let vapa = varnnapattah;
  let ttippannii = __DB.construct({ tag: "span", content: paatthah, style: { "position": "absolute", "bottom": "130%", "left": "50%", "transform": "translateX(-50%)", "backgroundColor": vapa.पाठ्यः, "color": vapa.पृष्ठतलम्, "padding": "5px 10px", "borderRadius": konnaah.लघु, "fontSize": "12px", "whiteSpace": "nowrap", "display": "none", "zIndex": "20" } });
  let aavarannam = __DB.construct({ tag: "div", style: { "position": "relative", "display": "inline-block" }, children: [muulaghattakah, ttippannii] });
  __DB.listen(aavarannam, "mouseenter", function (gha) {
  ttippannii.style.display = "block";
});
  __DB.listen(aavarannam, "mouseleave", function (gha) {
  ttippannii.style.display = "none";
});
  return aavarannam;
}

return { "piiddakam": piiddakam, "cihnam": cihnam, "patrakam": patrakam, "suucanaapattttii": suucanaapattttii, "aadaanakssetram": aadaanakssetram, "parivartakam": parivartakam, "pragatipattttii": pragatipattttii, "avataarah": avataarah, "vibhaajakah": vibhaajakah, "cakrikaa": cakrikaa, "ttaibasamuuhah": ttaibasamuuhah, "vidhivaataayanam": vidhivaataayanam, "upakarannasuucanaa": upakarannasuucanaa };
})();

const __mod_2 = (function () {
const varnnapattah = __mod_0["varnnapattah"];
const antaraalah = __mod_0["antaraalah"];
const konnaah = __mod_0["konnaah"];
const akssarakulam = __mod_0["akssarakulam"];
const piiddakam = __mod_1["piiddakam"];


const kssetraruupam = { "width": "100%", "padding": "9px 12px", "fontSize": "14px", "fontFamily": "inherit", "border": "1px solid var(--db-border)", "borderRadius": "10px", "backgroundColor": "var(--db-surface)", "color": "var(--db-text)", "boxSizing": "border-box" };
function naamapatram(paatthah) {
  return __DB.construct({ tag: "p", content: (paatthah ?? ""), style: { "fontSize": "13px", "fontWeight": "bold", "color": varnnapattah.पाठ्यमृदु, "margin": "0 0 4px 0" } });
}
function bahupaatthakssetram(vikalpaah) {
  let vi = (vikalpaah ?? {  });
  let gannakanoddah = __DB.construct({ tag: "span", content: "", style: { "fontSize": "11px", "color": varnnapattah.पाठ्यमृदु, "textAlign": "right" } });
  let kssetranoddah = __DB.el("textarea", { "placeholder": (vi.स्थानधारी ?? ""), "rows": (vi.पङ्क्तयः ?? 4), "style": { "width": kssetraruupam.width, "padding": kssetraruupam.padding, "fontSize": kssetraruupam.fontSize, "fontFamily": kssetraruupam.fontFamily, "border": kssetraruupam.border, "borderRadius": kssetraruupam.borderRadius, "backgroundColor": kssetraruupam.backgroundColor, "color": kssetraruupam.color, "boxSizing": kssetraruupam.boxSizing, "resize": "vertical" }, "onInput": function (ghattanaa) {
  if (vi.max) {
    gannakanoddah.textContent = ((ghattanaa.target.value.length + " / ") + vi.max);
  }
} });
  if (vi.प्रारम्भः) {
    kssetranoddah.value = vi.प्रारम्भः;
  }
  let aavarannam = __DB.construct({ tag: "div", style: { "display": "flex", "flexDirection": "column", "gap": "4px" }, children: [naamapatram(vi.नामपत्रम्), kssetranoddah, gannakanoddah] });
  return { "अंशः": aavarannam, "इनपुटः": kssetranoddah, "मूल्यम्": function () {
  return kssetranoddah.value;
} };
}
function cayanakssetram(vikalpaah) {
  let vi = (vikalpaah ?? {  });
  let vikalpasuucii = (vi.विकल्पसूची ?? []);
  let vikalpanoddaah = [];
  let i = 0;
  while ((i < vikalpasuucii.length)) {
    vikalpanoddaah.push(__DB.el("option", { "value": vikalpasuucii[i].मूल्यम् }, vikalpasuucii[i].पाठः));
    i = (i + 1);
  }
  let cayananoddah = __DB.el("select", { "style": { "width": kssetraruupam.width, "padding": kssetraruupam.padding, "fontSize": kssetraruupam.fontSize, "fontFamily": kssetraruupam.fontFamily, "border": kssetraruupam.border, "borderRadius": kssetraruupam.borderRadius, "backgroundColor": kssetraruupam.backgroundColor, "color": kssetraruupam.color, "boxSizing": kssetraruupam.boxSizing, "cursor": "pointer" } }, vikalpanoddaah);
  if (vi.प्रारम्भः) {
    cayananoddah.value = vi.प्रारम्भः;
  }
  let aavarannam = __DB.construct({ tag: "div", style: { "display": "flex", "flexDirection": "column", "gap": "4px" }, children: [naamapatram(vi.नामपत्रम्), cayananoddah] });
  return { "अंशः": aavarannam, "मूल्यम्": function () {
  return cayananoddah.value;
} };
}
function angkitapettikaa(paatthah, praarambhah, hastakah) {
  let inaputtah = __DB.el("input", { "type": "checkbox", "style": { "width": "16px", "height": "16px", "cursor": "pointer", "accentColor": "var(--db-primary)" } });
  if ((praarambhah == true)) {
    inaputtah.checked = true;
  }
  __DB.listen(inaputtah, "change", function (ghattanaa) {
  if (hastakah) {
    hastakah(ghattanaa.target.checked);
  }
});
  let lebalapaatthah = __DB.construct({ tag: "span", content: paatthah, style: { "fontSize": "14px", "color": varnnapattah.पाठ्यः } });
  let aavarannam = __DB.el("label", { "style": { "display": "flex", "alignItems": "center", "gap": "8px", "cursor": "pointer" } }, inaputtah, lebalapaatthah);
  return { "अंशः": aavarannam, "मूल्यम्": function () {
  return inaputtah.checked;
} };
}
function vikalpacakram(naama, vikalpasuucii, praarambhah, hastakah) {
  let cayanitah = praarambhah;
  let pangktayah = [];
  let i = 0;
  while ((i < vikalpasuucii.length)) {
    let muulyam = vikalpasuucii[i].मूल्यम्;
    let inaputtah = __DB.el("input", { "type": "radio", "name": naama, "value": muulyam, "style": { "width": "16px", "height": "16px", "cursor": "pointer", "accentColor": "var(--db-primary)" } });
    if ((muulyam == praarambhah)) {
      inaputtah.checked = true;
    }
    __DB.listen(inaputtah, "change", function (ghattanaa) {
  cayanitah = muulyam;
  if (hastakah) {
    hastakah(muulyam);
  }
});
    let lebalapaatthah = __DB.construct({ tag: "span", content: vikalpasuucii[i].पाठः, style: { "fontSize": "14px", "color": varnnapattah.पाठ्यः } });
    pangktayah.push(__DB.el("label", { "style": { "display": "flex", "alignItems": "center", "gap": "8px", "cursor": "pointer" } }, inaputtah, lebalapaatthah));
    i = (i + 1);
  }
  let aavarannam = __DB.construct({ tag: "div", style: { "display": "flex", "flexDirection": "column", "gap": "8px" }, children: [pangktayah] });
  return { "अंशः": aavarannam, "मूल्यम्": function () {
  return cayanitah;
} };
}
function sarpinnii(vikalpaah) {
  let vi = (vikalpaah ?? {  });
  let nyuunatamah = (vi.min ?? 0);
  let adhikatamah = (vi.max ?? 100);
  let praarambhah = (vi.प्रारम्भः ?? nyuunatamah);
  let muulyalebalah = __DB.construct({ tag: "span", content: ("" + praarambhah), style: { "fontSize": "13px", "fontWeight": "bold", "color": varnnapattah.प्राथमिकः } });
  let inaputtah = __DB.el("input", { "type": "range", "min": nyuunatamah, "max": adhikatamah, "value": praarambhah, "style": { "width": "100%", "accentColor": "var(--db-primary)", "cursor": "pointer" }, "onInput": function (ghattanaa) {
  muulyalebalah.textContent = ghattanaa.target.value;
} });
  let shiirssapangkti = __DB.construct({ tag: "div", style: { "display": "flex", "justifyContent": "space-between", "alignItems": "center" }, children: [__DB.construct({ tag: "span", content: (vi.नामपत्रम् ?? ""), style: { "fontSize": "13px", "fontWeight": "bold", "color": varnnapattah.पाठ्यमृदु } }), muulyalebalah] });
  let aavarannam = __DB.construct({ tag: "div", style: { "display": "flex", "flexDirection": "column", "gap": "6px" }, children: [shiirssapangkti, inaputtah] });
  return { "अंशः": aavarannam, "मूल्यम्": function () {
  return inaputtah.value;
} };
}
function truttipaatthah(paatthah) {
  return __DB.construct({ tag: "p", content: paatthah, style: { "fontSize": "12px", "color": varnnapattah.संकटः, "margin": "2px 0 0 0" } });
}
function prapatram(vikalpaah) {
  let vi = (vikalpaah ?? {  });
  let kssetraanni = (vi.क्षेत्राणि ?? []);
  let baalakaah = [];
  let i = 0;
  while ((i < kssetraanni.length)) {
    baalakaah.push(kssetraanni[i].अंशः);
    i = (i + 1);
  }
  let samarpannapiiddakah = piiddakam((vi.समर्पणपाठः ?? "समर्पय"), function () {
  let parinnaamah = {  };
  let ja = 0;
  while ((ja < kssetraanni.length)) {
    parinnaamah[kssetraanni[ja].नाम] = kssetraanni[ja].मूल्यम्();
    ja = (ja + 1);
  }
  if (vi.समर्पणहस्तकः) {
    vi.समर्पणहस्तकः(parinnaamah);
  }
}, { "वर्गः": "प्राथमिक", "चौडम्": true });
  baalakaah.push(samarpannapiiddakah);
  return __DB.construct({ tag: "div", style: { "display": "flex", "flexDirection": "column", "gap": antaraalah.बृहत् }, children: [baalakaah] });
}

return { "bahupaatthakssetram": bahupaatthakssetram, "cayanakssetram": cayanakssetram, "angkitapettikaa": angkitapettikaa, "vikalpacakram": vikalpacakram, "sarpinnii": sarpinnii, "truttipaatthah": truttipaatthah, "prapatram": prapatram };
})();

const __mod_3 = (function () {
const varnnapattah = __mod_0["varnnapattah"];
const antaraalah = __mod_0["antaraalah"];
const konnaah = __mod_0["konnaah"];

function adhikatamasangkhyaa(suucii, kunyjii) {
  let ma = 0;
  let i = 0;
  while ((i < suucii.length)) {
    let muu = suucii[i][kunyjii];
    if ((muu > ma)) {
      ma = muu;
    }
    i = (i + 1);
  }
  return ((ma == 0) ? 1 : ma);
}
function yogasangkhyaa(suucii, kunyjii) {
  let yo = 0;
  let i = 0;
  while ((i < suucii.length)) {
    yo = (yo + suucii[i][kunyjii]);
    i = (i + 1);
  }
  return ((yo == 0) ? 1 : yo);
}
const kramavarnnaah = [varnnapattah.प्राथमिकः, varnnapattah.सफलता, varnnapattah.चेतावनी, varnnapattah.संकटः, varnnapattah.सूचना, varnnapattah.द्वितीयकः];
function dannddaarekhaacitram(vikalpaah) {
  let vi = (vikalpaah ?? {  });
  let dattaani = (vi.दत्तानि ?? []);
  let cauddaaii = (vi.चौडाई ?? 340);
  let uccataa = (vi.उच्चता ?? 190);
  let ranggah = (vi.वर्णः ?? varnnapattah.प्राथमिकः);
  let upari = 28;
  let adhah = 30;
  let bhiitariiuccataa = ((uccataa - upari) - adhah);
  let adhikatamam = adhikatamasangkhyaa(dattaani, "मूल्यम्");
  let sangkhyaa = dattaani.length;
  let sthaanacauddaaii = (cauddaaii / sangkhyaa);
  let dannddacauddaaii = (sthaanacauddaaii * 0.5);
  let bhaagaah = "";
  let i = 0;
  while ((i < sangkhyaa)) {
    let muulyam = dattaani[i].मूल्यम्;
    let dannddauccataa = ((muulyam / adhikatamam) * bhiitariiuccataa);
    let x = ((i * sthaanacauddaaii) + ((sthaanacauddaaii - dannddacauddaaii) / 2));
    let y = ((uccataa - adhah) - dannddauccataa);
    bhaagaah = (((((((((((bhaagaah + "<rect x='") + x) + "' y='") + y) + "' width='") + dannddacauddaaii) + "' height='") + dannddauccataa) + "' rx='4' fill='") + ranggah) + "'></rect>");
    bhaagaah = (((((((((bhaagaah + "<text x='") + (x + (dannddacauddaaii / 2))) + "' y='") + (y - 6)) + "' text-anchor='middle' font-size='11' fill='") + varnnapattah.पाठ्यः) + "'>") + muulyam) + "</text>");
    bhaagaah = (((((((((bhaagaah + "<text x='") + (x + (dannddacauddaaii / 2))) + "' y='") + (uccataa - 8)) + "' text-anchor='middle' font-size='11' fill='") + varnnapattah.पाठ्यमृदु) + "'>") + dattaani[i].नाम) + "</text>");
    i = (i + 1);
  }
  let aadhaararekhaa = (((((((("<line x1='0' y1='" + (uccataa - adhah)) + "' x2='") + cauddaaii) + "' y2='") + (uccataa - adhah)) + "' stroke='") + varnnapattah.सीमा) + "' stroke-width='1'></line>");
  let na = __DB.construct({ tag: "div", style: { "width": "100%" } });
  na.innerHTML = ((((((("<svg viewBox='0 0 " + cauddaaii) + " ") + uccataa) + "' style='width:100%;height:auto;display:block'>") + aadhaararekhaa) + bhaagaah) + "</svg>");
  return na;
}
function rekhaacitram(vikalpaah) {
  let vi = (vikalpaah ?? {  });
  let dattaani = (vi.दत्तानि ?? []);
  let cauddaaii = (vi.चौडाई ?? 340);
  let uccataa = (vi.उच्चता ?? 190);
  let ranggah = (vi.वर्णः ?? varnnapattah.प्राथमिकः);
  let upari = 20;
  let adhah = 30;
  let bhiitariiuccataa = ((uccataa - upari) - adhah);
  let adhikatamam = adhikatamasangkhyaa(dattaani, "मूल्यम्");
  let sangkhyaa = dattaani.length;
  let sthaanacauddaaii = ((sangkhyaa > 1) ? (cauddaaii / (sangkhyaa - 1)) : cauddaaii);
  let bindavah = "";
  let vrittaani = "";
  let lebalaah = "";
  let pathabindavah = "";
  let i = 0;
  while ((i < sangkhyaa)) {
    let x = (i * sthaanacauddaaii);
    let y = ((upari + bhiitariiuccataa) - ((dattaani[i].मूल्यम् / adhikatamam) * bhiitariiuccataa));
    bindavah = ((((bindavah + x) + ",") + y) + " ");
    pathabindavah = (((((pathabindavah + ((i == 0) ? "M" : "L")) + x) + ",") + y) + " ");
    vrittaani = (((((((vrittaani + "<circle cx='") + x) + "' cy='") + y) + "' r='3.5' fill='") + ranggah) + "'></circle>");
    lebalaah = (((((((((lebalaah + "<text x='") + x) + "' y='") + (uccataa - 8)) + "' text-anchor='middle' font-size='11' fill='") + varnnapattah.पाठ्यमृदु) + "'>") + dattaani[i].नाम) + "</text>");
    i = (i + 1);
  }
  let kssetrapathah = (((((((((("<path d='" + pathabindavah) + "L") + ((sangkhyaa - 1) * sthaanacauddaaii)) + ",") + (uccataa - adhah)) + " L0,") + (uccataa - adhah)) + " Z' fill='") + ranggah) + "' fill-opacity='0.12' stroke='none'></path>");
  let aadhaararekhaa = (((((((("<line x1='0' y1='" + (uccataa - adhah)) + "' x2='") + cauddaaii) + "' y2='") + (uccataa - adhah)) + "' stroke='") + varnnapattah.सीमा) + "' stroke-width='1'></line>");
  let bahurekhaa = (((("<polyline points='" + bindavah) + "' fill='none' stroke='") + ranggah) + "' stroke-width='2.5' stroke-linejoin='round'></polyline>");
  let na = __DB.construct({ tag: "div", style: { "width": "100%" } });
  na.innerHTML = (((((((((("<svg viewBox='0 0 " + cauddaaii) + " ") + uccataa) + "' style='width:100%;height:auto;display:block'>") + aadhaararekhaa) + kssetrapathah) + bahurekhaa) + vrittaani) + lebalaah) + "</svg>");
  return na;
}
function vrittacitram(vikalpaah) {
  let vi = (vikalpaah ?? {  });
  let dattaani = (vi.दत्तानि ?? []);
  let vyaasah = (vi.व्यासः ?? 170);
  let valayaamshah = (vi.वलयांशः ?? 0.55);
  let trijyaa = (vyaasah / 2);
  let kendrah = trijyaa;
  let yogah = yogasangkhyaa(dattaani, "मूल्यम्");
  let varnnaah = kramavarnnaah;
  let konnah = (0 - (Math.PI / 2));
  let bhaagaah = "";
  let i = 0;
  while ((i < dattaani.length)) {
    let amshah = (dattaani[i].मूल्यम् / yogah);
    let khannddakonnah = ((amshah * Math.PI) * 2);
    let ranggah = (dattaani[i].वर्णः ?? varnnaah[(i % varnnaah.length)]);
    let x1 = (kendrah + (trijyaa * Math.cos(konnah)));
    let y1 = (kendrah + (trijyaa * Math.sin(konnah)));
    let antyakonnah = (konnah + khannddakonnah);
    let x2 = (kendrah + (trijyaa * Math.cos(antyakonnah)));
    let y2 = (kendrah + (trijyaa * Math.sin(antyakonnah)));
    let brihatcaapah = ((khannddakonnah > Math.PI) ? 1 : 0);
    bhaagaah = (((((((((((((((((((((bhaagaah + "<path d='M") + kendrah) + ",") + kendrah) + " L") + x1) + ",") + y1) + " A") + trijyaa) + ",") + trijyaa) + " 0 ") + brihatcaapah) + " 1 ") + x2) + ",") + y2) + " Z' fill='") + ranggah) + "'></path>");
    konnah = antyakonnah;
    i = (i + 1);
  }
  let chidram = "";
  if ((valayaamshah > 0)) {
    chidram = (((((((("<circle cx='" + kendrah) + "' cy='") + kendrah) + "' r='") + (trijyaa * valayaamshah)) + "' fill='") + varnnapattah.पृष्ठतलम्) + "'></circle>");
  }
  let citranoddah = __DB.construct({ tag: "div", style: { "width": (vyaasah + "px"), "height": (vyaasah + "px"), "flexShrink": "0" } });
  citranoddah.innerHTML = ((((((("<svg viewBox='0 0 " + vyaasah) + " ") + vyaasah) + "'>") + bhaagaah) + chidram) + "</svg>");
  let lebalasuucih = [];
  i = 0;
  while ((i < dattaani.length)) {
    let ranggah = (dattaani[i].वर्णः ?? varnnaah[(i % varnnaah.length)]);
    let svatrah = __DB.construct({ tag: "div", style: { "width": "10px", "height": "10px", "backgroundColor": ranggah, "borderRadius": "3px", "flexShrink": "0" } });
    let paatthah = __DB.construct({ tag: "p", content: ((dattaani[i].नाम + " — ") + dattaani[i].मूल्यम्), style: { "fontSize": "13px", "color": varnnapattah.पाठ्यः } });
    lebalasuucih.push(__DB.construct({ tag: "div", style: { "display": "flex", "alignItems": "center", "gap": "6px" }, children: [svatrah, paatthah] }));
    i = (i + 1);
  }
  let lebalanoddah = __DB.construct({ tag: "div", style: { "display": "flex", "flexDirection": "column", "gap": "6px", "alignItems": "center" }, children: [lebalasuucih] });
  return __DB.construct({ tag: "div", style: { "display": "flex", "gap": "20px", "alignItems": "center", "flexWrap": "wrap" }, children: [citranoddah, lebalanoddah] });
}
function saamkhyikaakaarddam(vikalpaah) {
  let vi = (vikalpaah ?? {  });
  let pravrittinoddah = null;
  if ((vi.परिवर्तनम् != null)) {
    let vriddhih = (vi.परिवर्तनम् >= 0);
    let varnnah = (vriddhih ? varnnapattah.सफलता : varnnapattah.संकटः);
    let cihnam = (vriddhih ? "▲ " : "▼ ");
    let nirapekssam = (vriddhih ? vi.परिवर्तनम् : (0 - vi.परिवर्तनम्));
    pravrittinoddah = __DB.construct({ tag: "span", content: ((cihnam + nirapekssam) + "%"), style: { "color": varnnah, "fontSize": "13px", "fontWeight": "bold" } });
  }
  return __DB.construct({ tag: "div", style: { "backgroundColor": varnnapattah.पृष्ठतलम्, "border": ("1px solid " + varnnapattah.सीमा), "borderRadius": konnaah.बृहत्, "padding": antaraalah.बृहत्, "display": "flex", "flexDirection": "column", "gap": "6px", "width": "100%" }, children: [__DB.construct({ tag: "p", content: (vi.शीर्षकम् ?? ""), style: { "fontSize": "13px", "color": varnnapattah.पाठ्यमृदु } }), __DB.construct({ tag: "h1", content: ("" + (vi.मूल्यम् ?? "")), style: { "fontSize": "30px", "fontWeight": "bold", "color": varnnapattah.पाठ्यः } }), pravrittinoddah] });
}

return { "dannddaarekhaacitram": dannddaarekhaacitram, "rekhaacitram": rekhaacitram, "vrittacitram": vrittacitram, "saamkhyikaakaarddam": saamkhyikaakaarddam };
})();

const __mod_4 = (function () {
const varnnapattah = __mod_0["varnnapattah"];
const prakaashah = __mod_0["prakaashah"];
const raatrih = __mod_0["raatrih"];
const svarnnimah = __mod_0["svarnnimah"];
const himah = __mod_0["himah"];
const vissayalaaguu = __mod_0["vissayalaaguu"];
const antaraalah = __mod_0["antaraalah"];
const konnaah = __mod_0["konnaah"];
const chaayaah = __mod_0["chaayaah"];
const akssarakulam = __mod_0["akssarakulam"];
const varnnapraapti = __mod_0["varnnapraapti"];
const piiddakam = __mod_1["piiddakam"];
const cihnam = __mod_1["cihnam"];
const patrakam = __mod_1["patrakam"];
const suucanaapattttii = __mod_1["suucanaapattttii"];
const aadaanakssetram = __mod_1["aadaanakssetram"];
const parivartakam = __mod_1["parivartakam"];
const pragatipattttii = __mod_1["pragatipattttii"];
const avataarah = __mod_1["avataarah"];
const vibhaajakah = __mod_1["vibhaajakah"];
const cakrikaa = __mod_1["cakrikaa"];
const ttaibasamuuhah = __mod_1["ttaibasamuuhah"];
const vidhivaataayanam = __mod_1["vidhivaataayanam"];
const upakarannasuucanaa = __mod_1["upakarannasuucanaa"];
const bahupaatthakssetram = __mod_2["bahupaatthakssetram"];
const cayanakssetram = __mod_2["cayanakssetram"];
const angkitapettikaa = __mod_2["angkitapettikaa"];
const vikalpacakram = __mod_2["vikalpacakram"];
const sarpinnii = __mod_2["sarpinnii"];
const truttipaatthah = __mod_2["truttipaatthah"];
const prapatram = __mod_2["prapatram"];
const dannddaarekhaacitram = __mod_3["dannddaarekhaacitram"];
const rekhaacitram = __mod_3["rekhaacitram"];
const vrittacitram = __mod_3["vrittacitram"];
const saamkhyikaakaarddam = __mod_3["saamkhyikaakaarddam"];





return {  };
})();
window.Devarupa = Object.assign({}, __mod_0, __mod_1, __mod_2, __mod_3, __mod_4);
(function () {
  var asciiKeys = Object.keys(window.Devarupa);
  var devanagari = ["वर्णपटः","प्रकाशः","रात्रिः","स्वर्णिमः","हिमः","विषयलागू","अन्तरालः","कोणाः","छायाः","अक्षरकुलम्","वर्णप्राप्ति","पीडकम्","चिह्नम्","पत्रकम्","सूचनापट्टी","आदानक्षेत्रम्","परिवर्तकम्","प्रगतिपट्टी","अवतारः","विभाजकः","चक्रिका","टैबसमूहः","विधिवातायनम्","उपकरणसूचना","बहुपाठक्षेत्रम्","चयनक्षेत्रम्","अङ्कितपेटिका","विकल्पचक्रम्","सर्पिणी","त्रुटिपाठः","प्रपत्रम्","दण्डारेखाचित्रम्","रेखाचित्रम्","वृत्तचित्रम्","सांख्यिकाकार्डम्"];
  for (var i = 0; i < devanagari.length && i < asciiKeys.length; i++) {
    window.Devarupa[devanagari[i]] = window.Devarupa[asciiKeys[i]];
  }
})();
