// scripts/build-dist.mjs — regenerates dist/devarupa.browser.js from
// src/*.deva. Run from the package root: `node scripts/build-dist.mjs`
//
// Requires `devabhasha` to be installed (it's a peerDependency of this
// package — `npm install devabhasha` if you don't already have it).

import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { bundle } from 'devabhasha/bundler';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

mkdirSync(join(root, 'dist'), { recursive: true });

const code = bundle(join(root, 'src/अनुक्रमणिका.deva'), { includeRuntime: true });

// Every top-level module slot the bundler created (const __mod_0 = (...)();
// one per source file in the dependency graph) gets merged into one global
// namespace for plain-JS/HTML consumers.
const slots = [...code.matchAll(/^const (__mod_\d+) = /gm)].map(m => m[1]);

// The bundler's own export-object keys are transliterated ASCII (e.g.
// "piiddakam" for पीडकम्). Alias every export back onto its original
// Devanagari name too, in declaration order, so plain-JS consumers can use
// either Devarupa.piiddakam(...) or Devarupa["पीडकम्"](...).
const devanagariNames = [
  'वर्णपटः', 'प्रकाशः', 'रात्रिः', 'स्वर्णिमः', 'हिमः', 'विषयलागू', 'अन्तरालः', 'कोणाः',
  'छायाः', 'अक्षरकुलम्', 'वर्णप्राप्ति',
  'पीडकम्', 'चिह्नम्', 'पत्रकम्', 'सूचनापट्टी', 'आदानक्षेत्रम्', 'परिवर्तकम्', 'प्रगतिपट्टी',
  'अवतारः', 'विभाजकः', 'चक्रिका', 'टैबसमूहः', 'विधिवातायनम्', 'उपकरणसूचना',
  'बहुपाठक्षेत्रम्', 'चयनक्षेत्रम्', 'अङ्कितपेटिका', 'विकल्पचक्रम्', 'सर्पिणी', 'त्रुटिपाठः', 'प्रपत्रम्',
  'दण्डारेखाचित्रम्', 'रेखाचित्रम्', 'वृत्तचित्रम्', 'सांख्यिकाकार्डम्',
];

const merged = `
window.Devarupa = Object.assign({}, ${slots.join(', ')});
(function () {
  var asciiKeys = Object.keys(window.Devarupa);
  var devanagari = ${JSON.stringify(devanagariNames)};
  for (var i = 0; i < devanagari.length && i < asciiKeys.length; i++) {
    window.Devarupa[devanagari[i]] = window.Devarupa[asciiKeys[i]];
  }
})();
`;

const outPath = join(root, 'dist/devarupa.browser.js');
writeFileSync(outPath, code + merged);
console.log('Built', outPath, '—', slots.length, 'modules,', devanagariNames.length, 'exports.');
