import { openDatabase, hashPassword } from './db.mjs';
import { DEFAULT_POLICY } from './schema-v2.mjs';
export function seedUpgrades(db){
  // This helper only extends the fictional sample campus.
  if(!db.prepare("SELECT 1 FROM users WHERE email='student@academytrack.demo' AND reg_no='CIT/001/2026'").get())return;
  const find=email=>db.prepare('SELECT id FROM users WHERE email=?').get(email)?.id;
  function account(name,email,role,reg=null){if(find(email))return find(email);return Number(db.prepare('INSERT INTO users(name,email,reg_no,role,approved,password) VALUES(?,?,?,?,1,?)').run(name,email,reg,role,hashPassword('AcademyDemo2026!')).lastInsertRowid);}
  const department=account('Academic Office','department@academytrack.demo','lecturer'),finance=account('Finance Office','finance@academytrack.demo','lecturer');
  db.prepare('INSERT OR IGNORE INTO staff_roles VALUES(?,?)').run(department,'department');db.prepare('INSERT OR IGNORE INTO staff_roles VALUES(?,?)').run(finance,'finance');
  db.prepare('INSERT OR IGNORE INTO curriculum(course_id,semester) SELECT id,? FROM courses').run(DEFAULT_POLICY.semester);
  db.prepare("INSERT OR IGNORE INTO registrations(student_id,course_id,semester,status) SELECT student_id,course_id,?,'approved' FROM enrollments").run(DEFAULT_POLICY.semester);
  const exists=db.prepare('SELECT 1 FROM programmes WHERE name=?').get('ICT Technician · CBET sample');
  if(!exists){const rules={...DEFAULT_POLICY,institutionType:'technical_college',calendar:'term',resultMode:'competency',qualification:'ICT Technician (sample)',knqfLevel:6,awardingBody:'Institution / authorised assessment body',creditSystem:'Institution credit units',minCredits:6};delete rules.semester;delete rules.institution;delete rules.registrationDeadline;delete rules.reportDays;db.prepare('INSERT INTO programmes(name,body) VALUES(?,?)').run('ICT Technician · CBET sample',JSON.stringify(rules));}
  const programme=db.prepare('SELECT id FROM programmes WHERE name=?').get('ICT Technician · CBET sample').id;
  const tvet=account('Sam Njeri','tvet@academytrack.demo','student','TVET/001/2026');db.prepare('INSERT OR IGNORE INTO student_programmes VALUES(?,?)').run(tvet,programme);
  for(const c of db.prepare('SELECT id FROM courses WHERE code IN (?,?)').all('CIT101','CIT204')){
    db.prepare('INSERT OR IGNORE INTO enrollments VALUES(?,?)').run(tvet,c.id);
    db.prepare("INSERT OR IGNORE INTO registrations(student_id,course_id,semester,status) VALUES(?,?,?,'approved')").run(tvet,c.id,DEFAULT_POLICY.semester);
    db.prepare('INSERT OR IGNORE INTO curriculum VALUES(?,?,1,NULL,?)').run(c.id,DEFAULT_POLICY.semester,programme);
  }
  if(!db.prepare('SELECT 1 FROM notices LIMIT 1').get())db.prepare('INSERT INTO notices(author_id,title,body) VALUES(?,?,?)').run(department,'Welcome to the upgraded academic workspace','Check your unit registration, report missing marks with evidence, and follow decisions here. These are sample campus records.');
}
if(process.argv[1]?.endsWith('seed-v2.mjs')){const db=openDatabase();db.exec('BEGIN');try{seedUpgrades(db);db.exec('COMMIT');console.log('Sample-campus upgrades added without replacing existing records.');}catch(e){db.exec('ROLLBACK');throw e;}finally{db.close();}}
