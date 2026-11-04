# 시세 흐름 자동 갱신(GitHub Actions용, v1.5.1 ’26.11.4) — 계산은 dash_core.py
# 국토교통부 아파트 매매 실거래가 API(RTMSDataSvcAptTrade)를 최근 36개월 × 광주 5개 구 호출 → dash.json.gz 다시 만듦
# 인증키는 환경변수 MOLIT_KEY(GitHub Secrets)로만 받음. 등급 계산은 건드리지 않음
# 사용: MOLIT_KEY=... python3 scripts/dash_auto.py <dash_src.json> <출력 dash.json.gz>
import os, sys, json, gzip, time, datetime as dt, urllib.request, urllib.parse, xml.etree.ElementTree as ET, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import dash_core as DC
KEY = os.environ.get("MOLIT_KEY", "").strip()
if not KEY: sys.exit("MOLIT_KEY 없음")
SRC, OUT = sys.argv[1], sys.argv[2]
GU = {"12210": "동구", "12240": "서구", "12270": "남구", "12300": "북구", "12330": "광산구"}
URL = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade"
today = dt.date.today(); M = DC.months_until(today)
def fetch(lawd, ym):
    rows = []; page = 1
    while True:
        q = urllib.parse.urlencode(dict(serviceKey=KEY, LAWD_CD=lawd, DEAL_YMD=ym, numOfRows=1000, pageNo=page), safe="")
        for tr in range(4):
            try:
                with urllib.request.urlopen(URL + "?" + q, timeout=60) as r: body = r.read()
                break
            except Exception:
                if tr == 3: raise
                time.sleep(3 * (tr + 1))
        root = ET.fromstring(body)
        code = (root.findtext(".//resultCode") or "").strip()
        if code not in ("000", "00"): raise SystemExit(f"API 오류 {lawd} {ym}: {root.findtext('.//resultMsg')}")
        items = root.findall(".//item")
        for it in items:
            g = lambda k: (it.findtext(k) or "").strip()
            try: rows.append((g("umdNm"), g("jibun"), g("aptNm"), int(g("dealYear")), int(g("dealMonth")), int(g("dealDay")), int(g("dealAmount").replace(",", "")), float(g("excluUseAr") or 0), g("cdealType") == "O"))
            except ValueError: pass
        total = int(root.findtext(".//totalCount") or 0)
        if page * 1000 >= total or not items: break
        page += 1
    return rows
rows = []
for lawd in GU:
    for mm in M:
        rows += fetch(lawd, mm.replace("-", "")); time.sleep(0.2)
print("실거래", len(rows), "건")
cxs = json.load(open(SRC, encoding="utf-8"))["cx"]
out, n_all = DC.build(rows, cxs, today, f"국토교통부 아파트 매매 실거래가(공공데이터포털, {today.isoformat()} 자동 조회) · 해제 거래 제외 · 단지는 평형대별 실제 거래가 월 중위, 동네·구·광주는 전용 76~95㎡ 거래를 84.9㎡로 환산한 월 중위")
if len(out["dongs"]) < 50 or n_all < 5000: raise SystemExit(f"자료가 너무 적음(동 {len(out['dongs'])}, 거래 {n_all}) — 갱신 중단")
os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
with gzip.open(OUT, "wt", encoding="utf-8") as f: f.write(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
print("dash v2", len(out["dongs"]), "행정동 ·", len(out["px"]), "단지 · 광주 최근 월", out["city"]["mc"][-3:], out["city"]["mo"][-3:])
