# 시세 흐름 자동 갱신(GitHub Actions용, v1.7.2: 끝에 OSM 동 위치(osm_bld.py, 30일마다) · v1.7.0 ’26.11.5: 거래에 층 추가(보관 형식 3, 전체 다시 받음) · 전월세(RTMSDataSvcAptRent, 2021년부터) 추가) — 계산은 dash_core.py
# 국토교통부 아파트 매매 실거래가(RTMSDataSvcAptTrade)·분양권 전매(RTMSDataSvcSilvTrade) API를 광주 5개 구에 대해 호출 → dash.json.gz 다시 만듦
# 기간: 2006년 1월(자료 제공 시작)부터 이번 달까지 전체. 받은 자료는 <출력 폴더>/rt/<연도>.json.gz 에 연도별로 보관하고,
#   매일은 최근 4개월(신고·해제가 늦게 잡히는 기간)만 다시 받음. 보관 파일이 없는 달만 새로 받음(첫 실행 약 2,500회 호출, 이후 매일 50회)
# 인증키는 환경변수 MOLIT_KEY(GitHub Secrets)로만 받음. 등급·환금성 점수는 건드리지 않음
# 사용: MOLIT_KEY=... python3 scripts/dash_auto.py <dash_src.json> <data/dash.json.gz> → 실제 출력은 data/rt/trend.json.gz(보관 파일과 같은 폴더)
import os, sys, json, gzip, time, datetime as dt, urllib.request, urllib.parse, xml.etree.ElementTree as ET, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import dash_core as DC
KEY = os.environ.get("MOLIT_KEY", "").strip()
if not KEY: sys.exit("MOLIT_KEY 없음")
SRC, OUT = sys.argv[1], sys.argv[2]
CACHE = pathlib.Path(os.path.dirname(OUT) or ".") / "rt"; CACHE.mkdir(parents=True, exist_ok=True)
TREND = CACHE / "trend.json.gz"   # v1.5.3 화면 자료(v4)는 rt/trend.json.gz 에 씀. 예전 dash.json.gz(v3)는 건드리지 않아 예전 화면(v1.5.2)이 깨지지 않음
GU = {"12210": "동구", "12240": "서구", "12270": "남구", "12300": "북구", "12330": "광산구"}
API = {"apt": "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade", "silv": "https://apis.data.go.kr/1613000/RTMSDataSvcSilvTrade/getRTMSDataSvcSilvTrade", "rent": "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent"}
START = "2006-01"; REFRESH = 4   # 최근 4개월은 매일 다시 받음
RENT_START = "2021-01"   # v1.7.0 전월세는 2021년부터(전세가율·전세 흐름용. 그 전은 받지 않음)
EXCL_DIRECT = True   # 연구원 결정(11.4): 시세 흐름에서 직거래 제외(등급·환금성 계산과 무관). 보관 파일 형식 2(거래 구분 포함)가 아니면 그 해를 다시 받음
LEAD_FLOOR = 300     # 연구원 결정(11.4): 대장 후보 세대수 하한(그 이상 단지가 없는 동네는 전체에서)
FMT = 3              # 보관 파일 형식: 3 = 매매·분양권 행 끝에 직거래 여부·층, 전월세(rent) 행 추가. 형식이 다르면 그 해를 전부 다시 받음(첫 실행 약 1시간)
today = dt.date.today(); M = DC.months_from(START, today)
calls = 0
def fetch(kind, lawd, ym):
    global calls; rows = []; page = 1
    while True:
        q = urllib.parse.urlencode(dict(serviceKey=KEY, LAWD_CD=lawd, DEAL_YMD=ym, numOfRows=1000, pageNo=page), safe="")
        for tr in range(4):
            try:
                with urllib.request.urlopen(API[kind] + "?" + q, timeout=60) as r: body = r.read()
                break
            except Exception:
                if tr == 3: raise
                time.sleep(3 * (tr + 1))
        calls += 1
        root = ET.fromstring(body)
        code = (root.findtext(".//resultCode") or "").strip()
        if code not in ("000", "00"): raise RuntimeError(f"API 오류 {kind} {lawd} {ym}: {root.findtext('.//resultMsg')}")
        items = root.findall(".//item")
        for it in items:
            g = lambda k: (it.findtext(k) or "").strip()
            try:
                if kind == "rent": rows.append([g("umdNm"), g("jibun"), g("aptNm"), int(g("dealYear")), int(g("dealMonth")), int(g("dealDay")), int(g("deposit").replace(",", "") or 0), int(g("monthlyRent").replace(",", "") or 0), float(g("excluUseAr") or 0), int(g("floor") or 0), g("contractType")])   # 전월세: 보증금·월세(만원)·전용·층·신규/갱신
                else: rows.append([g("umdNm"), g("jibun"), g("aptNm"), int(g("dealYear")), int(g("dealMonth")), int(g("dealDay")), int(g("dealAmount").replace(",", "")), float(g("excluUseAr") or 0), g("cdealType") == "O", g("dealingGbn") == "직거래", int(g("floor") or 0)])
            except ValueError: pass
        total = int(root.findtext(".//totalCount") or 0)
        if page * 1000 >= total or not items: break
        page += 1
    return rows
def load_year(y):
    p = CACHE / f"{y}.json.gz"
    d = json.load(gzip.open(p, "rt", encoding="utf-8")) if p.exists() else {}
    return d if d.get("fmt") == FMT else {"fmt": FMT, "apt": {}, "silv": {}, "rent": {}}   # 형식이 다르면(예전 파일) 그 해를 새로 받음
def save_year(y, d, before):
    s = json.dumps(d, ensure_ascii=False, separators=(",", ":"))
    if s == before: return False
    with gzip.open(CACHE / f"{y}.json.gz", "wt", encoding="utf-8") as f: f.write(s)
    return True
silv_ok = True; rent_ok = True
by_year = {}; changed = 0
for mm in M:
    y = mm[:4]
    if y not in by_year: by_year[y] = (load_year(y), None); by_year[y] = (by_year[y][0], json.dumps(by_year[y][0], ensure_ascii=False, separators=(",", ":")))
    d = by_year[y][0]; fresh = mm >= M[-REFRESH]
    for kind in ("apt", "silv", "rent"):
        if kind == "silv" and not silv_ok: continue
        if kind == "rent" and (not rent_ok or mm < RENT_START): continue
        if not fresh and mm in d[kind]: continue
        rows = []
        try:
            for lawd in GU: rows += fetch(kind, lawd, mm.replace("-", "")); time.sleep(0.15)
        except RuntimeError as e:
            if kind == "silv": print("분양권 API 건너뜀:", e); silv_ok = False; continue
            if kind == "rent": print("전월세 API 건너뜀:", e); rent_ok = False; continue
            raise
        d[kind][mm] = rows
for y, (d, before) in by_year.items():
    if save_year(y, d, before): changed += 1
apt = [tuple(r) for d, _ in by_year.values() for L in d["apt"].values() for r in L]
n_dir = sum(1 for r in apt if len(r) > 9 and r[9])
silv = [tuple(r) for d, _ in by_year.values() for L in d["silv"].values() for r in L]
rent = [tuple(r) for d, _ in by_year.values() for L in d.get("rent", {}).values() for r in L]
print(f"호출 {calls}회 · 매매 {len(apt):,}건(직거래 {n_dir:,}) · 분양권 {len(silv):,}건 · 전월세 {len(rent):,}건 · 연도 파일 변경 {changed}개 · 기간 {M[0]}~{M[-1]}")
cxs = json.load(open(SRC, encoding="utf-8"))["cx"]
out, n_all = DC.build(apt, cxs, today, f"국토교통부 아파트 매매 실거래가·분양권 전매(공공데이터포털, {today.isoformat()} 자동 조회, {M[0][:4]}년부터) · 해제 거래{'·직거래' if EXCL_DIRECT else ''} 제외 · 단지는 평형대별 실제 거래가 월 중위, 동네·구·광주는 전용 76~95㎡ 거래를 84.9㎡로 환산한 월 중위", silv=silv, start=START, excl_direct=EXCL_DIRECT, lead_floor=LEAD_FLOOR, rent=rent)
if len(out["dongs"]) < 50 or n_all < 5000: raise SystemExit(f"자료가 너무 적음(동 {len(out['dongs'])}, 거래 {n_all}) — 갱신 중단")
tx = out.pop("tx", None); rtx = out.pop("rtx", None)   # v1.5.9 단지 상세 개별 거래(최근 3년) → rt/tx.json.gz. v1.7.0 전월세 개별 거래도 같은 파일(rtx)
with gzip.open(TREND, "wt", encoding="utf-8") as f: f.write(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
if tx is not None:
    with gzip.open(CACHE / "tx.json.gz", "wt", encoding="utf-8") as f: f.write(json.dumps(dict(v=2, asof=today.isoformat(), m0=M[0], tx=tx, rtx=rtx or {}), ensure_ascii=False, separators=(",", ":")))
    print("tx", len(tx), "단지 ·", os.path.getsize(CACHE / "tx.json.gz") // 1024, "KB")
print("trend v4", len(out["dongs"]), "행정동 ·", len(out["px"]), "단지 ·", os.path.getsize(TREND) // 1024, "KB · 광주 최근 월", out["city"]["mc"][-3:], out["city"]["mo"][-3:])
# v1.7.2 OSM 아파트 동(건물) 위치 → rt/bld_osm.json.gz(30일마다). 위 시세 갱신이 끝난 뒤라 실패해도 영향 없음
try:
    import subprocess; subprocess.run([sys.executable, str(pathlib.Path(__file__).resolve().parent / "osm_bld.py"), str(CACHE)], timeout=900)
except Exception as e: print("osm_bld 건너뜀:", e)
