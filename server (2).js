const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { MongoClient } = require('mongodb');
const DRUG_SEED = require('./drugs');

const app = express();
app.set('trust proxy', 1); // needed behind Render/Railway proxy so rate limiting sees real client IPs
const PORT = process.env.PORT || 18080;

// ---------- Config ----------
// Set JWT_SECRET in your environment for production. If missing, a random one
// is created on each start (everyone gets logged out when the server restarts).
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET not set. Using a temporary secret.');
}

// If AUTO_APPROVE=false, new accounts must be approved by an admin
// (using the ADMIN_KEY) before they can log in. Default is true for easy demo use.
const AUTO_APPROVE = process.env.AUTO_APPROVE !== 'false';
const ADMIN_KEY = process.env.ADMIN_KEY || '';

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const BATCHES_FILE = path.join(DATA_DIR, 'batches.json');
const DRUGS_FILE = path.join(DATA_DIR, 'drugs.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

const VALID_ROLES = ['Manufacturer', 'Distributor', 'Pharmacy'];
const VALID_STATUSES = ['Manufactured', 'In-Transit', 'Delivered'];

// Who is allowed to move a batch from one status to the next
const TRANSITIONS = {
  Distributor: { from: 'Manufactured', to: 'In-Transit' },
  Pharmacy: { from: 'In-Transit', to: 'Delivered' }
};

app.use(express.json({ limit: '10kb' }));
// Frontend is served from the same server, so no CORS is needed at all.
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Storage helpers ----------
// If MONGODB_URI is set, all data lives in MongoDB (it survives Render restarts).
// If not, the app falls back to local JSON files (fine for running on your own PC).
const MONGODB_URI = process.env.MONGODB_URI || '';
const store = new Map();          // in-memory copy of every "file", filled from MongoDB at startup
const writeChains = new Map();    // per-file queue so saves reach MongoDB in order
const pendingWrites = new Set();  // saves still running (we wait for them on shutdown)
let collection = null;            // set once MongoDB is connected
const keyOf = (file) => path.basename(file);

function readLocalJson(file, fallback) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    // Keep the broken file for inspection instead of silently overwriting it
    const backup = `${file}.corrupt-${Date.now()}`;
    fs.renameSync(file, backup);
    console.error(`Corrupted file moved to ${backup}`);
    return fallback;
  }
}

function writeLocalJson(file, data) {
  // Write to a temp file first, then rename: avoids half-written files
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function readJson(file, fallback) {
  if (!collection) return readLocalJson(file, fallback);
  const key = keyOf(file);
  return store.has(key) ? structuredClone(store.get(key)) : fallback;
}

function writeJson(file, data) {
  if (!collection) return writeLocalJson(file, data);
  const key = keyOf(file);
  const copy = structuredClone(data);
  store.set(key, copy);
  const job = (writeChains.get(key) || Promise.resolve())
    .then(() => collection.replaceOne({ _id: key }, { _id: key, value: copy }, { upsert: true }))
    .catch((err) => console.error(`MongoDB save failed for ${key}:`, err.message));
  writeChains.set(key, job);
  pendingWrites.add(job);
  job.finally(() => pendingWrites.delete(job));
}

async function initStorage() {
  if (!MONGODB_URI) {
    console.warn('WARNING: MONGODB_URI not set. Using local JSON files. On Render free, this data is lost on restart.');
    return;
  }
  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  collection = client.db(process.env.MONGODB_DB || 'pharmatrack').collection('files');

  for (const doc of await collection.find({}).toArray()) store.set(doc._id, doc.value);

  // One-time import: if a local data file exists and MongoDB does not have it yet, upload it
  for (const file of [USERS_FILE, BATCHES_FILE, REQUESTS_FILE, DRUGS_FILE]) {
    if (store.has(keyOf(file)) || !fs.existsSync(file)) continue;
    const local = readLocalJson(file, null);
    if (local) {
      writeJson(file, local);
      console.log(`Imported ${keyOf(file)} into MongoDB.`);
    }
  }
  console.log('Connected to MongoDB. Data will be saved there.');
}

// Render sends SIGTERM when it stops the server: finish saving first
async function shutdown() {
  try { await Promise.allSettled([...pendingWrites]); } finally { process.exit(0); }
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

const loadUsers = () => readJson(USERS_FILE, []);
const saveUsers = (u) => writeJson(USERS_FILE, u);
const loadBatches = () => {
  const existing = readJson(BATCHES_FILE, null);
  if (existing) return existing;
  const seed = [
    { batchId: 'B101', product: 'Paracetamol 500mg', quantity: 10000, status: 'Delivered', createdBy: 'system', updatedAt: new Date().toISOString() },
    { batchId: 'B102', product: 'Amoxicillin 250mg', quantity: 5000, status: 'In-Transit', createdBy: 'system', updatedAt: new Date().toISOString() }
  ];
  writeJson(BATCHES_FILE, seed);
  return seed;
};
const saveBatches = (b) => writeJson(BATCHES_FILE, b);

// Drug catalog: created from drugs.js the first time, then lives in data/drugs.json
const loadDrugs = () => {
  const existing = readJson(DRUGS_FILE, null);
  if (existing) return existing;
  const seed = DRUG_SEED.map((d, i) => Array.isArray(d)
    ? { drugId: 'D' + String(i + 1).padStart(4, '0'), name: d[0], strength: d[1], form: d[2], category: d[3] }
    : d);
  writeJson(DRUGS_FILE, seed);
  return seed;
};
const saveDrugs = (d) => writeJson(DRUGS_FILE, d);

// ---------- Password helpers ----------
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64);
}

const DUMMY_SALT = crypto.randomBytes(16).toString('hex');

// Constant-time check. Also does the same work when the user doesn't exist,
// so response time does not reveal which emails are registered.
function verifyPassword(password, user) {
  const salt = user ? user.salt : DUMMY_SALT;
  const actual = hashPassword(password, salt);
  const expected = user ? Buffer.from(user.passwordHash, 'hex') : Buffer.alloc(64);
  const match = crypto.timingSafeEqual(actual, expected);
  return Boolean(user) && match;
}

// ---------- Validation helpers ----------
const isString = (v) => typeof v === 'string';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BATCH_ID_RE = /^[A-Za-z0-9_-]{1,30}$/;
const IMAGE_URL_RE = /^https:\/\/[^\s]{4,500}$/i;

// ---------- Who did what on a batch ----------
// New records store the organisation's email as well as its name (names are not
// unique). Older records only have a name, so we fall back to comparing names.
function creatorOf(b) {
  return b.createdBy ? { name: b.createdBy, email: b.createdByEmail || null } : null;
}
function dispatcherOf(b) {
  if (b.inTransitBy) return { name: b.inTransitBy, email: b.inTransitByEmail || null };
  // Old batches: updatedBy was the distributor while the batch was still In-Transit
  if (b.status === 'In-Transit' && b.updatedBy) return { name: b.updatedBy, email: null };
  return null;
}
function receiverOf(b) {
  if (b.deliveredBy) return { name: b.deliveredBy, email: b.deliveredByEmail || null };
  // Old batches: updatedBy was the pharmacy once the batch was Delivered
  if (b.status === 'Delivered' && b.updatedBy) return { name: b.updatedBy, email: null };
  return null;
}
function isActor(actor, user) {
  if (!actor) return false;
  return actor.email ? actor.email === user.email : actor.name === user.orgName;
}

// What the browser receives: names only, never other people's emails
function publicBatch(b) {
  const { createdByEmail, inTransitByEmail, deliveredByEmail, pharmacyEmail, ...rest } = b;
  const d = dispatcherOf(b);
  const r = receiverOf(b);
  return { ...rest, inTransitBy: d ? d.name : null, deliveredBy: r ? r.name : null };
}

// ---------- Rate limiting ----------
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in 15 minutes.' }
});

// ---------- Auth middleware ----------
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Please log in.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = loadUsers().find((u) => u.email === payload.email);
    if (!user || user.approved === false) {
      return res.status(401).json({ message: 'Account not found or not approved.' });
    }
    req.user = { email: user.email, orgName: user.orgName, role: user.role };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Session expired. Please log in again.' });
  }
}

// ---------- Register ----------
app.post('/api/register', authLimiter, (req, res) => {
  const { orgName, role, email, password } = req.body || {};

  if (![orgName, role, email, password].every(isString)) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  const cleanOrg = orgName.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (cleanOrg.length < 2 || cleanOrg.length > 100) {
    return res.status(400).json({ message: 'Organization name must be 2-100 characters.' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ message: 'Invalid role.' });
  }
  if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 254) {
    return res.status(400).json({ message: 'Please enter a valid email.' });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ message: 'Password must be 8-128 characters.' });
  }

  const users = loadUsers();
  if (users.some((u) => u.email === cleanEmail)) {
    return res.status(409).json({ message: 'This email is already registered.' });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  users.push({
    orgName: cleanOrg,
    role,
    email: cleanEmail,
    salt,
    passwordHash: hashPassword(password, salt).toString('hex'),
    approved: AUTO_APPROVE,
    createdAt: new Date().toISOString()
  });
  saveUsers(users);

  res.status(201).json({
    message: AUTO_APPROVE
      ? 'Account registered successfully!'
      : 'Account registered. An admin must approve it before you can log in.'
  });
});

// ---------- Login ----------
app.post('/api/login', authLimiter, (req, res) => {
  const { email, password } = req.body || {};

  if (!isString(email) || !isString(password) || !email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const user = loadUsers().find((u) => u.email === cleanEmail);

  if (!verifyPassword(password, user)) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }
  if (user.approved === false) {
    return res.status(403).json({ message: 'Your account is waiting for admin approval.' });
  }

  const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '8h' });

  res.json({
    message: 'Login successful!',
    token,
    orgName: user.orgName,
    role: user.role
  });
});

// ---------- Current user ----------
app.get('/api/me', requireAuth, (req, res) => {
  res.json(req.user);
});

// ---------- Drug catalog ----------
// Any logged-in user can read it.
app.get('/api/drugs', requireAuth, (req, res) => {
  res.json(loadDrugs());
});

// Manufacturers can add a drug that is missing from the catalog.
app.post('/api/drugs', requireAuth, (req, res) => {
  if (req.user.role !== 'Manufacturer') {
    return res.status(403).json({ message: 'Only manufacturers can add drugs to the catalog.' });
  }

  const { name, strength, form, category, image } = req.body || {};
  if (![name, strength, form, category].every(isString)) {
    return res.status(400).json({ message: 'Name, strength, form and category are required.' });
  }
  // Picture is optional, but if given it must be a normal https link
  const cleanImage = isString(image) ? image.trim() : '';
  if (cleanImage && !IMAGE_URL_RE.test(cleanImage)) {
    return res.status(400).json({ message: 'Image link must start with https:// (max 500 characters).' });
  }

  const clean = {
    name: name.trim(),
    strength: strength.trim(),
    form: form.trim(),
    category: category.trim()
  };
  for (const [key, value] of Object.entries(clean)) {
    if (value.length < 1 || value.length > 80) {
      return res.status(400).json({ message: `${key} must be 1-80 characters.` });
    }
  }

  const drugs = loadDrugs();
  const key = (d) => `${d.name}|${d.strength}|${d.form}`.toLowerCase();
  if (drugs.some((d) => key(d) === key(clean))) {
    return res.status(409).json({ message: 'This drug is already in the catalog.' });
  }

  const maxNum = drugs.reduce((m, d) => Math.max(m, parseInt(d.drugId.slice(1), 10) || 0), 0);
  const drug = { drugId: 'D' + String(maxNum + 1).padStart(4, '0'), ...clean };
  if (cleanImage) drug.image = cleanImage;
  drugs.push(drug);
  saveDrugs(drugs);

  res.status(201).json(drug);
});

// ---------- Requests: pharmacy -> manufacturer ----------
// Pending -> Accepted/Rejected (manufacturer) -> Manufactured (batch made)
// -> In-Transit (distributor) -> Delivered (the SAME pharmacy that asked).
const REQUESTS_FILE = path.join(DATA_DIR, 'requests.json');
const loadRequests = () => readJson(REQUESTS_FILE, []);
const saveRequests = (r) => writeJson(REQUESTS_FILE, r);
const publicRequest = ({ pharmacyEmail, manufacturerEmail, decidedByEmail, ...rest }) => rest;

function syncRequestStatus(requestId, status, extra) {
  if (!requestId) return;
  const reqs = loadRequests();
  const r = reqs.find((x) => x.requestId === requestId);
  if (!r) return;
  r.status = status;
  r.updatedAt = new Date().toISOString();
  Object.assign(r, extra || {});
  saveRequests(reqs);
}

// Pharmacies pick which manufacturer to ask
app.get('/api/manufacturers', requireAuth, (req, res) => {
  if (req.user.role !== 'Pharmacy') return res.status(403).json({ message: 'Only pharmacies can view this.' });
  res.json(loadUsers().filter((u) => u.role === 'Manufacturer' && u.approved !== false)
    .map((u) => ({ orgName: u.orgName, email: u.email })));
});

app.get('/api/pharmacies', requireAuth, (req, res) => {
  if (req.user.role !== 'Manufacturer') return res.status(403).json({ message: 'Only manufacturers can view this.' });
  res.json(loadUsers().filter((u) => u.role === 'Pharmacy' && u.approved !== false)
    .map((u) => ({ orgName: u.orgName, email: u.email })));
});

app.post('/api/requests', requireAuth, (req, res) => {
  if (req.user.role !== 'Pharmacy') return res.status(403).json({ message: 'Only pharmacies can request medicines.' });
  const { drugId, quantity, manufacturerEmail, note } = req.body || {};
  if (!isString(drugId) || !isString(manufacturerEmail)) return res.status(400).json({ message: 'Choose a manufacturer and a drug.' });
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000000) {
    return res.status(400).json({ message: 'Quantity must be a whole number from 1 to 10,000,000.' });
  }
  const drug = loadDrugs().find((d) => d.drugId === drugId);
  if (!drug) return res.status(400).json({ message: 'Please choose a drug from the catalog.' });
  const mfr = loadUsers().find((u) => u.email === manufacturerEmail && u.role === 'Manufacturer' && u.approved !== false);
  if (!mfr) return res.status(400).json({ message: 'Manufacturer not found.' });

  const reqs = loadRequests();
  const maxNum = reqs.reduce((m, r) => Math.max(m, parseInt(r.requestId.slice(1), 10) || 0), 0);
  const now = new Date().toISOString();
  const request = {
    requestId: 'R' + String(maxNum + 1).padStart(4, '0'),
    drugId: drug.drugId,
    product: `${drug.name} ${drug.strength} ${drug.form}`,
    quantity,
    note: isString(note) ? note.trim().slice(0, 200) : '',
    pharmacy: req.user.orgName,
    pharmacyEmail: req.user.email,
    manufacturerEmail: mfr.email,
    manufacturerName: mfr.orgName,
    status: 'Pending',
    requestedAt: now,
    updatedAt: now
  };
  reqs.push(request);
  saveRequests(reqs);
  res.status(201).json(publicRequest(request));
});

// Pharmacy: only requests it sent. Manufacturer: only requests addressed to it.
app.get('/api/requests', requireAuth, (req, res) => {
  const all = loadRequests();
  let list = [];
  if (req.user.role === 'Pharmacy') list = all.filter((r) => r.pharmacyEmail === req.user.email);
  else if (req.user.role === 'Manufacturer') list = all.filter((r) => r.manufacturerEmail === req.user.email);
  res.json(list.map(publicRequest).reverse());
});

// Manufacturer accepts or rejects a pending request
app.patch('/api/requests/:requestId', requireAuth, (req, res) => {
  if (req.user.role !== 'Manufacturer') return res.status(403).json({ message: 'Only manufacturers can decide on requests.' });
  const { status } = req.body || {};
  if (!['Accepted', 'Rejected'].includes(status)) return res.status(400).json({ message: 'Status must be Accepted or Rejected.' });
  const reqs = loadRequests();
  const r = reqs.find((x) => x.requestId === req.params.requestId && x.manufacturerEmail === req.user.email);
  if (!r) return res.status(404).json({ message: 'Request not found.' });
  if (r.status !== 'Pending') return res.status(400).json({ message: 'This request has already been decided.' });
  r.status = status;
  r.decidedBy = req.user.orgName;
  r.decidedByEmail = req.user.email;
  r.decidedAt = r.updatedAt = new Date().toISOString();
  saveRequests(reqs);
  res.json(publicRequest(r));
});

// ---------- Batches ----------
// Every organisation gets its own list:
//   Manufacturer: only the batches it manufactured
//   Distributor:  batches waiting to be dispatched (from any manufacturer)
//                 + the batches this distributor dispatched, with their latest status
//   Pharmacy:     batches in transit that can be received
//                 + the batches this pharmacy received
app.get('/api/batches', requireAuth, (req, res) => {
  const all = loadBatches();
  let list;
  if (req.user.role === 'Manufacturer') {
    list = all.filter((b) => isActor(creatorOf(b), req.user));
  } else if (req.user.role === 'Distributor') {
    list = all.filter((b) => b.status === 'Manufactured' || isActor(dispatcherOf(b), req.user));
  } else {
    // Only the pharmacy that placed the request ever sees its batch (in transit or delivered)
    const mine = new Set(loadRequests().filter((r) => r.pharmacyEmail === req.user.email).map((r) => r.requestId));
    const addressedToMe = (b) => b.pharmacyEmail === req.user.email || (!b.pharmacyEmail && b.requestId && mine.has(b.requestId));
    list = all.filter((b) => (addressedToMe(b) && b.status !== 'Manufactured') || isActor(receiverOf(b), req.user));
  }
  // Add the medicine picture (and dosage form, for the fallback drawing) to each batch.
  // New batches carry a drugId; older ones are matched by their product text.
  const drugs = loadDrugs();
  const byId = new Map(drugs.map((d) => [d.drugId, d]));
  const byProduct = new Map(drugs.map((d) => [`${d.name} ${d.strength} ${d.form}`, d]));
  res.json(list.map((b) => {
    const d = byId.get(b.drugId) || byProduct.get(b.product);
    return { ...publicBatch(b), image: (d && d.image) || null, form: (d && d.form) || null };
  }));
});

// Only Manufacturers can create a batch, and the drug MUST come from the catalog.
// The product name is copied from the catalog, so it cannot be typed freely.
app.post('/api/batches', requireAuth, (req, res) => {
  if (req.user.role !== 'Manufacturer') {
    return res.status(403).json({ message: 'Only manufacturers can add new batches.' });
  }

  const { batchId, requestId, pharmacyEmail } = req.body || {};
  let request = null, drugId, quantity, toEmail, toName;
  if (isString(requestId) && requestId) {
    // Fulfilling a pharmacy request: drug, quantity and pharmacy all come from the request
    request = loadRequests().find((r) => r.requestId === requestId && r.manufacturerEmail === req.user.email);
    if (!request || request.status !== 'Accepted') {
      return res.status(400).json({ message: 'Choose an accepted pharmacy request to fulfil.' });
    }
    ({ drugId, quantity } = request);
    toEmail = request.pharmacyEmail; toName = request.pharmacy;
  } else {
    // Direct shipment: the manufacturer picks the one pharmacy that will receive it
    ({ drugId, quantity } = req.body || {});
    const ph = loadUsers().find((u) => u.email === pharmacyEmail && u.role === 'Pharmacy' && u.approved !== false);
    if (!ph) return res.status(400).json({ message: 'Choose the pharmacy to send this to.' });
    toEmail = ph.email; toName = ph.orgName;
  }
  if (!isString(batchId) || !isString(drugId)) {
    return res.status(400).json({ message: 'Batch ID and drug are required.' });
  }

  const cleanId = batchId.trim().toUpperCase();
  if (!BATCH_ID_RE.test(cleanId)) {
    return res.status(400).json({ message: 'Batch ID can use letters, numbers, - and _ (max 30).' });
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000000) {
    return res.status(400).json({ message: 'Quantity must be a whole number from 1 to 10,000,000.' });
  }

  const drug = loadDrugs().find((d) => d.drugId === drugId);
  if (!drug) {
    return res.status(400).json({ message: 'Please choose a drug from the catalog.' });
  }

  const batches = loadBatches();
  if (batches.some((b) => b.batchId === cleanId)) {
    return res.status(409).json({ message: 'This Batch ID already exists.' });
  }

  const batch = {
    batchId: cleanId,
    drugId: drug.drugId,
    product: `${drug.name} ${drug.strength} ${drug.form}`,
    quantity,
    status: 'Manufactured',
    createdBy: req.user.orgName,
    createdByEmail: req.user.email,
    pharmacyEmail: toEmail,
    pharmacy: toName,
    ...(request ? { requestId: request.requestId } : {}),
    manufacturedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  batches.push(batch);
  saveBatches(batches);
  if (request) syncRequestStatus(request.requestId, 'Manufactured', { batchId: batch.batchId, manufacturedAt: batch.manufacturedAt });

  res.status(201).json(publicBatch(batch));
});

// A manufacturer can remove a batch it added by mistake, but only while nobody
// has picked it up yet (status is still "Manufactured").
app.delete('/api/batches/:batchId', requireAuth, (req, res) => {
  if (req.user.role !== 'Manufacturer') {
    return res.status(403).json({ message: 'Only manufacturers can remove batches.' });
  }
  const batches = loadBatches();
  const index = batches.findIndex((b) => b.batchId === req.params.batchId);
  if (index === -1 || !isActor(creatorOf(batches[index]), req.user)) {
    return res.status(404).json({ message: 'Batch not found.' });
  }
  if (batches[index].status !== 'Manufactured') {
    return res.status(400).json({ message: 'This batch has already left the factory and cannot be removed.' });
  }
  const [removed] = batches.splice(index, 1);
  saveBatches(batches);
  res.json({ message: `Batch ${removed.batchId} removed.` });
});

// Distributor: Manufactured -> In-Transit. Pharmacy: In-Transit -> Delivered.
app.patch('/api/batches/:batchId/status', requireAuth, (req, res) => {
  const rule = TRANSITIONS[req.user.role];
  if (!rule) {
    return res.status(403).json({ message: 'Your role cannot change batch status.' });
  }

  const { status } = req.body || {};
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Invalid status.' });
  }

  const batches = loadBatches();
  const batch = batches.find((b) => b.batchId === req.params.batchId);
  if (!batch) {
    return res.status(404).json({ message: 'Batch not found.' });
  }
  if (req.user.role === 'Pharmacy') {
    const own = loadRequests().find((r) => r.requestId === batch.requestId);
    if ((batch.pharmacyEmail || (own && own.pharmacyEmail)) !== req.user.email) return res.status(404).json({ message: 'Batch not found.' });
  }
  if (batch.status !== rule.from || status !== rule.to) {
    return res.status(400).json({
      message: `${req.user.role}s can only change "${rule.from}" to "${rule.to}".`
    });
  }

  batch.status = status;
  batch.updatedAt = new Date().toISOString();
  // Remember when each stage was reached (used for the date/time and "time taken" columns)
  if (status === 'In-Transit') {
    batch.inTransitAt = batch.updatedAt;
    batch.inTransitBy = req.user.orgName;
    batch.inTransitByEmail = req.user.email;
  }
  if (status === 'Delivered') {
    batch.deliveredAt = batch.updatedAt;
    batch.deliveredBy = req.user.orgName;
    batch.deliveredByEmail = req.user.email;
  }
  batch.updatedBy = req.user.orgName;
  saveBatches(batches);
  syncRequestStatus(batch.requestId, status);

  res.json(publicBatch(batch));
});

// ---------- Manufacturer only: distributors, pharmacies and their updates ----------
function requireManufacturer(req, res, next) {
  if (req.user.role !== 'Manufacturer') {
    return res.status(403).json({ message: 'Only manufacturers can view this.' });
  }
  next();
}

const PARTNER_ROLES = ['Distributor', 'Pharmacy'];

// The partner's action on a batch, with the time it happened (null if not theirs)
function partnerAction(batch, partner) {
  if (partner.role === 'Distributor' && isActor(dispatcherOf(batch), partner)) {
    return { action: 'Marked In-Transit', at: batch.inTransitAt || (batch.status === 'In-Transit' ? batch.updatedAt : null) };
  }
  if (partner.role === 'Pharmacy' && isActor(receiverOf(batch), partner)) {
    return { action: 'Marked Delivered', at: batch.deliveredAt || (batch.status === 'Delivered' ? batch.updatedAt : null) };
  }
  return null;
}

// List of all distributors and pharmacies, with how many of MY batches each one handled
app.get('/api/partners', requireAuth, requireManufacturer, (req, res) => {
  const mine = loadBatches().filter((b) => isActor(creatorOf(b), req.user));
  const partners = loadUsers()
    .filter((u) => PARTNER_ROLES.includes(u.role) && u.approved !== false)
    .map((u) => {
      const p = { orgName: u.orgName, email: u.email, role: u.role };
      return { ...p, handled: mine.filter((b) => partnerAction(b, p)).length };
    })
    .sort((a, b) => a.orgName.localeCompare(b.orgName));
  res.json(partners);
});

// Updates made by one distributor / pharmacy on MY batches only
app.get('/api/partners/:email/updates', requireAuth, requireManufacturer, (req, res) => {
  const email = String(req.params.email || '').trim().toLowerCase();
  const found = loadUsers().find((u) => u.email === email && PARTNER_ROLES.includes(u.role) && u.approved !== false);
  if (!found) return res.status(404).json({ message: 'Distributor or pharmacy not found.' });
  const partner = { orgName: found.orgName, email: found.email, role: found.role };

  const updates = [];
  for (const b of loadBatches()) {
    if (!isActor(creatorOf(b), req.user)) continue;
    const a = partnerAction(b, partner);
    if (!a) continue;
    updates.push({
      batchId: b.batchId,
      product: b.product,
      quantity: b.quantity,
      action: a.action,
      at: a.at,
      currentStatus: b.status
    });
  }
  updates.sort((x, y) => String(y.at || '').localeCompare(String(x.at || '')));

  res.json({
    partner: { orgName: partner.orgName, role: partner.role },
    summary: {
      total: updates.length,
      inTransit: updates.filter((u) => u.currentStatus === 'In-Transit').length,
      delivered: updates.filter((u) => u.currentStatus === 'Delivered').length
    },
    updates
  });
});

// ---------- Admin approval (only used when AUTO_APPROVE=false) ----------
function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (!ADMIN_KEY || !isString(key)) return res.status(403).json({ message: 'Forbidden.' });
  const a = crypto.createHash('sha256').update(key).digest();
  const b = crypto.createHash('sha256').update(ADMIN_KEY).digest();
  if (!crypto.timingSafeEqual(a, b)) return res.status(403).json({ message: 'Forbidden.' });
  next();
}

app.get('/api/admin/pending', requireAdmin, (req, res) => {
  const pending = loadUsers()
    .filter((u) => u.approved === false)
    .map(({ orgName, role, email, createdAt }) => ({ orgName, role, email, createdAt }));
  res.json(pending);
});

app.post('/api/admin/approve', requireAdmin, (req, res) => {
  const { email } = req.body || {};
  if (!isString(email)) return res.status(400).json({ message: 'Email is required.' });

  const users = loadUsers();
  const user = users.find((u) => u.email === email.trim().toLowerCase());
  if (!user) return res.status(404).json({ message: 'User not found.' });

  user.approved = true;
  saveUsers(users);
  res.json({ message: `${user.email} approved.` });
});

// ---------- Start ----------
app.get('/', (req, res) => res.redirect('/login_page.html'));

initStorage()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`PharmaTrack running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Could not start (database problem):', err.message);
    process.exit(1);
  });
