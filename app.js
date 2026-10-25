
/* 우리동네 입지분석 v1.1 화면(’26.10.20). 점수·등급은 pipeline/build_v10.py에서 계산하고 여기서는 보여 주기만 함 */
const DATA = window.__DATA;
const $ = id => document.getElementById(id);
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const median = a => { if(!a.length) return null; const s=[...a].sort((x,y)=>x-y), m=s.length>>1; return s.length%2?s[m]:(s[m-1]+s[m])/2; };
const eok = man => man==null ? '–' : (man/10000).toFixed(man>=100000?1:2).replace(/\.?0+$/,'') + '억';
const fmtMan = v => v==null?'–':Math.round(v).toLocaleString()+'만원';
const pct = v => `${v>0?'+':v<0?'−':''}${Math.abs(Math.round(v*100))}%`;
const pct1 = v => `${v>0?'+':v<0?'−':''}${Math.abs(v*100).toFixed(1)}%`;
const f1 = v => v==null?'–':(Math.round(v*10)/10).toFixed(1);
const M = DATA.meta, CX = DATA.cx, NOWY = 2026, N = CX.length, NF = M.Nfinal;
/* v1.2.2 연구원: 등급 표시는 단지 외곽선 가운데(외곽선 중심이 대표점에서 250m 안일 때). 점수 계산 좌표는 그대로 */
CX.forEach(c=>{ c.mla=c.mla??c.lat; c.mlo=c.mlo??c.lon; const r=c.ol; if(!r||r.length<3) return; let A=0,X=0,Y=0;
  for(let i=0;i<r.length;i++){ const [a,b]=r[i],[d,e]=r[(i+1)%r.length], k=a*e-d*b; A+=k; X+=(a+d)*k; Y+=(b+e)*k; }
  if(!A) return; const la=X/(3*A), lo=Y/(3*A), dm=Math.hypot((la-c.lat)*110940,(lo-c.lon)*111320*Math.cos(c.lat*Math.PI/180));
  if (dm<=250){ c.mla=la; c.mlo=lo; } });
const AREAS = M.areaOrder, LOC = ['S','L','J','T'];
const AN = M.areaNames, IN = M.inArea, NAMES = M.names;
CX.forEach(c => { if (c.n.startsWith(c.dong)) c.n = c.n.slice(c.dong.length).trim(); });

/* ═════════ 등급 색: 1(진한 파랑) → 9(빨강) ═════════ */
const GCOL = ['#1b64da','#3182f6','#4ca3f7','#2fb5a6','#5cc27a','#f2c94c','#f2994a','#eb6c4b','#e5384a'];
const gCol = g => g==null ? 'var(--surface2)' : GCOL[g-1], gInk = g => g==null ? 'var(--muted)' : g===6 ? '#191f28' : '#fff';
const scoreOf0 = c => S.locMode ? (c.loc ?? c.locTent) : (c.total ?? c.tent);   // v3.1.0 연구원: 상단 '입지 점수' 탭 → 입지 점수·입지 등급으로 보기

/* ═════════ 항목 기준(표시용, 계산은 build_v10.py) ═════════ */
const RULE = M.rules;
const ST = {A:'관측', B:'추정', C:'미확인', U:'미확인(전 단지 같은 중간값)', P:'잠정'};
const verdict = s => s==null?'미확인':s>=8?'강점':s>=6?'양호':s>=4?'보통':'약점';

/* 파생값 */
CX.forEach(c => {
  c.types = (c.tt||[]).map(([ex,n,med,last,dt,m3,a3,n3])=>({ex, py:Math.round(ex*0.4), n, med:med*100, last:last*100, dt, m3:m3==null?null:m3*100, a3:a3==null?null:a3*100, n3:n3||0}));
  c.age = NOWY - c.y; c.band = c.pm ? c.pm.band : (c.pmb||'hold'); c.gap = c.pm ? c.pm.gap : (c.pmg??null);
  c.p84 = c.p.med ? c.p.med*84.9 : c.p.p84;
  const q=c.p.q24||{}; c.qr = q.months ? q.n/c.u/(q.months/12)*100 : null;   // 연간 매매회전율(%)
  c.tags = c.tags || [];
});
const BAND = {under:'저평가 단지',fair:'적정 범위',over:'고평가 단지',hold:'판정 보류'};
const bandColor = b => ({under:'var(--under)',fair:'var(--fair)',over:'var(--over)',hold:'var(--muted)'})[b];

/* ═════════ 상태 ═════════ */
const RMAX = { p:Math.min(20, Math.ceil(Math.max(...CX.flatMap(c=>c.types.map(t=>t.med/10000))))), py:Math.max(...CX.flatMap(c=>c.types.map(t=>t.py))), u:Math.ceil(Math.max(...CX.map(c=>c.u))/100)*100, age:Math.max(...CX.map(c=>c.age)) };
const S = { sel:null, band:'all', py:null, units:null, ageR:null, grades:new Set(), tags:new Set(), sort:'score', cmp:[], mine:null, openCat:null, view:'list', pop:null };
try { const v = JSON.parse(localStorage.getItem('dn10-mine')||'null'); if (v) S.mineDraft = v; } catch(e){}

/* ═════════ 내 조건: 예산·비용 (지방세법 제11조①8, 공인중개사법 시행규칙 제20조) ═════════ */
function acqTaxRate(P){ if (P<=6e8) return 0.01; if (P<=9e8) return Math.round(((P/3e8)*2-3)/100*1e6)/1e6; return 0.03; }
function brokerFee(P){ if (P<5e7) return Math.min(P*0.006,250000); if (P<2e8) return Math.min(P*0.005,800000); if (P<9e8) return P*0.004; if (P<12e8) return P*0.005; if (P<15e8) return P*0.006; return P*0.007; }
function costs(P, big, first){ const r=acqTaxRate(P); let acq=P*r; if (first && P<=12e8) acq=Math.max(0,acq-2e6); const edu=P*r*0.1, farm=big?P*0.002:0, fee=brokerFee(P); return {r,acq,edu,farm,fee,sum:acq+edu+farm+fee}; }
function maxPrice(cash, big, first){ let lo=0,hi=cash; for (let i=0;i<60;i++){ const mid=(lo+hi)/2; if (mid+costs(mid,big,first).sum<=cash) lo=mid; else hi=mid; } return lo; }

/* ═════════ 필터 ═════════ */
function matchTypes(c){ return c.types.filter(t=>(!S.py || (t.py>=S.py[0] && t.py<=S.py[1])) && (!S.priceR || (t.med/10000>=S.priceR[0] && (S.priceR[1]>=RMAX.p || t.med/10000<=S.priceR[1])))); }
// v3.1.0 연구원: 대표 평형 = 그 단지에서 세대가 가장 많은 평형대(K-apt 면적별 세대수, 없으면 최근 1년 거래가 가장 많은 평형), 가격 = 그 평형 최근 3개월 평균 실거래가
const HBR={1:[0,60],2:[60,85],3:[85,135],4:[135,999]};
function mainType(c){ if(!c.types.length) return null; let m=c.types; if(c.hb){ const [a,b]=HBR[c.hb]; const f=m.filter(t=>t.ex>a&&t.ex<=b+0.5); if(f.length) m=f; } return [...m].sort((x,y)=>(y.n-x.n)||(y.n3-x.n3))[0]; }
function repType(c){ if(S.py||S.priceR){ const m=matchTypes(c); if(!m.length) return null; return [...m].sort((a,b)=>b.n-a.n)[0]; } return mainType(c); }
const repPrice = c => { const t=repType(c); return t?(t.a3??t.med):c.p84; };
const typeLabel = t => `${t.py}평`;
function bandPrice(c){ if (S.mine && S.mine.size!=='all'){ const b=c.p.bands?.[S.mine.size]; return b && b[1]>0 ? b[0] : null; } return c.p84; }
function tagsShow(c){   // v1.1 연구원: 태그는 최대 4개, 왼쪽부터 좋은 점(파랑) → 보통(초록) → 아쉬운 점(빨강)
  const g=c.tags.filter(t=>t[2]==='good'), n=c.tags.filter(t=>!t[2]), b=c.tags.filter(t=>t[2]==='bad');
  const bb=b.slice(0, Math.min(2, b.length)), gg=g.slice(0, 4-bb.length), nn=n.slice(0, 4-bb.length-gg.length), b2=b.slice(bb.length, bb.length+Math.max(0,4-bb.length-gg.length-nn.length));
  return [...gg,...nn,...bb,...b2].map(t=>`<span class="tag ${t[2]||''}">${t[1]}</span>`).join('');
}
function pkU(c){ const k=c.k||{}; const t=k.pt||((k.pg||0)+(k.pu||0)); return t&&c.u ? Math.round(t/c.u*100)/100 : null; }   // v1.1 세대당 주차대수
function passes(c){
  if (S.band!=='all' && c.band!==S.band) return false;
  if (S.units && (c.u<S.units[0] || c.u>S.units[1])) return false;
  if (S.ageR && (c.age<S.ageR[0] || c.age>S.ageR[1])) return false;
  if (S.grades.size && !S.grades.has(gradeOf(c) ?? 0)) return false;
  const inR=(v,r,mx)=> v!=null && v>=r[0] && (r[1]>=mx || v<=r[1]);
  if (S.far && !inR(c.far,S.far,500)) return false;
  if (S.bcr && !inR(c.bcr,S.bcr,80)) return false;
  if (S.qR && !inR(c.qr,S.qR,15)) return false;
  if (S.pkR && !inR(pkU(c),S.pkR,2)) return false;
  if ((S.py || S.priceR) && !matchTypes(c).length) return false;
  for (const t of S.tags){ if (t==='final'){ if (!c.final) return false; } else if (!c.tags.some(x=>x[0]===t)) return false; }
  if (S.mine){ const p=bandPrice(c); if (p==null || p*10000 > S.mine.maxP) return false; }
  return true;
}
function personal(c){
  if (!S.mine) return scoreOf0(c);
  const w=S.mine.w; let s=0, ws=0; for (const a of AREAS){ const v=c.area[a]; if (v!=null && w[a]>0){ s+=v*w[a]; ws+=w[a]; } }
  return ws ? s/ws*10 : null;
}
function applyMine(){
  if (!S.mine){ CX.forEach(c=>{c.ps=null; c.pg=null;}); return; }
  const fin=CX.filter(c=>c.final), xs=fin.map(personal).sort((a,b)=>b-a), Nf=xs.length, pos=new Map();
  xs.forEach((v,i)=>{ if(!pos.has(v)) pos.set(v,[]); pos.get(v).push(i+1); });
  CX.forEach(c=>{ c.ps=personal(c); if(!c.final){ c.pg=null; return; } const p=pos.get(c.ps), r=p.reduce((a,b)=>a+b,0)/p.length, q=100*(r-.5)/Nf; c.pg=M.cuts.findIndex(cc=>q<=cc+1e-9)+1; });
}
const gradeOf = c => S.mine ? c.pg : (S.locMode ? c.locG : c.grade);
const scoreOf = c => S.mine ? c.ps : scoreOf0(c);
function visible(){
  const list=CX.filter(passes), key=S.sort;
  list.sort((a,b)=> key==='score' ? ((b.final-a.final) || (gradeOf(a)??10)-(gradeOf(b)??10) || (scoreOf(b)??-1)-(scoreOf(a)??-1)) : key==='loc' ? ((b.loc??b.locTent??-1)-(a.loc??a.locTent??-1)) : key==='gap' ? ((a.gap??9)-(b.gap??9)) : key==='price' ? ((repPrice(a)??1e9)-(repPrice(b)??1e9)) : key==='turn' ? ((b.qr??-1)-(a.qr??-1)) : 0);
  return list;
}

/* ═════════ 필터 안내 상자 ═════════ */
const HINT = {
  chopuma:['초품아 기준','차도를 건너지 않고 인도로 배정 초등학교까지 도보 5분 안에 가는 단지입니다.','배정 초등학교는 학구도 통학구역 기준입니다. 차도는 OpenStreetMap 기준이며 단지 안 길은 차도로 보지 않습니다.'],
  acad:['학원가 기준','걸어서 10분 안에 학원(예체능 포함)이 50곳 이상 모여 있는 단지입니다. 한 학원은 과목 수와 관계없이 1곳으로 셉니다.','소상공인시장진흥공단 상가정보(’26.6.30) 학원 업종 기준입니다.'],
  job:['직주근접 기준','주요 업무지구의 일자리 규모(통계청 사업체조사 종사자 수 × 국민연금 평균 임금)와 자가용 출퇴근 시간으로 매긴 점수가 광주 단지 상위 5% 안인 단지입니다. 가까울수록 크게 셉니다. 거리 반영 비율은 2020 인구주택총조사(통계청)의 실제 통근시간 분포로 정했습니다: 45분 안에 출퇴근하는 사람 중 통근시간이 그보다 긴 사람의 비율(0분 100% · 15분 72% · 30분 39% · 45분 0%). 45분이 넘는 업무지구는 세지 않습니다. 만점은 광주 전체에서 가까운 일자리가 가장 많은 단지이고, 모든 지역에 같은 기준을 씁니다.','출퇴근 시간은 경로 탐색 시간 × 1.3(혼잡 보정)입니다. 종사자 수는 근무지 기준(2024)이라 지사·공무원이 포함됩니다. 공무원 임금은 국민연금 자료에 없어 인사혁신처가 고시한 공무원 평균 소득(월 571만 원)을 씁니다.'],
  park:['공세권 기준','걸어서 5분 안(공원 경계까지)에 큰 공원이나 호수가 있는 단지입니다. 공원·호수 10만㎡ 이상, 또는 5만㎡ 이상이면서 하천·산책로로 더 큰 녹지에 이어진 곳(예: 수완호수공원)이 해당합니다.','도시공원정보 표준데이터 면적과 OpenStreetMap 공원·호수 경계 기준입니다. 실제 입구 위치와 다를 수 있습니다.'],
  water:['수세권 기준','걸어서 5분 안에 하천 둔치나 수변 산책로(광주천·풍영정천·영산강 자전거길, 푸른길, 지역 하천·해안 산책로 등)가 있는 단지입니다. 공세권과 겹치면 공세권만 표시합니다.','OpenStreetMap 하천·이름 있는 산책로 기준입니다. 작은 천은 복개 구간이 있을 수 있어 제외했습니다.'],
  gpark:['지상공원화 기준','주차장이 모두 지하에 있어(지상 주차 0대) 단지 지상을 공원처럼 쓰는 단지입니다.','K-apt 지상·지하 주차대수 기준입니다. 방문·상가 주차가 일부 지상에 있어도 K-apt에 0대로 입력돼 있으면 해당합니다.'],
  slse:['슬세권 기준','슬리퍼 신고 다닐 거리에 장보기·병원·약국·공원·은행·상권이 모인 단지입니다. 생활환경 점수가 광주 단지 중 상위 5% 안이면 해당합니다.','생활환경 항목(마트·의원·공원·대형마트·종합병원·도서관·은행·상권·영화관·수영장) 점수 기준입니다.'],
  final:['확정 등급이란?','모든 기본 항목이 관측된 단지만 도시 내 상대등급을 받습니다.','자료가 빠진 단지는 잠정점수와 가능한 점수 범위만 보여 줍니다(평가 기준 [4]).'],
  under:['저평가 단지란?','반경 500m 안 단지 시세와 조건으로 만든 추정가보다 최근 실거래가가 10% 이상 낮은 단지입니다.','종합점수에는 넣지 않는 참고 정보입니다. 감정평가나 적정가격이 아닙니다.'],
  over:['고평가 단지란?','반경 500m 안 단지 시세와 조건으로 만든 추정가보다 최근 실거래가가 10% 이상 높은 단지입니다.','종합점수에는 넣지 않는 참고 정보입니다. 감정평가나 적정가격이 아닙니다.'],
};
function renderMacro(){
  const box=$('macro');
  if (!S.hint){ box.hidden=true; box.innerHTML=''; return; }
  box.hidden=false; box.classList.toggle('hint', !S.macroMin); box.classList.toggle('min', !!S.macroMin);
  if (S.macroMin){ box.innerHTML=`<button class="mopen" id="mopen">${HINT[S.hint][0]} ▸</button>`; $('mopen').onclick=()=>{S.macroMin=false; renderMacro();}; return; }
  const t=HINT[S.hint]; box.innerHTML=`<div class="hx"><b>${t[0]}</b><span>${t[1]}</span><small>${t[2]}</small></div><button class="minfo" id="mmin" aria-label="접기">✕</button>`; $('mmin').onclick=()=>{S.macroMin=true; renderMacro();};
}

/* ═════════ 지도(내장 배경: OSM에서 뽑은 물·녹지·도로) ═════════ */
const BASE = (()=>{ const AL='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_', IX={}; [...AL].forEach((c,i)=>IX[c]=i);
  const dec=s=>{ const out=[]; let i=0, x=1266300, y=350350; const rd=()=>{ let v=0,sh=0,c; do{ c=IX[s[i++]]; v|=(c&31)<<sh; sh+=5; }while(c&32); return (v&1)?~(v>>1):(v>>1); };
    while(i<s.length){ x+=rd(); y+=rd(); out.push([x/1e4,y/1e4]); } return out; };
  const G={}; for (const line of (DATA.base||'').trim().split('\n')){ if(!line) continue; const k=line.indexOf(':'); G[line.slice(0,k)]=line.slice(k+1).split('.').map(dec); } return G; })();
const GU5 = ['동구','서구','남구','북구','광산구'];
const PLACES = [
  ['충장로·금남로',35.1480,126.9160,'area',1], ['상무지구',35.1515,126.8470,'area',1], ['수완지구',35.1895,126.8215,'area',1],
  ['첨단지구',35.2160,126.8465,'area',1], ['봉선동',35.1262,126.9100,'area',1], ['효천지구',35.1010,126.8762,'area',2],
  ['하남산단',35.1925,126.7972,'ind',2], ['평동산단',35.1262,126.7640,'ind',2], ['첨단산단',35.2314,126.8548,'ind',2],
  ['광주송정역',35.1377,126.7909,'rail',1], ['광주역',35.1653,126.9093,'rail',1], ['광주공항',35.1300,126.8070,'air',1],
  ['유스퀘어(종합버스터미널)',35.1603,126.8790,'bus',2], ['광주시청',35.1601,126.8516,'gov',2],
  ['전남대',35.1778,126.9048,'univ',2], ['조선대',35.1413,126.9306,'univ',2], ['광주과학기술원',35.2284,126.8418,'univ',3],
  ['무등산',35.1250,127.0086,'nat',1], ['광주호',35.1981,126.9855,'water',2], ['영산강',35.1635,126.8240,'water',1],
];
const SUB1 = [['녹동',35.1068,126.9340],['소태',35.1236,126.9322],['학동·증심사입구',35.1331,126.9282],['남광주',35.1394,126.9228],['문화전당',35.1467,126.9198],['금남로4가',35.1507,126.9146],['금남로5가',35.1537,126.9101],['양동시장',35.1545,126.9018],['돌고개',35.1517,126.8956],['농성',35.1532,126.8840],['화정',35.1519,126.8768],['쌍촌',35.1515,126.8696],['운천',35.1504,126.8587],['상무',35.1467,126.8487],['김대중컨벤션센터',35.1432,126.8413],['공항',35.1441,126.8117],['송정공원',35.1436,126.7995],['광주송정',35.1375,126.7916],['도산',35.1314,126.7873],['평동',35.1248,126.7696]];
const POLY_ORDER = [['wood','lu-wood'],['grass','lu-grass'],['park','lu-park'],['ind','lu-ind'],['com','lu-com'],['edu','lu-edu'],['mil','lu-mil'],['air','lu-air'],['water','lu-water']];
const ROAD_ORDER = [['r5',.85,1.6,1.8],['r4',1.3,2.3,0],['r3',2.0,3.2,0],['r2',2.4,3.7,0],['r1',2.8,4.2,0]];
const svg=d3.select('#map'), gRoot=svg.append('g'), gLU=gRoot.append('g'), gRiver=gRoot.append('g'), gRoad=gRoot.append('g'), gRail=gRoot.append('g'), gMask=gRoot.append('g'),
  gEmd=gRoot.append('g'), gSgg=gRoot.append('g'), gOl=gRoot.append('g').attr('class','olg'), gSub=gRoot.append('g'), gLbl=gRoot.append('g'), gMk=gRoot.append('g'), gUp=gRoot.append('g'), gDong=gRoot.append('g');
let proj, path, zoom, K=1, W=0, H=0, LBL=[], MKB=[];
/* v3.0.1 최적화(연구원 ’26.10.24: 오래 쓰면 드래그가 버벅임): 배경(토지이용·도로·하천·철도)을 그림 한 장(캔버스)으로 그려 두고,
   움직이는 동안에는 그 그림만 옮김(벡터 도로 수천 개를 매 프레임 다시 그리지 않음). 멈추면 현재 화면에 맞게 다시 그림 */
const BCV=document.createElement('canvas'); BCV.id='baseCv'; BCV.setAttribute('aria-hidden','true');
document.getElementById('map').parentNode.insertBefore(BCV, document.getElementById('map'));
let BT=null; const BM=0.6;                                            // BT = 그림을 그린 시점의 변환, BM = 화면 밖 여백(가로·세로 비율)
function renderBase(){
  if (!proj || NV) return;
  const t=d3.zoomTransform(svg.node()), dpr=Math.min(window.devicePixelRatio||1,2), mx=Math.round(W*BM), my=Math.round(H*BM);
  const cw=W+2*mx, ch=H+2*my; if (BCV.width!==Math.round(cw*dpr)||BCV.height!==Math.round(ch*dpr)){ BCV.width=Math.round(cw*dpr); BCV.height=Math.round(ch*dpr); }
  BCV.style.width=cw+'px'; BCV.style.height=ch+'px'; BCV.style.left=(-mx)+'px'; BCV.style.top=(-my)+'px'; BCV.style.transform='';
  const ctx=BCV.getContext('2d'); ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,BCV.width,BCV.height);
  ctx.setTransform(dpr*t.k,0,0,dpr*t.k,dpr*(t.x+mx),dpr*(t.y+my));
  for (const g of [gLU,gRiver,gRoad,gRail]) g.selectAll('path').each(function(){
    if (this.getAttribute('display')==='none') return;
    const cs=getComputedStyle(this); if (cs.display==='none') return;
    if (!this.__p2 || this.__pd!==this.getAttribute('d')){ this.__pd=this.getAttribute('d'); this.__p2=new Path2D(this.__pd); }
    ctx.globalAlpha=+cs.opacity||1;
    if (cs.fill && cs.fill!=='none'){ ctx.fillStyle=cs.fill; ctx.globalAlpha=(+cs.opacity||1)*(+cs.fillOpacity||1); ctx.fill(this.__p2,'evenodd'); }
    if (cs.stroke && cs.stroke!=='none'){ const nonScale=(cs.vectorEffect||'').includes('non-scaling'); const sw=parseFloat(cs.strokeWidth)||1;
      ctx.strokeStyle=cs.stroke; ctx.globalAlpha=(+cs.opacity||1)*(+cs.strokeOpacity||1); ctx.lineWidth=nonScale?sw/t.k:sw; ctx.lineCap=cs.strokeLinecap||'butt'; ctx.lineJoin=cs.strokeLinejoin||'miter';
      const da=(cs.strokeDasharray&&cs.strokeDasharray!=='none')?cs.strokeDasharray.split(/[ ,]+/).map(parseFloat).map(v=>nonScale?v/t.k:v):[]; ctx.setLineDash(da); ctx.stroke(this.__p2); }
  });
  ctx.globalAlpha=1; BT=t;
  for (const g of [gLU,gRiver,gRoad,gRail]) g.style('display','none');   // 벡터 배경은 숨기고 그림으로 대신
}
function moveBase(t){ if (!BT) return; const s=t.k/BT.k; BCV.style.transform=`translate(${t.x-s*BT.x}px,${t.y-s*BT.y}px) scale(${s})`; }
function pcent(f){ const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates; let A=0,X=0,Y=0;
  for (const poly of polys){ const r=poly[0].map(q=>proj(q)); let a=0,x=0,y=0; for(let i=0;i<r.length-1;i++){ const c=r[i][0]*r[i+1][1]-r[i+1][0]*r[i][1]; a+=c; x+=(r[i][0]+r[i+1][0])*c; y+=(r[i][1]+r[i+1][1])*c; }
    if (a){ A+=Math.abs(a/2); X+=x/(3*a)*Math.abs(a/2); Y+=y/(3*a)*Math.abs(a/2); } }
  return {a:A, c:[X/A, Y/A]}; }
const pathOf = (rings, close) => rings.map(r=>{ let s=''; for (let i=0;i<r.length;i++){ const p=proj(r[i]); s+=(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1); } return close?s+'Z':s; }).join('');
const fpath = f => pathOf((f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates).flat(), true);
function drawMap(){
  const el=$('map'); W=el.clientWidth; H=el.clientHeight; svg.attr('viewBox',`0 0 ${W} ${H}`);
  const mobile=matchMedia('(max-width:900px)').matches;
  const fitFeat={type:'MultiPoint', coordinates:CX.filter(c=>!c.nj).map(c=>[c.lon,c.lat])};   // v0.9 첫 화면은 광주
  const padT=mobile?70:24, padB=mobile?(parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sheet-peek'))||152)+40:24, padL=mobile?16:310;
  proj=d3.geoMercator().fitExtent([[padL,padT],[W-56,H-padB]], fitFeat); path=d3.geoPath(proj);
  gLU.selectAll('path').data(POLY_ORDER.filter(([k])=>BASE[k])).join('path').attr('class',d=>'lu '+d[1]).attr('d',([k])=>pathOf(BASE[k],true));
  gRiver.selectAll('path').data(BASE.river?[0]:[]).join('path').attr('class','river').attr('d',()=>pathOf(BASE.river,false));
  const rd=ROAD_ORDER.filter(([k])=>BASE[k]);
  gRoad.selectAll('path').data([...rd.map(r=>[...r,'c']),...rd.map(r=>[...r,'f'])]).join('path').attr('class',d=>`rd ${d[0]} ${d[4]}`).attr('d',d=>pathOf(BASE[d[0]],false));
  gRail.selectAll('path').data(BASE.rail?['c','f']:[]).join('path').attr('class',d=>'rail '+d).attr('d',()=>pathOf(BASE.rail,false));
  const gj=DATA.geo.sgg.features.filter(f=>GU5.includes(f.properties.g));
  gMask.selectAll('path').data([0]).join('path').attr('class','mask').attr('d',`M-9999 -9999H${W+9999}V${H+9999}H-9999Z`+gj.map(fpath).join(''));
  gEmd.selectAll('path').data(DATA.geo.emd.features).join('path').attr('class','emd').attr('d',fpath);
  gSgg.selectAll('path').data([...gj.map(f=>[f,'halo']),...gj.map(f=>[f,'line'])]).join('path').attr('class',d=>'gu-'+d[1]).attr('d',d=>fpath(d[0]));
  gSub.selectAll('path').data([0]).join('path').attr('class','sub1').attr('d',pathOf([SUB1.map(s=>[s[2],s[1]])],false));
  gSub.selectAll('circle').data(SUB1).join('circle').attr('class','stn').attr('r',3.2).attr('cx',s=>proj([s[2],s[1]])[0]).attr('cy',s=>proj([s[2],s[1]])[1]);
  const gus=d3.groups(DATA.geo.emd.features,f=>f.properties.g).filter(([g])=>GU5.includes(g)).map(([g,fs])=>{ let a=0,cx=0,cy=0; fs.forEach(f=>{ const q=pcent(f); a+=q.a; cx+=q.c[0]*q.a; cy+=q.c[1]*q.a; }); return {t:g,x:cx/a,y:cy/a,cls:'lbl-gu',pr:0,min:GZ,max:2.4,fs:16}; });
  const pl=PLACES.map(([t,la,lo,ty,lv])=>{ const [x,y]=proj([lo,la]); return {t,x,y,ty,cls:'lbl-pl '+ty,pr:lv*2+(ty==='area'?1:0),min:lv===1?0:lv===2?1.6:2.6,max:99,fs:ty==='area'?13:12,icon:!['area','ind','water'].includes(ty)}; });
  const stn=SUB1.map(([t,la,lo])=>{ const [x,y]=proj([lo,la]); return {t,x,y,cls:'lbl-stn',pr:7,min:3.4,max:99,fs:10.5}; });
  const dong=DATA.geo.emd.features.map(f=>{ const c=pcent(f).c; return {t:f.properties.n,x:c[0],y:c[1],cls:'lbl-dong',pr:8,min:2.4,max:99,fs:11}; });
  LBL=[...gus,...pl,...stn,...dong];
  const g=gLbl.selectAll('g.lb').data(LBL).join(e=>{ const g=e.append('g').attr('class','lb'); g.append('circle'); g.append('text'); return g; });
  g.attr('class',d=>'lb '+d.cls);
  g.select('circle').attr('r',d=>d.icon?4:0).attr('class',d=>'ic '+(d.ty||''));
  g.select('text').text(d=>d.t).attr('x',d=>d.icon?7:0).attr('text-anchor',d=>d.icon?'start':'middle').attr('dominant-baseline','central');
  zoom=d3.zoom().scaleExtent([.8,16]).on('zoom',e=>{ gRoot.attr('transform',e.transform); const k=e.transform.k; if (k!==K){ K=k; gOl.selectAll('.ol').style('stroke-width',2.4/K+'px'); gOl.selectAll('circle.ol').attr('r',26/K); } moveBase(e.transform); clearTimeout(PZ); PZ=setTimeout(()=>{ place(); renderBase(); d3View(); },120); });   // v3.0.1 최적화: 매 프레임 재배치 → 멈춘 뒤 1회
  svg.call(zoom).on('dblclick.zoom',null);
  drawMarkers(); place(); renderBase();
}
/* v3.0.1 최적화: 겹침 검사를 격자로(상자 수가 많아도 주변 칸만 비교) */
function boxGrid(cell){ cell=cell||48; const m=new Map(), key=(i,j)=>i*100003+j;
  const cells=b=>{ const r=[]; for(let i=Math.floor(b[0]/cell);i<=Math.floor(b[2]/cell);i++) for(let j=Math.floor(b[1]/cell);j<=Math.floor(b[3]/cell);j++) r.push(key(i,j)); return r; };
  return { add(b){ cells(b).forEach(k=>{ let a=m.get(k); if(!a) m.set(k,a=[]); a.push(b); }); },
           hit(b){ for (const k of cells(b)){ const a=m.get(k); if (a && a.some(o=>b[0]<o[2]&&b[2]>o[0]&&b[1]<o[3]&&b[3]>o[1])) return true; } return false; } }; }
function placeBase(){
  const f=1+0.35*Math.log2(Math.max(K,1));
  gRoad.selectAll('path.rd').style('stroke-width',d=>((d[4]==='c'?d[2]:d[1])*f)+'px').attr('display',d=>K>=d[3]?null:'none');
  gRail.selectAll('path').style('stroke-width',d=>(d==='c'?2.6:1.2)*f+'px');
  gRiver.selectAll('path').style('stroke-width',2.2*f+'px');
  gSub.select('path').style('stroke-width',(K>=2?3:2.2)+'px').style('opacity',K>=1.6?.9:.55);
  gSub.selectAll('circle').attr('display',K>=2?null:'none').attr('r',3.4/K).style('stroke-width',1.6/K+'px');
  gEmd.selectAll('path').style('opacity',K>=2?1:.55);
  const t=d3.zoomTransform(svg.node()), G=boxGrid(); MKB.forEach(b=>G.add(b)); const hit=G.hit, boxes={push:G.add};
  const show=new Set();
  for (const d of [...LBL].sort((a,b)=>a.pr-b.pr)){
    if (K<d.min || K>=d.max) continue;
    const x=t.applyX(d.x), y=t.applyY(d.y); if (x<-80||y<-20||x>W+80||y>H+20) continue;
    const w=d.t.length*d.fs*0.92+(d.icon?9:0), h=d.fs*1.25;
    let ok=null;
    for (const [dx,dy] of (d.cls==='lbl-dong'||d.cls==='lbl-stn')?[[0,0]]:[[0,0],[0,-h-4],[0,h+4],[-w*.6,0],[w*.6,0],[0,-2*h-6],[0,2*h+6]]){
      const b=d.icon?[x+dx-5,y+dy-h/2,x+dx+w,y+dy+h/2]:[x+dx-w/2,y+dy-h/2,x+dx+w/2,y+dy+h/2];
      if (!hit(b)){ ok=[dx,dy,b]; break; }
    }
    if (!ok && d.pr<=1) ok=[0,0,[x-w/2,y-h/2,x+w/2,y+h/2]];
    if (!ok) continue; boxes.push(ok[2]); show.add(d); d.dx=ok[0]; d.dy=ok[1];
  }
  gLbl.selectAll('g.lb').attr('display',d=>show.has(d)?null:'none').attr('transform',d=>`translate(${d.x},${d.y}) scale(${1/K}) translate(${d.dx||0},${d.dy||0})`)
    .select('text').attr('font-size',d=>d.fs);
}
/* 넓게 볼 때는 행정동 평균(확정 등급 단지만), 확대하면 단지별 */
/* v1.2.2 연구원: 크게 보면 시군구 평균 → 확대하면 행정동 평균 → 더 확대하면 단지 등급(단지를 골라도 같은 규칙) */
const GZ = 1.6, DZ = 2.2, NGZ = 12, NDZ = 14;
const lvOf = () => NV ? (NV.getZoom()<=NGZ?'gu':NV.getZoom()<=NDZ?'dong':'cx') : (K<GZ?'gu':K<DZ?'dong':'cx');
function dongAgg(lv){
  lv = lv||'dong'; const m=new Map();
  visible().forEach(c=>{ if (gradeOf(c)==null) return; const k=lv==='gu'?(c.nj&&c.rg==='naju'?'나주시':c.gu):(c.hd||c.dong); if(!m.has(k)) m.set(k,[]); m.get(k).push(c); });
  return [...m].map(([k,cs])=>({ k, lv, n:cs.length, g:cs.reduce((s,c)=>s+gradeOf(c),0)/cs.length, s:cs.reduce((s,c)=>s+(scoreOf(c)||0),0)/cs.length,
    lat:(lv==='gu'&&GUC[k])?GUC[k][0]:cs.reduce((s,c)=>s+c.lat,0)/cs.length, lon:(lv==='gu'&&GUC[k])?GUC[k][1]:cs.reduce((s,c)=>s+c.lon,0)/cs.length }));
}
const GUC = {}; DATA.geo.sgg.features.forEach(f=>{ const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates; let A=0,X=0,Y=0;
  polys.forEach(poly=>{ const r=poly[0]; for(let i=0;i<r.length-1;i++){ const k=r[i][0]*r[i+1][1]-r[i+1][0]*r[i][1]; A+=k; X+=(r[i][0]+r[i+1][0])*k; Y+=(r[i][1]+r[i+1][1])*k; } });
  if (A) GUC[f.properties.g]=[Y/(3*A), X/(3*A)]; });   // 시군구 경계 중심(위도, 경도)
const aggLab = d => d.lv==='gu' ? `평균 ${d.s.toFixed(1)}점 · ${d.g.toFixed(1)}등급 · ${d.n}곳` : `평균 ${d.g.toFixed(1)}등급 · ${d.n}곳`;
let CURLV = null;
function drawDong(lv){
  lv = lv || (K<GZ?'gu':'dong'); CURLV = lv;
  const D=dongAgg(lv);
  const g=gDong.selectAll('g.dg').data(D,d=>d.lv+d.k).join(e=>{ const g=e.append('g').attr('class','dg').attr('role','button').attr('tabindex',0);
      g.append('rect'); g.append('text').attr('class','dn'); g.append('text').attr('class','dv');
      g.on('click',(ev,d)=>{ const [x,y]=proj([d.lon,d.lat]); svg.transition().duration(350).call(zoom.transform, d3.zoomIdentity.translate(W/2,H/2).scale(d.lv==='gu'?Math.max(GZ+0.3,K*1.5):Math.max(DZ+0.4,K*2.2)).translate(-x,-y)); });
      return g; });
  g.each(function(d){ const e=d3.select(this), gr=Math.round(d.g), lab=aggLab(d);
    e.attr('aria-label',`${d.k} ${lab}`);
    e.select('.dn').text(d.k).attr('y',-6); e.select('.dv').text(lab).attr('y',8);
    const w=Math.max(d.k.length*12, lab.length*6.4)+16;
    e.select('rect').attr('x',-w/2).attr('y',-17).attr('width',w).attr('height',34).attr('rx',10).style('fill',gCol(clamp(gr,1,9))).style('stroke','#fff');
    e.selectAll('text').style('fill',gInk(clamp(gr,1,9)));
  });
}
const gLab = c => { const g=gradeOf(c); return g==null ? (c.rent&&!S.mine?`임대 · 입지 ${c.locG??'-'}등급`:'잠정') : g+'등급'; };
function drawOutline(){
  const c=S.sel?CX.find(x=>x.id===S.sel):null;
  if (proj){ gOl.selectAll('*').remove();
    if (c){ if (c.ol) gOl.append('path').attr('class','ol').attr('d',pathOf([c.ol.map(([a,b])=>[b,a])],true)).style('stroke-width',2.4/K+'px');
      else { const [x,y]=proj([c.lon,c.lat]); gOl.append('circle').attr('class','ol').attr('cx',x).attr('cy',y).attr('r',26/K).style('stroke-width',2.4/K+'px'); } } }
  if (NV){ if (NVOL){ NVOL.setMap(null); NVOL=null; }
    if (c) NVOL = c.ol ? new naver.maps.Polygon({map:NV, paths:[c.ol.map(([a,b])=>new naver.maps.LatLng(a,b))], strokeColor:'#3182f6', strokeWeight:3, strokeOpacity:.95, fillColor:'#3182f6', fillOpacity:.14, clickable:false})
      : new naver.maps.Circle({map:NV, center:new naver.maps.LatLng(c.lat,c.lon), radius:60, strokeColor:'#3182f6', strokeWeight:3, fillColor:'#3182f6', fillOpacity:.14, clickable:false}); }
}
let VIS=null, ORD=null, PZ=null;
function drawMarkers(){
  { const v=visible(); VIS=new Set(v.map(c=>c.id)); ORD=[...CX].sort((a,b)=>(VIS.has(b.id)-VIS.has(a.id)) || (b.id===S.sel)-(a.id===S.sel) || (scoreOf(b)??-1)-(scoreOf(a)??-1)); }
  if (NV){ drawOutline(); nvMarkers(); return; }                     // v3.0.1 최적화: 네이버 지도를 쓸 때는 숨은 내장 지도(SVG) 갱신 생략
  if (proj) drawDong();
  drawOutline();
  const vis=VIS;
  const mk=gMk.selectAll('g.mk').data(CX,c=>c.id).join(e=>{
    const g=e.append('g').attr('class','mk').attr('tabindex',0).attr('role','button');
    g.append('rect').attr('class','prbg'); g.append('text').attr('class','pr');
    g.append('rect').attr('class','pill'); g.append('text').attr('class','sc'); g.append('title');
    g.on('click',(ev,c)=>select(c.id)).on('keydown',(ev,c)=>{ if(ev.key==='Enter'||ev.key===' '){ev.preventDefault(); select(c.id);} });
    return g;
  });
  mk.each(function(c){
    const g=d3.select(this), gr=gradeOf(c);
    g.attr('aria-label',`${c.dong} ${c.n}, ${gLab(c)}, 종합 ${f1(scoreOf(c))}점`);
    g.select('title').text(`${c.dong} ${c.n} · ${gLab(c)} · 종합 ${f1(scoreOf(c))}점${c.final?'':'(잠정)'} · ${BAND[c.band]}`);
    g.select('.pill').style('fill', gr==null?'var(--surface)':gCol(gr)).style('stroke', gr==null?'var(--muted)':null).attr('stroke-dasharray', gr==null?'3 2':null);
    g.select('.sc').text(gLab(c)).style('fill', gInk(gr));
    const pt = S.mine && S.mine.size!=='all' ? bandPrice(c) : repPrice(c);
    g.select('.pr').text(eok(pt)).attr('x',22).attr('y',0);
    g.select('.prbg').attr('x',17).attr('y',-9).attr('width',eok(pt).length*7+10).attr('height',18).attr('rx',6);
    g.classed('dim',!vis.has(c.id)).classed('sel',c.id===S.sel).classed('cmp',S.cmp.includes(c.id));
    this.__m=null;                                                     // 모양 다시 그리기 표시
  });
  gMk.selectAll('g.mk').filter(c=>vis.has(c.id)).raise();
  gMk.selectAll('g.mk').filter(c=>c.id===S.sel).raise();
  drawUp();
  if (proj && !NV) place();
  if (NV) nvMarkers();
}
const UP = DATA.up||[];
const ymTxt = ym => `’${String(ym).slice(2,4)}.${+String(ym).slice(4,6)}`;
function drawUp(){
  if (!gUp) return;
  gUp.selectAll('g.up').data(UP,u=>u.id).join(e=>{
    const g=e.append('g').attr('class','up').attr('tabindex',0).attr('role','button');
    g.append('rect').attr('class','upb'); g.append('text').attr('class','upt'); g.append('title');
    g.on('click',(ev,u)=>openUp(u.id)).on('keydown',(ev,u)=>{ if(ev.key==='Enter'||ev.key===' '){ev.preventDefault(); openUp(u.id);} });
    return g;
  }).each(function(u){ const g=d3.select(this);
    g.attr('aria-label',`입주예정 ${u.n}, ${ymTxt(u.mvn)} 입주 예정`); g.select('title').text(`입주예정 · ${u.n} · ${ymTxt(u.mvn)} 입주 예정 · ${u.u.toLocaleString()}세대`);
    g.select('.upb').attr('x',-27).attr('y',-10).attr('width',54).attr('height',20).attr('rx',7);
    g.select('.upt').text('입주예정'); });
}
function placeDong(){
  const t=d3.zoomTransform(svg.node()), inv=1/K, boxes=[], hit=b=>boxes.some(o=>b[0]<o[2]&&b[2]>o[0]&&b[1]<o[3]&&b[3]>o[1]);
  const show=new Set(), D=gDong.selectAll('g.dg').data().slice().sort((a,b)=>b.n-a.n);
  for (const d of D){ const [px,py]=proj([d.lon,d.lat]); const x=t.applyX(px), y=t.applyY(py); const w=Math.max(d.k.length*12,aggLab(d).length*6.4)+16;
    const b=[x-w/2,y-17,x+w/2,y+17]; if (x<-60||y<-30||x>W+60||y>H+30||(d.lv!=='gu'&&hit(b))) continue; boxes.push(b); show.add(d.k); }
  gDong.selectAll('g.dg').attr('transform',d=>{const [x,y]=proj([d.lon,d.lat]); return `translate(${x},${y}) scale(${inv})`;}).attr('display',d=>show.has(d.k)?null:'none');
}
function d3View(){ if (NV || !proj) return; const tr=d3.zoomTransform(svg.node()); const a=proj.invert(tr.invert([0,0])), b=proj.invert(tr.invert([W,H])); if(a&&b) setVB([Math.min(a[1],b[1]),Math.min(a[0],b[0]),Math.max(a[1],b[1]),Math.max(a[0],b[0])]); }
function place(){
  const dongMode = K<DZ;
  if (dongMode && CURLV!==(K<GZ?'gu':'dong')) drawDong();
  gDong.attr('display',dongMode?null:'none'); gMk.attr('display',dongMode?'none':null); gUp.attr('display',dongMode?'none':null);
  { const iv=1/Math.pow(K,0.85); gUp.selectAll('g.up').attr('transform',u=>{const [x,y]=proj([u.lon,u.lat]); return `translate(${x},${y}) scale(${iv})`;}); }
  if (dongMode){ placeDong(); placeBase(); return; }
  const showPrice=K>=2.2, inv=1/Math.pow(K,0.85), sz=inv*K, t=d3.zoomTransform(svg.node());
  if (place.__k!==K || place.__p!==proj){ place.__k=K; place.__p=proj; gMk.selectAll('g.mk').attr('transform',c=>{const [x,y]=proj([c.mlo,c.mla]); return `translate(${x},${y}) scale(${inv})`;}); }
  const vis=VIS||new Set(visible().map(c=>c.id));
  const order=ORD||[...CX].sort((a,b)=>(vis.has(b.id)-vis.has(a.id)) || (b.id===S.sel)-(a.id===S.sel) || (scoreOf(b)??-1)-(scoreOf(a)??-1));
  const G=boxGrid(), hit=G.hit, boxes=[], mode=new Map(); const _push=b=>{ boxes.push(b); G.add(b); };
  for (const c of order){
    const [px,py]=proj([c.mlo,c.mla]); const x=t.applyX(px), y=t.applyY(py);
    if (!vis.has(c.id) || x<-40||y<-20||x>W+40||y>H+20){ mode.set(c.id,'dot'); continue; }
    const pill=[x-19*sz,y-10*sz,x+19*sz,y+10*sz];
    if (c.id!==S.sel && hit(pill)){ mode.set(c.id,'dot'); continue; }
    _push(pill);
    const pw=(eok(repPrice(c)).length*7+10)*sz, lab=[x+19.5*sz,y-9*sz,x+17*sz+pw,y+9*sz];
    if (showPrice && !hit(lab)){ _push(lab); mode.set(c.id,'full'); } else mode.set(c.id,'pill');
  }
  MKB=boxes;
  gMk.selectAll('g.mk').each(function(c){
    const m=mode.get(c.id); if (this.__m===m) return; this.__m=m; const g=d3.select(this);
    g.select('.pill').attr('x',m==='dot'?-5:-19).attr('y',m==='dot'?-5:-10).attr('width',m==='dot'?10:38).attr('height',m==='dot'?10:20).attr('rx',m==='dot'?5:7);
    g.select('.sc').attr('display',m==='dot'?'none':null);
    g.selectAll('.pr,.prbg').attr('display',m==='full'?null:'none');
  });
  placeBase();
}
function njFit(rg,gu){            // v0.9 나주 → v2.0 지역별(rg) → v3.0 시군별(gu) 이동(내장 지도)
  const ps=CX.filter(c=>c.nj&&(!rg||c.rg===rg)&&(!gu||c.gu===gu)).map(c=>proj([c.lon,c.lat])); if(!ps.length) return;
  const x0=d3.min(ps,p=>p[0]),x1=d3.max(ps,p=>p[0]),y0=d3.min(ps,p=>p[1]),y1=d3.max(ps,p=>p[1]); const k=Math.min(8,.6*Math.min(W/Math.max(1,x1-x0),H/Math.max(1,y1-y0)));
  svg.transition().duration(450).call(zoom.transform, d3.zoomIdentity.translate(W/2-k*(x0+x1)/2, H/2-k*(y0+y1)/2).scale(k));
}
function flyTo(c){
  if (NV){ const mobile=matchMedia('(max-width:900px)').matches; NV.setZoom(Math.max(NV.getZoom(),15),false); NV.setCenter(new naver.maps.LatLng(c.mla,c.mlo));
    NV.panBy(new naver.maps.Point(mobile?0:-150, mobile?NV.getSize().height*0.2:0)); return; }
  const [x,y]=proj([c.mlo,c.mla]); const k=Math.max(K,4), mobile=matchMedia('(max-width:900px)').matches;
  const cy=mobile?H*0.30:H/2, cx=mobile?W/2:(W+300)/2;
  svg.transition().duration(450).call(zoom.transform, d3.zoomIdentity.translate(cx-k*x, cy-k*y).scale(k));
}
$('zin').onclick=()=>svg.transition().duration(220).call(zoom.scaleBy,1.6);
$('zout').onclick=()=>svg.transition().duration(220).call(zoom.scaleBy,1/1.6);
$('zfit').onclick=()=>svg.transition().duration(300).call(zoom.transform,d3.zoomIdentity);
document.querySelectorAll('.zrg').forEach(b=>b.onclick=()=>njFit(b.dataset.rg,b.dataset.gu));

/* ═════════ 패널: 목록 ═════════ */
const gradeChip = c => { const g=gradeOf(c); return g==null ? `<span class="grade tent"><span>${c.rent&&!S.mine?'임대':'잠정'}</span></span>` : `<span class="grade" style="background:${gCol(g)};color:${gInk(g)}"><span>${g}<small>등급</small></span></span>`; };
const bandBtn = c => `<button class="vbtn vpill ${c.band}" data-pid="${c.id}" aria-label="${BAND[c.band]} 상세">${BAND[c.band]}${c.gap!=null?' '+pct1(c.gap):''}</button>`;
function setSide(open){   // v1.7 연구원: 데스크톱에서 단지 목록 접기·펴기(지도 전체 보기)
  $('bodyG').classList.toggle('collapsed', !open); const t=$('sideTab'); t.textContent = open?'‹':'›'; t.title = open?'목록 접기':'목록 펼치기'; t.setAttribute('aria-label', open?'단지 목록 접기':'단지 목록 펼치기');
  setTimeout(()=>dispatchEvent(new Event('resize')), 30);
}
$('sideTab').onclick=()=>setSide($('bodyG').classList.contains('collapsed'));
// v3.0.10 연구원: 목록 = 지금 보고 있는 지도 안 단지(지역 버튼으로 순천을 보면 순천 단지가 등급순으로)
let VB=null, VBT=null, LMORE=150;
function setVB(b){ VB=b; clearTimeout(VBT); VBT=setTimeout(()=>{ if (!(S.view==='detail' && S.sel)){ LMORE=150; renderPanel(); } },120); }
const inVB=c=>!VB || (c.lat>=VB[0] && c.lat<=VB[2] && c.lon>=VB[1] && c.lon<=VB[3]);
function renderPanel(){
  if (S.view==='detail' && S.sel) return renderDetail();
  const all=visible(), list=all.filter(inVB), nf=list.filter(c=>c.final).length;
  $('ptop').innerHTML = `<span class="cnt">${VB&&list.length<all.length?'지도 안 ':''}<b class="num">${list.length}</b>개 단지${S.mine?` · 예산 ${eok(S.mine.maxP/10000)} 이하`:''}</span>
    <span class="sortWrap"><select id="sort" aria-label="정렬"><option value="score">${S.mine?'내 점수순':'등급순'}</option><option value="loc">입지점수순</option><option value="gap">저평가 큰 순</option><option value="price">가격 낮은 순</option><option value="turn">거래 활발 순</option></select></span>`;
  $('sort').value=S.sort; $('sort').onchange=e=>{S.sort=e.target.value; renderPanel();};
  $('pbody').innerHTML = list.length ? `<ul class="list">${list.slice(0,LMORE).map(itemHTML).join('')}</ul>${list.length>LMORE?`<p style="padding:8px 16px 20px"><button class="btn" id="lmore" style="width:100%">더 보기 (${(list.length-LMORE).toLocaleString()}곳 남음)</button></p>`:''}` : `<div class="empty">조건에 맞는 단지가 없습니다.<br>필터를 줄이거나 예산을 늘려 보세요.</div>`;
  $('pbody').querySelectorAll('.item[data-id]').forEach(b=>b.onclick=()=>select(b.dataset.id));
  if ($('lmore')) $('lmore').onclick=()=>{ const y=$('pbody').scrollTop; LMORE+=300; renderPanel(); $('pbody').scrollTop=y; };
  $('pbody').querySelectorAll('[data-pid]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); openPrice(b.dataset.pid); });
}
function itemHTML(c){
  const pt = S.mine && S.mine.size!=='all' ? bandPrice(c) : repPrice(c), r=repType(c), sc=scoreOf(c);
  return `<li class="row"><button class="item" data-id="${c.id}">
    ${gradeChip(c)}
    <span style="min-width:0"><span class="nm">${c.dong} ${c.n}</span><br><span class="sub">${c.gu} · ${c.u.toLocaleString()}세대 · ${c.y}년</span>
      <span class="tags">${tagsShow(c)}</span></span>
    <span class="rt"><span class="score num">${f1(sc)}<small>${S.mine?'':'점'}</small></span><span class="price">${r?`${typeLabel(r)} `:''}${eok(pt)}</span></span>
  </button>${bandBtn(c)}</li>`;
}
async function select(id, opts={}){ { const _c=CX.find(x=>x.id===id); if (_c) await window.__ensureDetail(_c); }
  const wasFolded=$('bodyG').classList.contains('collapsed');
  if (wasFolded) setSide(true);           // v0.7.5 연구원: 목록을 접은 상태에서 단지를 누르면 목록을 펼쳐 상세를 보여줌
  S.sel=id; S.view='detail'; drawMarkers(); renderPanel();
  const c=CX.find(x=>x.id===id); if (c && !opts.noFly) { if (wasFolded) setTimeout(()=>flyTo(c), 260); else flyTo(c); }
  sheetTo('half'); $('pbody').scrollTop=0;
}

/* ═════════ 패널: 상세 ═════════ */
function itemRow(c,k){
  const v=c.it[k];
  return `<div class="it ${v==null?'miss':''}"><span class="in">${NAMES[k]}</span><span class="iv num">${v==null?'자료 없음':f1(v)+'<small> /10</small>'}</span><span class="ir">${c.raw[k]||''}${v==null?' → 이 항목은 빼고 같은 영역의 나머지 항목으로 계산':''}</span></div>`;
}
function futureLines(c){            // v3.0.0 연구원: 역세권은 1km 넘으면 의미가 적음 → 1km 안일 때만. 확장 지역은 지역 개발 계획(FUT, 출처 있는 것만)
  const L=[];
  const F=(DATA.future||{})[c.nj?c.gu:'광주']||[];
  if (c.sub2&&c.sub2[1]<=1000){ L.push(`도시철도 2호선 예정역 <b>${c.sub2[0]}</b>까지 약 ${c.sub2[1].toLocaleString()}m`); L.push('2호선 1단계(시청~광주역) 공사 중, 개통 시기는 공식 발표 확인'); L.push('※ 개통이 연기됐다는 보도가 있습니다(’26.10.2)'); L.push('※ 개통 시기·운행 조건은 공식 발표로 다시 확인하세요'); }
  else if (!c.nj) L.push('1km 안에 도시철도 2호선 예정역이 없습니다');
  F.forEach(f=>L.push(`${f.t}${f.src?` <span style="color:var(--muted);font-size:12px">(${f.src})</span>`:''}`));
  if (!L.length) L.push('확인된 개발 계획 자료를 준비 중입니다');
  return L.map(t=>`<p>${t}</p>`).join('');
}
function jsHTML(c){
  const j=c.js; if (!j) return `<p class="note" style="margin:8px 0 0">전세가율: 최근 1년 전세 거래가 적어 계산하지 않았습니다.</p>`;
  const [ar,jm,nj,sm,ns,r]=j.rep, ci=DATA.jsCity;
  const word = r>=ci+5 ? '광주 중위보다 높은 편' : r<=ci-5 ? '광주 중위보다 낮은 편' : '광주 중위와 비슷';
  return `<div class="jsbox"><div class="ptop3"><span class="v num" style="font-size:18px">전세가율 약 ${Math.round(r)}%</span><span class="s">${word} · 광주 단지 중위 ${ci}%</span></div>
    <p class="note" style="margin:2px 0 6px">전용 ${ar}㎡ 기준 · 전세 중위 ${eok(jm)}(${nj}건) ÷ 매매 중위 ${eok(sm)} · 최근 1년 전세 실거래</p>
    ${j.rows.length>1?`<div class="tblwrap"><table class="t"><thead><tr><th>전용</th><th>전세 중위</th><th>매매 중위</th><th>전세가율</th></tr></thead><tbody>${j.rows.map(([a,jm,nj,sm,ns,r])=>`<tr><td>${a}㎡</td><td class="num">${eok(jm)} <span style="color:var(--muted)">${nj}건</span></td><td class="num">${eok(sm)}</td><td class="num">${Math.round(r)}%</td></tr>`).join('')}</tbody></table></div>`:''}
    <p class="note" style="margin:4px 0 0">갱신 계약이 섞여 있어 시세보다 낮게 나올 수 있습니다. 전세가율이 높으면 매매가 대비 전세 수요가 탄탄하다는 뜻이지만, 깡통전세 위험도 함께 커집니다.</p></div>`;
}
function rateTxt(v){ if(!v) return '–'; const [n,r]=v; const m=String(r).match(/△\s*(\d+)/); if (m && n==null) return `<span style="color:var(--bad)">최종 미달 ${m[1]}</span>`; if (m) return `${n.toLocaleString()}명 <span style="color:var(--bad)">미달 ${m[1]}</span>`; return r && r!=='-' ? `${n.toLocaleString()}명 <b>${r}:1</b>` : `${n.toLocaleString()}명`; }
function openUp(id){
  const u=UP.find(x=>x.id===id), ov=$('ovPrice'); ov.hidden=false;
  const tyRows=u.tys.map(t=>`<tr><td>${t.ty}${t.pno!==u.pno?' <span style="color:var(--muted)">취소분</span>':''}<br><span style="color:var(--muted);font-size:11px">공급 ${t.ar?t.ar.toFixed(1)+'㎡':'–'}</span></td><td class="num">${t.top?eok(t.top):'–'}</td><td class="num">${t.gen??'–'}${t.sp?`<br><span style="color:var(--muted);font-size:11px">특공 ${t.sp}</span>`:''}</td><td class="num">${rateTxt(t.r1h)}</td><td class="num">${rateTxt(t.r1e)}</td><td class="num">${rateTxt(t.r2h)}</td></tr>`).join('');
  const silv=u.silv.length?`<div class="tblwrap"><table class="t"><thead><tr><th>전용</th><th>거래</th><th>최근 1년 중위</th><th>최근 거래</th></tr></thead><tbody>${u.silv.map(([a,n,md,last,dt])=>`<tr><td>${a}㎡</td><td class="num">${n}건</td><td class="num">${eok(md)}</td><td class="num">${eok(last)} <span style="color:var(--muted)">’${dt}</span></td></tr>`).join('')}</tbody></table></div><p class="note">분양권 전매 실거래(’24.9~’26.9, 해제 거래 제외). 분양가와 비교할 때는 같은 주택형인지 확인하세요.</p>`:`<p class="note">’24.9~’26.9 분양권 전매 실거래가 없습니다(전매 제한 기간이거나 거래 없음).</p>`;
  ov.innerHTML=`<div class="drawer" role="dialog" aria-modal="true" aria-labelledby="upT"><div class="dh"><h2 id="upT">입주예정 단지</h2><button class="back" id="pClose" aria-label="닫기">✕</button></div><div class="db">
    <div><div style="font-weight:700;font-size:17px">${u.n}</div><div class="dmeta">${u.addr} · ${u.u.toLocaleString()}세대(공고 공급) · ${u.b}</div>
      <div class="tags" style="margin-top:6px"><span class="tag">입주 예정 ${ymTxt(u.mvn)}</span><span class="tag">모집공고 ${u.pbl.replace(/-/g,'.').slice(2)}</span></div></div>
    ${u.eloc?`<section class="sec" style="margin:0"><h2>예상 입지 등급 <b style="color:var(--accent)">${u.eloc.g}등급</b> <span style="font-size:13px;font-weight:400;color:var(--muted)">(예상 입지 점수 ${f1(u.eloc.s)}점)</span></h2><p class="note">반경 2km 안 기존 단지 ${u.eloc.k||u.eloc.n.length}곳의 입지 점수를 거리로 가중 평균한 추정값입니다(참고용). 가까운 곳: ${u.eloc.n.join(' · ')}</p></section>`:'<p class="note">반경 2km 안 기존 단지가 2곳 미만이라 예상 입지 등급을 계산하지 않았습니다.</p>'}
    <div class="callout">아직 입주 전이라 종합 등급은 매기지 않습니다. 입주 후 실거래·관리 자료가 쌓이면 평가에 넣습니다.${u.approx?'<br>※ 지도 위치는 근사입니다('+u.gsrc.replace('위치 근사: ','')+').':''}</div>
    <section class="sec"><h2>주택형별 분양가·청약 경쟁률</h2>${u.cmp&&u.cmp.sup?`<p style="margin:0 0 8px">일반공급 <b class="num">${u.cmp.sup.toLocaleString()}</b>세대 · 1순위 접수 <b class="num">${u.cmp.req1.toLocaleString()}</b>건(평균 <b>${u.cmp.rate1}:1</b>)${u.cmp.short?` · <span style="color:var(--bad)">2순위까지 미달 ${u.cmp.short.toLocaleString()}세대(${u.cmp.shortPct}%)</span>`:' · 미달 없음'}</p>`:''}${u.unsold!=null?`<p style="margin:0 0 8px">광주시 미분양 현황(’26.8월말): ${u.unsold?`<b style="color:var(--bad)">미분양 ${u.unsold}세대</b>`:'미분양 없음'}</p>`:''}${u.tys.length?'':'<p class="note">이 지역은 주택형별 경쟁률 자료를 아직 받지 않았습니다. 아래 청약홈 공고에서 확인하세요.</p>'}<div class="tblwrap"${u.tys.length?'':' hidden'}><table class="t"><thead><tr><th>주택형(전용)</th><th>분양 최고가</th><th>일반공급</th><th>1순위 해당지역</th><th>1순위 기타지역</th><th>2순위 해당지역</th></tr></thead><tbody>${tyRows}</tbody></table></div>
      <p class="note">경쟁률 = 1순위 해당지역 접수 기준(청약홈 표기). 미달은 공급보다 접수가 적었던 세대 수(광양만권 ‘2순위 해당지역’ 칸은 2순위까지 받은 뒤 최종 미달). 분양가는 주택형별 최고가(발코니 확장·옵션 제외).</p></section>
    <section class="sec"><h2>분양권 실거래</h2>${silv}</section>
    ${u.notes.length?`<p class="note">같은 단지의 추가 공고: ${u.notes.join(' · ')}</p>`:''}
    <p><a class="btn" href="${u.url}" target="_blank" rel="noopener">청약홈 공고 보기 ↗</a></p>
    <p class="note">출처: ${DATA.upSrc}</p>
  </div></div>`;
  $('pClose').onclick=()=>ov.hidden=true; ov.onclick=e=>{if(e.target===ov) ov.hidden=true;};
}
function renderDetail(){
  const c=CX.find(x=>x.id===S.sel), g=gradeOf(c);
  $('ptop').innerHTML = `<button class="back" id="back" aria-label="목록으로">‹</button><span></span><span></span>`;
  $('back').onclick=()=>{S.view='list'; S.sel=null; drawMarkers(); renderPanel();};
  const areas = AREAS.map((a,i)=>{
    const v=c.area[a], open=S.openCat===a, full=c.afull[a];
    const its = Object.keys(IN[a]).map(k=>itemRow(c,k)).join('');
    return `<button class="area" data-cat="${a}" aria-expanded="${open}"><span class="an">${i+1}. ${AN[a]}<span class="aw">비중 ${Math.round(M.areaW[a]*100)}%</span></span><span class="bar"><i style="width:${(v||0)*10}%;background:${full?'var(--accent)':'var(--muted)'}"></i></span><span class="s num">${v==null?'–':f1(v)}<small>/10</small></span><span class="chev">▶</span></button>${open?`<div class="subs">${its}</div>`:''}`;
  }).join('');
  const inCmp=S.cmp.includes(c.id);
  const tot = c.final ? c.total : c.tent;
  const subsc = [[`입지 점수${c.locG?` (${c.locG}등급${c.locRank?` · ${({gj:'광주',sw:'목포권',east:'광양만권'})[c.zn]||''} ${c.locRank.toLocaleString()}위`:''})`:''}`, c.loc ?? c.locTent], ['상품성 점수', c.area.C!=null?c.area.C*10:null], ['거래활발도 점수', c.area.Q!=null?c.area.Q*10:null]]
    .map(([l,v])=>`<span>${l} <b class="num">${v==null?'–':f1(v)}</b></span>`).join('') + (c.mktG?`<span title="실거래 시세에서 단지 상품성 몫을 뺀 '시장이 매기는 입지 가격'의 권역 안 등급">시장 검증 입지 <b class="num">${c.mktG}등급</b>${c.mktE?' (이웃 단지로 추정)':(c.y||0)>2023?' (신축·참고)':''}</span>`:'');
  const pro = (c.hi||[]).map(([k,t])=>`<li>${t}</li>`).join('') || '<li>두드러진 강점 항목이 없습니다</li>';
  const con = (c.lo||[]).map(([k,t])=>`<li>${t}</li>`).join('') || '<li>두드러진 약점 항목이 없습니다</li>';
  const flags=[]; if (c.mktG && c.locG && !c.mktE && (c.y||9999)<=2023 && Math.abs(c.mktG-c.locG)>=3) flags.push(c.mktG<c.locG?`시장 평가와 차이 큼: 입지 점수는 ${c.locG}등급인데 실거래가로 본 입지(시장 검증)는 ${c.mktG}등급입니다. 점수에 안 잡히는 장점(동네 평판·학군 선호 등)이 있을 수 있습니다.`:`시장 평가와 차이 큼: 입지 점수는 ${c.locG}등급인데 실거래가로 본 입지(시장 검증)는 ${c.mktG}등급입니다. 점수에 안 잡히는 약점이 있는지 확인하세요.`); if (c.xs.ecross==='big' && !c.xs.evia) flags.push('배정 초등학교 가는 길에 왕복 4차로 이상 큰길을 건넙니다. 통학 안전을 따로 확인하세요.'); if (c.xs.evia) flags.push(`배정 초등학교 가는 길에 큰길을 ${c.xs.evia}로 건넙니다.`); if (c.xs.encr && c.xs.encr[0]>=3) flags.push(`배정 초등학교 가는 길에 왕복 2차로 이하 길을 ${c.xs.encr[0]}번 건넙니다.`);
  const a3=c.p.a3, gp = c.gap!=null ? pct(c.gap) : '';
  const mt=mainType(c), mtl=mt?`${mt.py}평형(전용 ${mt.ex}㎡)`:'';
  const priceTop = mt && mt.a3 ? `<div class="ptop3"><span class="v num">${eok(mt.a3)}원</span>${bandBtn(c)}</div><div class="ptop3"><span class="s">${mtl} 최근 3개월 평균 실거래가 · ${mt.n3}건 · ${c.hb?'세대가 가장 많은 평형대':'거래가 가장 많은 평형'}</span></div>`
    : `<div class="ptop3"><span class="s">${mt?`${mtl} 최근 3개월 거래가 없습니다 · 최근 거래 ${eok(mt.last)}원(’${mt.dt.slice(0,2)}.${+mt.dt.slice(2,4)})`:'최근 1년 매매 거래가 없습니다'}</span>${bandBtn(c)}</div>`;
  const pmsg = c.band==='hold' ? `${(c.pm&&c.pm.holdWhy)||'비교 자료 부족'}이라 고평가·저평가를 판정하지 않습니다.`
    : c.band==='over' ? '인근 비슷한 조건 단지의 시세보다 실거래가가 높습니다.'
    : c.band==='under' ? '인근 비슷한 조건 단지의 시세보다 실거래가가 낮습니다.'
    : '인근 비슷한 조건 단지의 시세와 실거래가가 비슷합니다.';
  $('pbody').innerHTML = `<div class="detail">
    <div><div class="dtitle"><h1>${c.dong} ${c.n}</h1><button class="star ${inCmp?'on':''}" id="star" aria-pressed="${inCmp}" aria-label="${inCmp?'비교함에서 빼기':'비교함에 담기'}" title="${inCmp?'비교함에서 빼기':'비교함에 담기'}">${inCmp?'★':'☆'}</button></div>
      <div class="dmeta">${c.gu} ${c.addr||''} · ${c.u.toLocaleString()}세대 · ${c.ym?String(c.ym).slice(0,4)+'.'+String(c.ym).slice(4):c.y} 사용승인 · ${c.b||''}</div>
      <div class="dmeta">${c.far?`용적률 ${c.far}%${c.fe?'(추정)':''}`:'용적률 미확인'}${c.bcr?` · 건폐율 ${c.bcr}%`:''}</div>
      <div class="tags" style="margin-top:6px">${tagsShow(c)}</div></div>
    <section class="hero">
      <div class="ghead">${g==null?`<span class="gnum tent">${c.rent&&!S.mine?'임대 단지':'등급 산출 전'}</span>`:`<span class="gnum" style="background:${gCol(g)};color:${gInk(g)}">${g}등급</span>`}
        <div><div class="gwhere">${g==null?(c.rent&&!S.mine?`종합 등급 없음 · 입지 ${c.locG??'-'}등급`:'잠정 평가'):(c.zn?`${({gj:'광주',sw:'목포권',east:'광양만권'})[c.zn]} 아파트 ${c.zN.toLocaleString()}곳 중 상위 ${f1(c.pct)}%`:`광주 아파트 기준 상위 ${f1(c.pct)}%`)}</div><div class="gbase">${g==null?(c.rent&&!S.mine?`임대 단지는 매매 거래가 없어 시장 검증·상품 선택이 성립하지 않습니다. 매수용 종합 등급을 매기지 않고 입지 등급(교육·생활·직주·광역·공급)만 표시합니다. 분양전환 뒤 매매가 생기면 일반 단지로 평가합니다`:`자료가 빠진 항목이 있어 등급을 붙이지 않았습니다`):(c.grade>c.grade0?`단지 점수(${f1(c.total0)}점)로는 ${c.grade0}등급이지만 `+({small:`100세대 미만(최고 3등급. 최근 2년 매매 10건 이상이고 실거래가 광주 상위 7% 안이면 2등급 · 이 단지 ${c.rpp!=null?`상위 ${Math.round(c.rpp)}%`:'거래 없음'} · 2년 매매 ${(c.p&&c.p.q24&&c.p.q24.n)||0}건)`,old:`입주 25년 이상(최고 3등급. 최근 2년 매매 10건 이상이고 실거래가 광주 상위 7% 안이면 2등급 · 이 단지 ${c.rpp!=null?`상위 ${Math.round(c.rpp)}%`:'거래 없음'} · 2년 매매 ${(c.p&&c.p.q24&&c.p.q24.n)||0}건)`,price:`1등급은 실거래가(㎡당) 광주 상위 4% 안에서만(이 단지 상위 ${c.rpp==null?'-':Math.round(c.rpp)}%)`,nopx:`최근 2년 자기 실거래가 없음 — 시장 검증을 할 수 없어 최고 3등급`,rentpx:`임대 단지(매매 거래 없음) — 이웃 시세를 빌리지 않아 최고 4등급`,hd:`동네 급지(광주 상위 ${Math.round(c.qhd)}%)`,px:(c.pxp==null?`실거래 시세 없음(최고 3등급)`:`시장 검증 입지(신축·대단지 프리미엄 포함, 광주 상위 ${Math.round(c.pxp)}%, 최고 ${Math.min(c.cap,4)}등급)`),px1:`1등급은 순수 자리값 상위 ${M.px1p||4}% 안에서만(이 단지 상위 ${c.mktPg==null?'-':Math.round(c.mktPg)}%)`,unsold2:(c.unsT?`미분양 — 준공(${c.unsT[4]}) 때 ${c.unsT[2]}세대 · 지금 ${c.unsT[5]??'-'}세대(단지 ${c.unsT[3].toLocaleString()}세대의 최대 ${c.unsT[1]}%, 최고 ${c.unsT[0]}등급${c.unsT[6]?` · 출처: ${c.unsT[6]}`:' · 광주시 월별 미분양 현황'})`:'미분양'),elite:`상급지 조건 미달(단지 시세 상위 ${c.pxp==null?'-':Math.round(c.pxp)}%)`,fill:`위 등급 정원이 찬 순서(점수 순)`,loc:`입지 점수(${({gj:'광주',sw:'목포권',east:'광양만권'})[c.zn]||''} ${c.locG}등급 — 종합 등급은 입지 등급보다 한 단계까지만 위)`,unsold:`미분양 세대 3% 이상(최고 3등급)`}[c.why]||'등급 상한')+` 기준으로 ${c.grade}등급`+(c.lok?' (생활권 안 상급지 조건을 만족해 2등급까지 허용)':''):(c.lok?'종합점수 기준 · 생활권 안 상급지 조건 충족':'종합점수 기준'))}</div></div></div>
      <div class="tot"><span class="l">종합점수</span><span class="v num">${f1(tot)}<small> /100</small></span></div>
      <div class="dmeta" style="margin-top:-4px">${c.total0!=null&&Math.abs(c.total0-c.total)>=0.05?`단지 점수 ${f1(c.total0)}점을 ${c.grade}등급 점수 범위로 환산 · `:''}기본점수 ${f1(c.B)} ${c.Msum<0?`+ 가점 ${f1(-c.Msum)}`:`− 보정 ${f1(c.Msum)}`}${c.qhd!=null?` · 동네 급지: 광주 상위 ${Math.round(c.qhd)}%`:''}${c.relax?' · 대장 단지(시세 상위 5%)로 상한 1단계 완화':''}</div>
      <div class="subsc">${subsc}</div>
    </section>
    <section class="sec"><h2>보정 점수 <span style="font-weight:500;color:var(--muted);font-size:12px">시장에서 할인되는 단지 특성(감점, 최대 10점) · 하이엔드 브랜드는 가점</span></h2><div>${(c.M&&c.M.length)?c.M.map(m=>`<div class="it"><span class="in">${m[0]}</span>${m[1]<0?`<span class="iv num" style="color:var(--accent)">+${f1(-m[1])}</span>`:`<span class="iv num" style="color:var(--bad)">−${f1(m[1])}</span>`}<span class="ir">${m[2]}</span></div>`).join('')+(c.M.reduce((a,m)=>a+Math.max(0,m[1]),0)>10?`<p class="note">합계가 10점을 넘어 10점에서 자름</p>`:''):'<p class="note" style="margin:6px 0">해당하는 보정 항목이 없습니다.</p>'}</div></section>
    <section class="pros"><div class="p"><h3>장점</h3><ul>${pro}</ul></div><div class="c"><h3>약점</h3><ul>${con}</ul></div></section>
    <section class="sec"><h2>영역별 점수</h2><div>${areas}</div></section>
    <section class="card"><h2 style="font-size:14px;margin:0;font-weight:700">실거래가<span class="tagref">참고 정보</span></h2>
      ${priceTop}
      <p class="note" style="font-size:12.5px;color:var(--ink)">${pmsg}</p>
      ${c.p.med ? `<div class="tblwrap"><table class="t"><thead><tr><th>평형(전용)</th><th>최근 1년 거래량</th><th>최근 3개월 중위가격</th><th>최근 거래</th></tr></thead><tbody>${c.types.map(t=>`<tr><td>${t.py}평(${t.ex}㎡)</td><td class="num">${t.n}건</td><td class="num">${t.m3!=null?eok(t.m3):'<span style="color:var(--muted)">–</span>'}</td><td class="num">${eok(t.last)} <span style="color:var(--muted)">’${t.dt.slice(0,2)}.${+t.dt.slice(2,4)}.${+t.dt.slice(4)}</span></td></tr>`).join('')}</tbody></table></div>` : ''}
      <div class="chart" id="pchart"></div>
      ${jsHTML(c)}</section>
    ${(c.xs.tr||[]).length?`<section class="card"><h2 style="font-size:14px;margin:0;font-weight:700">교통 한눈에</h2><dl class="kv">${c.xs.tr.map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></section>`:''}
    <section class="card"><h2 style="font-size:14px;margin:0;font-weight:700">미래 변화</h2><div class="lines">${futureLines(c)}</div></section>
    <section class="card"><h2 style="font-size:14px;margin:0;font-weight:700">개별 위험·확인 사항</h2><div class="lines">${flags.map(f=>`<p>${f}</p>`).join('')}<p>이 분석은 AI가 공공데이터로 자동 계산한 결과입니다. 실제 매수 등 중요한 결정 전에는 현장 방문과 공식 자료로 사람이 직접 다시 확인해 주세요.</p></div></section>
    <section class="card"><h2 style="font-size:14px;margin:0;font-weight:700">출처</h2><ul class="note" style="margin:0;padding-left:16px">${M.sources.map(s=>`<li>${s}</li>`).join('')}</ul></section>
  </div>`;
  $('pbody').querySelectorAll('.area').forEach(b=>b.onclick=()=>{S.openCat=S.openCat===b.dataset.cat?null:b.dataset.cat; renderDetail();});
  $('pbody').querySelectorAll('[data-pid]').forEach(b=>b.onclick=()=>openPrice(b.dataset.pid));
  $('star').onclick=()=>toggleCmp(c.id);
  priceChart($('pchart'), [c]);
}
function priceChart(el, list){
  // v1.2.4: 점·선이 축 밖으로 나가지 않게 여백·클립, 점(월)에 마우스·터치하면 그 달 가격 표시
  const W=380,H=180,m={l:44,r:12,t:14,b:26}, months=DATA.months, pad=9;
  const ser=list.map(c=>({c, pts:(c.p.mo||[]).map((v,i)=>({i,v,n:c.p.mc[i]})).filter(p=>p.v!=null)}));
  const all=ser.flatMap(s=>s.pts.map(p=>p.v));
  if (!all.length){ el.innerHTML='<p class="note">최근 12개월 거래가 없습니다.</p>'; return; }
  let [lo,hi]=d3.extent(all); const sp=(hi-lo)||hi*0.1; lo-=sp*0.12; hi+=sp*0.12;
  const x=d3.scaleLinear().domain([0,months.length-1]).range([m.l+pad,W-m.r-pad]);
  const y=d3.scaleLinear().domain([lo,hi]).nice(4).range([H-m.b-pad,m.t+pad]);
  const fm=i=>`’${months[i].slice(2,4)}.${+months[i].slice(5,7)}`;
  const s=d3.create('svg').attr('viewBox',`0 0 ${W} ${H}`).attr('role','img').attr('aria-label','월별 84㎡ 환산 중위 거래가');
  const cid='clip-'+el.id; s.append('defs').append('clipPath').attr('id',cid).append('rect').attr('x',m.l).attr('y',m.t).attr('width',W-m.l-m.r).attr('height',H-m.t-m.b);
  s.append('g').attr('class','axis').attr('transform',`translate(0,${H-m.b})`).call(d3.axisBottom(x).tickValues(d3.range(0,months.length,3)).tickFormat(fm).tickSizeOuter(0));
  s.append('g').attr('class','axis').attr('transform',`translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickFormat(v=>(v/10000).toFixed(1)+'억').tickSize(-(W-m.l-m.r))).call(g=>g.selectAll('.tick line').attr('stroke','var(--line)').attr('stroke-dasharray','2 3')).call(g=>g.select('.domain').remove());
  const cols = list.length>1 ? ['#3182f6','#f04452','#00a870','#f2994a'] : ['#3182f6'];
  const plot=s.append('g').attr('clip-path',`url(#${cid})`);
  const guide=plot.append('line').attr('y1',m.t).attr('y2',H-m.b).attr('stroke','var(--muted)').attr('stroke-dasharray','3 3').attr('opacity',0);
  const dots=ser.map((sr,k)=>{
    plot.append('path').attr('d',d3.line().x(p=>x(p.i)).y(p=>y(p.v))(sr.pts)).attr('fill','none').attr('stroke',cols[k]).attr('stroke-width',2.2);
    return plot.append('g').selectAll('circle').data(sr.pts).join('circle').attr('cx',p=>x(p.i)).attr('cy',p=>y(p.v)).attr('r',p=>2+Math.min(4,Math.sqrt(p.n))).attr('fill',cols[k]).attr('opacity',.85);
  });
  const idx=[...new Set(ser.flatMap(sr=>sr.pts.map(p=>p.i)))].sort((a,b)=>a-b);
  el.innerHTML=''; el.style.position='relative'; el.append(s.node());
  const tip=document.createElement('div');
  tip.style.cssText='position:absolute;pointer-events:none;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:5px 8px;font-size:12px;line-height:1.45;box-shadow:0 2px 8px rgba(0,0,0,.12);white-space:nowrap;display:none;z-index:2';
  el.append(tip);
  const show=ev=>{
    const r=s.node().getBoundingClientRect(), k=W/r.width, px=(ev.clientX-r.left)*k;
    const i=idx.reduce((b,j)=>Math.abs(x(j)-px)<Math.abs(x(b)-px)?j:b, idx[0]);
    guide.attr('x1',x(i)).attr('x2',x(i)).attr('opacity',1);
    dots.forEach(d=>d.attr('stroke',p=>p.i===i?'var(--surface)':null).attr('stroke-width',p=>p.i===i?2:null).attr('opacity',p=>p.i===i?1:.85));
    const rows=ser.map((sr,j)=>{ const p=sr.pts.find(q=>q.i===i); return p?`<div>${list.length>1?`<span style="color:${cols[j]}">●</span> ${sr.c.n} `:''}<b>${eok(p.v)}</b> <span style="color:var(--muted)">${p.n}건</span></div>`:''; }).join('');
    tip.innerHTML=`<div style="color:var(--muted)">${months[i].slice(0,4)}년 ${+months[i].slice(5,7)}월</div>${rows}`;
    tip.style.display='block';
    const er=el.getBoundingClientRect(), sx=r.left-er.left+x(i)/k, tw=tip.offsetWidth;
    tip.style.left=Math.max(0,Math.min(er.width-tw, sx-tw/2))+'px'; tip.style.top=(r.top-er.top+2)+'px';
  };
  const hide=()=>{ tip.style.display='none'; guide.attr('opacity',0); dots.forEach(d=>d.attr('stroke',null).attr('opacity',.85)); };
  s.append('rect').attr('x',m.l).attr('y',m.t).attr('width',W-m.l-m.r).attr('height',H-m.t-m.b).attr('fill','transparent').style('cursor','crosshair')
    .on('pointermove',show).on('pointerdown',show).on('pointerleave',hide);
  if (list.length>1){ const cap=document.createElement('p'); cap.className='note'; cap.innerHTML=list.map((c,k)=>`<span style="color:${cols[k]}">■</span> ${c.n}`).join(' · '); el.append(cap); }
}

/* ═════════ 가격 판정 근거 ═════════ */
async function openPrice(id){ { const _c=CX.find(x=>x.id===id); if (_c) await window.__ensureDetail(_c); }
  const c=CX.find(x=>x.id===id), pm=c.pm, ov=$('ovPrice'); if (!pm) return; ov.hidden=false;
  const steps=[['평균 조건 시세',pm.base,null],['단지 요인',pm.base*(1+pm.cpx),pm.cpx],['입지 요인',pm.base*(1+pm.cpx)*(1+pm.loc),pm.loc],[`반경 500m 시세`,pm.fair,pm.area]];
  const mx=Math.max(pm.fair, c.p.med||0, ...steps.map(s=>s[1]))*1.08;
  const bar=(v,col)=>`<span class="wfbar"><i style="left:0;width:${v/mx*100}%;background:${col}"></i></span>`;
  const wf=steps.map(([l,v,d],i)=>`<div class="wfr"><span class="lab">${l}${d!=null?` <span class="num" style="color:${d>=0?'var(--over)':'var(--under)'}">${pct(d)}</span>`:''}</span>${bar(v,i===0?'var(--muted)':'var(--accent)')}<span class="val">${Math.round(v).toLocaleString()}</span></div>`).join('')
    + `<div class="wfr tot"><span class="lab">추정 ㎡당가</span>${bar(pm.fair,'var(--ink)')}<span class="val">${Math.round(pm.fair).toLocaleString()}</span></div>`
    + (c.p.med?`<div class="wfr tot"><span class="lab">실제 ㎡당 중위가</span>${bar(c.p.med,bandColor(c.band))}<span class="val">${Math.round(c.p.med).toLocaleString()}</span></div>`:'');
  const peers=(pm.peers||[]).map(i=>CX.find(x=>x.id===i)).filter(Boolean);
  const verdict2 = c.band==='hold' ? '최근 거래가 적거나 반경 500m 비교 단지가 부족해 판정을 보류합니다.'
    : `최근 거래가 ㎡당 <b>${fmtMan(c.p.med)}</b>(84㎡ 환산 ${eok(c.p84)})로, 반경 500m·비슷한 조건 추정값 <b>${fmtMan(pm.fair)}</b>보다 <b>${pct(c.gap)}</b> ${c.gap<0?'낮습니다':'높습니다'}.`;
  ov.innerHTML=`<div class="drawer" role="dialog" aria-modal="true" aria-labelledby="prT"><div class="dh"><h2 id="prT">가격 판정 근거</h2><button class="back" id="pClose" aria-label="닫기">✕</button></div><div class="db">
    <div><div style="font-weight:700">${c.dong} ${c.n}</div><span class="vpill ${c.band}" style="font-size:12.5px;padding:3px 10px">${BAND[c.band]}${c.gap!=null?' '+pct(c.gap):''}</span></div>
    <div class="callout">${verdict2}</div>
    <section class="sec"><h2>추정값을 만든 과정 (만원/㎡)</h2><div class="wf">${wf}</div></section>
    <section class="sec"><h2>가격에 크게 작용한 요인</h2><dl class="kv">${(pm.top||[]).map(([n,v])=>`<dt>${n}</dt><dd class="${v>=0?'up':'dn'}">${pct(v)}</dd>`).join('')}</dl></section>
    <section class="sec"><h2>비슷한 조건의 단지</h2><div class="tblwrap"><table class="t"><thead><tr><th>단지</th><th>연식</th><th>세대</th><th>84㎡</th><th>판정</th></tr></thead><tbody>${peers.map(p=>`<tr><td><button class="btn" style="height:28px;padding:0 8px" data-go="${p.id}">${p.dong} ${p.n}</button></td><td class="num">${p.y}</td><td class="num">${p.u.toLocaleString()}</td><td class="num">${eok(p.p84)}</td><td><span class="vpill ${p.band}">${BAND[p.band]}</span></td></tr>`).join('')}</tbody></table></div></section>
    <p class="note">참고값입니다. 감정평가나 적정가격이 아니며 종합점수에 넣지 않습니다.</p>
  </div></div>`;
  $('pClose').onclick=()=>ov.hidden=true; ov.onclick=e=>{if(e.target===ov) ov.hidden=true;};
  ov.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{ ov.hidden=true; select(b.dataset.go); });
}

/* ═════════ 하단 시트(모바일) ═════════ */
const side=$('side'); let sheetState='peek';
function sheetH(st){ const h=window.innerHeight; return st==='peek'?152: st==='half'? Math.round(h*0.52) : Math.round(h - 120); }
function sheetTo(st){ if (!matchMedia('(max-width:900px)').matches) return; sheetState=st; document.documentElement.style.setProperty('--sheet-h', sheetH(st)+'px'); }
(function(){
  let y0=null,h0=0; const hd=$('handle');
  hd.addEventListener('pointerdown',e=>{ y0=e.clientY; h0=side.getBoundingClientRect().height; side.classList.add('dragging'); hd.setPointerCapture(e.pointerId); });
  hd.addEventListener('pointermove',e=>{ if(y0==null) return; const h=clamp(h0+(y0-e.clientY),120,window.innerHeight-100); document.documentElement.style.setProperty('--sheet-h',h+'px'); });
  hd.addEventListener('pointerup',e=>{ if(y0==null) return; side.classList.remove('dragging'); const moved=Math.abs(e.clientY-y0); const h=side.getBoundingClientRect().height; y0=null;
    if (moved<6){ sheetTo(sheetState==='peek'?'half':sheetState==='half'?'full':'peek'); return; }
    const cand=['peek','half','full'].map(s=>[s,Math.abs(sheetH(s)-h)]).sort((a,b)=>a[1]-b[1])[0][0]; sheetTo(cand); });
})();

/* ═════════ 검색 ═════════ */
$('q').addEventListener('input',e=>{
  const q=e.target.value.trim(), box=$('sugg');
  if (!q){ box.hidden=true; return; }
  const hits=CX.filter(c=>(c.dong+' '+c.n+' '+c.gu).includes(q)).slice(0,8);
  box.innerHTML = hits.length ? hits.map(c=>`<button data-id="${c.id}">${c.dong} ${c.n} <span style="color:var(--muted);font-size:12px">${c.gu} · ${gLab(c)} · ${f1(scoreOf(c))}점</span></button>`).join('') : '<div class="empty" style="padding:12px">검색 결과 없음</div>';
  box.hidden=false;
  box.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>{ box.hidden=true; e.target.value=''; select(b.dataset.id); });
});
document.addEventListener('click',e=>{ if(!e.target.closest('.search')) $('sugg').hidden=true; });

/* ═════════ 필터 칩 ═════════ */
document.querySelectorAll('.chip[data-f]').forEach(b=>b.onclick=()=>{
  const v=b.dataset.v;
  if (b.dataset.f==='band'){ S.band = S.band===v ? 'all' : v; document.querySelectorAll('.chip[data-f="band"]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.v===S.band))); S.hint = S.band==='all'?null:v; }
  else { S.tags.has(v)?S.tags.delete(v):S.tags.add(v); b.setAttribute('aria-pressed',String(S.tags.has(v))); S.hint = S.tags.has(v)?v:null; }
  S.macroMin=false; renderMacro(); refresh();
});
$('fReset') && ($('fReset').onclick=()=>{
  Object.assign(S,{band:'all',py:null,units:null,ageR:null,priceR:null,far:null,bcr:null,qR:null,pkR:null,hint:null,pop:null});
  S.grades.clear(); S.tags.clear();
  document.querySelectorAll('.chip[data-f]').forEach(x=>x.setAttribute('aria-pressed','false'));
  const pp=$('fpop'); if (pp) pp.hidden=true;
  S.macroMin=false; renderMacro(); refresh();
});
function histo(vals, lo, hi, step){ const n=Math.floor((hi-lo)/step)+1, h=new Array(n).fill(0); vals.forEach(v=>{ const i=Math.min(n-1,Math.max(0,Math.floor((v-lo)/step))); h[i]++; }); return h; }
const RANGE = {
  price:{ title:'가격', unit:'억', step:0.5, max:()=>RMAX.p, vals:()=>CX.flatMap(c=>c.types.map(t=>t.med/10000)), get:()=>S.priceR, set:v=>S.priceR=v },
  py:{ title:'평형', unit:'평', step:1, max:()=>RMAX.py, vals:()=>CX.flatMap(c=>c.types.map(t=>t.py)), get:()=>S.py, set:v=>S.py=v },
  units:{ title:'세대수', unit:'세대', step:100, max:()=>RMAX.u, vals:()=>CX.map(c=>c.u), get:()=>S.units, set:v=>S.units=v },
  pkR:{ title:'주차대수', def:'세대당 주차대수입니다. 1.0대 미만이면 저녁 시간 주차가 빠듯할 수 있습니다.', unit:'대', step:0.1, max:()=>2, vals:()=>CX.map(pkU).filter(v=>v!=null), get:()=>S.pkR, set:v=>S.pkR=v },
  ageR:{ title:'입주년차', unit:'년차', step:1, max:()=>RMAX.age, vals:()=>CX.map(c=>c.age), get:()=>S.ageR, set:v=>S.ageR=v },
  far:{ title:'용적률', unit:'%', step:10, max:()=>500, vals:()=>CX.map(c=>c.far).filter(v=>v!=null), get:()=>S.far, set:v=>S.far=v },
  bcr:{ title:'건폐율', unit:'%', step:5, max:()=>80, vals:()=>CX.map(c=>c.bcr).filter(v=>v!=null), get:()=>S.bcr, set:v=>S.bcr=v },
  qR:{ title:'매매회전율', def:`1년 동안 단지 전체 세대 중 몇 %가 실제로 팔렸는지 나타냅니다. 최근 2년 매매 건수 ÷ 세대수 ÷ 2로 계산하며, 높을수록 사고팔기 쉬운 단지입니다(광주 평균 연 ${(DATA.meta.qCity/2).toFixed(1)}%).`, unit:'%', step:0.5, max:()=>15, vals:()=>CX.map(c=>c.qr).filter(v=>v!=null), get:()=>S.qR, set:v=>S.qR=v },
};
function chipLabels(){
  const L=(k,txt)=>{ const b=document.querySelector(`.chip[data-pop="${k}"]`); if(b){ b.querySelector('span').textContent=txt; b.setAttribute('aria-pressed',String(txt!==b.dataset.def)); } };
  for (const k in RANGE){ const r=RANGE[k], v=r.get(); L(k, v? `${r.title} ${v[0].toLocaleString()}~${v[1].toLocaleString()}${r.unit}${k==='price'&&v[1]>=RMAX.p?' 이상':''}` : r.title); }
  L('grade', S.grades.size? [...S.grades].sort().map(g=>g?g:'잠정').join('·')+(S.grades.has(0)&&S.grades.size===1?'':'등급') : '등급');
}
function openPop(k, btn){
  const pop=$('fpop');
  if (S.pop===k){ S.pop=null; pop.hidden=true; return; }
  S.pop=k; pop.hidden=false;
  const r=btn.getBoundingClientRect(), host=pop.offsetParent.getBoundingClientRect();
  pop.style.left=Math.max(8, Math.min(r.left-host.left, host.width-pop.offsetWidth-8))+'px';
  if (k==='grade'){
    const opts = [1,2,3,4,5,6,7,8,9].map(g=>[g,g+'등급']), set = S.grades;
    pop.innerHTML=`<div class="pt">종합 등급(여러 개 선택)</div><div class="pbtns">${opts.map(([v,l])=>`<button class="chip" data-v="${v}" aria-pressed="${set.has(v)}">${l}</button>`).join('')}</div><div class="pf"><button class="lnk" id="pReset">초기화</button><button class="btn primary sm" id="pDone">적용</button></div>`;
    pop.querySelectorAll('.pbtns .chip').forEach(b=>b.onclick=()=>{ const v=+b.dataset.v; set.has(v)?set.delete(v):set.add(v); b.setAttribute('aria-pressed',String(set.has(v))); refresh(); });
    $('pReset').onclick=()=>{ set.clear(); pop.querySelectorAll('.pbtns .chip').forEach(b=>b.setAttribute('aria-pressed','false')); refresh(); };
  } else {
    const R=RANGE[k];
    const mx=R.max(), st=R.step, cur=R.get()||[0,mx], h=histo(R.vals(),0,mx,st), hm=Math.max(...h);
    pop.innerHTML=`<div class="pt">${k==='price'?'최근 실거래가(평형별)':R.title} <b id="rv"></b></div>${R.def?`<div class="pdef">${R.def}</div>`:''}<div class="hist">${h.map((v,i)=>`<i data-i="${i}" style="height:${Math.max(2,v/hm*100)}%"></i>`).join('')}</div>
      <div class="dual"><input type="range" id="r0" min="0" max="${mx}" step="${st}" value="${cur[0]}" aria-label="${R.title} 최소"><input type="range" id="r1" min="0" max="${mx}" step="${st}" value="${cur[1]}" aria-label="${R.title} 최대"></div>
      <div class="pax"><span>0</span><span>${mx.toLocaleString()}${R.unit}${k==='price'?' 이상':''}</span></div><div class="pf"><button class="lnk" id="pReset">초기화</button><button class="btn primary sm" id="pDone">적용</button></div>`;
    const r0=$('r0'), r1=$('r1');
    const upd=(apply)=>{ let a=+r0.value, b=+r1.value; if (a>b){ [a,b]=[b,a]; } $('rv').textContent=`${a.toLocaleString()}~${b.toLocaleString()}${R.unit}`;
      pop.querySelectorAll('.hist i').forEach(e=>{ const v=+e.dataset.i*st; e.classList.toggle('on', v>=a && v<=b); });
      if (apply){ R.set(a===0&&b===mx?null:[a,b]); refresh(); } };
    r0.oninput=r1.oninput=()=>upd(false); r0.onchange=r1.onchange=()=>upd(true); upd(false);
    $('pReset').onclick=()=>{ r0.value=0; r1.value=mx; upd(true); };
  }
  $('pDone').onclick=()=>{ S.pop=null; pop.hidden=true; };
}
document.querySelectorAll('.chip[data-pop]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); openPop(b.dataset.pop,b); });
document.addEventListener('click',e=>{ const pop=$('fpop'); if (S.pop && !pop.contains(e.target)){ S.pop=null; pop.hidden=true; } });
if ($('locMode')) $('locMode').onclick=()=>{ S.locMode=!S.locMode; $('locMode').setAttribute('aria-pressed',String(S.locMode)); if (S.locMode && S.mine){ S.mine=null; applyMine(); } VIS=null; ORD=null; refresh(); if (S.view==='detail' && S.sel) renderDetail(); };   // v3.1.0 연구원: 입지 점수 탭
function refresh(){ if (S.view==='detail' && S.sel && !passes(CX.find(c=>c.id===S.sel))) { S.view='list'; S.sel=null; } drawMarkers(); renderPanel(); renderBanner(); chipLabels(); }
function renderBanner(){
  const b=$('banner');
  if (!S.mine){ b.hidden=true; return; }
  b.hidden=false; b.innerHTML=`내 조건 적용 중 · 예산 ${eok(S.mine.maxP/10000)} · ${visible().length}개 <button id="bEdit">수정</button><button id="bOff">해제</button>`;
  $('bEdit').onclick=openMine; $('bOff').onclick=()=>{S.mine=null; applyMine(); S.sort='score'; refresh();};
}

/* ═════════ 내 조건으로 찾기: 예산 + 영역 가중치(개인 점수는 도시 등급을 바꾸지 않음) ═════════ */
const MW = AREAS.map(a=>[a, AN[a], Math.round(M.areaW[a]*100)]);
function openMine(){
  const d = S.mineDraft || {cash:20000, loan:30000, size:'M', first:false, w:Object.fromEntries(MW.map(m=>[m[0],m[2]]))};
  const ov=$('ovMine'); ov.hidden=false;
  ov.innerHTML = `<div class="drawer" role="dialog" aria-modal="true" aria-labelledby="mineT">
    <div class="dh"><h2 id="mineT">내 조건으로 찾기</h2><button class="back" id="mClose" aria-label="닫기">✕</button></div>
    <div class="db">
      <div class="grid2">
        <div class="field"><label for="mCash">보유 자금</label><div class="money"><input id="mCash" inputmode="numeric" value="${d.cash}"><span>만원</span></div></div>
        <div class="field"><label for="mLoan">대출 가능액</label><div class="money"><input id="mLoan" inputmode="numeric" value="${d.loan}"><span>만원</span></div></div>
      </div>
      <div class="field"><label>찾는 면적</label><div class="seg" id="mSize">${[['S','60㎡ 이하'],['M','60~85㎡'],['L','85㎡ 초과'],['all','상관없음']].map(([k,l])=>`<button data-v="${k}" aria-pressed="${d.size===k}">${l}</button>`).join('')}</div></div>
      <label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" id="mFirst" ${d.first?'checked':''}> 생애최초 주택 구입(취득세 최대 200만원 감면)</label>
      <div class="card" id="mBudget"></div>
      <div class="field"><label>내가 중요하게 보는 것 (합계 100)</label>
        ${MW.map(([k,l])=>`<div class="slider"><label for="w_${k}">${l}</label><input type="range" id="w_${k}" min="0" max="60" step="5" value="${d.w[k]??0}"><output class="num" id="o_${k}">${d.w[k]??0}</output></div>`).join('')}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px"><span>합계 <span class="sum" id="wSum"></span></span><button class="btn" id="wFit" style="height:32px">합계 100으로 맞추기</button></div>
      </div>
      <p class="note">내 가중치로 다시 매긴 순위는 개인 참고용입니다. 도시 공통 등급(기본 가중치)은 바뀌지 않습니다. 확정 단지끼리만 다시 등급을 매깁니다.</p>
    </div>
    <div class="df"><button class="btn" id="mReset">초기화</button><button class="btn primary" id="mApply">지도에 표시</button></div>
  </div>`;
  let size=d.size;
  const upd=()=>{
    const cash=(+$('mCash').value.replace(/[^\d]/g,'')||0), loan=(+$('mLoan').value.replace(/[^\d]/g,'')||0), first=$('mFirst').checked;
    const total=(cash+loan)*10000, big=size==='L', P=maxPrice(total,big,first), cs=costs(P,big,first);
    $('mBudget').innerHTML = `<dl class="kv"><dt>총 가용자금</dt><dd>${eok(cash+loan)}</dd><dt>살 수 있는 집값(최대)</dt><dd><b>${eok(P/10000)}</b></dd>
      <dt>취득세 ${(cs.r*100).toFixed(2)}%${first&&P<=12e8?' (감면 반영)':''}</dt><dd>${fmtMan(cs.acq/10000)}</dd><dt>지방교육세</dt><dd>${fmtMan(cs.edu/10000)}</dd>${big?`<dt>농어촌특별세</dt><dd>${fmtMan(cs.farm/10000)}</dd>`:''}<dt>중개보수(상한)</dt><dd>${fmtMan(cs.fee/10000)}</dd></dl>
      <p class="note">1주택 유상취득 가정(지방세법 제11조①8). 다주택 중과·등기비용·DSR 한도는 반영하지 않습니다. 기준일 ’26.10.20.</p>`;
    let sum=0; MW.forEach(([k])=>{ const v=+$('w_'+k).value; $('o_'+k).textContent=v; sum+=v; });
    $('wSum').textContent=sum; $('wSum').classList.toggle('bad',sum!==100);
    return {cash,loan,first,size,maxP:P,w:Object.fromEntries(MW.map(([k])=>[k,+$('w_'+k).value]))};
  };
  ov.querySelectorAll('input').forEach(i=>i.addEventListener('input',upd));
  $('mSize').querySelectorAll('button').forEach(b=>b.onclick=()=>{ size=b.dataset.v; $('mSize').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b))); upd(); });
  $('wFit').onclick=()=>{ let sum=0; MW.forEach(([k])=>sum+=+$('w_'+k).value); if(!sum) return; let acc=0; MW.forEach(([k],i)=>{ let v=i<MW.length-1?Math.round(+$('w_'+k).value/sum*100):100-acc; acc+=v; $('w_'+k).value=v; }); upd(); };
  $('mReset').onclick=()=>{ MW.forEach(([k,,v])=>$('w_'+k).value=v); upd(); };
  $('mClose').onclick=()=>{ov.hidden=true;}; ov.onclick=e=>{ if(e.target===ov) ov.hidden=true; };
  $('mApply').onclick=()=>{ const m=upd(); S.mine=m; S.mineDraft=m; try{localStorage.setItem('dn10-mine',JSON.stringify(m));}catch(e){} applyMine(); S.sort='score'; S.view='list'; S.sel=null; ov.hidden=true; refresh(); sheetTo('half'); };
  upd();
}
$('btnMine').onclick=()=>alert('준비중입니다. 곧 찾아뵙겠습니다.');   // v1.7 연구원: 내 조건으로 찾기는 추가 개발 후 공개(openMine 유지)

/* ═════════ 비교함 ═════════ */
function toggleCmp(id){
  const i=S.cmp.indexOf(id); if (i>=0) S.cmp.splice(i,1); else { if (S.cmp.length>=4) S.cmp.shift(); S.cmp.push(id); }
  $('cmpN').textContent=S.cmp.length; drawMarkers(); if (S.view==='detail') renderDetail();
}
function openCmp(){
  const ov=$('ovCmp'); ov.hidden=false;
  const L=S.cmp.map(id=>CX.find(c=>c.id===id));
  const rows=[['종합점수',c=>scoreOf0(c),1,v=>f1(v)],['종합 등급',c=>c.grade,-1,v=>v+'등급'],['입지점수',c=>c.loc??c.locTent,1,v=>f1(v)],...AREAS.map(a=>[AN[a],c=>c.area[a],1,v=>f1(v)]),
    ['자료 충족률',c=>c.cover,1,v=>f1(v)+'%'],['대표 평형 실거래',c=>repPrice(c),-1,eok],['가격 판정',c=>c.gap,-1,pct],['매매회전율',c=>c.qr,1,v=>v.toFixed(1)+'%'],['세대수',c=>c.u,1,v=>v.toLocaleString()],['사용승인',c=>c.y,1,v=>v+'년'],['세대당 주차',pkU,1,v=>v.toFixed(2)+'대'],['용적률',c=>c.far,-1,v=>v+'%']];
  const body = L.length ? `<div class="tblwrap"><table class="t cmp"><thead><tr><th></th>${L.map((c,k)=>`<th>${L.length>1?`<i style="background:${['#3182f6','#f04452','#00a870','#f2994a'][k]}"></i>`:''}${c.dong}<br>${c.n}</th>`).join('')}</tr></thead><tbody>${rows.filter(r=>L.some(c=>r[1](c)!=null)).map(([n,f,dir,fmt])=>{ const vs=L.map(f); const valid=vs.filter(v=>v!=null); const best=valid.length>1?(dir>0?Math.max(...valid):Math.min(...valid)):null; return `<tr><td>${n}</td>${vs.map(v=>`<td class="num ${v!=null&&v===best?'best':''}">${v==null?'–':(fmt?fmt(v):v)}</td>`).join('')}</tr>`; }).join('')}</tbody></table></div><div class="chart" id="cchart"></div><p class="note">파란 굵은 글씨 = 해당 항목 가장 좋은 값(가격 판정은 낮을수록)</p>` : `<div class="empty">단지 상세에서 단지 이름 옆 ☆를 눌러 최대 4개까지 비교하세요.</div>`;
  ov.innerHTML=`<div class="drawer wide" role="dialog" aria-modal="true" aria-labelledby="cmpT"><div class="dh"><h2 id="cmpT">단지 비교</h2><button class="back" id="cClose" aria-label="닫기">✕</button></div><div class="db">${body}</div><div class="df"><button class="btn" id="cClear">비우기</button></div></div>`;
  if (L.length) priceChart($('cchart'), L);
  $('cClose').onclick=()=>ov.hidden=true; ov.onclick=e=>{if(e.target===ov) ov.hidden=true;};
  $('cClear').onclick=()=>{ S.cmp=[]; $('cmpN').textContent=0; drawMarkers(); ov.hidden=true; if (S.view==='detail') renderDetail(); };
}
$('btnCmp').onclick=openCmp;

/* ═════════ 평가기준 ═════════ */
function gradeBar(){
  const cut=M.cuts, cnt=[1,2,3,4,5,6,7,8,9].map(g=>CX.filter(c=>c.grade===g).length);
  const seg=cut.map((v,i)=>v-(i?cut[i-1]:0));
  return `<div class="gbar" role="img" aria-label="등급별 비율과 단지 수">${seg.map((w,i)=>`<i style="width:${w}%;background:${gCol(i+1)};color:${gInk(i+1)}"><b>${i+1}</b></i>`).join('')}</div>
  <div class="gtick">${cut.map((v,i)=>`<span style="left:${v}%">${i<8?v+'%':''}</span>`).join('')}</div>
  <table class="gtab"><tr><th>등급</th>${cnt.map((_,i)=>`<th>${i+1}</th>`).join('')}</tr><tr><th>상위</th>${cut.map(v=>`<td>${v}%</td>`).join('')}</tr><tr><th>단지</th>${cnt.map(n=>`<td>${n}</td>`).join('')}</tr></table>`;
}
function openMethod(){
  const ov=$('ovMethod'); ov.hidden=false;
  const itemsT = AREAS.map(a=>Object.keys(IN[a]).map((k,i)=>`<tr>${i===0?`<td rowspan="${Object.keys(IN[a]).length}"><b>${AN[a]}</b><br><span class="ver">${Math.round(M.areaW[a]*100)}%</span>${(M.basis&&M.basis.area[a])?`<br><span class="sm">${M.basis.area[a]}</span>`:''}</td>`:''}<td>${NAMES[k]}<br><span class="ver">${(()=>{const t=Object.values(IN[a]).reduce((x,y)=>x+y,0); return t>1?IN[a][k]+'점':'100점';})()}</span></td><td class="n">${(M.itemW[k]*100).toFixed(1)}%</td><td>${RULE[k]}${(M.basis&&M.basis.item[k])?`<br><span class="sm">배점 근거: ${M.basis.item[k]}</span>`:''}</td></tr>`).join('')).join('');
  const sens = M.sens.map(s=>`<tr><td>${AN[s.area]} ${s.f<1?'−20%':'+20%'}</td><td class="n">${s.changed}곳 (${s.changedPct}%)</td><td class="n">${s.top1Keep}/${s.top1N}</td></tr>`).join('');
  ov.innerHTML=`<div class="drawer wide" role="dialog" aria-modal="true" aria-labelledby="mtT"><div class="dh"><h2 id="mtT">평가기준</h2><button class="back" id="tClose" aria-label="닫기">✕</button></div><div class="db mth">
    <section><h3>종합점수</h3><p><b>단지 점수(100점)</b> = 기본점수 − 보정 점수(최대 10점) − 미분양·임대 감점</p><p><b>입지 70 : 단지 상품성 20 : 환금성 10.</b> 땅(입지)은 오래 남고 건물은 감가되므로 입지를 가장 크게 봅니다. 다만 이것은 가격 구성비가 아니라 평가 원칙입니다(광주 아파트 가격에서 땅 몫은 연식에 따라 2~5할로 추정). 지방 비규제지역에서는 팔고 싶을 때 팔리는지(환금성)가 중요해 거래 활발도를 10%로 둡니다. <b>입지 점수</b> = 생활환경 26.25·교육환경 24.5·직주근접 8.75·광역교통 7·공급 부담 3.5(합계 70%)만 합친 점수. 단지를 누르면 상세에서 입지 등급을 볼 수 있습니다.</p><p>기본점수 = 0.2625×생활환경 + 0.245×교육환경 + 0.0875×직주근접 + 0.07×광역교통 + 0.035×공급 부담 + 0.20×단지 상품성 + 0.10×거래 활발도 (각 영역 0~100점)</p><p><b>종합점수</b>는 단지 점수를 등급 순서에 맞춘 점수입니다. 등급 조건으로 내려간 단지가 있는 등급은 그 등급의 점수를 위 등급 최저점보다 낮게 직선 환산합니다. 그래서 종합점수가 높으면 등급도 같거나 높습니다.</p></section>
    <section><h3>등급</h3><p>광주 아파트를 단지 점수 순으로 줄을 세워 정해진 비율(1등급부터 4·7·12·17·20·17·12·7·4%)로 1~9등급을 나눕니다.</p><p>다만 <b>1~3등급</b>은 <b>시장 검증 입지 등급</b> 안에서만 받을 수 있습니다. 시장 검증 입지가치는 ㎡당 실거래가(최근 1년, 입주 2년 안 된 단지는 분양권 포함)에서 단지 상품성(연식·세대수·주차·커뮤니티·지하주차·시공사·복도·주상복합·평형·신축)이 설명하는 몫을 뺀 값입니다. 상품성의 몫은 같은 법정동 안 단지끼리 비교해 데이터로 추정하고, 거래가 적은 단지는 반경 1km 이웃 단지 값으로 보정합니다. 즉 시장이 그 자리에 실제로 매기는 가격입니다. 다만 <b>신축(입주 5년 이내)과 대단지(1,000세대 이상)는 그 프리미엄을 빼지 않고</b> 2~3등급 조건을 봅니다. 광주 전체 순위를 같은 비율로 나눠, 권역 점수로는 1등급이어도 상위 11~23%면 최고 3등급, 상위 23% 밖이면 최고 4등급입니다. <b>1등급</b>은 세 가지를 모두 만족해야 합니다: ① 시장 검증 입지 상위 ${M.pxg1||11}% ② 프리미엄을 모두 뺀 순수 자리값 상위 ${M.px1p||23}% ③ 그 단지 자기 실거래가(㎡당, 최근 1년) 광주 상위 4%. 기준 비율은 수능 등급 경계(4·11·23%)를 씁니다. ③ 실거래가는 이웃 단지 시세를 빌리지 않고 그 단지 거래만 봅니다(최근 1년이 없으면 최근 2년). <b>임대 단지</b>(국민임대·영구임대·민간임대)는 매매 거래가 없어 종합 등급을 매기지 않고 입지 등급만 표시합니다. 최근 2년 거래가 없는 일반 단지는 시세를 확인할 수 없어 최고 3등급입니다. 시세 자료가 없으면 최고 3등급, 입주 25년 이상과 100세대 미만은 최고 3등급입니다. 단, 최근 2년 매매가 10건 이상이고 실거래가가 광주 상위 7% 안이면 2등급까지 받을 수 있습니다(거래 한두 건으로 만든 가격은 쓰지 않습니다). <b>미분양 단지</b>는 준공(입주) 때 또는 지금 미분양이 남은 비율로 상한을 둡니다: 단지 세대의 10% 미만 최고 2등급 · 10~20% 3등급 · 20~30% 4등급 · 30% 이상 5등급(광주시 월별 미분양 아파트 현황 ’23.1~’26.8, 입주 2년 안 단지와 지금도 미분양이 있는 단지).</p><p><b>영역 점수 표준화</b>: 영역마다 점수가 퍼진 정도가 달라(광주 표준편차 상품성 2.3·거래 2.2 vs 생활 1.0·직주 1.0) 정한 비중대로 영향을 주지 못했습니다(실제 영향력 입지 56% : 상품성·거래 44%). 그래서 권역 안에서 영역 점수를 같은 폭으로 맞춘 뒤 비중을 곱합니다. 이제 입지(교육 28·생활 30·직주 10·광역교통 8·공급 4 = 80%)가 실제로도 그만큼 순위를 정합니다. 영역 막대는 원래 점수 그대로 보여 줍니다.</p><p><b>시장 검증 입지 등급</b>: 단지 상세에 입지 점수 등급과 나란히 보여 줍니다(권역 안 순위). 둘이 3단계 이상 다르면 ‘시장 평가와 차이 큼’으로 알려 드립니다. ㎡당 시세에 섞인 신축 프리미엄 때문에 입지가 중간인 신축이 시세 상한을 통과하던 문제를 상품성 전체로 넓혀 고친 것입니다.</p><p><b>용적률</b>: 확인되지 않은 단지는 인근 비슷한 단지(1.5km·±5년·세대수 0.5~2배, 없으면 3km·±7년) 3곳의 중앙값으로 ‘(추정)’ 표시합니다. <b>미분양</b>: 보정 감점 15 × 미분양 비율(미분양 ÷ 전체 세대), 20% 이상이면 3점(광주시 단지별 현황 ’26.8월말). <b>노후 빌라·원룸촌</b>: 단지 경계에서 바깥 300m 띠 안에서 30년 넘은 단독·4층 이하 공동주택의 바닥면적 비율과 원룸(다가구 추정) 바닥면적 비율을 봅니다. 광주 단지 중 상위 30% 밖은 0점이고, 상위 3%면 노후 저층 1.5점·원룸 1점(합계 최대 2점)입니다(브이월드 건축물정보, 용도 미상 건물은 제외). <b>임대</b>: 전체 임대 2점, 혼합 단지는 2점 × 임대 비율. 미분양·임대는 보정 상한 10점 밖에서 따로 뺍니다. <b>기피시설</b>: 사회적으로 꼭 필요하지만 주민이 입지를 꺼리는 시설(행정·언론에서 쓰는 순화어, 흔히 ‘님비시설’)입니다. 하수처리장·매립장·소각장·음식물처리시설 같은 환경기초시설과 교정시설은 300m 안이면 2점, 화장장·공원묘지는 1.5점, 차량기지·발전소·345kV 변전소는 1점이고 1km까지 줄어들며 합계 최대 3점입니다(지도 공개자료 위치를 지자체·공단·언론 자료로 교차확인). 하수처리장·매립장은 악취 보정에서 빼고 여기로 옮겼습니다. <b>임대</b>: 임대 단지 3점, 혼합 단지 3점 × 임대 세대 비율(확인된 단지만).</p><p>상단 <b>‘입지 점수’</b> 탭을 누르면 지도·목록이 입지 점수와 입지 등급(권역 안 같은 비율)으로 바뀝니다.</p><p>상한 때문에 빈 자리는 같은 권역에서 조건을 만족하는 다음 순위 단지가 채웁니다. 임대 단지는 권역 기준선에 위치만 매깁니다.</p>${gradeBar()}</section>
    ${M.basis?`<section><h3>기준의 근거</h3><p class="sm">모든 기준에 근거를 붙였습니다. [공식] 법령·정부 기준·공식 통계 · [연구] 논문·연구보고서 · [자료] 광주 단지 자료 분석(시장 검증 입지·실거래가와의 순위 상관) · [판단] 근거를 찾지 못해 연구원이 정한 값입니다.</p><ul class="sm">${Object.entries({grade:'등급 비율',price:'실거래가 조건',unsold:'미분양',small:'소단지',old:'구축',walk:'도보 시간',harm:'청소년 유해업소',far:'용적률',noise:'소음',nimby:'기피시설',villa:'노후 빌라·원룸촌',rent:'임대 단지'}).filter(([k])=>M.basis.rule[k]).map(([k,n])=>`<li><b>${n}</b>: ${M.basis.rule[k]}</li>`).join('')}</ul></section>`:''}
    <section><h3>세부 항목과 기준</h3><div class="tblwrap"><table class="calc"><thead><tr><th>영역</th><th>항목</th><th>종합 비중</th><th>점수 기준(사이 값은 직선으로 이음)</th></tr></thead><tbody>${itemsT}</tbody></table></div><p class="sm">${M.curves?M.curves.w+'<br>'+M.curves.d:''}</p></section>
    <section><h3>쓰지 않는 자료</h3><ul>${M.notUsed.map(x=>`<li>${x}</li>`).join('')}</ul></section>
    <section><h3>계산식</h3><p>${M.formula}</p><p><b>보정:</b> ${M.mRule}</p><p><b>등급 조건:</b> ${M.capRule}</p></section>
    <section><h3>결측 처리</h3><p>${M.missRule}</p></section>
    <section><h3>점수 밖 참고 정보</h3><p>실거래가, 고평가·저평가(반경 500m 추정가 대비 ±10%), 전세가율, 도시철도 2호선 예정역은 점수에 넣지 않습니다.</p></section>
    <section><h3>측정 방식과 한계</h3><ul>${M.caveats.map(x=>`<li>${x}</li>`).join('')}</ul></section>
    <section><h3>자료 출처</h3><ul>${M.sources.map(x=>`<li>${x}</li>`).join('')}</ul></section>
    <section class="warn"><h3>주의사항</h3><ul>
      <li><b>이 서비스는 AI와 함께 만든 프로토타입입니다.</b> 개발 중이라 계산 방식이 바뀔 수 있습니다.</li>
      <li>공공데이터를 정해진 규칙으로 가공한 참고 정보입니다. 특정 단지의 매수·매도 권유나 투자 자문이 아닙니다.</li>
      <li>등급·점수·고평가/저평가 표시는 단지의 가치나 미래 가격을 보장하지 않습니다.</li>
      <li>자료는 ${M.evalDate} 기준입니다. 이후 거래·개발 계획은 반영되지 않으며, 원자료의 오류·누락이 있을 수 있습니다.</li>
      <li>매수 등 중요한 판단 전에는 실거래가·현장·공식 자료로 직접 확인해 주세요. 이용에 따른 판단과 결과의 책임은 이용자에게 있습니다.</li>
    </ul></section>
    <section class="by"><p class="sm">만든 사람 · <a href="https://blog.naver.com/kwon_austin" target="_blank" rel="noopener">방구석 연구원 블로그</a></p></section>
  </div></div>`;
  $('tClose').onclick=()=>ov.hidden=true; ov.onclick=e=>{if(e.target===ov) ov.hidden=true;};
}
$('btnMethod').onclick=openMethod;
/* v3.0.0 연구원: 필터 칩 좌우 넘기기(마우스를 올리면 화살표, 화살표 위에 올리거나 누르면 이동) */
(function(){
  const nav=document.querySelector('nav.chips'); if(!nav) return;
  const wrap=document.createElement('div'); wrap.className='chipwrap'; nav.parentNode.insertBefore(wrap,nav); wrap.appendChild(nav);
  const mk=(cls,txt,lab)=>{ const b=document.createElement('button'); b.type='button'; b.className='cnav '+cls; b.textContent=txt; b.setAttribute('aria-label',lab); wrap.appendChild(b); return b; };
  const L=mk('l','‹','왼쪽 필터 보기'), R=mk('r','›','오른쪽 필터 보기');
  const upd=()=>{ L.classList.toggle('on',nav.scrollLeft>2); R.classList.toggle('on',nav.scrollLeft+nav.clientWidth<nav.scrollWidth-2); };
  let tm=null; const stop=()=>{ if(tm){ clearInterval(tm); tm=null; } };
  const glide=d=>{ stop(); tm=setInterval(()=>{ nav.scrollLeft+=d*9; upd(); if(nav.scrollLeft<=0||nav.scrollLeft+nav.clientWidth>=nav.scrollWidth) stop(); },16); };
  L.addEventListener('mouseenter',()=>glide(-1)); R.addEventListener('mouseenter',()=>glide(1));
  [L,R].forEach(b=>b.addEventListener('mouseleave',stop));
  L.onclick=()=>{ stop(); nav.scrollBy({left:-nav.clientWidth*.7,behavior:'smooth'}); };
  R.onclick=()=>{ stop(); nav.scrollBy({left:nav.clientWidth*.7,behavior:'smooth'}); };
  nav.addEventListener('scroll',upd,{passive:true}); addEventListener('resize',upd); upd();
})();
/* v1.1 연구원: 왼쪽 위 '우리동네 입지분석'을 누르면 첫 화면으로(비교함은 유지) */
function goHome(e){ if(e) e.preventDefault();
  ['ovMine','ovCmp','ovMethod','ovPrice'].forEach(id=>{ const o=$(id); if(o) o.hidden=true; });
  document.querySelectorAll('.ov,[role="dialog"]').forEach(o=>{ const w=o.closest('[id^="ov"]'); if(w) w.hidden=true; });
  const q=$('q'); if(q) q.value=''; const sg=$('sugg'); if(sg) sg.hidden=true;
  Object.assign(S,{band:'all',py:null,units:null,ageR:null,priceR:null,far:null,bcr:null,qR:null,pkR:null,hint:null,pop:null,sort:'score',view:'list',sel:null,macroMin:false});
  S.grades.clear(); S.tags.clear(); document.querySelectorAll('.chip[data-f]').forEach(x=>x.setAttribute('aria-pressed','false'));
  const pp=$('fpop'); if (pp) pp.hidden=true;
  renderMacro(); refresh(); $('pbody').scrollTop=0; sheetTo('peek'); $('zfit').click();
}
document.querySelectorAll('.brand').forEach(b=>{ b.addEventListener('click',goHome); b.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' ') goHome(e); }); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape') ['ovMine','ovCmp','ovMethod','ovPrice'].forEach(id=>$(id).hidden=true); });

/* ═════════ 네이버 지도(공개 사이트용). 불러오지 못하면 내장 지도 ═════════ */
let NV=null, NVOL=null, NVL=null; const NVM=new Map(), NVLINES=[];
function nvView(){ if(!NV) return; const b=NV.getBounds(), s=b.getSW(), n=b.getNE(); setVB([s.lat(),s.lng(),n.lat(),n.lng()]); }
function nvFit(rg,gu){ const b=new naver.maps.LatLngBounds(); CX.filter(c=>rg?(c.rg===rg&&(!gu||c.gu===gu)):!c.nj).forEach(c=>b.extend(new naver.maps.LatLng(c.lat,c.lon)));
  const mobile=matchMedia('(max-width:900px)').matches;
  NV.fitBounds(b, mobile?{top:70,right:16,bottom:40,left:16}:{top:24,right:56,bottom:24,left:Math.min(310,NV.getSize().width*0.35)}); }
function nvInit(){
  if (!(window.naver && naver.maps && naver.maps.Map)) return false;
  const el=$('nmap'); el.hidden=false; $('map').style.visibility='hidden'; BCV.style.display='none';
  NV=new naver.maps.Map(el,{center:new naver.maps.LatLng(35.16,126.85), zoom:12, minZoom:10, maxZoom:19, zoomControl:false, mapDataControl:false, scaleControl:false, logoControl:true,
    logoControlOptions:{position:naver.maps.Position.BOTTOM_RIGHT}});
  DATA.geo.sgg.features.filter(f=>GU5.includes(f.properties.g)).forEach(f=>{
    const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
    polys.forEach(poly=>NVLINES.push(new naver.maps.Polyline({map:NV, path:poly[0].map(([x,y])=>new naver.maps.LatLng(y,x)), strokeColor:'#8b95a5', strokeOpacity:.85, strokeWeight:2, strokeStyle:'shortdash', clickable:false})));
  });
  // v3.0.10 최적화(연구원: 지도 끊김): 단지 1,797곳을 네이버 마커 1,797개로 만들지 않고, 지도 위 한 겹(overlay)에 HTML 한 번에 그림 → 마커 아이콘 갱신 1,000ms → 수 ms
  function NvLayer(){ this.el=document.createElement('div'); this.el.className='nvlayer'; }
  NvLayer.prototype=new naver.maps.OverlayView();
  NvLayer.prototype.onAdd=function(){ this.getPanes().overlayImage.appendChild(this.el);
    const h=e=>{ const t=e.target.closest('[data-cid]'); if(t){ e.stopPropagation(); if(e.type==='click') select(t.dataset.cid); } };
    this.el.addEventListener('click',h); this.el.addEventListener('mousedown',e=>{ if(e.target.closest('[data-cid]')) e.stopPropagation(); }); };
  NvLayer.prototype.draw=function(){ const z=NV.getZoom(); if (this.__z!==z){ this.__z=z; nvMarkers(); } };
  NvLayer.prototype.onRemove=function(){ this.el.remove(); };
  NVL=new NvLayer(); NVL.setMap(NV);
  let lastZ=null; naver.maps.Event.addListener(NV,'idle',()=>{ const z=NV.getZoom(); if (z!==lastZ || z>NDZ){ lastZ=z; nvMarkers(); } nvView(); });   // v3.0.1: 단지 단계에서는 이동이 끝날 때도 화면 안 마커만 갱신 · v3.0.10 목록 = 지금 보는 지도 안 단지
  naver.maps.Event.once(NV,'idle',()=>{ if (!S.sel && NV.getZoom()>NGZ) NV.setZoom(NGZ,false); });   // v1.2.2 첫 화면은 시군구 평균
  $('zin').onclick=()=>NV.setZoom(NV.getZoom()+1,true);
  $('zout').onclick=()=>NV.setZoom(NV.getZoom()-1,true);
  $('zfit').onclick=()=>nvFit(null); document.querySelectorAll('.zrg').forEach(b=>b.onclick=()=>nvFit(b.dataset.rg,b.dataset.gu));
  $('attrib').hidden=true;
  nvFit(); nvMarkers();
  return true;
}
const NVD=new Map(), NVU=new Map();
function nvUp(show){
  UP.forEach(u=>{ let m=NVU.get(u.id); if(!m){ m=new naver.maps.Marker({position:new naver.maps.LatLng(u.lat,u.lon), icon:{content:`<div class="nmw"><div class="nup" title="입주예정 · ${u.n} · ${ymTxt(u.mvn)}">입주예정</div></div>`, anchor:new naver.maps.Point(0,0)}, zIndex:150});
    naver.maps.Event.addListener(m,'click',()=>openUp(u.id)); NVU.set(u.id,m); }
    m.setMap(show?NV:null); });
}
function nvMarkers(){
  if (!NV) return;
  const vis=VIS||new Set(visible().map(c=>c.id)), z=NV.getZoom(), dongMode = z<=NDZ, lv = z<=NGZ?'gu':'dong';
  NVD.forEach(m=>m.setMap(null));
  if (dongMode){
    if (NVL) NVL.el.innerHTML='';
    const prj0=NV.getProjection(), bx=[], hit0=q=>bx.some(o=>q[0]<o[2]&&q[2]>o[0]&&q[1]<o[3]&&q[3]>o[1]);   // v1.2.2 이름표가 겹치면 큰 동네 먼저
    dongAgg(lv).sort((a,b)=>b.n-a.n).forEach(d=>{ const p=prj0.fromCoordToOffset(new naver.maps.LatLng(d.lat,d.lon)), w=Math.max(d.k.length*12,aggLab(d).length*6.2)+20, q=[p.x-w/2,p.y-19,p.x+w/2,p.y+19];
      if (lv!=='gu' && hit0(q)) return; bx.push(q); let m=NVD.get(lv+d.k); if(!m){ m=new naver.maps.Marker({position:new naver.maps.LatLng(d.lat,d.lon), icon:{content:'<div></div>',anchor:new naver.maps.Point(0,0)}}); naver.maps.Event.addListener(m,'click',()=>{ NV.morph(m.getPosition(), lv==='gu'?NGZ+1:NDZ+1); }); NVD.set(lv+d.k,m); }
      const gr=clamp(Math.round(d.g),1,9);
      m.setPosition(new naver.maps.LatLng(d.lat,d.lon));
      m.setIcon({content:`<div class="ndg" style="background:${gCol(gr)};color:${gInk(gr)}"><b>${d.k}</b><span>${aggLab(d)}</span></div>`, anchor:new naver.maps.Point(0,0)});
      m.setZIndex(100+d.n); m.setMap(NV); });
    nvUp(false);
    return;
  }
  // v3.0.1 최적화: 지도 화면과 주변 여백 안 단지만 그림 · v3.0.10 한 겹 HTML로 한 번에
  const bd=NV.getBounds(), sw=bd.getSW(), ne=bd.getNE(), dy=(ne.lat()-sw.lat())*0.35, dx=(ne.lng()-sw.lng())*0.35;
  const inV=c=>c.mla>=sw.lat()-dy && c.mla<=ne.lat()+dy && c.mlo>=sw.lng()-dx && c.mlo<=ne.lng()+dx;
  const VC=CX.filter(c=>inV(c)||c.id===S.sel);
  nvUp(true);
  if (!NVL) return;
  const prj=NVL.getProjection(); if(!prj) return;
  const ord=VC.sort((a,b)=>(b.id===S.sel)-(a.id===S.sel) || vis.has(b.id)-vis.has(a.id) || (gradeOf(a)??10)-(gradeOf(b)??10) || (scoreOf(b)??-1)-(scoreOf(a)??-1));
  const NG=boxGrid(), out=[];
  for (const c of ord){
    const p=prj.fromCoordToOffset(new naver.maps.LatLng(c.mla,c.mlo)); const w=(z>=16?96:44), bx=[p.x-2,p.y-12,p.x+w,p.y+12];
    const sel=c.id===S.sel, lab = sel || !NG.hit(bx); if (lab) NG.add(bx);
    const gr=gradeOf(c), on=vis.has(c.id), cmp=S.cmp.includes(c.id);
    const pt = S.mine && S.mine.size!=='all' ? bandPrice(c) : repPrice(c);
    const dot = !sel && (z<=11 || (!on && z<=13) || !lab);
    const bg = gr==null ? 'background:#fff;color:#6b7684;border:1.5px dashed #8b95a1' : `background:${gCol(gr)};color:${gInk(gr)}`;
    const zi=sel?1000:cmp?900:on?200+(10-(gr||10))*10:1;
    out.push(`<div class="nmw nvp" data-cid="${c.id}" style="transform:translate(${Math.round(p.x)}px,${Math.round(p.y)}px);z-index:${zi}">`+(dot ? `<div class="nmk dot${on?'':' dim'}" style="${gr==null?'background:#fff;border-color:#8b95a1':`background:${gCol(gr)}`}"></div>`
      : `<div class="nmk${on?'':' dim'}${sel?' sel':''}${cmp?' cmp':''}" title="${c.dong} ${c.n} · ${gLab(c)} · ${f1(scoreOf(c))}점"><b style="${bg}">${gLab(c)}</b>${(z>=16||sel)&&pt?`<span>${eok(pt)}</span>`:''}</div>`)+'</div>');
  }
  NVL.el.innerHTML=out.join('');
}
window.navermap_authFailure = function(){
  if (!proj) drawMap();   // v3.1.1 내장 지도는 네이버 지도 실패 때 그림
  if (NV){ NV.destroy(); NV=null; }
  $('nmap').hidden=true; $('map').style.visibility=''; $('attrib').hidden=false; BCV.style.display=''; setTimeout(renderBase,0);
  $('zin').onclick=()=>svg.transition().duration(220).call(zoom.scaleBy,1.6);
  $('zout').onclick=()=>svg.transition().duration(220).call(zoom.scaleBy,1/1.6);
  $('zfit').onclick=()=>svg.transition().duration(300).call(zoom.transform,d3.zoomIdentity); document.querySelectorAll('.zrg').forEach(b=>b.onclick=()=>njFit(b.dataset.rg,b.dataset.gu));
  console.warn('네이버 지도 인증 실패: 내장 지도로 표시');
};
$('legend').onclick=()=>{ const l=$('legend'); l.classList.toggle('min'); $('lgt').textContent=l.classList.contains('min')?'범례 ▸':'범례 ▾'; };
if (matchMedia('(max-width:900px)').matches){ $('legend').classList.add('min'); $('lgt').textContent='범례 ▸'; }
if (/ipji-score-dev/.test(location.pathname) || /^(localhost|127\.)/.test(location.hostname)){ document.title='[개발판] '+document.title; const _b=document.querySelector('.brand-sub'); if(_b) _b.textContent+=' · 개발판'; }   // v3.1.1 개발 주소 표시
renderMacro(); if (!(window.naver && naver.maps)) drawMap(); renderPanel(); sheetTo('peek'); chipLabels(); try{ nvInit(); }catch(e){ console.warn(e); window.navermap_authFailure(); }   // v3.1.1 최적화: 네이버 지도를 쓰면 숨은 내장 지도(SVG 1만여 개)를 처음에 그리지 않음
let rt; addEventListener('resize',()=>{clearTimeout(rt); rt=setTimeout(()=>{if(!NV) drawMap(); if(sheetState) sheetTo(sheetState); if(NV) NV.autoResize();},150);});
