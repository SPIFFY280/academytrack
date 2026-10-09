import { openDatabase } from './db.mjs';
const email=process.argv[2];
if (!email) { console.error('Usage: node approve.mjs lecturer@example.edu'); process.exit(1); }
const db=openDatabase();
const result=db.prepare("UPDATE users SET approved=1 WHERE email=? AND role='lecturer'").run(email);
console.log(result.changes ? 'Lecturer approved. Assign courses using the database before entering marks.' : 'Lecturer account not found.');
db.close();
