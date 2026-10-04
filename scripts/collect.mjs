import fs from "node:fs/promises";
const venues={"01":"桐生","02":"戸田","03":"江戸川","04":"平和島","05":"多摩川","06":"浜名湖","07":"蒲郡","08":"常滑","09":"津","10":"三国","11":"びわこ","12":"住之江","13":"尼崎","14":"鳴門","15":"丸亀","16":"児島","17":"宮島","18":"徳山","19":"下関","20":"若松","21":"芦屋","22":"福岡","23":"唐津","24":"大村"};
const jst=new Date(Date.now()+9*3600e3).toISOString().slice(0,10), date=process.env.RACE_DATE||jst, hd=date.replaceAll("-","");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clean=h=>h.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/g," ").replace(/&yen;|&#165;/g,"¥").replace(/&amp;/g,"&").replace(/\s+/g," ").trim();
const num=v=>v==null?null:Number(String(v).replaceAll(",",""));
async function get(page,jcd,rno){
 const u=`https://www.boatrace.jp/owpc/pc/race/${page}?hd=${hd}&jcd=${jcd}&rno=${rno}`;
 const r=await fetch(u,{headers:{"user-agent":"RaceEdge-Free-Collector/2.3","accept":"text/html"}});
 if(!r.ok)return null; return clean(await r.text());
}
function racers(t,jcd,race){
 if(!t)return null;
 const out=[];
 // Official pages contain racer number/name and common performance figures. Keep only confidently parsed rows.
 const rx=/([1-6])\s+(\d{4})\s+([^\d]{2,20}?)\s+(?:\d{2,3})\s*[\/／]\s*(?:\d{2,3})\s+([\d.]+)\s+([\d.]+)/g;
 let m; while((m=rx.exec(t))&&out.length<6) out.push({boat:Number(m[1]),racerNo:m[2],name:m[3].trim(),winRate:num(m[4]),localWinRate:num(m[5])});
 return out.length===6?{date,jcd,venue:venues[jcd],race,racers:out,source:"BOAT RACE official",fetchedAt:new Date().toISOString()}:null;
}
function exhibition(t,jcd,race){
 if(!t)return null; const rows=[];
 // Conservative extraction: boat + exhibition time around the exhibition section.
 const section=(t.match(/展示タイム([\s\S]{0,2500})/)||[])[1]||"";
 const rx=/([1-6])\s+([6-7]\.\d{2})/g; let m,seen=new Set();
 while((m=rx.exec(section))){if(!seen.has(m[1])){seen.add(m[1]);rows.push({boat:Number(m[1]),exhibitionTime:num(m[2])});} if(rows.length===6)break;}
 return rows.length?{date,jcd,venue:venues[jcd],race,boats:rows,source:"BOAT RACE official",fetchedAt:new Date().toISOString()}:null;
}
function odds3t(t,jcd,race){
 if(!t)return null; const values={};
 // Parse explicit trifecta combinations where present; never fabricate missing odds.
 const rx=/([1-6])\s*[-－]\s*([1-6])\s*[-－]\s*([1-6])\s+(\d+(?:\.\d+)?)/g; let m;
 while((m=rx.exec(t))){if(m[1]!==m[2]&&m[1]!==m[3]&&m[2]!==m[3]) values[`${m[1]}-${m[2]}-${m[3]}`]=num(m[4]);}
 return Object.keys(values).length?{date,jcd,venue:venues[jcd],race,type:"trifecta",values,source:"BOAT RACE official",fetchedAt:new Date().toISOString()}:null;
}
function result(t,jcd,race){
 if(!t)return null; const m=t.match(/3連単\s*([1-6])\s*[-－]\s*([1-6])\s*[-－]\s*([1-6])\s*[¥￥]\s*([\d,]+)/);
 if(!m)return null;
 return {date,jcd,venue:venues[jcd],race,trifecta:`${m[1]}-${m[2]}-${m[3]}`,payout100:num(m[4]),winningMethod:(t.match(/決まり手\s*(逃げ|差し|まくり差し|まくり|抜き|恵まれ)/)||[])[1]||null,source:"BOAT RACE official",fetchedAt:new Date().toISOString()};
}
const feed={schema:"raceedge-feed-1",generatedAt:new Date().toISOString(),date,source:"BOAT RACE official via Race Edge GitHub collector 2.3",entries:[],exhibition:[],odds:[],results:[]};
for(const jcd of Object.keys(venues)){
 for(let race=1;race<=12;race++){
  try{
   const [e,x,o,r]=await Promise.all([get("racelist",jcd,race),get("beforeinfo",jcd,race),get("odds3t",jcd,race),get("raceresult",jcd,race)]);
   const a=racers(e,jcd,race),b=exhibition(x,jcd,race),c=odds3t(o,jcd,race),d=result(r,jcd,race);
   if(a)feed.entries.push(a); if(b)feed.exhibition.push(b); if(c)feed.odds.push(c); if(d)feed.results.push(d);
  }catch(e){console.warn(jcd,race,e.message)}
  await sleep(180);
 }
}
await fs.mkdir("public",{recursive:true});
await fs.writeFile("public/raceedge-feed.json",JSON.stringify(feed,null,2));
await fs.writeFile("public/status.json",JSON.stringify({ok:true,date,generatedAt:feed.generatedAt,counts:{entries:feed.entries.length,exhibition:feed.exhibition.length,odds:feed.odds.length,results:feed.results.length}},null,2));
console.log("Race Edge feed counts",feed.entries.length,feed.exhibition.length,feed.odds.length,feed.results.length);
