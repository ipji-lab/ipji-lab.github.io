
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
const S = { sel:null, band:'all', py:null, units:null, ageR:null, grades:new Set(), tags:new Set(), amin:{}, sort:'score', cmp:[], mine:null, openCat:null, view:'list', pop:null };
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
function mainType(c){ if(!c.types.length) return null;
  if (c.ut&&c.ut.length){ const top=c.utop!=null?[c.utop]:[...c.ut].sort((a,b)=>b[1]-a[1])[0]; const t=c.types.filter(t=>Math.abs(t.ex-top[0])<=1).sort((x,y)=>y.n-x.n)[0]; if(t) return t; }   // v1.2.4 utop: 청약 일반분양 구성 + K-apt 면적 구간으로 정한 대표 전용면적   // v1.1.2: 공시가격 자료로 세대가 가장 많은 전용면적
  let m=c.types; const mx=Math.max(...m.map(t=>t.n));
  if(c.hb){ const [a,b]=HBR[c.hb]; const f=m.filter(t=>t.ex>a&&t.ex<=b+0.5); if(f.length && Math.max(...f.map(t=>t.n))>=0.25*mx) m=f; }   // v1.1.2: K-apt 면적 구간이 공급면적 기준인 단지가 있어(무등산자이앤어울림 115㎡ 오류) 그 구간 거래가 최다 평형의 1/4도 안 되면 무시
  return [...m].sort((x,y)=>(y.n-x.n)||(y.n3-x.n3))[0]; }
function repType(c){ if(S.py||S.priceR){ const m=matchTypes(c); if(!m.length) return null; return [...m].sort((a,b)=>b.n-a.n)[0]; } return mainType(c); }
// v1.2.4 연구원(위파크마륵 10억): 대표 가격 = 세대가 가장 많은 평형의 최근 실거래. 그 평형 거래가 없고 분양가(청약홈 주택형별 최고가)가 있으면 분양가, 둘 다 없으면 84㎡ 환산값
function topEx(c){ return c.utop!=null?c.utop:(c.ut&&c.ut.length?[...c.ut].sort((a,b)=>b[1]-a[1])[0][0]:null); }
function bpOf(c){ if(!c.bp||!c.bp.length) return null; let ex=topEx(c); const L=ex==null?[...c.bp].sort((a,b)=>b[2]-a[2]):c.bp.filter(b=>Math.abs(b[0]-ex)<=1); const b=L.find(b=>b[1]); return b?{ex:b[0],py:Math.round(b[0]*0.4),top:b[1]}:null; }
function repInfo(c){ const t=repType(c); if(t&&(t.a3!=null||t.med!=null)){ const top=topEx(c); if(top!=null&&Math.abs(t.ex-top)>1&&!(S.py||S.priceR)){ const b=bpOf(c); if(b) return {pt:b.top,src:'bp',t:null,b}; } return {pt:t.a3??t.med,src:t.a3!=null?'a3':'med',t}; } const b=bpOf(c); if(b) return {pt:b.top,src:'bp',t:null,b}; return {pt:c.p84,src:'p84',t:null}; }
const repPrice = c => repInfo(c).pt;
const repLab = c => { const i=repInfo(c); if(i.pt==null) return '–'; const te=topEx(c); const other=i.t&&te!=null&&Math.abs(i.t.ex-te)>1; return (i.src==='bp'?'분양 ':other?`${i.t.py}평 `:'')+eok(i.pt); };   // 최다 평형 거래가 없어 다른 평형 값이면 평형을 붙여 표시
const typeLabel = t => `${t.py}평`;
function bandPrice(c){ if (S.mine && S.mine.size!=='all'){ const b=c.p.bands?.[S.mine.size]; return b && b[1]>0 ? b[0] : null; } return c.p84; }
function tagsShow(c){   // v1.1 연구원: 태그는 최대 4개, 왼쪽부터 좋은 점(파랑) → 보통(초록) → 아쉬운 점(빨강)
  const g=c.tags.filter(t=>t[2]==='good'), n=c.tags.filter(t=>!t[2]), b=c.tags.filter(t=>t[2]==='bad');
  const bb=b.slice(0, Math.min(2, b.length)), gg=g.slice(0, 4-bb.length), nn=n.slice(0, 4-bb.length-gg.length), b2=b.slice(bb.length, bb.length+Math.max(0,4-bb.length-gg.length-nn.length));
  const all=[...gg,...nn,...bb,...b2]; const ri=c.tags.find(t=>t[0]==='rent'); const out=ri?[ri,...all.filter(t=>t!==ri)].slice(0,4):all;   // v1.1.2 연구원: 임대 태그를 맨 앞
  return out.map(t=>`<span class="tag ${t[2]||''}${t[0]==='rent'?' rent':''}">${t[1]}</span>`).join('');
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
  for (const t of S.tags){ if (t==='final'){ if (!c.final) return false; } else if (t==='under'){ if (c.band!=='under') return false; } else if (!c.tags.some(x=>x[0]===t)) return false; }   // v1.1.3 연구원: 저평가 단지도 태그로
  for (const a in S.amin){ const v=S.amin[a]; if (v!=null && (c.area[a]==null || c.area[a] < v[0] || c.area[a] > v[1])) return false; }   // v1.2.0 연구원: 영역 점수 범위(드래그, 0.1점 단위)
  if (S.mine){ if (S.mine.prod==='gap'){ const j=c.js&&c.js.rep; if (!j||!j[1]||!j[3]||j[2]<3||j[4]<3||j[1]>=j[3]) return false; const gap=(j[3]-j[1])*10000; if (gap+costs(j[3]*10000,false,S.mine.first).sum > S.mine.cash*10000) return false; }
    else { const p=bandPrice(c); if (p==null || p*10000 > S.mine.maxP) return false; } }
  return true;
}
// v1.4.0 개인화: 직장(업무지구)·자녀(학교 단계·성별)로 항목 점수를 다시 매기고, 영역 표준화(M.zs) 뒤 내 비중으로 합산, 보정 감점을 뺌
const linC=(v,pts)=>{ if(v==null) return null; if(v<=pts[0][0]) return pts[0][1]; for(let i=1;i<pts.length;i++){ if(v<=pts[i][0]){ const [x0,y0]=pts[i-1],[x1,y1]=pts[i]; return y0+(y1-y0)*(v-x0)/(x1-x0);} } return pts[pts.length-1][1]; };
const childStage=m=>{ if(!m||!m.child||!m.cby) return null; const age=new Date().getFullYear()-m.cby; return age<7?'pre':age<=12?'elem':age<=15?'mid':age<=18?'high':null; };
function personalItems(c,m){   // 내 조건으로 바뀐 항목 점수와 설명
  const out={}, note=[];
  if (m.hub!=null && c.jh && c.jh[m.hub]!=null){ const t=c.jh[m.hub]; out.Jcar=linC(t,M.jcurve)*10; note.push(`직주근접: ${M.hubN[m.hub]}까지 자가용 ${t}분 → ${f1(out.Jcar)}점`); }
  const st=childStage(m), sex=m.csex||null;
  if (st && c.ms && c.ms.length){
    const ok=c.ms.filter(r=>r[1]==='공'||(sex&&r[1]===sex)||(!sex&&true)).filter(r=>!sex||r[1]==='공'||r[1]===sex);
    if (ok.length){ const t0=ok[0][2], lim=Math.max((M.midK||2)*t0, 1000/60), top=ok.filter(r=>r[2]<=lim).slice(0,3); if(!top.length) top.push(ok[0]);
      const avg=top.reduce((a,r)=>a+r[2],0)/top.length; out.S3=linC(avg,M.mcurve)*10;
      const ach=top.filter(r=>r[3]!=null); if (ach.length) out.S4=ach.reduce((a,r)=>a+linC(r[3],M.schoolC),0)/ach.length;
      note.push(`중학교(${sex?(sex==='여'?'여학생: 여중·공학':'남학생: 남중·공학'):'전체'}): ${top.map(r=>r[0]).join('·')} 평균 도보 ${Math.round(avg)}분${ach.length?` · 학업성취 상위 ${Math.round(ach.reduce((a,r)=>a+r[3],0)/ach.length)}%`:''}`); }
  }
  if (st && c.hs && c.hs.length && sex){
    const ok=c.hs.filter(r=>sex==='여'?true:r[1]!=='여').slice(0,3);
    if (ok.length){ const avg=ok.reduce((a,r)=>a+r[2],0)/ok.length; out.S7t=linC(avg,M.mcurve)*10; out.S7a=ok.reduce((a,r)=>a+linC(r[3],M.schoolC),0)/ok.length;
      note.push(`고등학교(${sex==='여'?'여학생(남고 여부 자료 없음 → 공학으로 봄)':'남학생: 여고 제외'}): ${ok.map(r=>r[0]).join('·')} 평균 도보 ${Math.round(avg)}분 · 학업성취 상위 ${Math.round(ok.reduce((a,r)=>a+r[3],0)/ok.length)}%`); }
  }
  const drop = st==='mid'?['S6','S1t','S1c','S2'] : st==='high'?['S6','S1t','S1c','S2','S3','S4'] : st==='pre'?[] : st==='elem'?['S6'] : [];
  if (drop.length) note.push(`자녀 ${({mid:'중학생',high:'고등학생',elem:'초등학생'})[st]}: ${drop.map(k=>NAMES[k]).join('·')} 항목은 빼고 계산`);
  return {it:out, drop, note};
}
function personalArea(c,a,pi){
  const ks=Object.keys(IN[a]); let s=0, ws=0;
  for (const k of ks){ if (pi.drop.includes(k)) continue; const v=(k in pi.it)?pi.it[k]:c.it[k]; const w=IN[a][k]; if (v!=null && w>0){ s+=v*w; ws+=w; } }
  return ws?s/ws:null;
}
function personal(c){
  if (!S.mine) return scoreOf0(c);
  const m=S.mine, w=m.w, pi=personalItems(c,m); let s=0, ws=0;
  for (const a of AREAS){ if(!(w[a]>0)) continue; let v=c.area[a]; if (a==='S'||a==='J') v=personalArea(c,a,pi); if (v==null) continue;
    const z=M.zs&&M.zs[a]?Math.min(10,Math.max(0,M.stdMu+M.stdSg*(v-M.zs[a][0])/M.zs[a][1])):v; s+=z*w[a]; ws+=w[a]; }
  if (!ws) return null;
  return Math.max(0, s/ws*10-(c.Msum||0));
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
const HINT = {   // v1.1.3 연구원: 태그를 누르면 뜻을 보여 줌(엔진 태그 규칙과 같은 기준)
  under:['저평가 단지','반경 500m 안 비슷한 조건 단지 시세로 만든 추정가보다 최근 실거래가가 10% 이상 낮은 단지입니다.','종합점수에는 넣지 않는 참고 정보입니다. 감정평가나 적정가격이 아닙니다.'],
  chopuma:['초품아','차도를 건너지 않고 인도로 배정 초등학교까지 도보 5분 내에 가는 단지입니다.','배정 초등학교는 학구도 통학구역 기준입니다. 차도는 OpenStreetMap 기준이며 단지 안 길은 차도로 보지 않습니다.'],
  acad:['학원가','도보 15분 내 학원이 150개 이상인 단지입니다. 교과 학원은 1개, 예체능·독서실·스터디카페·체육도장은 0.5개로 셉니다.','교육청 학원·교습소 등록 자료(NEIS ’26.10) 기준입니다. 성인 대상 학원은 뺐습니다.'],
  sub:['역세권','운행 중인 도시철도역까지 600m 내인 단지입니다. 개통 예정역까지 600m 내이기도 하면 더블 역세권(예정)으로 표시합니다.','역 위치는 광주교통공사·OpenStreetMap 기준입니다.'],
  sub2:['역세권(예정)','공사 중인 도시철도 2호선 예정역까지 600m 내인 단지입니다.','개통 시기는 공식 발표로 다시 확인하세요.'],
  slse:['슬세권','슬리퍼 신고 다닐 거리에 프랜차이즈·편의시설·병원·마트·공원이 모인 단지입니다. 생활환경 점수가 광주 단지 중 상위 5% 안이면 해당합니다.','생활환경 항목(프랜차이즈·편의시설·동네 병·의원·대형마트·동네마트·공원·종합병원·도서관·영화관·수영장) 점수 기준입니다.'],
  park:['공세권','걸어서 5분 내(공원 경계까지)에 큰 공원이나 호수가 있는 단지입니다. 공원·호수 10만㎡ 이상, 또는 5만㎡ 이상이면서 하천·산책로로 더 큰 녹지에 이어진 곳(예: 수완호수공원)이 해당합니다.','도시공원정보 표준데이터 면적과 OpenStreetMap 공원·호수 경계 기준입니다.'],
  water:['수세권','걸어서 5분 내에 하천 둔치나 수변 산책로(광주천·풍영정천·영산강 자전거길, 푸른길 등)가 있는 단지입니다. 공세권과 겹치면 공세권만 표시합니다.','OpenStreetMap 하천·이름 있는 산책로 기준입니다.'],
  job:['직주근접','주요 업무지구의 일자리 규모와 자가용 출퇴근 시간으로 매긴 직주근접 점수가 광주 단지 상위 5% 안인 단지입니다.','통계청 사업체조사 종사자 수 × 국민연금 평균 임금, 2020 인구주택총조사 통근시간 분포 기준입니다.'],
  new:['신축','입주 5년 이내인 단지입니다.','사용승인 연도 기준입니다.'],
  big:['대단지','1,000세대 이상인 단지입니다.','K-apt 세대수 기준입니다.'],
  gpark:['지상공원화','주차장이 모두 지하에 있어(지상 주차 0대) 단지 지상을 공원처럼 쓰는 단지입니다.','K-apt 지상·지하 주차대수 기준입니다.'],
  park2:['주차 여유','세대당 주차가 1.5대 이상인 단지입니다.','K-apt 주차대수 ÷ 세대수 기준입니다.'],
  liq:['거래 활발','거래활발도 점수가 10점 만점에 8점 이상인 단지입니다. 최근 2년 매매가 광주 평균보다 많아 팔고 사기 쉬운 편입니다.','국토교통부 실거래가 기준입니다.'],
  rent:['임대','분양형태가 임대인 단지입니다. 매매할 수 없어 거래활발도는 0점이고, 등급은 최고 4등급입니다.','K-apt 분양형태 기준입니다.'],
  mixr:['임대 혼합','분양 세대와 임대 세대가 함께 있는 단지입니다.','K-apt 분양형태(혼합) 기준입니다.'],
  mixu:['주상복합','아래층에 상가가 있는 주상복합 단지입니다.','K-apt 단지 분류 기준입니다.'],
  villa:['연립·다세대','공시가격 기준으로 아파트가 아닌 연립·다세대(빌라)로 분류된 곳입니다. 등급은 같은 규칙으로 매겼지만 아파트와 바로 비교하기는 어렵습니다.','국토교통부 공동주택 공시가격 구분입니다.'],
  sup:['입주 물량 많음','반경 2km 안에 3년 안 입주하는 새 아파트가 기존 세대의 20% 이상입니다. 입주 때 전세·매매가가 눌릴 수 있습니다.','청약홈 분양정보·사용승인 예정 기준입니다.'],
  solo:['나홀로아파트','동이 1개뿐인 소규모 단지입니다. 거래가 적고 시세가 덜 오르는 경향이 있습니다.','건축물대장·K-apt 동 수 기준입니다.'],
  pklow:['주차 부족','세대당 주차가 0.7대 미만인 단지입니다. 저녁 시간 주차가 빠듯할 수 있습니다.','K-apt 주차대수 ÷ 세대수 기준입니다.'],
  hall:['복도식','복도식 구조 단지입니다.','K-apt 복도 유형 기준입니다.'],
  harm:['유해업소 밀집','단지 경계 200m 내에 유흥주점 등 유해업소가 많아 보정 점수가 2점 이상인 단지입니다.','소상공인 상가정보 업종 기준입니다. 50m 내 업소는 더 크게 셉니다.'],
  noise:['소음 주의','큰 도로(왕복 6차로 이상·도시고속도로), 지상 철도, 광주공항 활주로가 가까워 소음 보정이 2점인 단지입니다.','실제 소음 측정값이 아닌 거리 기준 추정입니다.'],
  nimby:['기피시설 인접','하수처리·매립·소각장, 교정시설, 장사시설, 차량기지·발전소·345kV 변전소가 1km 내에 있어 보정 점수가 1점 이상인 단지입니다.','가까울수록 크게 셉니다(300m 내 기본점, 1km에서 0).'],
  odor:['악취 주의','산업단지·축사·퇴비 시설이 가까워 악취 보정이 1.5점 이상인 단지입니다.','바람 방향을 반영한 거리 기준 추정입니다.'],
  final:['확정 등급이란?','모든 기본 항목이 관측된 단지만 도시 내 상대등급을 받습니다.','자료가 빠진 단지는 잠정점수와 가능한 점수 범위만 보여 줍니다.'],
  over:['고평가 단지','반경 500m 안 비슷한 조건 단지 시세로 만든 추정가보다 최근 실거래가가 10% 이상 높은 단지입니다.','종합점수에는 넣지 않는 참고 정보입니다.'],
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
  // v1.2.5 연구원: 확대 단계의 동 이름은 법정동(치평동·쌍촌동…). 행정동은 중간 단계(동 평균 알약)에서만. 법정동 경계 자료가 없어 단지 평균 위치에 표시
  const dong=d3.groups(CX.filter(c=>c.lat&&c.lon),c=>c.gu+'|'+c.dong).map(([k,cs])=>{ const la=d3.mean(cs,c=>c.lat), lo=d3.mean(cs,c=>c.lon); const [x,y]=proj([lo,la]); return {t:k.split('|')[1].replace(/\(.*\)$/,''),x,y,cls:'lbl-dong',pr:8-Math.min(cs.length,20)/40,min:2.4,max:99,fs:11}; });
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
const gLab = c => { const g=gradeOf(c); return g==null ? (c.rent&&!S.mine?`입지 ${c.locG??'-'}등급`:'잠정') : g+'등급'; };
const mapG = c => gradeOf(c) ?? (c.rent&&!S.mine ? (c.locG??null) : null), mLab = c => { const g=mapG(c); return g==null?'잠정':g+'등급'; };   // v1.1.3 연구원: 지도의 임대 단지는 'N등급'만, 매매 단지와 같은 모양
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
    const g=d3.select(this), gr=mapG(c);
    g.attr('aria-label',`${c.dong} ${c.n}, ${gLab(c)}, 종합 ${f1(scoreOf(c))}점`);
    g.select('title').text(`${c.dong} ${c.n} · ${gLab(c)} · 종합 ${f1(scoreOf(c))}점${c.final?'':'(잠정)'} · ${BAND[c.band]}`);
    g.select('.pill').style('fill', gr==null?'var(--surface)':gCol(gr)).style('stroke', gr==null?'var(--muted)':null).attr('stroke-dasharray', gr==null?'3 2':null);
    g.select('.sc').text(mLab(c)).style('fill', gInk(gr));
    const pt = S.mine && S.mine.size!=='all' ? bandPrice(c) : repPrice(c);
    const ptl = S.mine && S.mine.size!=='all' ? eok(pt) : repLab(c);
    g.select('.pr').text(ptl).attr('x',22).attr('y',0);
    g.select('.prbg').attr('x',17).attr('y',-9).attr('width',ptl.length*7+10).attr('height',18).attr('rx',6);
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
    const pw=(repLab(c).length*7+10)*sz, lab=[x+19.5*sz,y-9*sz,x+17*sz+pw,y+9*sz];
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
  $('ptop').innerHTML = `<span class="cnt">${VB&&list.length<all.length?'지도 안 ':''}<b class="num">${list.length}</b>개 단지${S.mine?(S.mine.prod==='gap'?' · 갭 '+eok(S.mine.cash)+' 안':` · 예산 ${eok(S.mine.maxP/10000)} 이하`):''}</span>
    <span class="sortWrap"><select id="sort" aria-label="정렬"><option value="score">${S.mine?'내 점수순':'등급순'}</option><option value="loc">입지점수순</option><option value="gap">저평가 큰 순</option><option value="price">가격 낮은 순</option><option value="turn">거래 활발 순</option></select></span>`;
  $('sort').value=S.sort; $('sort').onchange=e=>{S.sort=e.target.value; renderPanel();};
  $('pbody').innerHTML = list.length ? `<ul class="list">${list.slice(0,LMORE).map(itemHTML).join('')}</ul>${list.length>LMORE?`<p style="padding:8px 16px 20px"><button class="btn" id="lmore" style="width:100%">더 보기 (${(list.length-LMORE).toLocaleString()}곳 남음)</button></p>`:''}` : `<div class="empty">조건에 맞는 단지가 없습니다.<br>필터를 줄이거나 예산을 늘려 보세요.</div>`;
  $('pbody').querySelectorAll('.item[data-id]').forEach(b=>b.onclick=()=>select(b.dataset.id));
  if ($('lmore')) $('lmore').onclick=()=>{ const y=$('pbody').scrollTop; LMORE+=300; renderPanel(); $('pbody').scrollTop=y; };
  $('pbody').querySelectorAll('[data-pid]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); openPrice(b.dataset.pid); });
}
function itemHTML(c){
  const ri=repInfo(c), pt = S.mine && S.mine.size!=='all' ? bandPrice(c) : ri.pt, r=ri.t||ri.b, sc=scoreOf(c);
  return `<li class="row"><button class="item" data-id="${c.id}">
    ${gradeChip(c)}
    <span style="min-width:0"><span class="nm">${c.dong} ${c.n}</span><br><span class="sub">${c.gu} · ${c.u.toLocaleString()}세대 · ${c.y}년</span>
      <span class="tags">${tagsShow(c)}</span></span>
    <span class="rt"><span class="score num">${f1(sc)}<small>${S.mine?'':'점'}</small></span><span class="price">${r?`${typeLabel(r)} `:''}${(!(S.mine && S.mine.size!=='all')&&ri.src==='bp')?'분양 ':''}${eok(pt)}</span></span>
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
const SGRP={S6:'어린이집·유치원',S1t:'초등학교',S3:'중학교',S5a:'학원'}, SNAME={S6:'도보 거리',S1t:'통학 시간',S1c:'통학 길 차도 횡단',S2:'고학년 집단 변화',S3:'통학 시간',S4:'학업성취도',S5a:'학원가',S5b:'대형학원'};   // v1.1.2 연구원: 교육은 초등 → 중학교 → 학원
function rankOf(c){   // v1.1.3 연구원: 같은 권역 등급 단지(임대 제외) 안 순위 = 등급 → 점수 순
  const z=c.zn||'gj', L=CX.filter(x=>(x.zn||'gj')===z && gradeOf(x)!=null).sort((a,b)=>gradeOf(a)-gradeOf(b) || (scoreOf(b)??-1)-(scoreOf(a)??-1));
  const i=L.indexOf(c); return [i+1, L.length, 100*(i+.5)/L.length]; }
function capWhy(c,g){   // v1.1.2: 등급 조건으로 내려간 단지만 한 줄로 사유
  const edge=(c.edge&&g!=null)?`점수가 등급 경계 근처(점수 상위 ${Math.round(c.pct0??c.pct)}%)라 비중을 조금만 바꿔도 한 단계 달라질 수 있습니다. `:'';   // v1.2.1 자체검토
  const _w=capWhy0(c,g); return edge+(_w||'');
}
function capWhy0(c,g){
  if (g==null) return c.rent&&!S.mine?'임대 단지는 매매가 없어 종합 등급 대신 입지 등급만 보여 줍니다.':'자료가 빠진 항목이 있어 등급을 붙이지 않았습니다.';
  if (c.why==='mktup' && c.grade<c.grade0){ const pg=v=>[4,11,23,40,60,77,89,96,100].findIndex(x=>v<=x)+1, pp=v=>v<1?'1% 이내':Math.round(v)+'%'; return `점수로는 ${c.grade0}등급이지만 ${c.grade}등급입니다. 시장이 인정한 자리값(상위 ${pp(c.pxp)})과 ㎡당 실거래가(상위 ${pp(c.rpp)})가 모두 ${Math.max(pg(c.pxp),pg(c.rpp))}등급 수준 이상이라 점수 등급보다 한 단계 올렸습니다.`; }   // v1.1.6 시장 등급 보정(일반화)
  if (c.why==='newmkt' && c.grade<c.grade0){ const pp=v=>v<1?'1% 이내':Math.round(v)+'%'; return `점수로는 ${c.grade0}등급이지만 ${c.grade}등급입니다. 준공 10년 이내 400세대 이상 신축이고, 자기 ㎡당 실거래가가 광주 상위 ${pp(c.rpp)}로 ${c.grade}등급 가격대(상위 ${c.grade<=3?23:40}%) 안이라 최소 ${c.grade}등급을 줍니다.`; }   // v1.1.8 신축·시세 하한 · v1.2.3 4등급까지
  if (!(c.grade>c.grade0)) return '';
  const pc=v=>v==null?'-':Math.round(v), n24=(c.p&&c.p.q24&&c.p.q24.n)||0, g0=c.grade0, gg=c.grade;   // v1.1.3 연구원: 왜 그 등급까지만인지 풀어서
  const ex=(t)=>`${t} 최고 3등급입니다. 최근 2년 매매가 10건 이상이고 ㎡당 실거래가가 광주 상위 7% 안이면 2등급까지 줍니다. 이 단지는 매매 ${n24}건, 실거래가 상위 ${pc(c.rpp)}%입니다.`;
  const W={small:ex('100세대 미만 소단지는'), old:ex('입주 25년이 넘은 단지는'),
    price:`등급은 이 단지의 ㎡당 실거래가 등급보다 한 단계까지만 위로 갑니다(1등급은 실거래가 상위 ${M.p1pct||11}% · 2등급은 23% · 3등급은 40% · 4등급은 60% 안). 이 단지는 상위 ${pc(c.rpp)}%입니다.`,   // v1.2.3 2·3등급에도 가격 조건(한 단계)
    unit:'전 세대가 전용 59㎡ 미만(소형·원룸형)이라 최고 4등급입니다.',   // v1.2.3
    nopx:'최근 2년 매매가 없어 시장 가격을 확인할 수 없으므로 최고 3등급입니다.',
    rentpx:'임대 단지는 매매 가격이 없어 최고 4등급입니다.',
    px:c.pxp==null?'최근 실거래가 없어 시장이 매기는 자리값을 확인할 수 없으므로 최고 3등급입니다.':`등급은 시장이 인정한 자리값 등급보다 한 단계까지만 위로 갑니다(1등급은 자리값 상위 11% · 2등급은 23% · 3등급은 40% · 4등급은 60% 안). 자리값은 ㎡당 실거래가에서 연식·세대수·주차 같은 단지 조건 몫을 빼고 남은 값입니다. 이 단지의 자리값은 상위 ${pc(c.pxp)}%입니다.`,
    px1:`1등급은 신축·대단지 프리미엄까지 뺀 순수 자리값도 광주 상위 ${M.px1p||23}% 안이어야 합니다. 이 단지는 상위 ${pc(c.mktPg)}%입니다.`,   // v1.1.4 기본 끔(M.px1on)
    unsold2:c.unsT?`미분양이 남아 있어(준공 때 ${c.unsT[2]}세대 · 단지의 ${c.unsT[1]}%) 최고 ${c.unsT[0]}등급입니다.`:'미분양이 남아 있어 등급을 낮췄습니다.'};
  return `점수로는 ${g0}등급이지만 ${gg}등급입니다. ${W[c.why]||'등급 조건에 걸렸습니다.'}`;
}
function itemRow(c,k,lab){
  const v=c.it[k];
  return `<div class="it ${v==null?'miss':''}"><span class="in">${lab||NAMES[k]}</span><span class="iv num">${v==null?'자료 없음':f1(v)+'<small> /10</small>'}</span><span class="ir">${c.raw[k]||''}${v==null?' → 이 항목은 빼고 같은 영역의 나머지 항목으로 계산':''}</span></div>`;
}
function typeTable(c){   // v1.1.2 연구원: 가로 스크롤 없이 전용면적·세대·최근 1년 거래·최근 거래. 줄을 누르면 그 면적이 있는 동 표시
  const U=c.ut||[], used=new Set();
  let rows=U.map(([ex,u],i)=>{ const ds=(c.utd||[])[i]||null; const t=c.types.filter(t=>!used.has(t)&&Math.abs(t.ex-ex)<=1).sort((x,y)=>y.n-x.n)[0]; if(t) used.add(t); return {ex,u,ds,t}; });
  c.types.forEach(t=>{ if(!used.has(t)) rows.push({ex:t.ex,u:null,ds:null,t}); });
  rows.sort((a,b)=>a.ex-b.ex); if(!rows.length) return '';
  const hasU=rows.some(r=>r.u), all=c.udong||[], fx=v=>Number.isInteger(v)?String(v):v.toFixed(2);
  const dt=t=>t&&t.dt?` <span class="pdt">’${t.dt.slice(0,2)}.${+t.dt.slice(2,4)}</span>`:'';
  return `<table class="t pt"><thead><tr><th>전용</th>${hasU?'<th>세대</th>':''}<th>최근 1년</th><th>최근 거래</th></tr></thead><tbody>${rows.map(r=>{
    const tr=`<tr${r.ds?' class="tyr" tabindex="0" role="button" aria-expanded="false" title="눌러서 이 면적이 있는 동 보기"':''}><td>${fx(r.ex)}㎡${r.ds?' <span class="dgi">동 ▾</span>':''}</td>${hasU?`<td class="num">${r.u!=null?r.u.toLocaleString():'–'}</td>`:''}<td class="num">${r.t?r.t.n+'건':'0건'}</td><td class="num">${r.t&&r.t.last?eok(r.t.last)+dt(r.t):'<span style="color:var(--muted)">거래 없음</span>'}</td></tr>`;
    const dd=r.ds?`<tr class="tyd" hidden><td colspan="${hasU?4:3}"><div class="dongs">${(all.length?all:r.ds).map(d=>`<span class="dg${r.ds.includes(d)?' on':''}">${d}</span>`).join('')}</div><p class="note" style="margin:4px 0 0">${fx(r.ex)}㎡가 있는 동 ${r.ds.length}개(진한 칸) · 공동주택 공시가격 자료 기준</p></td></tr>`:'';
    return tr+dd; }).join('')}</tbody></table>${hasU?'<p class="note" style="margin:4px 0 0">세대 = 공동주택 공시가격 자료의 전용면적별 세대 수. 줄을 누르면 그 면적이 있는 동을 보여 줍니다.</p>':''}`;
}
function futureLines(c){            // v3.0.0 연구원: 역세권은 1km 넘으면 의미가 적음 → 1km 안일 때만. 확장 지역은 지역 개발 계획(FUT, 출처 있는 것만)
  const L=[];
  const F=(DATA.future||{})[c.nj?c.gu:'광주']||[];
  if (c.sub2&&c.sub2[1]<=1000){ L.push(`도시철도 2호선 예정역 <b>${c.sub2[0]}</b>까지 약 ${c.sub2[1].toLocaleString()}m`); L.push('2호선 1단계(시청~광주역) 공사 중, 개통 시기는 공식 발표 확인'); L.push('※ 1단계 개통 목표가 2027년 12월에서 2028년 12월로 연기됐다는 보도가 있습니다(’26.10.2)'); L.push('※ 개통 시기·운행 조건은 공식 발표로 다시 확인하세요'); }
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
    const its = Object.keys(IN[a]).map(k=>(a==='S'&&SGRP[k]?`<div class="sgh">${SGRP[k]}</div>`:'')+itemRow(c,k,a==='S'?SNAME[k]:null)).join('');
    return `<button class="area" data-cat="${a}" aria-expanded="${open}"><span class="an">${i+1}. ${AN[a]}<span class="aw">비중 ${Math.round(M.areaW[a]*100)}%</span></span><span class="bar"><i style="width:${(v||0)*10}%;background:${full?'var(--accent)':'var(--muted)'}"></i></span><span class="s num">${v==null?'–':f1(v)}<small>/10</small></span><span class="chev">▶</span></button>${open?`<div class="subs">${its}</div>`:''}`;
  }).join('');
  const inCmp=S.cmp.includes(c.id);
  const tot = c.final ? c.total : c.tent;
  const subsc = [['입지 점수', c.loc ?? c.locTent], ['상품성 점수', c.area.C!=null?c.area.C*10:null], ['거래활발도 점수', c.area.Q!=null?c.area.Q*10:null]]
    .map(([l,v])=>`<div class="sbx"><span class="l">${l}</span><b class="num">${v==null?'–':f1(v)}</b></div>`).join('');   // v1.1.2 연구원: 점수 3개만
  const pro = (c.hi||[]).map(([k,t])=>`<li>${t}</li>`).join('') || '<li>두드러진 강점 항목이 없습니다</li>';
  const con = (c.lo||[]).map(([k,t])=>`<li>${t}</li>`).join('') || '<li>두드러진 약점 항목이 없습니다</li>';
  const flags=[]; if (c.mktG && c.locG && !c.mktE && (c.y||9999)<=2023 && Math.abs(c.mktG-c.locG)>=3) flags.push(c.mktG<c.locG?`시장 평가와 차이 큼: 입지 점수는 ${c.locG}등급인데 실거래가로 본 입지(시장 검증)는 ${c.mktG}등급입니다. 점수에 안 잡히는 장점(동네 평판·학군 선호 등)이 있을 수 있습니다.`:`시장 평가와 차이 큼: 입지 점수는 ${c.locG}등급인데 실거래가로 본 입지(시장 검증)는 ${c.mktG}등급입니다. 점수에 안 잡히는 약점이 있는지 확인하세요.`); if (c.xs.ecross==='big' && !c.xs.evia) flags.push('배정 초등학교 가는 길에 왕복 4차로 이상 큰길을 건넙니다. 통학 안전을 따로 확인하세요.'); if (c.xs.evia) flags.push(`배정 초등학교 가는 길에 큰길을 ${c.xs.evia}로 건넙니다.`); if (c.xs.encr && c.xs.encr[0]>=3) flags.push(`배정 초등학교 가는 길에 왕복 2차로 이하 길을 ${c.xs.encr[0]}번 건넙니다.`);
  const a3=c.p.a3, gp = c.gap!=null ? pct(c.gap) : '';
  const mt=mainType(c), mtl=mt?`${mt.py}평형(전용 ${mt.ex}㎡)`:'';
  const rinf=repInfo(c), bpi=rinf.src==='bp'?rinf.b:null, _te=topEx(c), utSrc=(mt&&_te!=null&&Math.abs(mt.ex-_te)>1)?`세대가 가장 많은 평형(전용 ${_te}㎡)은 최근 1년 매매가 없어 거래가 있는 평형`:(c.ut&&c.ut.length?(c.uts?`세대가 가장 많은 평형(${c.uts})`:'세대가 가장 많은 평형'):'거래가 가장 많은 평형');   // v1.2.4
  const priceTop = bpi ? `<div class="ptop3"><span class="v num">분양가 ${eok(bpi.top)}원</span>${bandBtn(c)}</div><div class="ptop3"><span class="s">${bpi.py}평형(전용 ${bpi.ex}㎡) 분양 최고가(청약홈 주택형별) · ${utSrc} · ${mt?`이 평형은 최근 1년 매매가 없어 분양가를 보여 줍니다`:'최근 1년 매매가 없어 분양가를 보여 줍니다'}</span></div>`
    : mt && mt.a3 ? `<div class="ptop3"><span class="v num">${eok(mt.a3)}원</span>${bandBtn(c)}</div><div class="ptop3"><span class="s">${mtl} 최근 3개월 평균 실거래가 · ${mt.n3}건 · ${utSrc}</span></div>`
    : `<div class="ptop3"><span class="s">${mt?`${mtl} 최근 3개월 거래가 없습니다 · 최근 거래 ${eok(mt.last)}원(’${mt.dt.slice(0,2)}.${+mt.dt.slice(2,4)})`:'최근 1년 매매 거래가 없습니다'}</span>${bandBtn(c)}</div>`;
  const pmsg = c.band==='hold' ? `${(c.pm&&c.pm.holdWhy)||'비교 자료 부족'}이라 고평가·저평가를 판정하지 않습니다.`
    : c.band==='over' ? '인근 비슷한 조건 단지의 시세보다 실거래가가 높습니다.'
    : c.band==='under' ? '인근 비슷한 조건 단지의 시세보다 실거래가가 낮습니다.'
    : '인근 비슷한 조건 단지의 시세와 실거래가가 비슷합니다.';
  $('pbody').innerHTML = `<div class="detail">
    <div><div class="dtitle"><h1>${c.dong} ${c.n}</h1><button class="star ${inCmp?'on':''}" id="star" aria-pressed="${inCmp}" aria-label="${inCmp?'비교함에서 빼기':'비교함에 담기'}" title="${inCmp?'비교함에서 빼기':'비교함에 담기'}">${inCmp?'★':'☆'}</button></div>
      <div class="dmeta">${c.gu} ${c.addr||''} · ${c.u.toLocaleString()}세대 · ${c.ym?String(c.ym).slice(0,4)+'.'+String(c.ym).slice(4):c.y} 사용승인 · ${c.b||''}</div>
      <div class="dmeta">${c.far?`용적률 ${c.far}%${c.fe?'(추정)':''}`:'용적률 미확인'}${c.bcr?` · 건폐율 ${c.bcr}%`:''}${c.offi?' · 같은 건물에 오피스텔 있음(세대수는 아파트만)':''}</div>
      <div class="tags" style="margin-top:6px">${tagsShow(c)}</div></div>
    <section class="hero">
      <div class="ghead">${g==null?`<span class="gnum tent">${c.rent&&!S.mine?'임대':'산출 전'}</span>`:`<span class="gnum" style="background:${gCol(g)};color:${gInk(g)}">${g}등급</span>`}<span class="gwhere">${g==null?(c.rent&&!S.mine?`종합 등급 없음 · 입지 ${c.locG??'-'}등급`:'잠정 평가'):(()=>{ const [rk,nn,pp]=rankOf(c); return `${c.zn==='gj'||!c.zn?'광주':({sw:'목포권',east:'광양만권'})[c.zn]} 아파트 ${nn.toLocaleString()}곳 중 상위 ${f1(pp)}%<span class="gtot">종합점수 ${f1(tot)}점(${rk.toLocaleString()}등)</span>`; })()}</span></div>
      ${(()=>{ const w=capWhy(c,g); return w?`<div class="gbase">${w}</div>`:''; })()}
      <div class="sc3">${subsc}</div>
    </section>
    <section class="sec"><h2>보정 점수 <span style="font-weight:500;color:var(--muted);font-size:12px">시장에서 할인되는 단지 특성</span></h2><div>${(c.M&&c.M.length)?c.M.map(m=>`<div class="it"><span class="in">${m[0]}</span>${m[1]<0?`<span class="iv num" style="color:var(--accent)">+${f1(-m[1])}</span>`:`<span class="iv num" style="color:var(--bad)">−${f1(m[1])}</span>`}<span class="ir">${m[2]}</span></div>`).join(''):'<p class="note" style="margin:6px 0">이 단지는 시장에서 할인되는 특성이 없어 깎인 점수가 없습니다.</p>'}</div></section>
    <section class="pros"><div class="p"><h3>장점</h3><ul>${pro}</ul></div><div class="c"><h3>약점</h3><ul>${con}</ul></div></section>
    <section class="sec"><h2>영역별 점수</h2><div>${areas}</div></section>
    <section class="card"><h2 style="font-size:14px;margin:0;font-weight:700">실거래가<span class="tagref">참고 정보</span></h2>
      ${priceTop}
      <p class="note" style="font-size:12.5px;color:var(--ink)">${pmsg}</p>
      ${typeTable(c)}
      <div class="chart" id="pchart"></div>
      ${jsHTML(c)}</section>
    ${S.mine?(()=>{const pi=personalItems(c,S.mine); const j=c.js&&c.js.rep; const gapTxt=(S.mine.prod==='gap'&&j&&j[1]&&j[3])?`갭: ${j[0]}㎡ 매매 중위 ${eok(j[3])} − 전세 중위 ${eok(j[1])} = ${eok(j[3]-j[1])}`:''; return `<section class="card mine"><h2 style="font-size:14px;margin:0;font-weight:700">내 조건으로 본 이 단지 <span class="tagref">개인 참고</span></h2><div class="lines"><p><b>내 점수 ${f1(c.ps)}점 · 내 등급 ${c.pg??'-'}등급</b>(기본 ${c.grade!=null?c.grade+'등급':(c.rent?'임대':'잠정')})</p>${pi.note.map(t=>`<p>${t}</p>`).join('')}${gapTxt?`<p>${gapTxt}</p>`:''}${pi.note.length?'':'<p>직장·자녀 조건을 넣지 않아 비중만 바꿔 계산했습니다.</p>'}</div></section>`;})():''}
    ${(c.xs.tr||[]).length?`<section class="card"><h2 style="font-size:14px;margin:0;font-weight:700">교통 한눈에</h2><dl class="kv trk">${c.xs.tr.map(([k,v])=>`<dt>${k}</dt><dd>${String(v).replace(' (자가용 기준)',' <small>(자가용 기준)</small>')}</dd>`).join('')}</dl></section>`:''}
    <section class="card"><h2 style="font-size:14px;margin:0;font-weight:700">미래 변화</h2><div class="lines">${futureLines(c)}</div></section>
    <section class="card"><h2 style="font-size:14px;margin:0;font-weight:700">개별 위험·확인 사항</h2><div class="lines">${flags.map(f=>`<p>${f}</p>`).join('')}<p>이 분석은 AI가 공공데이터로 자동 계산한 결과입니다. 실제 매수 등 중요한 결정 전에는 현장 방문과 공식 자료로 사람이 직접 다시 확인해 주세요.</p></div></section>
    <section class="card"><h2 style="font-size:14px;margin:0;font-weight:700">출처</h2><ul class="note" style="margin:0;padding-left:16px">${M.sources.map(s=>`<li>${s}</li>`).join('')}</ul></section>
  </div>`;
  $('pbody').querySelectorAll('.area').forEach(b=>b.onclick=()=>{S.openCat=S.openCat===b.dataset.cat?null:b.dataset.cat; renderDetail();});
  $('pbody').querySelectorAll('[data-pid]').forEach(b=>b.onclick=()=>openPrice(b.dataset.pid));
  $('pbody').querySelectorAll('tr.tyr').forEach(tr=>{ const f=()=>{ const d=tr.nextElementSibling; if(!d||!d.classList.contains('tyd')) return; d.hidden=!d.hidden; tr.setAttribute('aria-expanded',String(!d.hidden)); }; tr.onclick=f; tr.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); f(); } }; });
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
$('fReset') && ($('fReset').onclick=()=>{
  Object.assign(S,{band:'all',py:null,units:null,ageR:null,priceR:null,far:null,bcr:null,qR:null,pkR:null,hint:null,pop:null,amin:{}});
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
const AF={S:'교육환경',L:'생활환경',C:'단지상품성',Q:'거래활발도'};   // v1.2.0 연구원: 직주근접 필터 삭제 · 교육 → 생활 → 상품성 → 거래
const AFD={L:'프랜차이즈·편의시설·병원·마트·공원 등 생활 편의를 모은',S:'초등 통학·중학교·학원가를 모은',C:'연식·세대수·시공사·주차·커뮤니티를 모은',J:'주요 업무지구 출퇴근 거리로 매긴',Q:'최근 2년 매매가 얼마나 활발한지로 매긴'};
function chipLabels(){
  const L=(k,txt)=>{ const b=document.querySelector(`.chip[data-pop="${k}"]`); if(b){ b.querySelector('span').textContent=txt; b.setAttribute('aria-pressed',String(txt!==b.dataset.def)); } };
  for (const k in RANGE){ const r=RANGE[k], v=r.get(); L(k, v? `${r.title} ${v[0].toLocaleString()}~${v[1].toLocaleString()}${r.unit}${k==='price'&&v[1]>=RMAX.p?' 이상':''}` : r.title); }
  for (const a in AF){ const v=S.amin[a]; L('a'+a, v!=null?`${AF[a]} ${v[0].toFixed(1)}~${v[1].toFixed(1)}점`:AF[a]); }
  L('tag', S.tags.size?`태그 ${S.tags.size}`:'태그');
  L('grade', S.grades.size? [...S.grades].sort().map(g=>g?g:'잠정').join('·')+(S.grades.has(0)&&S.grades.size===1?'':'등급') : '등급');
}
function openPop(k, btn){
  const pop=$('fpop');
  if (S.pop===k){ S.pop=null; pop.hidden=true; return; }
  S.pop=k; pop.hidden=false;
  const r=btn.getBoundingClientRect(), host=pop.offsetParent.getBoundingClientRect();
  pop.style.left=Math.max(8, Math.min(r.left-host.left, host.width-pop.offsetWidth-8))+'px';
  if (k[0]==='a' && AF[k.slice(1)]){   // v1.2.0 연구원: 입주년차처럼 0~10점 막대 + 드래그로 범위 선택
    const a=k.slice(1), vals=CX.map(c=>c.area[a]).filter(v=>v!=null), cur=S.amin[a]||[0,10], h=histo(vals,0,10,1), hm=Math.max(...h);
    const cnt=(x,y)=>vals.filter(v=>v>=x && v<=y).length;
    pop.innerHTML=`<div class="pt">${AF[a]} <b id="rv"></b></div><div class="pdef">${AFD[a]} 10점 만점 영역 점수입니다. 양쪽 손잡이를 끌어 0.1점 단위로 점수 범위를 고르세요.</div><div class="hist">${h.map((v,i)=>`<i data-i="${i}" style="height:${Math.max(2,v/hm*100)}%"></i>`).join('')}</div>
      <div class="dual"><input type="range" id="r0" min="0" max="10" step="0.1" value="${cur[0]}" aria-label="${AF[a]} 최소"><input type="range" id="r1" min="0" max="10" step="0.1" value="${cur[1]}" aria-label="${AF[a]} 최대"></div>
      <div class="pax">${[...Array(11).keys()].map(t=>`<span>${t}</span>`).join('')}</div><div class="pf"><button class="lnk" id="pReset">초기화</button><button class="btn primary sm" id="pDone">적용</button></div>`;
    const r0=$('r0'), r1=$('r1');
    const upd=(apply)=>{ let x=+r0.value, y=+r1.value; if (x>y){ [x,y]=[y,x]; } $('rv').textContent=`${x.toFixed(1)}~${y.toFixed(1)}점 · ${cnt(x,y).toLocaleString()}곳`;
      pop.querySelectorAll('.hist i').forEach(e=>{ const v=+e.dataset.i; e.classList.toggle('on', v+1>x && v<=y); });
      if (apply){ S.amin[a]=(x===0&&y===10)?null:[+x.toFixed(1),+y.toFixed(1)]; refresh(); } };
    r0.oninput=r1.oninput=()=>upd(false); r0.onchange=r1.onchange=()=>upd(true); upd(false);
    $('pReset').onclick=()=>{ r0.value=0; r1.value=10; upd(true); };
  } else if (k==='tag'){   // v1.1.3 연구원: 태그 여러 개 선택 · 누르면 뜻 설명
    const have=new Map(); CX.forEach(c=>c.tags.forEach(t=>{ if(!have.has(t[0])) have.set(t[0],t); }));
    const HK=Object.keys(HINT), hi=k=>{ const i=HK.indexOf(k); return i<0?99:i; };
    const und=CX.some(c=>c.band==='under'), ordT0=[...(und?[['under','저평가 단지','good']]:[]), ...[...have.values()].filter(t=>t[2]==='good'), ...[...have.values()].filter(t=>!t[2]&&t[0]!=='naju'), ...[...have.values()].filter(t=>t[2]==='bad')], ordT=ordT0.sort((a,b)=>hi(a[0])-hi(b[0]));   // 태그 순서: 좋은 점 → 단지 형태 → 아쉬운 점
    const N=t=>t==='under'?CX.filter(c=>c.band==='under').length:CX.filter(c=>c.tags.some(x=>x[0]===t)).length;
    pop.innerHTML=`<div class="pt">태그(여러 개 선택)</div><div class="pdef">여러 개를 고르면 모두 해당하는 단지만 보여 줍니다. 태그를 누르면 뜻이 아래에 나옵니다.</div><div class="pbtns tagb">${ordT.map(t=>`<button class="chip ${t[2]||''}" data-v="${t[0]}" aria-pressed="${S.tags.has(t[0])}">${HINT[t[0]]?HINT[t[0]][0]:t[1]} <small>${N(t[0]).toLocaleString()}</small></button>`).join('')}</div><div class="tdesc" id="tdesc" aria-live="polite"></div><div class="pf"><button class="lnk" id="pReset">초기화</button><button class="btn primary sm" id="pDone">적용</button></div>`;
    const show=v=>{ const h=HINT[v]; $('tdesc').innerHTML=h?`<b>${h[0]}</b> ${h[1]}<small>${h[2]}</small>`:''; };
    pop.querySelectorAll('.tagb .chip').forEach(b=>b.onclick=()=>{ const v=b.dataset.v; S.tags.has(v)?S.tags.delete(v):S.tags.add(v); b.setAttribute('aria-pressed',String(S.tags.has(v))); show(v); refresh(); });
    $('pReset').onclick=()=>{ S.tags.clear(); pop.querySelectorAll('.tagb .chip').forEach(b=>b.setAttribute('aria-pressed','false')); $('tdesc').innerHTML=''; refresh(); };
  } else if (k==='grade'){
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
  b.hidden=false; b.innerHTML=`내 조건 적용 중 · ${S.mine.prod==='gap'?'갭투자 현금 '+eok(S.mine.cash):'예산 '+eok(S.mine.maxP/10000)}${S.mine.hub!=null?' · '+M.hubN[S.mine.hub]:''}${childStage(S.mine)?' · 자녀 '+({pre:'미취학',elem:'초등',mid:'중등',high:'고등'})[childStage(S.mine)]+(S.mine.csex||''):''} · ${visible().length}개 <button id="bEdit">수정</button><button id="bOff">해제</button>`;
  $('bEdit').onclick=openMine; $('bOff').onclick=()=>{S.mine=null; applyMine(); S.sort='score'; refresh();};
}

/* ═════════ 내 조건으로 찾기: 예산 + 영역 가중치(개인 점수는 도시 등급을 바꾸지 않음) ═════════ */
const MW = AREAS.map(a=>[a, AN[a], Math.round(M.areaW[a]*100)]);
// v1.4.0 대출 상품 규칙표(기준 ’26.10 · 2차 자료 정리값 — 신청 전 기금e든든(nhuf.molit.go.kr)·한국주택금융공사(hf.go.kr)에서 확인). 단위 만원
const LOAN = {
  asof:'’26.10',
  bank:{n:'시중은행 주담대', ltv:0.70, ltvFirst:0.80, cap:null, priceMax:null, inc:null, rate:4.0, dsr:0.40, desc:'비규제지역(광주) LTV 70% · 생애최초 80% · DSR 40%(연소득 입력 시)'},
  didim:{n:'디딤돌(주택도시기금)', ltv:0.70, ltvFirst:0.80, cap:25000, capFirst:30000, capNew:40000, capBaby:50000, priceMax:50000, priceMaxNew:60000, inc:6000, incFirst:7000, incNew:8500, incBaby:13000, rate:3.0, dti:0.60, desc:'한도 2.5억(생애최초 3억 · 신혼 4억 · 신생아 5억) · 집값 5억 이하(신혼·신생아 6억) · 부부합산 소득 6천(생애최초 7천 · 신혼 8.5천 · 신생아 1.3억) · 만 30세 미만 미혼 단독세대주 불가'},
  bogeum:{n:'보금자리론', ltv:0.70, ltvFirst:0.80, cap:36000, capFirst:42000, priceMax:60000, inc:7000, incNew:8500, incChild:9000, rate:4.0, dti:0.60, desc:'한도 3.6억(생애최초 4.2억) · 집값 6억 이하 · 부부합산 소득 7천(신혼 8.5천 · 자녀 1명 9천) · DTI 60%'},
  gap:{n:'갭투자(전세 끼고)', desc:'매매 중위가 − 전세 중위가(최근 1년, 대표 평형)가 보유 현금(세금·중개보수 뺀 뒤) 안인 단지만. 실거주 아님'},
  manual:{n:'직접 입력', desc:'대출 가능액을 직접 넣습니다(은행 상담 결과 등)'}};
const pmt30=(P,rate)=>{ const r=rate/100/12, n=360; return P*r/(1-Math.pow(1+r,-n))*12; };   // 30년 원리금균등 연 상환액
function loanCap(m, P){   // 상품 규칙으로 집값 P(원)일 때 빌릴 수 있는 최대액(원). 메시지도 돌려줌
  const L=LOAN[m.prod]; if (!L) return {cap:0, msg:[]}; const msg=[];
  if (m.prod==='manual') return {cap:m.loan*10000, msg};
  if (m.prod==='gap') return {cap:0, msg};
  const baby = m.child && m.cby && (new Date().getFullYear()-m.cby)<=2, newly = m.marry==='new';
  let ltv = (m.first?L.ltvFirst:L.ltv), cap = Infinity, ok=true;
  if (L.priceMax){ const pm=(newly||baby)&&L.priceMaxNew?L.priceMaxNew:L.priceMax; if (P>pm*10000){ ok=false; msg.push(`집값 ${eok(pm)} 초과 → ${L.n} 불가`); } }
  if (L.cap){ cap = (baby&&L.capBaby?L.capBaby:newly&&L.capNew?L.capNew:m.first&&L.capFirst?L.capFirst:L.cap)*10000; }
  if (L.inc && m.inc){ const lim=baby&&L.incBaby?L.incBaby:newly&&L.incNew?L.incNew:(m.child&&L.incChild)?L.incChild:(m.first&&L.incFirst)?L.incFirst:L.inc; if (m.inc>lim){ ok=false; msg.push(`연소득 ${eok(lim)} 초과 → ${L.n} 소득 요건 밖`); } }
  if (m.prod==='didim' && m.marry==='single' && m.age && m.age<30){ ok=false; msg.push('만 30세 미만 미혼 단독세대주는 디딤돌 불가'); }
  if (!ok) return {cap:0, msg};
  let c = Math.min(cap, ltv*P);
  if (m.inc){ const r=L.dsr?L.dsr:L.dti, annual=m.inc*10000*r, byInc=annual>0?(annual/pmt30(1,L.rate)):0; if (byInc<c){ c=byInc; msg.push(`${L.dsr?'DSR 40%':'DTI 60%'} 기준(30년·연 ${L.rate}% 가정) 상환 여력으로 ${eok(c/10000)}까지`); } }
  return {cap:c, msg};
}
function maxPriceProd(m){   // cash + loanCap(P) ≥ P + 비용(P) 를 만족하는 최대 P
  const cash=m.cash*10000, big=m.size==='L'; let lo=0, hi=cash*6+1e9, last={cap:0,msg:[]};
  for (let i=0;i<70;i++){ const mid=(lo+hi)/2, lc=loanCap(m,mid); if (cash+lc.cap >= mid+costs(mid,big,m.first).sum){ lo=mid; last=lc; } else hi=mid; }
  return {P:lo, loan:last.cap, msg:loanCap(m,lo).msg};
}
const PRESET = { none:{S:15,L:35,J:15,T:5,D:5,C:20,Q:5}, pre:{S:40,L:25,J:5,T:5,D:5,C:15,Q:5}, elem:{S:40,L:25,J:5,T:5,D:5,C:15,Q:5}, mid:{S:40,L:20,J:5,T:5,D:5,C:20,Q:5}, high:{S:35,L:20,J:10,T:5,D:5,C:20,Q:5} };
function openMine(){
  const d = Object.assign({cash:20000, loan:30000, inc:0, age:35, marry:'single', child:false, cby:2018, csex:'', prod:'bank', hub:null, size:'M', first:false, w:Object.fromEntries(MW.map(m=>[m[0],m[2]]))}, S.mineDraft||{});
  const ov=$('ovMine'); ov.hidden=false;
  const seg=(id,opts,cur)=>`<div class="seg" id="${id}">${opts.map(([k,l])=>`<button type="button" data-v="${k}" aria-pressed="${String(cur)===String(k)}">${l}</button>`).join('')}</div>`;
  ov.innerHTML = `<div class="drawer" role="dialog" aria-modal="true" aria-labelledby="mineT">
    <div class="dh"><h2 id="mineT">내 조건으로 찾기</h2><button class="back" id="mClose" aria-label="닫기">✕</button></div>
    <div class="db mine">
      <p class="note" style="margin:0 0 6px">입력한 내용은 이 기기 안에만 저장되고 어디로도 보내지 않습니다.</p>
      <h3>1. 나와 가족</h3>
      <div class="grid2">
        <div class="field"><label for="mAge">내 나이(만)</label><div class="money"><input id="mAge" inputmode="numeric" value="${d.age}"><span>세</span></div></div>
        <div class="field"><label>혼인</label>${seg('mMarry',[['single','미혼'],['new','결혼 7년 이내'],['married','결혼']],d.marry)}</div>
      </div>
      <div class="field"><label>자녀</label>${seg('mChild',[['0','없음'],['1','있음']],d.child?1:0)}</div>
      <div class="grid2" id="mChildBox" ${d.child?'':'hidden'}>
        <div class="field"><label for="mCby">자녀 출생연도</label><div class="money"><input id="mCby" inputmode="numeric" value="${d.cby}"><span>년</span></div></div>
        <div class="field"><label>자녀 성별</label>${seg('mSex',[['여','여'],['남','남'],['','모름']],d.csex)}</div>
      </div>
      <p class="note" id="mChildNote"></p>
      <h3>2. 돈</h3>
      <div class="grid2">
        <div class="field"><label for="mCash">보유 현금</label><div class="money"><input id="mCash" inputmode="numeric" value="${d.cash}"><span>만원</span></div></div>
        <div class="field"><label for="mInc">연소득(부부합산, 선택)</label><div class="money"><input id="mInc" inputmode="numeric" value="${d.inc||''}" placeholder="모르면 비움"><span>만원</span></div></div>
      </div>
      <div class="field"><label>대출 상품</label>${seg('mProd',Object.entries(LOAN).filter(([k])=>k!=='asof').map(([k,v])=>[k,v.n]),d.prod)}</div>
      <p class="note" id="mProdDesc"></p>
      <div class="field" id="mLoanBox" ${d.prod==='manual'?'':'hidden'}><label for="mLoan">대출 가능액</label><div class="money"><input id="mLoan" inputmode="numeric" value="${d.loan}"><span>만원</span></div></div>
      <div class="field"><label>찾는 면적</label>${seg('mSize',[['S','60㎡ 이하'],['M','60~85㎡'],['L','85㎡ 초과'],['all','상관없음']],d.size)}</div>
      <label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" id="mFirst" ${d.first?'checked':''}> 생애최초 주택 구입(취득세 감면 · LTV 80% · 대출 한도 우대)</label>
      <div class="card" id="mBudget"></div>
      <h3>3. 직장</h3>
      <div class="field"><label>주로 출근하는 업무지구</label>${seg('mHub',[['','상관없음(기본: 모든 업무지구 가중)']].concat((M.hubN||[]).map((n,i)=>[i,n])),d.hub==null?'':d.hub)}</div>
      <h3>4. 내가 중요하게 보는 것 <span class="sm">(합계 100)</span></h3>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px"><button class="btn" id="wAuto" style="height:32px">내 상황에 맞는 추천 비중</button><button class="btn" id="mReset" style="height:32px">기본 비중</button></div>
      ${MW.map(([k,l])=>`<div class="slider"><label for="w_${k}">${l}</label><input type="range" id="w_${k}" min="0" max="60" step="5" value="${d.w[k]??0}"><output class="num" id="o_${k}">${d.w[k]??0}</output></div>`).join('')}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px"><span>합계 <span class="sum" id="wSum"></span></span><button class="btn" id="wFit" style="height:32px">합계 100으로 맞추기</button></div>
      <p class="note">내 조건으로 다시 매긴 점수·등급은 개인 참고용입니다. 도시 공통 등급(기본 비중)은 바뀌지 않습니다. 직장을 고르면 직주근접은 그 업무지구까지 자가용 시간으로, 자녀 성별을 고르면 중학교는 여중·남중을 가려서, 자녀 학년에 맞지 않는 항목(예: 중학생이면 초등 통학)은 빼고 계산합니다.</p>
    </div>
    <div class="df"><button class="btn" id="mOff" ${S.mine?'':'hidden'}>해제</button><button class="btn primary" id="mApply">지도에 표시</button></div>
  </div>`;
  const st={marry:d.marry, child:!!d.child, csex:d.csex, prod:d.prod, hub:d.hub, size:d.size};
  const num=id=>+(($(id).value||'').toString().replace(/[^\d]/g,''))||0;
  const read=()=>({cash:num('mCash'), inc:num('mInc'), age:num('mAge'), marry:st.marry, child:st.child, cby:num('mCby'), csex:st.csex, prod:st.prod, hub:st.hub===''||st.hub==null?null:+st.hub, loan:num('mLoan'), size:st.size, first:$('mFirst').checked, w:Object.fromEntries(MW.map(([k])=>[k,+$('w_'+k).value]))});
  const upd=()=>{
    const m=read(); const L=LOAN[m.prod]; $('mProdDesc').textContent=L.desc+(m.prod==='gap'||m.prod==='manual'?'':` · 기준 ${LOAN.asof}, 신청 전 공식 확인`); $('mLoanBox').hidden=m.prod!=='manual'; $('mChildBox').hidden=!m.child;
    const stg=childStage(m); $('mChildNote').textContent = m.child ? (stg?`자녀 ${new Date().getFullYear()-m.cby}세 → ${({pre:'미취학: 영유아·초등 통학까지 모두 봅니다',elem:'초등학생: 초등 통학·중학교·학원가를 봅니다',mid:'중학생: 초등 항목은 빼고 중학교·학원가·고등학교를 봅니다',high:'고등학생: 학원가·고등학교만 봅니다'})[stg]}${m.csex?` · ${m.csex}학생 기준으로 중·고등학교를 고릅니다`:' · 성별을 고르면 여중·남중을 가립니다'}`:'자녀가 성인이면 자녀 없음과 같이 계산합니다') : '';
    const big=m.size==='L';
    if (m.prod==='gap'){ const cs=costs(0,big,m.first); $('mBudget').innerHTML=`<dl class="kv"><dt>보유 현금</dt><dd><b>${eok(m.cash)}</b></dd><dt>조건</dt><dd>매매 중위가 − 전세 중위가 + 취득세·중개보수 ≤ 보유 현금</dd></dl><p class="note">단지별 전세가율 자료(최근 1년 대표 평형, 전세·매매 각 3건 이상)가 있는 단지만 걸러집니다. 전세 끼고 사는 집은 실거주가 아니며, 전세 만기·역전세 위험은 반영하지 않습니다.</p>`; m.maxP=1e13; }
    else { const r=maxPriceProd(m), P=r.P, cs=costs(P,big,m.first); m.maxP=P; m.loanCalc=Math.round(r.loan/10000);
      $('mBudget').innerHTML = `<dl class="kv"><dt>보유 현금</dt><dd>${eok(m.cash)}</dd><dt>${L.n} 대출(계산)</dt><dd>${eok(m.loanCalc)}</dd><dt>살 수 있는 집값(최대)</dt><dd><b>${eok(P/10000)}</b></dd>
      <dt>취득세 ${(cs.r*100).toFixed(2)}%${m.first&&P<=12e8?' (감면 반영)':''}</dt><dd>${fmtMan(cs.acq/10000)}</dd><dt>지방교육세</dt><dd>${fmtMan(cs.edu/10000)}</dd>${big?`<dt>농어촌특별세</dt><dd>${fmtMan(cs.farm/10000)}</dd>`:''}<dt>중개보수(상한)</dt><dd>${fmtMan(cs.fee/10000)}</dd></dl>
      ${r.msg.length?`<p class="note" style="color:var(--warn-ink)">${r.msg.join(' · ')}</p>`:''}
      <p class="note">1주택 유상취득 가정(지방세법 제11조①8). 대출은 LTV·상품 한도·${L.dsr?'DSR':'DTI'}(연소득 입력 시) 중 작은 값. 금리·만기는 가정값이고 실제 한도는 은행 심사로 정해집니다. 기준일 ${LOAN.asof}.</p>`; }
    let sum=0; MW.forEach(([k])=>{ const v=+$('w_'+k).value; $('o_'+k).textContent=v; sum+=v; });
    $('wSum').textContent=sum; $('wSum').classList.toggle('bad',sum!==100);
    return m;
  };
  const bindSeg=(id,fn)=>$(id).querySelectorAll('button').forEach(b=>b.onclick=()=>{ $(id).querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b))); fn(b.dataset.v); upd(); });
  bindSeg('mMarry',v=>st.marry=v); bindSeg('mChild',v=>st.child=v==='1'); bindSeg('mSex',v=>st.csex=v); bindSeg('mProd',v=>st.prod=v); bindSeg('mHub',v=>st.hub=v); bindSeg('mSize',v=>st.size=v);
  ov.querySelectorAll('input').forEach(i=>i.addEventListener('input',upd));
  const setW=w=>{ MW.forEach(([k])=>{ $('w_'+k).value=w[k]??0; }); upd(); };
  $('wAuto').onclick=()=>{ const m=read(); const stg=childStage(m)||'none'; const w=Object.assign({},PRESET[stg]); if (m.hub!=null) { w.J=Math.min(60,w.J+10); w.L=Math.max(0,w.L-10); } setW(w); };
  $('wFit').onclick=()=>{ let sum=0; MW.forEach(([k])=>sum+=+$('w_'+k).value); if(!sum) return; let acc=0; MW.forEach(([k],i)=>{ let v=i<MW.length-1?Math.round(+$('w_'+k).value/sum*100):100-acc; acc+=v; $('w_'+k).value=v; }); upd(); };
  $('mReset').onclick=()=>{ setW(Object.fromEntries(MW.map(([k,,v])=>[k,v]))); };
  $('mClose').onclick=()=>{ov.hidden=true;}; ov.onclick=e=>{ if(e.target===ov) ov.hidden=true; };
  if ($('mOff')) $('mOff').onclick=()=>{ S.mine=null; applyMine(); S.sort='score'; ov.hidden=true; refresh(); };
  $('mApply').onclick=()=>{ const m=upd(); S.mine=m; S.mineDraft=m; try{localStorage.setItem('dn10-mine',JSON.stringify(m));}catch(e){} applyMine(); S.sort='score'; S.view='list'; S.sel=null; ov.hidden=true; refresh(); sheetTo('half'); };
  upd();
}
$('btnMine').onclick=openMine;   // v1.3.0 광주 최종판: 내 조건으로 찾기 공개(보유 자금·대출 → 살 수 있는 집값, 찾는 면적, 내 가중치로 다시 매긴 순위)   // (v1.7~v1.2.8: 준비중 알림)

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
function validStats(){   // v1.3.0: 등급 ↔ 실거래가 검증(화면에서 자료로 계산)
  const minN=5, mk=CX.filter(c=>!c.rent&&c.grade&&c.p&&c.p.med&&(((c.p.q24||{}).n)||0)>=minN);
  if (mk.length<50) return null;
  const rank=a=>{const idx=a.map((v,i)=>[v,i]).sort((x,y)=>x[0]-y[0]); const r=new Array(a.length); let i=0; while(i<idx.length){let j=i; while(j+1<idx.length&&idx[j+1][0]===idx[i][0]) j++; const m=(i+j)/2+1; for(let k=i;k<=j;k++) r[idx[k][1]]=m; i=j+1;} return r;};
  const sp=(x,y)=>{const rx=rank(x),ry=rank(y),n=x.length,mx=rx.reduce((a,b)=>a+b,0)/n,my=ry.reduce((a,b)=>a+b,0)/n; let sxy=0,sxx=0,syy=0; for(let i=0;i<n;i++){sxy+=(rx[i]-mx)*(ry[i]-my);sxx+=(rx[i]-mx)**2;syy+=(ry[i]-my)**2;} return sxy/Math.sqrt(sxx*syy);};
  const med=a=>{const b=[...a].sort((x,y)=>x-y),n=b.length; return n?(n%2?b[(n-1)/2]:(b[n/2-1]+b[n/2])/2):null;};
  const g=mk.map(c=>c.grade), pr=mk.map(c=>c.p.med);
  const px=mk.filter(c=>c.pxp!=null);
  const rows=[1,2,3,4,5,6,7,8,9].map(k=>{const s=mk.filter(c=>c.grade===k), q=s.filter(c=>c.pxp!=null); return {g:k,n:s.length,med:Math.round(med(s.map(c=>c.p.med))||0),px:q.length?med(q.map(c=>c.pxp)):null};}).filter(r=>r.n>0);
  let monoN=0; for(let i=1;i<rows.length;i++) if(rows[i].med<=rows[i-1].med) monoN++;
  return {n:mk.length,minN,sp:-sp(g,pr),spx:px.length?sp(px.map(c=>c.grade),px.map(c=>c.pxp)):0,rows,monoN,mono:monoN===rows.length-1};
}
function openMethod(){
  const ov=$('ovMethod'); ov.hidden=false;
  const itemsT = AREAS.map(a=>Object.keys(IN[a]).map((k,i)=>`<tr>${i===0?`<td rowspan="${Object.keys(IN[a]).length}"><b>${AN[a]}</b><br><span class="ver">${Math.round(M.areaW[a]*100)}%</span>${(M.basis&&M.basis.area[a])?`<br><span class="sm">${M.basis.area[a]}</span>`:''}</td>`:''}<td>${NAMES[k]}<br><span class="ver">${(()=>{const t=Object.values(IN[a]).reduce((x,y)=>x+y,0); return t>1?IN[a][k]+'점':'100점';})()}</span></td><td class="n">${(M.itemW[k]*100).toFixed(1)}%</td><td>${RULE[k]}${(M.basis&&M.basis.item[k])?`<br><span class="sm">배점 근거: ${M.basis.item[k]}</span>`:''}</td></tr>`).join('')).join('');
  const sens = M.sens.map(s=>`<tr><td>${AN[s.area]} ${s.f<1?'−20%':'+20%'}</td><td class="n">${s.changed}곳 (${s.changedPct}%)</td><td class="n">${s.top1Keep}/${s.top1N}</td></tr>`).join('');
  const AD={L:'프랜차이즈·편의시설·병원·마트·동네마트·공원·도서관',S:'초등 통학·중학교·학원가·고등학교(낮은 비중)',J:'주요 업무지구 출퇴근(자가용)',T:'KTX(광주송정역)·공항·유스퀘어',D:'반경 2km 새 아파트 입주 물량',C:'연식·세대수·시공사·주차·커뮤니티',Q:'최근 2년 월 거래율'};
  const GRP={L:'loc',S:'loc',J:'loc',T:'loc',D:'loc',C:'prd',Q:'liq'}, GN={loc:'입지',prd:'단지 상품성',liq:'환금성'}, AC=a=>`var(--a${a})`, AK={T:1,J:1,D:1};   // v1.1.3 연구원: 영역마다 다른 색(색약 검증 팔레트)
  const ord=[...AREAS].filter(a=>M.areaW[a]!=null)   /* v1.1.7 비중 높은 순 */, pc=a=>Math.round(M.areaW[a]*100);
  const gsum=g=>ord.filter(a=>GRP[a]===g).reduce((x,a)=>x+pc(a),0);
  const wbar=`<div class="wbar" role="img" aria-label="영역 비중">${ord.map((a,i)=>`<i style="width:${pc(a)}%;background:${AC(a)}${AK[a]?';color:#17201c':''}"><b>${({L:'생활',S:'교육',J:'직주',T:'광역',D:'공급',C:'상품성',Q:'환금성'})[a]}</b><small>${pc(a)}</small></i>`).join('')}</div>
    <div class="wleg">${['loc','prd','liq'].map(g=>`<span>${GN[g]} ${gsum(g)}%</span>`).join('<span>·</span>')}</div>`;
  const wtab=`<table class="calc wt"><thead><tr><th>영역</th><th>비중</th><th>무엇을 보나</th></tr></thead><tbody>${ord.map(a=>`<tr><td><i class="wsw" style="background:${AC(a)}"></i><b>${AN[a]}</b></td><td class="n">${pc(a)}%</td><td>${AD[a]}</td></tr>`).join('')}</tbody></table>`;
  // v1.3.0 연구원: 평가기준을 '한눈에' 구조로 재편 — 요약 → 검증 결과 → 점수 → 등급 → 감점 → 세부 → 자주 묻는 질문 → 근거·계산식
  const cond=[['점수 등급','단지 점수 순으로 줄 세워 수능 비율(4·7·12·17·20·17·12·7·4%)로 1~9등급','출발 등급'],
    ['시장 검증(1~4등급)','시장이 매긴 <b>자리값</b> 등급과 자기 <b>㎡당 실거래가</b> 등급, 둘 다보다 한 단계까지만 위(1등급 상위 11% · 2등급 23% · 3등급 40% · 4등급 60% 안)','못 미치면 그 아래 등급'],
    ['1등급 추가 조건','자리값·실거래가 모두 광주 상위 '+(M.p1pct||11)+'% 안(신축·대단지 프리미엄은 인정)','둘 다 만족해야 1등급'],
    ['시장 보정(올림)','자리값·실거래가 등급이 모두 점수 등급보다 높고 최근 2년 매매 10건 이상','점수 등급보다 한 단계 위'],
    ['신축·시세 하한(올림)','준공 10년 이내 · 400세대 이상 · 2년 매매 10건 이상 · 실거래가 상위 23% / 40% 안','최소 3등급 / 4등급'],
    ['100세대 미만','소단지','최고 3등급(2년 매매 10건 + 실거래가 상위 7%면 2등급)'],
    ['전 세대 59㎡ 미만','소형·원룸형 단지','최고 4등급'],
    ['실거래 없음','최근 2년 매매 0건(시세 확인 불가)','최고 3등급'],
    ['미분양','준공 때·지금 미분양 비율 10% 미만 / 10~20 / 20~30 / 30% 이상','최고 2 / 3 / 4 / 5등급'],
    ['임대 단지','매매할 수 없음','거래활발도 0점, 최고 4등급'],
    ['빈자리','조건으로 내려간 단지의 자리','아래 단지로 채우지 않음']];
  const ctab=`<table class="calc"><thead><tr><th>조건</th><th>기준</th><th>결과</th></tr></thead><tbody>${cond.map(r=>`<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table>`;
  const pen=[['복도 유형','복도식 · 혼합식','2 · 1'],['나홀로아파트','동 1개 단지(세대수는 상품성에서 이미 반영)','1~2(2 × (1 − 세대÷600))'],['용적률','250% 초과부터 100%p마다(주상복합은 면제)','0.5~3'],['평형 구성','전 세대 84㎡ 미만 · 59㎡ 미만','1 · 2'],['소음','큰 도로 200m · 지상 철도 100m · 공항 3km 안','최대 2'],['악취','산업단지 · 축사 · 퇴비 사업장','최대 2'],['청소년 유해업소','단지 경계 200m 안 유흥·숙박·노래방·PC방 등','최대 3'],['기피시설','하수·소각·매립·화장·교정시설','최대 2'],['노후 빌라·원룸촌','단지 둘레의 노후 다세대·다가구 비율','최대 2'],['주상복합','상가 위 주거(용적률 감점 대신)','1']];
  const ptab=`<table class="calc"><thead><tr><th>항목</th><th>기준</th><th>감점</th></tr></thead><tbody>${pen.map(r=>`<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td class="n">${r[2]}</td></tr>`).join('')}</tbody></table>`;
  const itemsT2 = ord.map(a=>`<details class="mi"><summary><b>${AN[a]}</b> <span class="ver">${pc(a)}%</span> <span class="sm">${AD[a]}</span></summary><table class="calc"><tbody>${Object.keys(IN[a]).map(k=>`<tr><td><b>${(a==='S'&&SNAME[k])?(({S6:'영유아',S1t:'초등',S1c:'초등',S2:'초등',S3:'중학교',S4:'중학교',S5a:'학원',S5b:'학원'})[k]+' · '+SNAME[k]):NAMES[k]}</b></td><td class="n">${(M.itemW[k]*100).toFixed(1)}%</td><td>${RULE[k]}${(M.basis&&M.basis.item[k])?`<br><span class="sm">근거: ${M.basis.item[k]}</span>`:''}</td></tr>`).join('')}</tbody></table>${(M.basis&&M.basis.area[a])?`<p class="sm">영역 근거: ${M.basis.area[a]}</p>`:''}</details>`).join('');
  const basisL = M.basis?`<ul class="sm">${Object.entries({grade:'등급 비율',price:'실거래가 조건',unsold:'미분양',small:'소단지',unit:'전 세대 59㎡ 미만',old:'구축',walk:'도보 시간',harm:'청소년 유해업소',far:'용적률',noise:'소음',nimby:'기피시설',villa:'노후 빌라·원룸촌',rent:'임대 단지',weight:'영역 비중',penalty:'보정 합계'}).filter(([k])=>M.basis.rule[k]).map(([k,n])=>`<li><b>${n}</b>: ${M.basis.rule[k]}</li>`).join('')}</ul>`:'';
  // 검증: 등급과 실제 시장(국토부 실거래)의 관계 — 화면에서 자료로 바로 계산(사람이 적어 넣는 값 없음)
  const V=validStats();
  const vtab=V?`<table class="calc vt"><thead><tr><th>등급</th><th class="n">단지</th><th class="n">㎡당 실거래가<br><span class="sm">중앙값</span></th><th class="n">84㎡ 환산</th><th class="n">시장 자리값<br><span class="sm">중앙값(상위 %)</span></th></tr></thead><tbody>${V.rows.map(r=>`<tr><td><b class="gchip" style="background:${gCol(r.g)};color:${gInk(r.g)}">${r.g}</b></td><td class="n">${r.n}</td><td class="n">${r.med.toLocaleString()}만원</td><td class="n">${(r.med*84/10000).toFixed(1)}억</td><td class="n">${r.px==null?'-':(r.px<1?'1% 이내':Math.round(r.px)+'%')}</td></tr>`).join('')}</tbody></table>`:'';
  const vsec=V?`<section><h3>② 얼마나 맞나 — 실거래가로 확인</h3>
    <div class="stat3"><div><b>${V.sp.toFixed(2)}</b><span>등급 ↔ ㎡당 실거래가<br>순위 상관(1에 가까울수록 일치)</span></div><div><b>${V.spx.toFixed(2)}</b><span>등급 ↔ 시장 자리값<br>순위 상관</span></div><div><b>${V.monoN}/${V.rows.length-1}</b><span>등급이 한 단계 내려갈 때<br>가격 중앙값도 내려간 구간</span></div></div>
    ${vtab}
    <p class="sm">최근 2년 매매 ${V.minN}건 이상인 분양 단지 ${V.n.toLocaleString()}곳(임대 제외) · 국토교통부 실거래(해제 제외) · 자료 ${M.evalDate} 기준. 등급은 가격 순위가 아니라 <b>입지 점수에 시장 검증을 더한 것</b>이라 같은 등급 안에도 가격 차이가 있습니다. 더 자세한 회귀분석은 블로그 글에 있습니다.</p></section>`:'';
  const faq=[['등급은 집값 순위인가요?','아닙니다. 입지 점수(교육·생활·교통 등)로 먼저 줄을 세우고, 실거래가로 검증만 합니다. 비싼 신축이 꼭 1등급은 아니고, 싼 구축이 꼭 낮은 등급도 아닙니다. "같은 값이면 어디가 입지가 더 좋은가"를 보는 도구입니다.'],
    ['5등급이면 나쁜 집인가요?','아닙니다. 광주 전체를 수능처럼 상대평가로 나눈 것이라 5등급은 "광주 한가운데"라는 뜻입니다. 1~3등급(상위 23%)이면 교육·생활·교통이 고루 갖춰진 편입니다.'],
    ['동네 등급인가요, 단지 등급인가요?','단지 등급입니다. 같은 동네라도 30년 넘은 구축, 100세대 미만 소단지, 원룸형 단지는 등급이 낮게 나옵니다. 지도를 넓게 보면 동네 평균, 확대하면 단지별 등급이 나옵니다.'],
    ['왜 이 단지가 이 등급인가요?','단지를 누르면 "점수로는 2등급이지만 실거래가가 상위 38%라 3등급입니다"처럼 이유가 한 줄로 나옵니다. 등급이 이상하다 싶으면 그 문장을 먼저 봐 주세요.'],
    ['신축인데 왜 등급이 낮나요?','신축 프리미엄은 단지 상품성(20%)과 시장 검증에서 인정합니다. 그래도 낮다면 학원가·초등 통학·생활 편의 같은 입지 점수가 낮은 경우입니다. 준공 10년 이내·400세대 이상이고 실거래가가 상위 40% 안이면 최소 4등급은 보장합니다.'],
    ['제 기준은 다른데요?','기본 등급은 교육 35%를 가장 크게 보는 연구원 기준입니다. 아이가 없거나 직장이 더 중요하면 <b>내 조건으로 찾기</b>에서 비중을 바꿔 보세요. 내 기준으로 다시 매긴 등급이 지도에 나옵니다.'],
    ['앞으로 오를 집을 알려 주나요?','아닙니다. 지금까지의 공개 자료로 지금의 입지를 평가한 것입니다. 투자 추천이나 가격 전망이 아니며, 최종 판단은 임장과 본인 상황으로 하셔야 합니다.']];
  const faqH=faq.map(q=>`<details class="mi faq"><summary><b>${q[0]}</b></summary><p>${q[1]}</p></details>`).join('');
  ov.innerHTML=`<div class="drawer wide" role="dialog" aria-modal="true" aria-labelledby="mtT"><div class="dh"><h2 id="mtT">평가기준</h2><button class="back" id="tClose" aria-label="닫기">✕</button></div><div class="db mth">
    <section class="sum"><p class="lead">광주 아파트 <b>${CX.length.toLocaleString()}곳</b>(임대 ${CX.filter(c=>c.rent).length}곳 포함)을 같은 자로 재서 <b>1~9등급</b>으로 나눕니다.</p>
      <div class="chips"><span style="--c:var(--aS)">입지 ${gsum('loc')}%</span><span style="--c:var(--aC)">단지 상품성 ${gsum('prd')}%</span><span style="--c:var(--aQ)">환금성 ${gsum('liq')}%</span></div>
      <ol class="flow"><li><b>점수 매기기</b><span>교육·생활·교통·단지 조건을 공개 자료로 0~10점</span></li><li><b>줄 세워 9등급</b><span>수능 비율로 상대평가(1등급 = 상위 4%)</span></li><li><b>실거래가로 검증</b><span>시장이 매긴 값보다 한 단계까지만 위. 확실히 높으면 올림</span></li></ol>
      <p class="sm">사람이 손으로 정하는 점수는 없습니다. 모든 단지에 같은 규칙과 같은 자료를 씁니다.</p></section>
    <section><h3>① 점수는 이렇게 만듭니다</h3>${wbar}<p class="fx"><b>단지 점수</b> = Σ(영역 점수 × 비중) − 보정 감점</p>${wtab}<p class="sm">입지 ${gsum('loc')} : 상품성 ${gsum('prd')} : 환금성 ${gsum('liq')}은 '오래 남는 땅을 가장 크게 본다'는 평가 원칙입니다(가격 구성비가 아닙니다). 비중의 근거는 ⑥에 있습니다.</p></section>
    ${vsec}
    <section><h3>③ 등급은 이렇게 정합니다</h3>${gradeBar()}<p class="sm"><b>자리값</b>이란 ㎡당 실거래가에서 연식·세대수·주차 같은 건물 몫을 뺀, 시장이 그 자리에 매기는 값입니다. 점수가 높아도 시장이 인정하지 않으면 등급이 내려가고, 시장이 확실히 높게 쳐주면 한 단계 올라갑니다.</p>${ctab}</section>
    <section><h3>④ 보정 감점</h3><p class="sm">시장에서 할인되는 단지 특성입니다. 항목마다 상한이 있고 합계에는 상한이 없습니다. 단지 점수 100점 기준입니다.</p>${ptab}</section>
    <section><h3>⑤ 영역별 세부 항목</h3><p class="sm">영역을 누르면 항목별 비중·점수 기준·근거가 펼쳐집니다.</p>${itemsT2}</section>
    <section><h3>자주 묻는 질문</h3>${faqH}</section>
    <section><details class="mi"><summary><b>⑥ 기준의 근거</b> <span class="sm">[공식] 법령·공식 통계 · [연구] 논문 · [자료] 광주 자료 분석 · [판단] 근거를 찾지 못해 정한 값</span></summary>${basisL}</details>
      <details class="mi"><summary><b>⑦ 계산식 · 결측 처리 · 자료 출처</b></summary><p class="sm"><b>계산식</b> ${M.formula}</p><p class="sm"><b>보정</b> ${M.mRule}</p><p class="sm"><b>등급 조건</b> ${M.capRule}</p><p class="sm"><b>결측</b> ${M.missRule}</p><p class="sm"><b>점수 밖 참고 정보</b> 실거래가, 고평가·저평가, 전세가율, 도시철도 2호선 예정역은 점수에 넣지 않습니다.</p><p class="sm"><b>측정 방식과 한계</b></p><ul class="sm">${M.caveats.map(x=>`<li>${x}</li>`).join('')}</ul><p class="sm"><b>쓰지 않는 자료</b></p><ul class="sm">${M.notUsed.map(x=>`<li>${x}</li>`).join('')}</ul><p class="sm"><b>자료 출처</b></p><ul class="sm">${M.sources.map(x=>`<li>${x}</li>`).join('')}</ul></details></section>
    <section class="warn"><h3>주의사항</h3><ul>
      <li><b>이 서비스는 방구석 연구원이 AI와 함께 만든 광주 아파트 입지분석 최종판(v1.4.0)입니다.</b> 계산식은 확정했고, 자료 오류는 계속 바로잡습니다.</li>
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
const BJ = d3.groups(CX.filter(c=>c.lat&&c.lon),c=>c.gu+'|'+c.dong).map(([k,cs])=>({t:k.split('|')[1].replace(/\(.*\)$/,''), lat:d3.mean(cs,c=>c.lat), lon:d3.mean(cs,c=>c.lon), n:cs.length}));   // v1.2.5 법정동 이름 위치(단지 평균)
function nvMarkers(){
  if (!NV) return;
  const vis=VIS||new Set(visible().map(c=>c.id)), z=NV.getZoom(), dongMode = z<=NDZ, lv = z<=NGZ?'gu':'dong';
  NVD.forEach(m=>m.setMap(null));
  if (dongMode){
    if (NVL) NVL.el.innerHTML='';
    const prj0=NV.getProjection(), bx=[], hit0=q=>bx.some(o=>q[0]<o[2]&&q[2]>o[0]&&q[1]<o[3]&&q[3]>o[1]);   // v1.2.2 이름표가 겹치면 큰 동네 먼저
    dongAgg(lv).sort((a,b)=>b.n-a.n).forEach(d=>{ const p=prj0.fromCoordToOffset(new naver.maps.LatLng(d.lat,d.lon)), w=Math.max(d.k.length*12,aggLab(d).length*6.2)+20;
      // v1.2.6 연구원(치평동 알약이 안 보임): 겹치면 숨기기 전에 위·아래·옆으로 비켜 봄
      let q=null, off=[0,0]; for (const [ox,oy] of (lv==='gu'?[[0,0]]:[[0,0],[0,-40],[0,40],[-w*.7,0],[w*.7,0],[0,-80],[0,80]])){ const t=[p.x-w/2+ox,p.y-19+oy,p.x+w/2+ox,p.y+19+oy]; if(!hit0(t)){ q=t; off=[ox,oy]; break; } }
      if (!q && lv==='gu') q=[p.x-w/2,p.y-19,p.x+w/2,p.y+19];   // v1.2.9 연구원(첫 화면에 동구 없음): 구 알약 5개는 겹쳐도 모두 표시(v1.2.6에서 숨겨지던 오류)
      if (!q) return; bx.push(q); let m=NVD.get(lv+d.k); if(!m){ m=new naver.maps.Marker({position:new naver.maps.LatLng(d.lat,d.lon), icon:{content:'<div></div>',anchor:new naver.maps.Point(0,0)}}); naver.maps.Event.addListener(m,'click',()=>{ NV.morph(m.getPosition(), lv==='gu'?NGZ+1:NDZ+1); }); NVD.set(lv+d.k,m); }
      const gr=clamp(Math.round(d.g),1,9);
      m.setPosition(new naver.maps.LatLng(d.lat,d.lon));
      m.setIcon({content:`<div class="ndg" style="background:${gCol(gr)};color:${gInk(gr)}"><b>${d.k}</b><span>${aggLab(d)}</span></div>`, anchor:new naver.maps.Point(-off[0],-off[1])});
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
  // v1.2.5 연구원: 단지 단계에서는 법정동 이름(치평동·쌍촌동…)을 단지 평균 위치에 표시(행정동 이름은 동 평균 단계에서만)
  for (const b of BJ){ if (!(b.lat>=sw.lat()-dy && b.lat<=ne.lat()+dy && b.lon>=sw.lng()-dx && b.lon<=ne.lng()+dx)) continue; const p=prj.fromCoordToOffset(new naver.maps.LatLng(b.lat,b.lon)); out.push(`<div class="nmw" style="transform:translate(${Math.round(p.x)}px,${Math.round(p.y)}px);z-index:0"><div class="nbj">${b.t}</div></div>`); }
  for (const c of ord){
    const p=prj.fromCoordToOffset(new naver.maps.LatLng(c.mla,c.mlo)); const w=(z>=16?96:44), bx=[p.x-2,p.y-12,p.x+w,p.y+12];
    const sel=c.id===S.sel, lab = sel || !NG.hit(bx); if (lab) NG.add(bx);
    const gr=mapG(c), on=vis.has(c.id), cmp=S.cmp.includes(c.id);
    const pt = S.mine && S.mine.size!=='all' ? bandPrice(c) : repPrice(c);
    const dot = !sel && (z<=11 || (!on && z<=13) || !lab);
    const bg = gr==null ? 'background:#fff;color:#6b7684;border:1.5px dashed #8b95a1' : `background:${gCol(gr)};color:${gInk(gr)}`;
    const zi=sel?1000:cmp?900:on?200+(10-(gr||10))*10:1;
    out.push(`<div class="nmw nvp" data-cid="${c.id}" style="transform:translate(${Math.round(p.x)}px,${Math.round(p.y)}px);z-index:${zi}">`+(dot ? `<div class="nmk dot${on?'':' dim'}" style="${gr==null?'background:#fff;border-color:#8b95a1':`background:${gCol(gr)}`}"></div>`
      : `<div class="nmk${on?'':' dim'}${sel?' sel':''}${cmp?' cmp':''}" title="${c.dong} ${c.n} · ${gLab(c)} · ${f1(scoreOf(c))}점"><b style="${bg}">${mLab(c)}</b>${(z>=16||sel)&&pt?`<span>${S.mine && S.mine.size!=='all'?eok(pt):repLab(c)}</span>`:''}</div>`)+'</div>');
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
