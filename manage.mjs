import { openDatabase } from './db.mjs';
const [command,...args]=process.argv.slice(2);
const db=openDatabase();
function user(email,role){const u=db.prepare('SELECT * FROM users WHERE email=? AND role=?').get(email,role);if(!u)throw new Error(`${role} account not found: ${email}`);return u;}
function course(code){const c=db.prepare('SELECT * FROM courses WHERE code=?').get(code);if(!c)throw new Error('Course not found: '+code);return c;}
try{
  if(command==='users')console.table(db.prepare('SELECT id,name,email,reg_no,role,approved FROM users').all());
  else if(command==='courses')console.table(db.prepare('SELECT id,code,name,lecturer_id,credits FROM courses').all());
  else if(command==='approve'){if(!args[0])throw new Error('Provide a lecturer email.');const u=user(args[0],'lecturer');db.prepare('UPDATE users SET approved=1 WHERE id=?').run(u.id);console.log('Lecturer approved.');}
  else if(command==='staff'){const [email,role]=args;if(!['department','finance','lecturer'].includes(role))throw new Error('Choose department, finance, or lecturer.');const u=user(email,'lecturer');if(role==='lecturer')db.prepare('DELETE FROM staff_roles WHERE user_id=?').run(u.id);else db.prepare('INSERT INTO staff_roles VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role').run(u.id,role);db.prepare('UPDATE users SET approved=1 WHERE id=?').run(u.id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(u.id);console.log('Role assigned. User must sign in again.');}
  else if(command==='course'){
    const [code,name,email,creditText='3']=args;const credits=Number(creditText);
    if(!code||!name||!email||!Number.isInteger(credits)||credits<1||credits>30)throw new Error('Provide course code, quoted name, lecturer email, and credits (1–30).');
    const lecturer=user(email,'lecturer');if(!lecturer.approved)throw new Error('Approve the lecturer first.');
    db.prepare('INSERT INTO courses(code,name,lecturer_id,credits) VALUES(?,?,?,?) ON CONFLICT(code) DO UPDATE SET name=excluded.name,lecturer_id=excluded.lecturer_id,credits=excluded.credits').run(code,name,lecturer.id,credits);console.log('Course saved.');
  }else if(command==='enroll'){
    const [email,code]=args;if(!email||!code)throw new Error('Provide student email and course code.');
    db.prepare('INSERT OR IGNORE INTO enrollments VALUES(?,?)').run(user(email,'student').id,course(code).id);console.log('Student enrolled.');
  }else if(command==='fees'){
    const [email,totalText,paidText,deadline]=args;const total=Number(totalText),paid=Number(paidText);
    if(!email||totalText===undefined||paidText===undefined||!Number.isSafeInteger(total)||!Number.isSafeInteger(paid)||total<0||paid<0||paid>total||!/^\d{4}-\d{2}-\d{2}$/.test(deadline)||!Number.isFinite(Date.parse(deadline)))throw new Error('Provide student email, total and paid amounts in whole KES (0 ≤ paid ≤ total), and deadline YYYY-MM-DD.');
    db.prepare('INSERT INTO fees VALUES(?,?,?,?) ON CONFLICT(student_id) DO UPDATE SET total=excluded.total,paid=excluded.paid,deadline=excluded.deadline').run(user(email,'student').id,total,paid,deadline);console.log('Fee statement saved.');
  }else console.log('Commands:\n  node manage.mjs users\n  node manage.mjs courses\n  node manage.mjs approve lecturer@example.edu\n  node manage.mjs course CIT101 "Programming" lecturer@example.edu 3\n  node manage.mjs enroll student@example.edu CIT101\n  node manage.mjs fees student@example.edu 65000 45000 2026-11-01');
}catch(e){console.error(e.message);process.exitCode=1;}finally{db.close();}
