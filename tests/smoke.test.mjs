import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const root=new URL('../',import.meta.url);
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../src/app.mjs',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
test('entrypoint references real local modules and styles',()=>{
 assert.match(html,/src="\/src\/app\.mjs"/);
 assert.match(html,/href="\/src\/style\.css"/);
 assert.ok(js.length>5000);
 assert.ok(css.length>3000);
});
test('core navigation and upload controls exist',()=>{
 for(const id of ['file','doc','auditBtn','panel','score','gauge','toast'])assert.match(html,new RegExp('id="'+id+'"'));
 for(const tab of ['findings','improvements','benchmark','history','export'])assert.match(html,new RegExp('data-tab="'+tab+'"'));
});
test('retrieval engine imported rather than duplicated inline',()=>{
 assert.match(js,/from ['"]\.\/retrieval\.mjs['"]/);
});