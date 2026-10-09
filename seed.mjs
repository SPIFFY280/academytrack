import { openDatabase, hashPassword } from './db.mjs';
import { seedUpgrades } from './seed-v2.mjs';
export function seed(db) {
  if (db.prepare('SELECT COUNT(*) n FROM users').get().n) return false;
  db.exec('BEGIN');
  try {
    const insert = db.prepare('INSERT INTO users(name,email,reg_no,role,approved,password) VALUES(?,?,?,?,1,?)');
    const password = hashPassword('AcademyDemo2026!');
    insert.run('Dr. Amina Wanjiku', 'lecturer@academytrack.demo', null, 'lecturer', password);
    insert.run('Alex Morgan', 'student@academytrack.demo', 'CIT/001/2026', 'student', password);
    insert.run('Grace Otieno', 'grace@academytrack.demo', 'CIT/002/2026', 'student', password);
    insert.run('Brian Kamau', 'brian@academytrack.demo', 'CIT/003/2026', 'student', password);
    const courses = [['CIT101','Introduction to Programming'],['CIT202','Database Systems'],['MAT201','Discrete Mathematics'],['CIT204','Computer Networks'],['COM101','Communication Skills'],['CIT206','Web Development']];
    courses.forEach(([code,name]) => db.prepare('INSERT INTO courses(code,name,lecturer_id) VALUES(?,?,1)').run(code,name));
    for (let s=2;s<=4;s++) for(let c=1;c<=6;c++) {
      db.prepare('INSERT INTO enrollments VALUES(?,?)').run(s,c);
      if (!(s===2 && c===4)) db.prepare('INSERT INTO marks VALUES(?,?,?,?)').run(s,c,'2026/2027 · Semester 1', [84,78,69,72,88,76][c-1] - (s-2)*5);
    }
    const future = days => new Date(Date.now()+days*86400000).toISOString().slice(0,10);
    db.prepare('INSERT INTO exams(course_id,title,date,venue) VALUES(?,?,?,?)').run(2,'End of semester exam',future(8)+'T09:00','Main Hall · Room 204');
    db.prepare('INSERT INTO exams(course_id,title,date,venue) VALUES(?,?,?,?)').run(1,'Practical assessment',future(12)+'T11:00','Computing Lab 2');
    for(let s=2;s<=4;s++) db.prepare('INSERT INTO fees VALUES(?,?,?,?)').run(s,65000,s===2?45000:65000,future(14));
    db.prepare('INSERT INTO notifications(user_id,message) VALUES(2,?)').run('Welcome to AcademyTrack. Your academic journey, all in one place.');
    seedUpgrades(db);
    db.exec('COMMIT'); return true;
  } catch(e) { db.exec('ROLLBACK'); throw e; }
}
if (process.argv[1]?.endsWith('seed.mjs')) { const db=openDatabase(); console.log(seed(db)?'Sample data created. Password: AcademyDemo2026!':'Database already contains users; nothing changed.'); db.close(); }
