export function words(s){return s.match(/\S+/g)||[]}
export function tokens(s){return s.toLowerCase().match(/[a-z0-9]+/g)||[]}
export function sections(source){
 const lines=source.split(/\r?\n/), headings=[];
 lines.forEach((line,i)=>{const m=line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);if(m)headings.push({level:m[1].length,title:m[2].trim(),line:i})});
 if(!headings.length)return [{title:'Untitled',start:0,end:words(source).length,text:source}];
 const result=[];
 for(let i=0;i<headings.length;i++){
  const h=headings[i];let endLine=lines.length;
  for(let j=i+1;j<headings.length;j++)if(headings[j].level<=h.level){endLine=headings[j].line;break}
  result.push({title:h.title,start:words(lines.slice(0,h.line).join('\n')).length,end:words(lines.slice(0,endLine).join('\n')).length,text:lines.slice(h.line,endLine).join('\n')});
 }
 return result;
}
export function chunk(source,strategy,size=70,overlap=15){
 if(!Number.isInteger(size)||!Number.isInteger(overlap)||size<=0||overlap<0||overlap>=size)throw Error('Invalid chunk settings');
 if(!['fixed','heading-aware'].includes(strategy))throw Error('Invalid strategy');
 const out=[];
 if(strategy==='fixed'){
  const w=words(source);
  for(let i=0;i<w.length;i+=size-overlap){const end=Math.min(w.length,i+size);out.push({text:w.slice(i,end).join(' '),start:i,end});if(end===w.length)break}
 }else{
  for(const s of sections(source)){
   const w=words(s.text);
   for(let i=0;i<w.length;i+=size-overlap){const end=Math.min(w.length,i+size);out.push({text:w.slice(i,end).join(' '),start:s.start+i,end:s.start+end,section:s.title});if(end===w.length)break}
  }
 }
 return out;
}
export function bm25(chunks,query,k1=1.2,b=.75){
 const docs=chunks.map(c=>tokens(c.text)),N=docs.length,avg=docs.reduce((n,d)=>n+d.length,0)/Math.max(N,1),df=new Map();
 for(const d of docs)for(const t of new Set(d))df.set(t,(df.get(t)||0)+1);
 return chunks.map((c,i)=>{
  const tf=new Map();for(const t of docs[i])tf.set(t,(tf.get(t)||0)+1);
  let score=0;for(const t of new Set(tokens(query))){const f=tf.get(t)||0;if(!f)continue;const n=df.get(t)||0,idf=Math.log(1+(N-n+.5)/(n+.5));score+=idf*f*(k1+1)/(f+k1*(1-b+b*docs[i].length/Math.max(avg,1)))}
  return {...c,score,index:i};
 }).sort((a,b)=>b.score-a.score||a.index-b.index);
}
export function evaluate(source,queries,strategy,k=3){
 if(!source.trim())throw Error('Empty corpus');
 if(!Array.isArray(queries)||!queries.length)throw Error('At least one query required');
 if(!Number.isInteger(k)||k<1)throw Error('Invalid k');
 const ss=sections(source),cs=chunk(source,strategy);
 const results=queries.map(q=>{
  if(typeof q.query!=='string'||!q.query.trim()||typeof q.heading!=='string'||!q.heading.trim())throw Error('Each query needs query and heading');
  const matches=ss.filter(s=>s.title.toLowerCase()===q.heading.toLowerCase());
  if(matches.length!==1)throw Error('Heading label must uniquely identify a section: '+q.heading);
  const target=matches[0],top=bm25(cs,q.query).slice(0,k).map((c,i)=>({rank:i+1,relevant:strategy==='fixed'?c.start<target.end&&c.end>target.start:c.section.toLowerCase()===target.title.toLowerCase(),score:c.score,excerpt:c.text,start:c.start,end:c.end}));
  const first=top.find(t=>t.relevant);
  return {query:q.query,heading:q.heading,top,hit:first?1:0,reciprocalRank:first?1/first.rank:0};
 });
 return {strategy,k,chunkCount:cs.length,queryCount:queries.length,recallAtK:results.reduce((a,r)=>a+r.hit,0)/results.length,mrrAtK:results.reduce((a,r)=>a+r.reciprocalRank,0)/results.length,results};
}