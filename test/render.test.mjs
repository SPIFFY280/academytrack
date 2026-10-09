import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../db.mjs';
import {seed} from '../seed.mjs';
import {createApp} from '../server.mjs';
import {createUpgrades} from '../public/upgrades-ui.js';

test('new workspace screens render with real API data for every supported role',async()=>{
  const db=openDatabase(':memory:');seed(db);const server=createApp(db);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  try{
    for(const name of ['student','lecturer','department','finance','tvet']){
      const login=await fetch(origin+'/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({identity:name+'@academytrack.demo',password:'AcademyDemo2026!'})});
      assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
      const response=await fetch(origin+'/api/state',{headers:{Cookie:cookie}});assert.equal(response.status,200);const data=await response.json();
      const renderer=createUpgrades({data,term:()=>data.semester,$:()=>null,escape,icon:()=>'',tag:escape,empty:escape,heading:(a,b)=>a+b,modal:()=>{},api:()=>{},toast:()=>{},reload:()=>{},money:v=>'KES '+v,date:v=>String(v),metric:(...args)=>args.join(' ')});
      for(const [page] of renderer.nav()){
        const html=renderer.content(page);
        if(html!==null){assert.equal(typeof html,'string',`${name}/${page}`);assert.ok(html.length>0,`${name}/${page} must have content`);assert.ok(!html.includes('[object Object]'),`${name}/${page} must not expose objects`);}
      }
      if(name==='tvet')assert.match(renderer.content('grades'),/Competency/);
    }
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));db.close();}
});
