import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import { openDatabase, hashPassword, verifyPassword, grade } from './db.mjs';
import { extended, role } from './upgrades.mjs';
import { policy, policyGrade } from './schema-v2.mjs';
const semester = '2026/2027 · Semester 1';
const digest = s => createHash('sha256').update(s).digest('hex');
const safeUser = u => ({id:u.id,name:u.name,email:u.email,reg_no:u.reg_no,role:u.role,approved:!!u.approved});
function fail(message,status=400) { throw Object.assign(new Error(message),{status}); }
function string(value,label,max=1000) { if(typeof value!=='string'||!value.trim()||value.trim().length>max) fail(`${label} is required (maximum ${max} characters).`); return value.trim(); }
function id(value) { if(!Number.isSafeInteger(Number(value))||Number(value)<1) fail('Invalid record ID.'); return Number(value); }
function score(value) { if(value===''||value==null||typeof value==='boolean'||!Number.isFinite(Number(value))||Number(value)<0||Number(value)>100) fail('Score must be between 0 and 100.'); return Number(value); }
async function body(req) { let raw=''; for await(const chunk of req) { raw+=chunk; if(Buffer.byteLength(raw)>600000) fail('Request is too large.',413); } try {return JSON.parse(raw||'{}');} catch {fail('Invalid JSON.');} }

export function createApp(db=openDatabase()) {
  const streams = new Map(); const attempts = new Map();
  function notify(userId,message) { db.prepare('INSERT INTO notifications(user_id,message) VALUES(?,?)').run(userId,message); }
  function refresh() { for(const [res,session] of streams) { if(!db.prepare('SELECT 1 FROM sessions WHERE token=? AND expires>?').get(session,Date.now())) {res.end();streams.delete(res);} else res.write('event: refresh\ndata: {}\n\n'); } }
  function owns(user,course) { const r=role(db,user);if(r==='department'&&db.prepare('SELECT 1 FROM courses WHERE id=?').get(course))return;if(r!=='lecturer'||!db.prepare('SELECT 1 FROM courses WHERE id=? AND lecturer_id=?').get(course,user.id)) fail('You cannot manage this course.',403); }
  function enrolled(student,course) { if(!db.prepare('SELECT 1 FROM enrollments WHERE student_id=? AND course_id=?').get(student,course)) fail('Student is not enrolled in this course.'); }
  function saveMark(user,b) {
    const course=id(b.course_id); owns(user,course); const student=id(b.student_id); enrolled(student,course);
    const term=string(b.semester,'Semester',80); const value=score(b.score);
    if(policy(db,term,student).resultMode==='competency')fail('Record a competency outcome for this programme, not a numeric mark.');
    if(!b.from_components)db.prepare('DELETE FROM assessments WHERE student_id=? AND course_id=? AND semester=?').run(student,course,term);
    const before=db.prepare('SELECT score FROM marks WHERE student_id=? AND course_id=? AND semester=?').get(student,course,term);
    db.prepare('INSERT INTO marks VALUES(?,?,?,?) ON CONFLICT(student_id,course_id,semester) DO UPDATE SET score=excluded.score').run(student,course,term,value);
    db.prepare('INSERT INTO audit(actor_id,action,detail) VALUES(?,?,?)').run(user.id,'mark-update',JSON.stringify({student,course,term,before:before?.score??null,after:value}));
    const c=db.prepare('SELECT code FROM courses WHERE id=?').get(course);
    notify(student,`${c.code}: your mark for ${term} is now ${value} (${policyGrade(db,value,term,student).letter}).`);
  }
  const upgrades=extended(db,{notify,owns,enrolled,saveMark});
  function state(user) {
    const r=role(db,user),department=r==='department';
    if(r==='finance')return upgrades.state(user,{user:safeUser(user),semester:policy(db).semester,courses:[],marks:[],reports:[],exams:[],students:[],fees:null,notifications:db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 100').all(user.id)});
    const courseSql=user.role==='student'?'c.id IN (SELECT course_id FROM enrollments WHERE student_id=?)':department?'? > 0':'c.lecturer_id=?';
    const courses=db.prepare(`SELECT c.*,u.name lecturer FROM courses c JOIN users u ON u.id=c.lecturer_id WHERE ${courseSql} ORDER BY c.code`).all(user.id);
    const marks=db.prepare(`SELECT m.*,c.code,c.name,c.credits,u.name student,u.reg_no FROM marks m JOIN courses c ON c.id=m.course_id JOIN users u ON u.id=m.student_id WHERE ${user.role==='student'?'m.student_id=?':department?'? > 0':'c.lecturer_id=?'}`).all(user.id).map(m=>({...m,...grade(m.score)}));
    const reports=db.prepare(`SELECT r.*,c.code,c.name course,u.name student FROM reports r JOIN courses c ON c.id=r.course_id JOIN users u ON u.id=r.student_id WHERE ${user.role==='student'?'r.student_id=?':department?'? > 0':'c.lecturer_id=?'} ORDER BY r.id DESC`).all(user.id);
    const exams=db.prepare(`SELECT e.*,c.code,c.name course FROM exams e JOIN courses c ON c.id=e.course_id WHERE ${courseSql} ORDER BY e.date`).all(user.id);
    const students=user.role==='lecturer'?db.prepare(`SELECT u.id,u.name,u.reg_no,e.course_id FROM enrollments e JOIN users u ON u.id=e.student_id JOIN courses c ON c.id=e.course_id WHERE ${department?'? > 0':'c.lecturer_id=?'} ORDER BY u.name`).all(user.id):[];
    return upgrades.state(user,{user:safeUser(user),semester,courses,marks,reports,exams,students,fees:db.prepare('SELECT * FROM fees WHERE student_id=?').get(user.id)||null,notifications:db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 100').all(user.id)});
  }
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    const json=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    try {
      const url=new URL(req.url,'http://localhost'); const path=url.pathname;
      if(!path.startsWith('/api/')) {
        if(req.method!=='GET') fail('Method not allowed.',405);
        const files={'/':'index.html','/app.js':'app.js','/upgrades-ui.js':'upgrades-ui.js','/sw.js':'sw.js','/styles.css':'styles.css','/upgrades.css':'upgrades.css','/favicon.svg':'favicon.svg','/manifest.webmanifest':'manifest.webmanifest'};
        if(!files[path]) fail('Page not found.',404);
        const type=path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.svg')?'image/svg+xml':path.endsWith('.webmanifest')?'application/manifest+json':'text/html';
        res.writeHead(200,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-cache'});res.end(await readFile(new URL('./public/'+files[path],import.meta.url)));return;
      }
      if(req.method!=='GET') {
        const expected=process.env.APP_ORIGIN||`http://${req.headers.host}`;
        if(req.headers.origin!==expected) fail('Request origin is not allowed.',403);
        if(!req.headers['content-type']?.startsWith('application/json')) fail('Use JSON requests.',415);
      }
      if(path==='/api/login'||path==='/api/signup') {
        if(req.method!=='POST') fail('Method not allowed.',405);
        const key=req.socket.remoteAddress; const now=Date.now();
        if(attempts.size>10000) for(const [k,v] of attempts) if(v.until<now) attempts.delete(k);
        let limit=attempts.get(key); if(!limit||limit.until<now) limit={n:0,until:now+900000};
        attempts.set(key,limit); if(++limit.n>40) fail('Too many attempts. Try again in 15 minutes.',429);
        const b=await body(req); let user;
        if(path==='/api/signup') {
          const name=string(b.name,'Full name',100), email=string(b.email,'Email',160).toLowerCase();
          if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Enter a valid email address.');
          if(typeof b.password!=='string'||b.password.length<10||b.password.length>128) fail('Use a password with 10–128 characters.');
          if(!['student','lecturer'].includes(b.role)) fail('Choose a valid role.');
          const reg=b.role==='student'?string(b.reg_no,'Registration number',60):null;
          if(db.prepare('SELECT 1 FROM users WHERE email=? OR reg_no=?').get(email,reg)) fail('Email or registration number already registered.',409);
          const created=db.prepare('INSERT INTO users(name,email,reg_no,role,approved,password) VALUES(?,?,?,?,?,?)').run(name,email,reg,b.role,b.role==='student'?1:0,hashPassword(b.password));
          user=db.prepare('SELECT * FROM users WHERE id=?').get(created.lastInsertRowid);
          // Enrollment is assigned by the institution; signup does not grant access to arbitrary courses.
          notify(user.id,b.role==='student'?'Welcome! Contact your department to enroll in your courses.':'Your lecturer account is awaiting institutional approval.');
        } else {
          const identity=string(b.identity,'Email or registration number',160);
          if(typeof b.password!=='string'||b.password.length>128) fail('Invalid login.',401);
          user=db.prepare('SELECT * FROM users WHERE email=? OR reg_no=?').get(identity,identity);
          if(!user||!verifyPassword(b.password,user.password)) fail('Email, registration number, or password is incorrect.',401);
        }
        const token=randomBytes(32).toString('hex'); db.prepare('DELETE FROM sessions WHERE expires<=?').run(now);
        db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token),user.id,now+7*86400000);
        res.setHeader('Set-Cookie',`academy_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${process.env.NODE_ENV==='production'?'; Secure':''}`);
        json({user:safeUser(user)});return;
      }
      const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('academy_session='))?.slice(16)||'';
      const session=digest(token);
      const user=db.prepare('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?').get(session,Date.now());
      if(!user) fail('Please sign in.',401);
      if(path==='/api/logout'&&req.method==='POST') {db.prepare('DELETE FROM sessions WHERE token=?').run(session);res.setHeader('Set-Cookie','academy_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');refresh();json({ok:true});return;}
      if(path==='/api/state'&&req.method==='GET') {json(user.approved?state(user):{user:safeUser(user)});return;}
      if(!user.approved) fail('Your lecturer account is awaiting approval.',403);
      if(req.method==='GET'&&path.startsWith('/api/evidence/')){await upgrades.handle(path,user,{},req,res);return;}
      if(path==='/api/events'&&req.method==='GET') {
        res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive'});res.write(': connected\n\n');streams.set(res,session);
        const heartbeat=setInterval(()=>{if(!db.prepare('SELECT 1 FROM sessions WHERE token=? AND expires>?').get(session,Date.now())) res.end();else res.write(': heartbeat\n\n');},25000);
        res.on('close',()=>{clearInterval(heartbeat);streams.delete(res);});return;
      }
      if(req.method!=='POST') fail('Endpoint not found.',404);
      const b=await body(req);
      if(await upgrades.handle(path,user,b,req,res)){refresh();json({ok:true});return;}
      if(path==='/api/reports') {
        if(user.role!=='student') fail('Only students can submit reports.',403);
        const course=id(b.course_id);enrolled(user.id,course);const term=string(b.semester,'Semester',80);
        if(db.prepare("SELECT 1 FROM reports WHERE student_id=? AND course_id=? AND semester=? AND status='pending'").get(user.id,course,term)) fail('You already have an open report for this unit and semester.',409);
        const remarks=string(b.remarks,'Remarks',2000);const c=db.prepare('SELECT * FROM courses WHERE id=?').get(course);
        db.exec('BEGIN');try{const result=db.prepare('INSERT INTO reports(student_id,course_id,semester,remarks) VALUES(?,?,?,?)').run(user.id,course,term,remarks);upgrades.createdReport(user,Number(result.lastInsertRowid),b.file);db.prepare('DELETE FROM drafts WHERE user_id=?').run(user.id);notify(c.lecturer_id,`${user.name} reported a missing mark for ${c.code}.`);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
      } else if(path==='/api/reports/resolve') {
        const report=db.prepare('SELECT * FROM reports WHERE id=?').get(id(b.id));if(!report) fail('Report not found.',404);owns(user,report.course_id);
        if(report.status==='resolved') fail('This report is already resolved.',409);
        const response=string(b.response,'Response',2000);
        db.exec('BEGIN');try{
          if(b.score!==''&&b.score!=null) saveMark(user,{...report,score:b.score});
          db.prepare("UPDATE reports SET status='resolved',response=? WHERE id=?").run(response,report.id);
          upgrades.resolvedReport(user,report.id,response);
          notify(report.student_id,`Your missing-mark report has been resolved: ${response}`);db.exec('COMMIT');
        }catch(e){db.exec('ROLLBACK');throw e;}
      } else if(path==='/api/marks') {
        if(!Array.isArray(b.rows)||!b.rows.length||b.rows.length>500) fail('Provide between 1 and 500 marks.');
        db.exec('BEGIN');try{for(const row of b.rows) saveMark(user,row);notify(user.id,`${b.rows.length} student mark(s) saved.`);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
      } else if(path==='/api/exams') {
        const course=id(b.course_id);owns(user,course);
        const title=string(b.title,'Exam title',100),venue=string(b.venue,'Venue',160),date=string(b.date,'Date',30);
        if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))) fail('Enter a valid exam date and time.');
        if(b.id) {const existing=db.prepare('SELECT * FROM exams WHERE id=?').get(id(b.id));if(!existing) fail('Exam not found.',404);owns(user,existing.course_id);}
        db.exec('BEGIN');try{
          if(b.id) db.prepare('UPDATE exams SET course_id=?,title=?,date=?,venue=? WHERE id=?').run(course,title,date,venue,b.id);
          else db.prepare('INSERT INTO exams(course_id,title,date,venue) VALUES(?,?,?,?)').run(course,title,date,venue);
          for(const s of db.prepare('SELECT student_id FROM enrollments WHERE course_id=?').all(course)) notify(s.student_id,`${title} scheduled for ${date.replace('T',' ')} at ${venue}.`);
          db.exec('COMMIT');
        }catch(e){db.exec('ROLLBACK');throw e;}
      } else if(path==='/api/notifications/read') {db.prepare('UPDATE notifications SET read=1 WHERE user_id=?').run(user.id);}
      else fail('Endpoint not found.',404);
      refresh();json({ok:true});
    } catch(e) {if(!e.status) console.error(e);if(!res.headersSent) json({error:e.status?e.message:'Something went wrong. Please try again.'},e.status||500);else res.end();}
  });
  server.on('close',()=>{for(const res of streams.keys()) res.end();});
  return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const server=createApp();const port=Number(process.env.PORT||3000);
  server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`AcademyTrack ready at http://localhost:${port}`));
}
