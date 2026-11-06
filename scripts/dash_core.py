# v1.7.1 시세 흐름 공통 계산(’26.11.5 v1.7.1: 전세 시세는 갱신 계약 제외(5% 상한이라 시세보다 낮음) · 광주 전체 전세 월 중위(city.ro) 추가. 연구원: 광주 통합 대장 아파트 30곳(㎡당 실거래가 순, v1.7.4 20 → 30)·구별 8곳 가격 흐름, 튀는 거래 걸러냄, 카드별 평형 선택, 단지 상세 개별 거래(층 포함)·전월세). dash_v15.py(로컬 자료)·dash_auto.py(GitHub Actions, API)가 같이 씀
# 입력: 매매 실거래 행 (umd, jibun, aptNm, 연, 월, 일, 금액(만원), 전용㎡, 해제여부[, 직거래여부]), 분양권 전매 행(같은 모양), 단지 목록 [{id,n,u,y,ym,g,hd,gu,rtk,al}], 기준일
# 출력(v4): months(자료 첫 달~이번 달) · city(84㎡대 월 지수) · gu(최근 중위·대장 아파트 8곳 top: 84㎡ 환산 가격 흐름) · dongs(대장 ㎡당 가격·평균 등급·주요 단지 6곳) · px(모든 단지 평형대별 월 시세, [간격, 중위가, 건수]를 이어 붙인 1차원 배열 — enc "d3")
# 등급·환금성 점수는 여기서 계산하지 않음(빌드 때 고정). 이 파일은 시세 흐름 화면 자료만 만듦
import collections, statistics, datetime as dt
BANDS = [(45, "39"), (54, "49"), (65, "59"), (79, "74"), (95, "84"), (110, "101"), (125, "114"), (150, "135"), (10**9, "160")]   # 전용 상한 → 평형대 이름(비슷한 평형 묶음)
def band(a):
    for hi, k in BANDS:
        if a <= hi: return k
TX_MONTHS = 36   # v1.5.9 개별 거래 보관 기간(최근 3년)
TOP_N = 30       # v1.6.0 광주 통합 대장 아파트 수(v1.7.4 연구원 11.6: 20 → 30곳)
BAND_LABEL = {"39": "39㎡대", "49": "49㎡대", "59": "59㎡대", "74": "74㎡대", "84": "84㎡대", "101": "101㎡대", "114": "114㎡대", "135": "135㎡대", "160": "160㎡ 이상"}
def months_until(today, n=36):   # 최근 n개월(예전 호환)
    y, m = today.year, today.month; M = []
    for _ in range(n):
        M.append(f"{y}-{m:02d}"); m -= 1
        if m == 0: m = 12; y -= 1
    return M[::-1]
def months_from(start, today):   # start "YYYY-MM" ~ 이번 달
    y, m = int(start[:4]), int(start[5:7]); M = []
    while (y, m) <= (today.year, today.month):
        M.append(f"{y}-{m:02d}"); m += 1
        if m == 13: m = 1; y += 1
    return M
def rtkey(umd, jb, nm):
    b = (str(jb).split("-") + ["0"])[:2]; iv = lambda v: int(v) if str(v).isdigit() else str(v)
    return (umd, iv(b[0]), iv(b[1] or 0), nm)
def _med(xs): return round(statistics.median(xs)) if xs else None
import re
def _norm(s): return re.sub(r"[\s()\[\]·.,\-]|아파트|APT", "", str(s)).lower()
LEAD_MIN_AREA = 84.0   # 연구원(11.4): 대장은 전용 84㎡ 이상 매매의 ㎡당 가격으로(39~74㎡는 ㎡당 가격이 높게 나와 제외)
LEAD_QMIN = 0.25      # v1.7.6 연구원(11.6): 대장 후보는 거래활발도(최근 2년 매매 ÷ 세대수 ÷ 24개월, 단지 상세와 같은 월간 빌드 값 dash_src q)가 월 0.25% 이상(2년간 세대수의 6%). q가 없으면(입주 2년 미만 등) 이 조건 없이
def build(rows, cxs, today, src_text, silv=None, start=None, excl_direct=False, lead_floor=0, rent=None):   # v1.7.0 rent = 전월세 행 (umd, jibun, aptNm, 연, 월, 일, 보증금(만원), 월세(만원), 전용㎡, 층, 신규/갱신)
    """lead_floor: 대장 후보 세대수 하한(그 이상 단지가 없는 동네는 전체에서). excl_direct: 직거래 제외(행에 직거래 여부가 있을 때만)"""
    if start is None: start = min(f"{r[3]}-{r[4]:02d}" for r in rows)
    M = months_from(start, today); MI = {m: i for i, m in enumerate(M)}; N = len(M)
    CX = {c["id"]: c for c in cxs}
    RTG = collections.defaultdict(list)
    for c in cxs:
        for k in c["rtk"]: RTG[tuple(k)].append(c["id"])
    # 분양권은 지번·이름이 매매와 다른 경우가 많아, 같은 법정동 + 정규화한 단지명(매매 이름·단지명·연구원 확인 별칭)으로도 연결(한 단지에만 맞을 때)
    NM = collections.defaultdict(set)
    for c in cxs:
        umds = {k[0] for k in c["rtk"]}; names = {_norm(k[3]) for k in c["rtk"]} | {_norm(c["n"])} | {_norm(a) for a in c.get("al", [])}
        for u in umds:
            for nm in names:
                if nm: NM[(u, nm)].add(c["id"])
    n_direct = 0
    def bucket(rs, by_name=False):
        nonlocal n_direct
        B = collections.defaultdict(list); n = 0; nm_hit = 0
        for r in rs:
            umd, jb, nm, yy, mo, dd, amt, ar, cancel = r[:9]
            n += 1
            if cancel or not (30 <= ar <= 250): continue
            if excl_direct and len(r) > 9 and r[9]: n_direct += 1; continue
            key = f"{yy}-{mo:02d}"
            if key not in MI: continue
            k = rtkey(umd, jb, nm)
            if by_name and k not in RTG:
                ids = NM.get((umd, _norm(nm)))
                if ids and len(ids) == 1: k = ("#", next(iter(ids))); nm_hit += 1
            B[k].append((key, amt, ar, yy * 10000 + mo * 100 + dd, (r[10] if len(r) > 10 else 0) or 0))   # v1.7.0 끝에 층(보관 형식 3 이전 자료는 0)
        return B, n, nm_hit
    def bucket_rent(rs):   # v1.7.0 전월세: (달, 보증금, 월세, 전용, 연월일, 층, 0 신규|1 갱신|2 미상)
        B = collections.defaultdict(list); n = 0
        for r in rs:
            umd, jb, nm, yy, mo, dd, dep, mon, ar, fl, ct = (list(r) + ["", ""])[:11]
            if not (30 <= (ar or 0) <= 250) or not dep: continue
            key = f"{yy}-{mo:02d}"
            if key not in MI: continue
            n += 1; B[rtkey(umd, jb, nm)].append((key, int(dep), int(mon or 0), ar, yy * 10000 + mo * 100 + dd, int(fl or 0), 0 if ct == "신규" else 1 if ct == "갱신" else 2))
        return B, n
    BYK, n_all, _ = bucket(rows); SVK, _, sv_name = bucket(silv or [], by_name=True); RNK, n_rent = bucket_rent(rent or [])
    for cid in CX: RTG[("#", cid)].append(cid)
    KEYS = collections.defaultdict(list)
    for k, ids in RTG.items():
        for i in set(ids): KEYS[i].append((k, CX[i]["u"] / sum(CX[j]["u"] for j in set(ids) if j in CX)))
    def series(cid, src):
        return [(m, p, a, d, sh) for k, sh in KEYS[cid] for m, p, a, d, *_ in src.get(k, [])]
    def idx84(trs):   # 84㎡대(전용 76~95) 거래를 84.9㎡로 환산한 월 중위 + 월 거래 건수(세대수 비례 배분 합)
        mo = [None] * N; mc = [0] * N; by = collections.defaultdict(list)
        for mm, p, a, _, s in trs:
            i = MI[mm]; mc[i] += s
            if 76 <= a <= 95: by[i].append(p / a * 84.9)
        for i, xs in by.items():
            if len(xs) >= 3: mo[i] = round(statistics.median(xs))
        return mo, [round(v) for v in mc]
    def recent(vals_by_month, need=2, back=(3, 6)):   # 최근 3개월 중위, 부족하면 6개월
        for b in back:
            xs = [p for m, p in vals_by_month if m >= M[-b]]
            if len(xs) >= need: return _med(xs)
        return None
    def sparse(tb):   # 거래 있는 달만 [앞 달과의 간격, 월 중위가, 월 건수] 을 이어 붙인 1차원 배열(파일 크기 ↓, 화면에서 풀어 씀)
        by = collections.defaultdict(list)
        for t in tb: by[MI[t[0]]].append(t)
        flat = []; prev = 0
        for i, v in sorted(by.items()):
            n = round(sum(t[4] for t in v), 1); flat += [i - prev, _med([t[1] for t in v]), int(n) if n == int(n) else n]; prev = i
        return flat
    def bandinfo(tb, sv):   # tb: 매매 [(m, p, a, d, sh)], sv: 분양권. 매매가 없고 분양권만 있는 평형대도 받음
        d = dict(s=sparse(tb), n=round(sum(t[4] for t in tb)), n24=round(sum(t[4] for t in tb if t[0] >= M[max(0, N - 24)])))
        if tb:
            vm = [(t[0], t[1]) for t in tb]
            p_now = recent(vm) or _med([t[1] for t in sorted(tb, key=lambda t: -t[3])[:3]])
            y1 = [t[1] for t in tb if M[max(0, N - 17)] <= t[0] <= M[max(0, N - 12)]]; p12 = _med(y1) if len(y1) >= 2 else None   # 1년 전 6개월 중위(거래가 적은 단지도 비교되게 넓힘)
            y3 = [t[1] for t in tb if M[max(0, N - 41)] <= t[0] <= M[max(0, N - 36)]]; p36 = _med(y3) if len(y3) >= 2 else None   # 3년 전 6개월 중위
            peak = max(tb, key=lambda t: t[1]); last = max(tb, key=lambda t: t[3])
            d.update(p=p_now, c12=(round((p_now / p12 - 1) * 100, 1) if p12 and p_now else None), c36=(round((p_now / p36 - 1) * 100, 1) if p36 and p_now else None),
                     peak=peak[1], pk=peak[0], vs=(round(p_now / peak[1] * 100) if p_now else None), last=[last[3], last[1], round(last[2], 1)])
        else:
            d.update(p=None, c12=None, c36=None, peak=None, pk=None, vs=None, last=None)
        if sv:
            d["sv"] = sparse(sv); d["svn"] = round(sum(t[4] for t in sv)); ls = max(sv, key=lambda t: t[3]); d["svl"] = [ls[3], ls[1], round(ls[2], 1)]
        return d
    def lead_ppm(tr):   # 대장 판단용: 전용 84㎡ 이상 매매 ㎡당 가격의 최근 6개월 중위(3건 미만이면 12개월). (만원/㎡, 건수, 기간)
        for b in (6, 12):
            xs = [p / a for m, p, a, _, _ in tr if a >= LEAD_MIN_AREA and m >= M[max(0, N - b)]]
            if len(xs) >= 3: return round(statistics.median(xs), 1), len(xs), b
        return None
    px = {}; dong_cx = collections.defaultdict(list); dong_g = collections.defaultdict(list); city_tr = []; gu_tr = collections.defaultdict(list); dong_tr = collections.defaultdict(list)
    for cid, c in CX.items():
        if c.get("g"): dong_g[c["hd"]].append(c["g"])
        tr = series(cid, BYK); sv = series(cid, SVK)
        if not tr and not sv: continue
        city_tr += tr; gu_tr[c["gu"]] += tr; dong_tr[c["hd"]] += tr
        byb = collections.defaultdict(list); bys = collections.defaultdict(list)
        for t in tr: byb[band(t[2])].append(t)
        for t in sv: bys[band(t[2])].append(t)
        bands = {k: bandinfo(byb.get(k, []), bys.get(k)) for k in set(byb) | set(bys) if len(byb.get(k, [])) >= 3 or len(bys.get(k, [])) >= 3}
        if not bands: continue
        rep = max(bands, key=lambda k: (round(bands[k]["n24"], 3), round(bands[k]["n"], 3), round(bands[k].get("svn", 0), 3), k))   # 대표 평형대 = 최근 2년 매매 최다(동률이면 전체, 그다음 분양권)
        n24 = round(sum(t[4] for t in tr if t[0] >= M[max(0, N - 24)]))
        px[cid] = dict(rep=rep, ym=c.get("ym"), b=bands)
        lp = lead_ppm(tr)
        if n24 >= 8 and (c.get("q") is None or c["q"] >= LEAD_QMIN): dong_cx[c["hd"]].append(dict(id=cid, n=c["n"], u=c["u"], y=c["y"], g=c.get("g"), rep=rep, lp=lp, n24=n24))   # v1.7.6 거래활발도 조건
    tx = {}   # v1.5.9 연구원(11.4): 단지 상세 실거래 그래프의 개별 거래 점·거래 목록 = 최근 TX_MONTHS개월 매매·분양권 [달 번호, 일, 금액(만원), 전용㎡×100, 0 매매|1 분양권, 층] 최신순(호출 쪽에서 따로 저장). v1.7.0 층 추가(6칸)
    rtx = {}  # v1.7.0 전월세 개별 거래(최근 TX_MONTHS개월) [달 번호, 일, 보증금(만원), 월세(만원), 전용㎡×100, 층, 0 신규|1 갱신|2 미상]
    def raw(cid, src):
        return [t for k, _ in KEYS[cid] for t in src.get(k, [])]
    for cid in px:
        rs = [(MI[m], d % 100, p, round(a * 100), 0, fl) for m, p, a, d, fl in raw(cid, BYK) if MI[m] >= N - TX_MONTHS] + [(MI[m], d % 100, p, round(a * 100), 1, fl) for m, p, a, d, fl in raw(cid, SVK) if MI[m] >= N - TX_MONTHS]
        if rs: rs.sort(key=lambda t: (-t[0], -t[1], -t[2])); tx[cid] = [v for t in rs for v in t]
        rr = [(MI[m], d % 100, dep, mon, round(a * 100), fl, ct) for m, dep, mon, a, d, fl, ct in raw(cid, RNK) if MI[m] >= N - TX_MONTHS]
        if rr: rr.sort(key=lambda t: (-t[0], -t[1], -t[2])); rtx[cid] = [v for t in rr for v in t]
        # 전세(월세 0) 평형대별 월 중위 보증금 → px[cid]["r"][평형대] = {s:[간격, 중위, 건수], n, p(최근 3개월 중위, 부족하면 6개월), pk(그 달 수)}
        byr = collections.defaultdict(list)
        for m, dep, mon, a, d, fl, ct in raw(cid, RNK):
            if mon == 0 and ct != 1: byr[band(a)].append((m, dep, a, d, 1))   # v1.7.1 전세(월세 0) 중 신규·미상만. 갱신(계약갱신청구권, 5% 상한)은 목록에만
        rb = {}
        for k, L in byr.items():
            if len(L) < 3: continue
            vm = [(t[0], t[1]) for t in L]; pr = recent(vm)
            rb[k] = dict(s=sparse(L), n=len(L), p=pr)
        if rb: px[cid]["r"] = rb
    out = dict(v=4, enc="d3", src=src_text, asof=today.isoformat(), months=M, bandLabel=BAND_LABEL, city={}, gu={}, dongs={}, px=px,
               lead=dict(area=LEAD_MIN_AREA, floor=lead_floor, direct=("제외" if excl_direct else "포함"), qmin=(LEAD_QMIN if any(c.get("q") is not None for c in CX.values()) else None)), svName=sv_name, nDirect=n_direct)
    cm, cc = idx84(city_tr); out["city"] = dict(mo=cm, mc=cc)
    # v1.7.1 광주 전체 전세 = 연결된 단지의 전세(월세 0, 신규·미상 계약) 중 전용 76~95㎡ 보증금을 84.9㎡로 환산한 월 중위(3건 이상인 달만) + 월 건수.
    #   대장 아파트 윗줄의 '광주 전세 중위·전세가율', 단지 상세 전세가율 추이의 광주 비교선에 씀. 전월세 자료가 없는 달(2021년 이전)은 None
    ro = [None] * N; rc = [0] * N; byc = collections.defaultdict(list)
    for k, L in RNK.items():
        if k not in RTG: continue
        for m, dep, mon, a, d, fl, ct in L:
            if mon or ct == 1: continue
            i = MI[m]; rc[i] += 1
            if 76 <= a <= 95: byc[i].append(dep / a * 84.9)
    for i, xs in byc.items():
        if len(xs) >= 3: ro[i] = round(statistics.median(xs))
    out["city"]["ro"] = ro; out["city"]["rc"] = rc
    for g, trs in gu_tr.items():
        out["gu"][g] = dict(p=recent([(m, p / a * 84.9) for m, p, a, _, _ in trs if 76 <= a <= 95], need=5, back=(6, 12)))
    leads = {}   # 동네 → 대장(구별 주요 단지 12곳 고를 때 씀)
    for hd, L in dong_cx.items():
        if len(L) < 2: continue
        cand = [d for d in L if d["lp"]]
        big = [d for d in cand if d["u"] >= lead_floor] or cand
        lead = max(big, key=lambda d: d["lp"][0]) if big else None   # 대장 = 전용 84㎡ 이상 ㎡당 최근 실거래가 1위(세대수 하한 이상 중). 84㎡ 이상 거래가 없는 동네는 대장 없음
        top = [lead] if lead else []
        if lead: leads[hd] = lead
        sig = lambda d: frozenset(k for k, _ in KEYS[d["id"]] if k[0] != "#")   # 실거래 지번을 같이 쓰는 단지(예: 라인광장1차·2,3차)는 같은 거래라 한 번만
        for d in sorted(L, key=lambda d: -d["u"]):
            if d not in top and len(top) < 6 and all(sig(d) != sig(t) for t in top): top.append(d)
        trs = dong_tr[hd]
        c36 = [px[d["id"]]["b"][d["rep"]]["c36"] for d in top if px[d["id"]]["b"][d["rep"]]["c36"] is not None]
        c12 = [px[d["id"]]["b"][d["rep"]]["c12"] for d in top if px[d["id"]]["b"][d["rep"]]["c12"] is not None]
        gs = dong_g.get(hd) or []
        out["dongs"][hd] = dict(gu=CX[L[0]["id"]]["gu"], n=len(L), n24=round(sum(s for m, _, _, _, s in trs if m >= M[max(0, N - 24)])),
                                **(dict(ppm=lead["lp"][0], p84=round(lead["lp"][0] * 84.9), lpn=lead["lp"][1], lpm=lead["lp"][2], top=lead["n"], topId=lead["id"], topU=lead["u"]) if lead else dict(ppm=None)),
                                gavg=(round(statistics.mean(gs), 1) if gs else None), ng=len(gs),
                                c36=(round(statistics.median(c36), 1) if len(c36) >= 3 else None), c12=(round(statistics.median(c12), 1) if len(c12) >= 3 else None),
                                cx=[dict(id=d["id"], n=d["n"], u=d["u"], y=d["y"], g=d["g"], rep=d["rep"], n24=d["n24"]) for d in top])
    # v1.5.6 연구원(11.4): 시세 흐름 = 구별 '대장 아파트' 8곳을 가격 순서대로, 단지별 가격 흐름만. 손으로 고르지 않음:
    #   후보 = 그 구에서 최근 2년 매매 8건 이상 + 전용 84㎡ 이상 매매가 최근 6개월(부족하면 12개월) 3건 이상인 단지
    #   대장 = 후보 중 300세대 이상을 84㎡ 환산가(㎡당 가격 × 84.9) 높은 순으로 8곳(300세대 이상이 8곳이 안 되면 나머지 후보로 채움). 지번 공유 단지는 하나만
    #   가격 흐름 = 전용 84㎡ 이상 매매(분양권 따로)의 ㎡당 가격 × 84.9, 앞뒤 1개월을 포함한 3개월 이동 중위 — 큰 평형만 있는 단지도 같은 잣대로 비교
    sigk = lambda i: frozenset(k for k, _ in KEYS[i] if k[0] != "#")
    def clean(trs, amin=LEAD_MIN_AREA):   # v1.5.7 튀는 거래 걸러냄(amin㎡ 이상, 84㎡ 환산가 = ㎡당 가격 기준. v1.5.8 평형대별은 amin=0): 앞 12개월·뒤 12개월(같은 달 포함, 자기 제외) 거래 중위와 각각 비교해
        #   거래가 있는 쪽 모두보다 25% 넘게 높거나 모두보다 25% 넘게 낮으면 뺌(앞뒤 합쳐 2건 이상일 때만 판단). 한쪽과 맞거나 앞·뒤 사이면 급등·급락(실제 흐름)으로 보고 남김
        v = [(MI[m], p / a * 84.9) for m, p, a, _, _ in trs if a >= amin]
        keep = []
        for m, p, a, d, sh in trs:
            if a < amin: continue
            i, x = MI[m], p / a * 84.9
            bf = [y for j, y in v if i - 12 <= j <= i]; bf.remove(x)
            af = [y for j, y in v if i <= j <= i + 12]; af.remove(x)
            nn = sum(1 for j, _ in v if abs(j - i) <= 12) - 1   # 앞뒤 12개월 다른 거래 수
            loc = [y for j, y in v if abs(j - i) <= 2]; loc.remove(x)   # 앞뒤 2개월 거래가 2건 이상이고 그 중위와 15% 안이면 그 시기 시세로 보고 남김
            if len(loc) >= 2 and abs(x / statistics.median(loc) - 1) <= 0.15: keep.append((m, p, a, d, sh)); continue
            r = [x / statistics.median(s) - 1 for s in (bf, af) if s]
            if nn >= 2 and (all(q > 0.25 for q in r) or all(q < -0.25 for q in r)): continue   # 양쪽보다 모두 25% 넘게 높거나 모두 낮을 때만(앞·뒤 사이에 있으면 급등·급락 중인 실제 거래)
            keep.append((m, p, a, d, sh))
        return keep
    def e84(trs, amin=LEAD_MIN_AREA, conv=True):   # [(m, p, a, d, sh)] → 3개월 이동 중위 1차원 배열 [간격, 값, 그 달 건수]. conv=False면 84㎡ 환산 없이 실제 거래가(v1.5.8 평형대별)
        by = collections.defaultdict(list)
        for m, p, a, _, sh in trs:   # trs는 clean() 거친 것
            if a >= amin: by[MI[m]].append((p / a * 84.9 if conv else p, sh))
        if not by: return []
        flat = []; prev = 0
        for i in range(min(by), N):
            xs = [v for j in (i - 1, i, i + 1) for v, _ in by.get(j, [])]
            if not xs or (i not in by and len(xs) < 2): continue
            n = round(sum(sh for _, sh in by.get(i, [])), 1)
            flat += [i - prev, round(statistics.median(xs)), int(n) if n == int(n) else n]; prev = i
        return flat
    def win(trs, a0, a1):   # 달 번호 a0~a1 사이 84㎡ 이상 매매 84㎡ 환산 중위(2건 이상)
        xs = [p / a * 84.9 for m, p, a, _, _ in trs if M[max(0, a0)] <= m <= M[max(0, a1)]]   # trs는 clean() 거친 것
        return statistics.median(xs) if len(xs) >= 2 else None
    def pick(L, n):   # 300세대 이상을 ㎡당 가격 높은 순으로 n곳(모자라면 나머지 후보로), 지번 공유 단지는 하나만 → 화면 순서 = ㎡당 가격 높은 순
        order = sorted(L, key=lambda d: (d["u"] < lead_floor, -d["lp"][0])); sel = []
        for d in order:
            if len(sel) >= n: break
            if all(sigk(d["id"]) != sigk(t["id"]) for t in sel): sel.append(d)
        return sorted(sel, key=lambda d: -d["lp"][0])
    def card(d):   # 대장 카드 1곳: 84㎡ 이상 환산 흐름(e·ev, 예전 화면용) + 평형대별 흐름(bs)
        tr = clean(series(d["id"], BYK)); sv = clean(series(d["id"], SVK))
        pnow = d["lp"][0] * 84.9; b6 = d["lp"][2]
        y1 = win(tr, N - 12 - b6, N - 13); y3 = win(tr, N - 36 - b6, N - 37)
        bs = {}   # v1.5.8 연구원(11.4): 카드마다 평형 선택 → 평형대별 실제 거래가 3개월 이동 중위(같은 튀는 거래 규칙)
        for k in px[d["id"]]["b"]:
            tk = clean([t for t in series(d["id"], BYK) if band(t[2]) == k], 0); sk = clean([t for t in series(d["id"], SVK) if band(t[2]) == k], 0)
            bs[k] = dict(e=e84(tk, 0, False), ev=e84(sk, 0, False))
        return dict(id=d["id"], n=d["n"], u=d["u"], y=d["y"], g=d["g"], gu=CX[d["id"]]["gu"], hd=CX[d["id"]]["hd"], ym=CX[d["id"]].get("ym"), ppm=d["lp"][0], p84=round(pnow), pn=d["lp"][1], pm=b6,
                    c12=(round((pnow / y1 - 1) * 100, 1) if y1 else None), c36=(round((pnow / y3 - 1) * 100, 1) if y3 else None), e=e84(tr), ev=e84(sv), big=d["u"] >= lead_floor, bs=bs)
    CAND = [d for L2 in dong_cx.values() for d in L2 if d["lp"]]
    for g in out["gu"]:   # 구별 8곳(v1.5.6~v1.5.9 화면용, 그대로 둠)
        out["gu"][g]["top"] = [card(d) for d in pick([d for d in CAND if CX[d["id"]]["gu"] == g], 8)]
    out["top"] = [card(d) for d in pick(CAND, TOP_N)]   # v1.6.0 연구원(11.5): 광주 통합 대장 아파트 = ㎡당 실거래가 높은 순 30곳(v1.7.4 연구원 11.6: 20 → 30)
    out["tx"] = tx; out["rtx"] = rtx; out["nRent"] = n_rent   # 호출 쪽(dash_auto·dash_v15)에서 꺼내 rt/tx.json.gz 로 따로 씀(시세 흐름 파일 크기 그대로)
    return out, n_all
