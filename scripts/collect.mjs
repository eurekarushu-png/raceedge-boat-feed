import fs from "node:fs/promises";
const venues={"01":"桐生","02":"戸田","03":"江戸川","04":"平和島","05":"多摩川","06":"浜名湖","07":"蒲郡","08":"常滑","09":"津","10":"三国","11":"びわこ","12":"住之江","13":"尼崎","14":"鳴門","15":"丸亀","16":"児島","17":"宮島","18":"徳山","19":"下関","20":"若松","21":"芦屋","22":"福岡","23":"唐津","24":"大村"};
const jst=new Date(Date.now()+9*3600e3).toISOString().slice(0,10),date=process.env.RACE_DATE||jst,hd=date.replaceAll("-","");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const decode=s=>s.replace(/&nbsp;|&#160;/gi," ").replace(/&yen;|&#165;/gi,"¥").replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&#x([0-9a-f]+);/gi,(_,x)=>String.fromCodePoint(parseInt(x,16))).replace(/&#(\d+);/g,(_,x)=>String.fromCodePoint(Number(x)));
const clean=h=>decode(h).replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<br\s*\/?>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
const num=v=>v==null?null:Number(String(v).replaceAll(",",""));
const normName=s=>s.replace(/\s+/g," ").trim();
const diagnostics={version:"2.4",requests:0,httpErrors:0,parseMiss:{entries:0,exhibition:0,odds:0,results:0},samples:{}};
async function get(page,jcd,rno){
 const u=`https://www.boatrace.jp/owpc/pc/race/${page}?hd=${hd}&jcd=${jcd}&rno=${rno}`; diagnostics.requests++;
 const r=await fetch(u,{headers:{"user-agent":"Mozilla/5.0 (compatible; RaceEdge-Free-Collector/2.4)",accept:"text/html,application/xhtml+xml"}});
 if(!r.ok){diagnostics.httpErrors++;return null} const html=await r.text(); return {html,text:clean(html),url:u};
}
function racers(src,jcd,race){
 if(!src)return null; const t=src.text,out=[];
 // Current official racelist: boat -> racerNo / class -> name -> branch/origin -> age/weight -> F/L/ST -> national/local -> motor/boat.
 const rx=/([1-6])\s+(\d{4})\s*\/\s*(A1|A2|B1|B2)\s+(.+?)\s+([^\s/]+)\s*\/\s*([^\s/]+)\s+(\d{1,2})歳\s*\/\s*([\d.]+)kg\s+F(\d+)\s+L(\d+)\s+(0?\.\d{2})\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+(\d+)\s+([\d.-]+)\s+([\d.-]+)\s+(\d+)\s+([\d.-]+)\s+([\d.-]+)/g;
 let m; while((m=rx.exec(t))&&out.length<6){out.push({boat:+m[1],racerNo:m[2],class:m[3],name:normName(m[4]),branch:m[5],origin:m[6],age:+m[7],weight:num(m[8]),F:+m[9],L:+m[10],avgST:num(m[11]),national:{winRate:num(m[12]),twoRate:num(m[13]),threeRate:num(m[14])},local:{winRate:num(m[15]),twoRate:num(m[16]),threeRate:num(m[17])},motor:{no:+m[18],twoRate:num(m[19]),threeRate:num(m[20])},boatStats:{no:+m[21],twoRate:num(m[22]),threeRate:num(m[23])}})}
 // Fallback: preserve at least the six official entrants even if detailed table formatting changes.
 if(out.length!==6){out.length=0; const rx2=/(\d{4})\s*\/\s*(A1|A2|B1|B2)\s+(.+?)\s+[^\s/]+\s*\/\s*[^\s/]+\s+\d{1,2}歳\s*\/\s*[\d.]+kg/g; while((m=rx2.exec(t))&&out.length<6)out.push({boat:out.length+1,racerNo:m[1],class:m[2],name:normName(m[3])});}
 if(out.length!==6){diagnostics.parseMiss.entries++; if(!diagnostics.samples.entries)diagnostics.samples.entries=t.slice(0,1200);return null}
 return {date,jcd,venue:venues[jcd],race,racers:out,source:"BOAT RACE official",fetchedAt:new Date().toISOString()};
}
function exhibition(src,jcd,race){
 if(!src)return null; const t=src.text,rows=[]; let section=t;
 const p=t.indexOf("展示タイム"); if(p>=0)section=t.slice(Math.max(0,p-1800),p+5000);
 // Official beforeinfo contains six exhibition times in the 6.xx-7.xx range. Prefer boat/time pairs; fall back to ordered six values.
 let m,seen=new Set(); const pair=/([1-6])\s+([67]\.\d{2})/g; while((m=pair.exec(section))){if(!seen.has(m[1])){seen.add(m[1]);rows.push({boat:+m[1],exhibitionTime:num(m[2])})}if(rows.length===6)break}
 if(rows.length<6){rows.length=0; const vals=[...section.matchAll(/(?<![\d.])([67]\.\d{2})(?!\d)/g)].map(x=>num(x[1])); const plausible=vals.filter(v=>v>=6&&v<8); if(plausible.length>=6)for(let i=0;i<6;i++)rows.push({boat:i+1,exhibitionTime:plausible[i]});}
 if(rows.length!==6){diagnostics.parseMiss.exhibition++;if(!diagnostics.samples.exhibition)diagnostics.samples.exhibition=section.slice(0,1400);return null}
 return {date,jcd,venue:venues[jcd],race,boats:rows,source:"BOAT RACE official",fetchedAt:new Date().toISOString()};
}
function odds3t(src,jcd,race){
 if(!src)return null; const t=src.text,values={}; let m;
 // Pattern A: explicit 1-2-3 12.3 style.
 const explicit=/([1-6])\s*[-－]\s*([1-6])\s*[-－]\s*([1-6])\s+(\d+(?:\.\d+)?)/g;
 while((m=explicit.exec(t)))if(new Set([m[1],m[2],m[3]]).size===3)values[`${m[1]}-${m[2]}-${m[3]}`]=num(m[4]);
 // Pattern B: official odds HTML commonly carries combination identifiers in attributes/classes next to the odds value.
 if(Object.keys(values).length<100){const h=decode(src.html); const attr=/(?:data-(?:combination|kumi|odds)|id|class)=["'][^"']*?([1-6])[-_]?([1-6])[-_]?([1-6])[^"']*["'][^>]*>[\s\S]{0,180}?(\d+(?:\.\d+)?)/gi; while((m=attr.exec(h))){if(new Set([m[1],m[2],m[3]]).size===3)values[`${m[1]}-${m[2]}-${m[3]}`]=num(m[4]);}}
 if(!Object.keys(values).length){diagnostics.parseMiss.odds++;if(!diagnostics.samples.odds)diagnostics.samples.odds=t.slice(Math.max(0,t.indexOf("3連単オッズ")),Math.max(0,t.indexOf("3連単オッズ"))+1800);return null}
 return {date,jcd,venue:venues[jcd],race,type:"trifecta",values,source:"BOAT RACE official",fetchedAt:new Date().toISOString()};
}
function result(src,jcd,race){if(!src)return null;const t=src.text,m=t.match(/3連単\s*([1-6])\s*[-－]\s*([1-6])\s*[-－]\s*([1-6])\s*[¥￥]\s*([\d,]+)/);if(!m){diagnostics.parseMiss.results++;return null}return {date,jcd,venue:venues[jcd],race,trifecta:`${m[1]}-${m[2]}-${m[3]}`,payout100:num(m[4]),winningMethod:(t.match(/決まり手\s*(逃げ|差し|まくり差し|まくり|抜き|恵まれ)/)||[])[1]||null,source:"BOAT RACE official",fetchedAt:new Date().toISOString()}}
const feed={schema:"raceedge-feed-1",generatedAt:new Date().toISOString(),date,source:"BOAT RACE official via Race Edge GitHub collector 2.4",entries:[],exhibition:[],odds:[],results:[]};
for(const jcd of Object.keys(venues))for(let race=1;race<=12;race++){try{const [e,x,o,r]=await Promise.all([get("racelist",jcd,race),get("beforeinfo",jcd,race),get("odds3t",jcd,race),get("raceresult",jcd,race)]);const a=racers(e,jcd,race),b=exhibition(x,jcd,race),c=odds3t(o,jcd,race),d=result(r,jcd,race);if(a)feed.entries.push(a);if(b)feed.exhibition.push(b);if(c)feed.odds.push(c);if(d)feed.results.push(d)}catch(e){console.warn("collector",jcd,race,e.message)}await sleep(180)}
await fs.mkdir("public",{recursive:true});
const counts={entries:feed.entries.length,exhibition:feed.exhibition.length,odds:feed.odds.length,results:feed.results.length};
await fs.writeFile("public/raceedge-feed.json",JSON.stringify(feed,null,2));
await fs.writeFile("public/status.json",JSON.stringify({ok:true,date,generatedAt:feed.generatedAt,counts,diagnostics},null,2));
console.log("Race Edge feed counts",counts.entries,counts.exhibition,counts.odds,counts.results);
console.log("Race Edge diagnostics",JSON.stringify({requests:diagnostics.requests,httpErrors:diagnostics.httpErrors,parseMiss:diagnostics.parseMiss}));
