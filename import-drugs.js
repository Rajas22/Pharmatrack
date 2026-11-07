// Import a big drug list (CSV, e.g. from Kaggle) into data/drugs.json
//
// Usage (stop the server first):
//   node import-drugs.js path\to\drugs.csv            -> merges into data/drugs.json
//   node import-drugs.js path\to\drugs.csv --dry      -> only shows what it would do
//
// Existing drugs and their IDs are kept. Duplicates (same name + strength + form) are skipped.
// A backup of the old file is saved as data/drugs.json.bak
//
// If your CSV uses unusual column names, set them in COLUMNS below.

const fs = require('fs');
const path = require('path');

const COLUMNS = {
  name: null,      // e.g. 'Medicine Name'
  strength: null,  // e.g. 'Strength'
  form: null,      // e.g. 'Dosage Form'
  category: null   // e.g. 'Therapeutic Class'
};

// Words in a header that probably mean each field (checked in this order)
const GUESS = {
  name: ['medicine name', 'drug name', 'brand name', 'product name', 'medicine', 'drug', 'name'],
  strength: ['strength', 'dosage', 'dose'],
  form: ['dosage form', 'dosage_form', 'form', 'pack_size_label', 'pack size'],
  category: ['therapeutic class', 'therapeutic_class', 'drug class', 'category', 'class', 'main_category', 'uses', 'use']
};

// Used when the CSV has no category column but has a "uses" column or when it has nothing at all
const CATEGORY_KEYWORDS = [
  ['Antibiotic', /antibiotic|bacterial|infection|cillin|mycin|floxacin|cef/i],
  ['Pain & Fever', /pain|fever|arthritis|inflammation|paracetamol|ibuprofen|diclofenac/i],
  ['Heart & Blood Pressure', /blood pressure|hypertension|heart|cardiac|angina|cholesterol|statin/i],
  ['Diabetes', /diabet|insulin|glucose|metformin/i],
  ['Stomach & Digestion', /acidity|ulcer|stomach|gastric|digest|nausea|vomit|constipation|diarrh/i],
  ['Allergy & Respiratory', /allerg|asthma|cough|cold|bronch|respirat|antihistamine/i],
  ['Antifungal / Antiviral / Antiparasitic', /fung|viral|virus|parasit|worm|malaria/i],
  ['Vitamins & Supplements', /vitamin|supplement|calcium|iron|zinc|deficiency/i],
  ['Brain & Mental Health', /depress|anxiety|epilep|seizure|psych|sleep|migraine|parkinson|schizo/i],
  ['Hormones & Steroids', /hormone|steroid|thyroid|contracept|estrogen|testosterone/i],
  ['Skin & Topical', /skin|acne|eczema|dermat|topical|wound/i]
];

const FORMS = ['Tablet', 'Capsule', 'Syrup', 'Suspension', 'Injection', 'Cream', 'Ointment', 'Gel', 'Drops',
  'Inhaler', 'Solution', 'Sachet', 'Lotion', 'Powder', 'Spray', 'Patch', 'Suppository', 'Infusion', 'Shampoo'];

// ---------- tiny CSV parser (handles quotes, commas and new lines inside quotes) ----------
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v.trim() !== '')) rows.push(row);
  return rows;
}

function pickColumn(headers, wanted, guesses) {
  const lower = headers.map((h) => h.trim().toLowerCase());
  if (wanted) {
    const i = lower.indexOf(wanted.toLowerCase());
    if (i === -1) throw new Error(`Column "${wanted}" not found. Headers are: ${headers.join(', ')}`);
    return i;
  }
  for (const g of guesses) {
    const i = lower.indexOf(g);
    if (i !== -1) return i;
  }
  for (const g of guesses) {
    const i = lower.findIndex((h) => h.includes(g));
    if (i !== -1) return i;
  }
  return -1;
}

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 80);

function guessForm(text) {
  const t = text.toLowerCase();
  const hit = FORMS.find((f) => new RegExp('\\b' + f.toLowerCase() + 's?\\b').test(t));
  return hit || (/\btab\b/.test(t) ? 'Tablet' : /\bcap\b/.test(t) ? 'Capsule' : /\binj\b/.test(t) ? 'Injection' : '');
}

function guessStrength(text) {
  const m = text.match(/(\d+(?:\.\d+)?\s?(?:mg|mcg|µg|g|ml|iu|%)(?:\s?\/\s?\d*(?:\.\d+)?\s?(?:mg|g|ml|l|dose|actuation)?)?)/i);
  return m ? m[1].replace(/\s+/g, '') : '';
}

function guessCategory(text) {
  const hit = CATEGORY_KEYWORDS.find(([, re]) => re.test(text));
  return hit ? hit[0] : 'Other';
}

// ---------- main ----------
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const dry = args.includes('--dry');
if (!file) {
  console.log('Usage: node import-drugs.js path\\to\\drugs.csv [--dry]');
  process.exit(1);
}

const rows = parseCsv(fs.readFileSync(file, 'utf8'));
const headers = rows.shift();
const col = {};
for (const k of Object.keys(GUESS)) col[k] = pickColumn(headers, COLUMNS[k], GUESS[k]);
if (col.name === -1) {
  console.error('Could not find the drug name column. Headers are: ' + headers.join(', '));
  console.error('Set COLUMNS.name at the top of this file and run again.');
  process.exit(1);
}
console.log('Column mapping:');
for (const k of Object.keys(col)) console.log('  ' + k.padEnd(9) + '<- ' + (col[k] === -1 ? '(not found, will be guessed)' : headers[col[k]]));

const DRUGS_FILE = path.join(__dirname, 'data', 'drugs.json');
const existing = fs.existsSync(DRUGS_FILE) ? JSON.parse(fs.readFileSync(DRUGS_FILE, 'utf8')) : [];
const keyOf = (d) => `${d.name}|${d.strength}|${d.form}`.toLowerCase();
const seen = new Set(existing.map(keyOf));
let nextNum = existing.reduce((m, d) => Math.max(m, parseInt(String(d.drugId).slice(1), 10) || 0), 0) + 1;

// Columns that hold the active ingredients, e.g. "Paracetamol (500mg)": used to find the strength
const compCols = headers.map((h, i) => (/composition/i.test(h) ? i : -1)).filter((i) => i !== -1);

const added = [];
let skippedDup = 0, skippedEmpty = 0;
for (const r of rows) {
  const rawName = clean(r[col.name]);
  if (!rawName) { skippedEmpty++; continue; }
  const rawStrength = col.strength === -1 ? '' : clean(r[col.strength]);
  const rawForm = col.form === -1 ? '' : clean(r[col.form]);
  const rawCat = col.category === -1 ? '' : clean(r[col.category]);

  const compText = compCols.map((i) => r[i] || '').join(' ');
  const strength = rawStrength || guessStrength(rawName) || guessStrength(compText) || 'N/A';
  // Only trust the form column if it names a real dosage form (some files put "allopathy" there)
  const form = guessForm(rawForm) || guessForm(rawName) || 'Other';

  const drug = {
    name: rawName,
    strength,
    form,
    category: rawCat ? (CATEGORY_KEYWORDS.some(([c]) => c === rawCat) ? rawCat : guessCategory(rawCat) !== 'Other' ? guessCategory(rawCat) : rawCat) : guessCategory(rawName + ' ' + compText)
  };
  drug.category = clean(drug.category) || 'Other';

  const key = keyOf(drug);
  if (seen.has(key)) { skippedDup++; continue; }
  seen.add(key);
  added.push({ drugId: 'D' + String(nextNum++).padStart(4, '0'), ...drug });
}

console.log(`\nRows read: ${rows.length}`);
console.log(`New drugs: ${added.length}   Duplicates skipped: ${skippedDup}   Empty names skipped: ${skippedEmpty}`);
console.log(`Catalog size after import: ${existing.length + added.length}`);
console.log('Sample:', added.slice(0, 3));

if (dry) { console.log('\nDry run only, nothing was written.'); process.exit(0); }

if (existing.length) fs.copyFileSync(DRUGS_FILE, DRUGS_FILE + '.bak');
const merged = existing.concat(added);
fs.writeFileSync(DRUGS_FILE + '.tmp', JSON.stringify(merged, null, 2));
fs.renameSync(DRUGS_FILE + '.tmp', DRUGS_FILE);
console.log('\nDone. Start the server again: npm start');
