# 시세 흐름 자동 갱신(GitHub Actions용, v1.5.0 ’26.11.3)
# 국토교통부 아파트 매매 실거래가 API(공공데이터포털 RTMSDataSvcAptTrade)를 최근 24개월 × 광주 5개 구 호출 →
# gwangju/v1.4.0/data/dash.json.gz 다시 만듦. 인증키는 환경변수 MOLIT_KEY(GitHub Secrets)로만 받음. 등급 계산은 건드리지 않음.
# 사용: MOLIT_KEY=... python3 dash_auto.py <dash_src.json> <출력 dash.json.gz>
import os, sys, json, gzip, time, datetime as dt, collections, statistics, urllib.request, urllib.parse, xml.etree.ElementTree as ET
KEY = os.environ.get("MOLIT_KEY", "").strip()
if not KEY: sys.exit("MOLIT_KEY 없음")
SRC, OUT = sys.argv[1], sys.argv[2]
GU = {"12210": "동구", "12240": "서구", "12270": "남구", "12300": "북구", "12330": "광산구"}
URL = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade"
today = dt.date.today()
M = []
y, m = today.year, today.month
for i in range(24):
    M.append(f"{y}-{m:02d}"); m -= 1
    if m == 0: m = 12; y -= 1
M = M[::-1]; MI = {mm: i for i, mm in enumerate(M)}
def fetch(lawd, ym):
    rows = []; page = 1
    while True:
        q = urllib.parse.urlencode(dict(serviceKey=KEY, LAWD_CD=lawd, DEAL_YMD=ym, numOfRows=1000, pageNo=page), safe="")
        for tr in range(4):
            try:
                with urllib.request.urlopen(URL + "?" + q, timeout=60) as r: body = r.read()
                break
            except Exception as e:
                if tr == 3: raise
                time.sleep(3 * (tr + 1))
        root = ET.fromstring(body)
        code = (root.findtext(".//resultCode") or "").strip()
        if code not in ("000", "00"): raise SystemExit(f"API 오류 {lawd} {ym}: {root.findtext('.//resultMsg')}")
        items = root.findall(".//item")
        for it in items:
            g = lambda k: (it.findtext(k) or "").strip()
            rows.append((g("umdNm"), g("jibun"), g("aptNm"), int(g("dealYear")), int(g("dealMonth")), int(g("dealDay")), int(g("dealAmount").replace(",", "")), float(g("excluUseAr") or 0), g("cdealType") == "O"))
        total = int(root.findtext(".//totalCount") or 0)
        if page * 1000 >= total or not items: break
        page += 1
    return rows
def rtkey(umd, jb, nm):
    b = (str(jb).split("-") + ["0"])[:2]; iv = lambda v: int(v) if str(v).isdigit() else str(v)
    return (umd, iv(b[0]), iv(b[1] or 0), nm)
BYK = collections.defaultdict(list); n_all = 0
for lawd in GU:
    for mm in M:
        for umd, jb, nm, yy, mo, dd, amt, ar, cancel in fetch(lawd, mm.replace("-", "")):
            n_all += 1
            if cancel or not (40 <= ar <= 200): continue
            BYK[rtkey(umd, jb, nm)].append((f"{yy}-{mo:02d}", amt, ar, yy * 10000 + mo * 100 + dd))
        time.sleep(0.2)
print("실거래", n_all, "건 · 키", len(BYK))
S = json.load(open(SRC, encoding="utf-8"))["cx"]
CX = {c["id"]: c for c in S}
RTG = collections.defaultdict(list)
for c in S:
    for k in c["rtk"]: RTG[tuple(k)].append(c["id"])
def series(cid):
    tr = []
    for k, ids in RTG.items():
        if cid not in ids: continue
        sh = CX[cid]["u"] / sum(CX[i]["u"] for i in set(ids) if i in CX)
        for m, p, a, d in BYK.get(k, []):
            if m in MI: tr.append((m, p / a * 84.9, p, a, d, sh))
    return tr
def smooth(mo):
    out = []
    for i in range(24):
        xs = [v for v in mo[max(0, i - 1):i + 2] if v is not None]
        out.append(round(statistics.median(xs)) if xs else None)
    return out
def idx(trs):
    mo = []; mc = []
    for m in M:
        xs = [p for mm, p, _ in trs if mm == m]
        mo.append(round(statistics.median(xs)) if len(xs) >= 3 else None); mc.append(round(sum(s for mm, _, s in trs if mm == m)))
    return mo, mc
dongs = collections.defaultdict(list); city_tr = []; dong_tr = collections.defaultdict(list)
for cid, c in CX.items():
    tr = series(cid)
    n24 = round(sum(t[5] for t in tr))
    city_tr += [(t[0], t[1], t[5]) for t in tr if 76 <= t[3] <= 95]
    dong_tr[c["hd"]] += [(t[0], t[1], t[5]) for t in tr if 76 <= t[3] <= 95]
    if n24 < 8: continue
    rep = collections.Counter(round(t[3]) for t in tr).most_common(1)[0][0]
    tb = [t for t in tr if round(t[3]) == rep]
    mo = [None] * 24; mc = [0] * 24
    for i, m in enumerate(M):
        xs = [t[2] for t in tb if t[0] == m]
        if xs: mo[i] = round(statistics.median(xs))
        mc[i] = round(sum(t[5] for t in tr if t[0] == m), 1)
    last = max(tb, key=lambda t: t[4]); recent = [t for t in tb if t[0] >= M[-3]]
    p_now = round(statistics.median([t[2] for t in recent])) if len(recent) >= 2 else round(statistics.median([t[2] for t in tb if t[0] >= M[-6]] or [last[2]]))
    first = [t for t in tb if t[0] <= M[5]]
    p_then = round(statistics.median([t[2] for t in first])) if len(first) >= 2 else None
    peak = max(t[2] for t in tb)
    dongs[c["hd"]].append(dict(id=cid, n=c["n"], u=c["u"], y=c["y"], g=c.get("g"), rep=rep, nrep=len(tb), mo=smooth(mo), mc=mc, n24=n24, p=p_now, chg=(round((p_now / p_then - 1) * 100, 1) if p_then else None),
                               peak=peak, vs=round(p_now / peak * 100), last=[last[4], last[2], round(last[3], 1)]))
cm, cc = idx(city_tr)
out = dict(src=f"국토교통부 아파트 매매 실거래가(공공데이터포털, {today.isoformat()} 자동 조회) · 해제 거래 제외 · 단지는 대표 평형(24개월 거래 최다 전용) 실제 거래가 월 중위, 동네·광주는 전용 76~95㎡ 거래를 84.9㎡로 환산한 월 중위",
           asof=today.isoformat(), months=M, city=dict(mo=cm, mc=cc), dongs={})
for hd, L in dongs.items():
    L.sort(key=lambda d: -d["p"] / d["rep"]); top = [L[0]]
    for d in sorted(L, key=lambda d: -d["u"]):
        if d not in top and len(top) < 6: top.append(d)
    dm, dc = idx(dong_tr[hd]); ch = [d["chg"] for d in top if d["chg"] is not None]
    if len(L) >= 2: out["dongs"][hd] = dict(gu=CX[L[0]["id"]]["gu"], n=len(L), cx=top, mo=dm, mc=dc, chg=(round(statistics.median(ch), 1) if len(ch) >= 3 else None), n24=round(sum(s for _, _, s in dong_tr[hd])))
if len(out["dongs"]) < 50 or n_all < 5000: raise SystemExit(f"자료가 너무 적음(동 {len(out['dongs'])}, 거래 {n_all}) — 갱신 중단")
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with gzip.open(OUT, "wt", encoding="utf-8") as f: f.write(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
print("dash", len(out["dongs"]), "행정동 ·", sum(len(v["cx"]) for v in out["dongs"].values()), "단지 · 광주 최근 월", cc[-3:], cm[-3:])
