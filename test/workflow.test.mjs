import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,grade} from '../db.mjs';
import {seed} from '../seed.mjs';
import {createApp} from '../server.mjs';

test('academic workflow, persistent records and authorization boundaries',async()=>{
  const db=openDatabase(':memory:');seed(db);const server=createApp(db);
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
  async function request(path,body,cookie='',extra={}){
    const res=await fetch(origin+'/api/'+path,{method:body?'POST':'GET',headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),Cookie:cookie,...extra},body:body?JSON.stringify(body):undefined});
    return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};
  }
  try{
    assert.equal((await request('state')).status,401);
    assert.equal((await request('login',{identity:'student@academytrack.demo',password:'wrong'})).status,401);
    const student=await request('login',{identity:'CIT/001/2026',password:'AcademyDemo2026!'});assert.equal(student.status,200);assert.ok(student.cookie);
    const lecturer=await request('login',{identity:'lecturer@academytrack.demo',password:'AcademyDemo2026!'});assert.equal(lecturer.status,200);
    const s=student.cookie,l=lecturer.cookie;const snapshot=(await request('state',undefined,s)).data;
    assert.equal(snapshot.marks.length,5);assert.ok(snapshot.marks.every(m=>m.student_id===2));assert.equal(snapshot.students.length,0);
    assert.equal((await request('reports',{course_id:4,semester:snapshot.semester,remarks:'Coursework not showing'},s,{Origin:'https://evil.example'})).status,403);
    const eventAbort=new AbortController();const eventResponse=await fetch(origin+'/api/events',{headers:{Cookie:s},signal:eventAbort.signal});const reader=eventResponse.body.getReader();await reader.read();
    const report=await request('reports',{course_id:4,semester:snapshot.semester,remarks:'Coursework not showing'},s);assert.equal(report.status,200);
    const next=await reader.read();assert.match(new TextDecoder().decode(next.value),/event: refresh/);eventAbort.abort();
    assert.equal((await request('reports',{course_id:4,semester:snapshot.semester,remarks:'Duplicate'},s)).status,409);
    const ls=(await request('state',undefined,l)).data;assert.equal(ls.reports.length,1);assert.match(ls.notifications[0].message,/missing mark/);
    assert.equal((await request('reports/resolve',{id:ls.reports[0].id,response:'Forged',score:100},s)).status,403);
    assert.equal((await request('marks',{rows:[{student_id:2,course_id:1,semester:snapshot.semester,score:100}]},s)).status,403);
    assert.equal((await request('reports/resolve',{id:ls.reports[0].id,response:'Assignment checked; mark restored.',score:82},l)).status,200);
    const updated=(await request('state',undefined,s)).data;assert.equal(updated.reports[0].status,'resolved');assert.equal(updated.marks.find(m=>m.course_id===4).score,82);assert.match(updated.notifications[0].message,/resolved/);
    assert.equal((await request('reports/resolve',{id:ls.reports[0].id,response:'Again'},l)).status,409);
    const before=db.prepare('SELECT score FROM marks WHERE student_id=2 AND course_id=1').get().score;
    assert.equal((await request('marks',{rows:[{student_id:2,course_id:1,semester:snapshot.semester,score:90},{student_id:2,course_id:2,semester:snapshot.semester,score:101}]},l)).status,400);
    assert.equal(db.prepare('SELECT score FROM marks WHERE student_id=2 AND course_id=1').get().score,before,'batch must roll back all rows');
    assert.equal((await request('exams',{course_id:1,title:'Final',venue:'Hall',date:'2026-12-01T10:00'},l)).status,200);
    assert.equal((await request('exams',{course_id:1,title:'Forged',venue:'Hall',date:'2026-12-01T10:00'},s)).status,403);
    const newLecturer=await request('signup',{name:'New lecturer',email:'new@university.edu',role:'lecturer',password:'LongPassword123!'});assert.equal(newLecturer.status,200);assert.equal(newLecturer.data.user.approved,false);
    assert.equal((await request('marks',{rows:[{student_id:2,course_id:1,semester:snapshot.semester,score:90}]},newLecturer.cookie)).status,403);
    db.prepare('UPDATE users SET approved=1 WHERE email=?').run('new@university.edu');
    assert.equal((await request('marks',{rows:[{student_id:2,course_id:1,semester:snapshot.semester,score:90}]},newLecturer.cookie)).status,403,'approved lecturers cannot edit another lecturer’s course');
    const newbie=await request('signup',{name:'New Student',email:'newstudent@university.edu',reg_no:'NEW/01',role:'student',password:'LongPassword123!'});assert.equal(newbie.status,200);
    assert.equal((await request('reports',{course_id:1,semester:snapshot.semester,remarks:'Not enrolled'},newbie.cookie)).status,400);
    assert.equal((await request('state',undefined,newbie.cookie)).data.marks.length,0);
    await request('notifications/read',{},s);assert.ok((await request('state',undefined,s)).data.notifications.every(n=>n.read));
    await request('logout',{},s);assert.equal((await request('state',undefined,s)).status,401);
    assert.ok(!JSON.stringify(updated).includes('password'));
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));db.close();}
});
test('grading boundaries and missing marks',()=>{assert.equal(grade(80).points,4);assert.equal(grade(75).letter,'B+');assert.equal(grade(0).points,0);assert.equal(grade(null).points,null);});
