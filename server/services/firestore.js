import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'local-db.json');

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ visits: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

console.log("Using local JSON file storage (local-db.json) — Firestore bypassed for now.");

export async function saveVisitData(data) {
  const db = readDB();
  const id = "visit_" + Date.now();
  const record = { id, ...data, timestamp: new Date().toISOString() };
  db.visits.unshift(record);
  writeDB(db);
  return { id };
}

export async function getVisits() {
  const db = readDB();
  return db.visits.slice(0, 10);
}