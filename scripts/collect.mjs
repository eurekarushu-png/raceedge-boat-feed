import fs from "node:fs/promises";
const venues={"01":"桐生","02":"戸田","03":"江戸川","04":"平和島","05":"多摩川","06":"浜名湖","07":"蒲郡","08":"常滑","09":"津","10":"三国","11":"びわこ","12":"住之江","13":"尼崎","14":"鳴門","15":"丸亀","16":"児島","17":"宮島","18":"徳山","19":"下関","20":"若松","21":"芦屋","22":"福岡","23":"唐津","24":"大村"};
const jst=new Date(Date.now()+9*3600e3).toISOString().slice(0,10), date=process.env.RACE_DATE||jst, hd=date.replaceAll("-","");
const clean=h=>h.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/g," ").replace(/&yen;|&#165;/g,"¥").replace(/&amp;/g,"&").replace(/\s+/g," ").trim();
const n=v=>v==null?null:Number(String(v).replaceAll(",",""));
async function get(page,jcd,rno){const u=`https://www.boatrace.jp/owpc/pc/race/${page}?hd=${hd}&jcd=${jcd}&rno=${rno}`;const r=await fetch(u,{headers:{"user-agent":"RaceEdge-Free-Collector/2.2","accept":"text/html"}});if(!r.ok)return null;return clean(await r.text())}
function result(t,jcd,race){if(!t)return null;const m=t.match(/3連単\s*([1-6])\s*[-－]\s*([1-6])\s*[-－]\s*([1-6])\s*[¥￥]\s*([\d,]+)/);if(!m)return null;return {date,jcd,venue:venues[jcd],race,trifecta:`${m[1]}-${m[2]}-${m[3]}`,payout100:n(m[4]),winningMethod:(t.match(/決まり手\s*(逃げ|差し|まくり差し|まくり|抜き|恵まれ)/)||[])[1]||null,weather:{temperature:n((t.match(/気温\s*([\d.]+)℃/)||[])[1]),windSpeed:n((t.match(/風速\s*([\d.]+)m/)||[])[1]),waterTemperature:n((t.match(/水温\s*([\d.]+)℃/)||[])[1]),waveHeight:n((t.match(/波高\s*([\d.]+)cm/)||[])[1])},source:"BOAT RACE official",fetchedAt:new Date().toISOString()}}
const feed={schema:"raceedge-feed-1",generatedAt:new Date().toISOString(),date,source:"BOAT RACE official via Race Edge GitHub collector",entries:[],exhibition:[],odds:[],results:[]};
for(const jcd of Object.keys(venues)){for(let r=1;r<=12;r++){try{const x=result(await get("raceresult",jcd,r),jcd,r);if(x)feed.results.push(x)}catch{} await new Promise(x=>setTimeout(x,120));}}
await fs.mkdir("public",{recursive:true});await fs.writeFile("public/raceedge-feed.json",JSON.stringify(feed,null,2));
await fs.writeFile("public/status.json",JSON.stringify({ok:true,date,generatedAt:feed.generatedAt,resultCount:feed.results.length},null,2));
console.log(`Race Edge feed: ${feed.results.length} results for ${date}`);
