// scripts/build-dist.mjs — regenerates dist/devarupa.browser.js from
// src/*.deva. Run from the package root: `node scripts/build-dist.mjs`
//
// Requires `devabhasha` to be installed (it's a peerDependency of this
// package — `npm install devabhasha` if you don't already have it).

import { writeFileSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { bundle } from 'devabhasha/bundler';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const srcDir = join(root, 'src');

// asciiId — a faithful copy of codegen's id(): the deterministic Devanagari→
// ASCII transliteration the compiler applies to identifiers. Kept in sync with
// devabhasha/src/codegen.js so the alias map below matches the bundle's keys.
const TRANSLIT = {
  'अ':'a','आ':'aa','इ':'i','ई':'ii','उ':'u','ऊ':'uu','ऋ':'ri','ॠ':'rii',
  'ऌ':'li','ए':'e','ऐ':'ai','ओ':'o','औ':'au',
  'क':'ka','ख':'kha','ग':'ga','घ':'gha','ङ':'nga',
  'च':'ca','छ':'cha','ज':'ja','झ':'jha','ञ':'nya',
  'ट':'tta','ठ':'ttha','ड':'dda','ढ':'ddha','ण':'nna',
  'त':'ta','थ':'tha','द':'da','ध':'dha','न':'na',
  'प':'pa','फ':'pha','ब':'ba','भ':'bha','म':'ma',
  'य':'ya','र':'ra','ल':'la','व':'va','श':'sha','ष':'ssa','स':'sa','ह':'ha',
  'ळ':'lla',
  'ा':'aa','ि':'i','ी':'ii','ु':'u','ू':'uu',
  'ृ':'ri','े':'e','ै':'ai','ो':'o','ौ':'au',
  'ं':'m','ः':'h','ँ':'n',
};
const VIRAMA = '्';
const JS_RESERVED = new Set([
  'do','if','in','for','new','var','let','try','case','else','enum','eval',
  'null','this','true','void','with','break','catch','class','const','false',
  'super','throw','while','yield','delete','export','import','return','switch',
  'typeof','default','extends','finally','continue','debugger','function',
  'arguments','await','async','instanceof',
]);
function asciiId(name) {
  let result = '';
  const chars = [...name];
  for (let k = 0; k < chars.length; k++) {
    const ch = chars[k];
    if (/[A-Za-z0-9_$]/.test(ch)) { result += ch; continue; }
    if (ch === VIRAMA) { if (result.endsWith('a')) result = result.slice(0, -1); continue; }
    const map = TRANSLIT[ch];
    if (map !== undefined) {
      if (/[ा-ौ]/.test(ch) && result.endsWith('a')) result = result.slice(0, -1) + map;
      else result += map;
    } else {
      result += '_u' + ch.codePointAt(0).toString(16);
    }
  }
  if (/^[0-9]/.test(result)) result = '_' + result;
  if (JS_RESERVED.has(result)) result = result + '_';
  return result || '_';
}

// Scan every src/*.deva (except the entry point) for exported names.
function collectExportNames(dir) {
  const names = [];
  const seen = new Set();
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.deva') || file === 'अनुक्रमणिका.deva') continue;
    const text = readFileSync(join(dir, file), 'utf8');
    // निर्यात कार्य NAME (…)   |   निर्यात नियत NAME = …
    const re = /निर्यात\s+(?:कार्य|नियत)\s+([^\s(=।]+)/g;
    let m;
    while ((m = re.exec(text))) {
      const name = m[1];
      if (!seen.has(name)) { seen.add(name); names.push(name); }
    }
  }
  return names;
}

mkdirSync(join(root, 'dist'), { recursive: true });

const code = bundle(join(srcDir, 'अनुक्रमणिका.deva'), { includeRuntime: true });

// Every top-level module slot the bundler created (const __mod_0 = (...)();
// one per source file in the dependency graph) gets merged into one global
// namespace for plain-JS/HTML consumers.
const slots = [...code.matchAll(/^const (__mod_\d+) = /gm)].map(m => m[1]);

// The bundler's own export-object keys are transliterated ASCII (e.g.
// "piiddakam" for पीडकम्). We alias every export back onto its original
// Devanagari name so plain-JS consumers can use either Devarupa.piiddakam(...)
// or Devarupa["पीडकम्"](...).
//
// The alias map is derived, not hand-maintained: every `निर्यात कार्य/नियत X`
// across src/*.deva is transliterated with asciiId() above. This is
// order-independent, so adding a new module or export needs no edit here — the
// export just has to reach the bundle graph via अनुक्रमणिका.
const devanagariNames = collectExportNames(srcDir);
const aliasMap = Object.fromEntries(devanagariNames.map((n) => [n, asciiId(n)]));

const merged = `
window.Devarupa = Object.assign({}, ${slots.join(', ')});
(function () {
  var alias = ${JSON.stringify(aliasMap)};
  Object.keys(alias).forEach(function (deva) {
    var ascii = alias[deva];
    if (Object.prototype.hasOwnProperty.call(window.Devarupa, ascii)) {
      window.Devarupa[deva] = window.Devarupa[ascii];
    }
  });
})();
`;

const bundleOut = code + merged;

const outPath = join(root, 'dist/devarupa.browser.js');
writeFileSync(outPath, bundleOut);

// Keep a copy next to the docs site (docs/index.html loads it with a relative
// path) so GitHub Pages can serve the documentation self-contained, whether it
// publishes the repo root or the /docs folder.
mkdirSync(join(root, 'docs'), { recursive: true });
const docsCopy = join(root, 'docs/devarupa.browser.js');
writeFileSync(docsCopy, bundleOut);

console.log('Built', outPath, '—', slots.length, 'modules,', devanagariNames.length, 'exports.');
console.log('Copied', docsCopy);
