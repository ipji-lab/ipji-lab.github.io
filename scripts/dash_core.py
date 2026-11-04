# v1.5.4 시세 흐름 공통 계산(’26.11.4, 연구원: 구별 주요 단지 12곳 그래프). dash_v15.py(로컬 자료)·dash_auto.py(GitHub Actions, API)가 같이 씀
# 입력: 매매 실거래 행 (umd, jibun, aptNm, 연, 월, 일, 금액(만원), 전용㎡, 해제여부[, 직거래여부]), 분양권 전매 행(같은 모양), 단지 목록 [{id,n,u,y,ym,g,hd,gu,rtk,al}], 기준일
# 출력(v4): months(자료 첫 달~이번 달) · city(84㎡대 월 지수) · gu(최근 중위·주요 단지 12곳 top) · dongs(대장 ㎡당 가격·평균 등급·주요 단지 6곳) · px(모든 단지 평형대별 월 시세, [간격, 중위가, 건수]를 이어 붙인 1차원 배열 — enc "d3")
# 등급·환금성 점수는 여기서 계산하지 않음(빌드 때 고정). 이 파일은 시세 흐름 화면 자료만 만듦
import collections, statistics, datetime as dt
BANDS = [(45, "39"), (54, "49"), (65, "59"), (79, "74"), (95, "84"), (110, "101"), (125, "114"), (150, "135"), (10**9, "160")]   # 전용 상한 → 평형대 이름(비슷한 평형 묶음)
def band(a):
    for hi, k in BANDS:
        if a <= hi: return k
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
def build(rows, cxs, today, src_text, silv=None, start=None, excl_direct=False, lead_floor=0):
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
            B[k].append((key, amt, ar, yy * 10000 + mo * 100 + dd))
        return B, n, nm_hit
    BYK, n_all, _ = bucket(rows); SVK, _, sv_name = bucket(silv or [], by_name=True)
    for cid in CX: RTG[("#", cid)].append(cid)
    KEYS = collections.defaultdict(list)
    for k, ids in RTG.items():
        for i in set(ids): KEYS[i].append((k, CX[i]["u"] / sum(CX[j]["u"] for j in set(ids) if j in CX)))
    def series(cid, src):
        return [(m, p, a, d, sh) for k, sh in KEYS[cid] for m, p, a, d in src.get(k, [])]
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
        rep = max(bands, key=lambda k: (bands[k]["n24"], bands[k]["n"], bands[k].get("svn", 0)))   # 대표 평형대 = 최근 2년 매매 최다(동률이면 전체, 그다음 분양권)
        n24 = round(sum(t[4] for t in tr if t[0] >= M[max(0, N - 24)]))
        px[cid] = dict(rep=rep, ym=c.get("ym"), b=bands)
        lp = lead_ppm(tr)
        if n24 >= 8: dong_cx[c["hd"]].append(dict(id=cid, n=c["n"], u=c["u"], y=c["y"], g=c.get("g"), rep=rep, lp=lp, n24=n24))
    out = dict(v=4, enc="d3", src=src_text, asof=today.isoformat(), months=M, bandLabel=BAND_LABEL, city={}, gu={}, dongs={}, px=px,
               lead=dict(area=LEAD_MIN_AREA, floor=lead_floor, direct=("제외" if excl_direct else "포함")), svName=sv_name, nDirect=n_direct)
    cm, cc = idx84(city_tr); out["city"] = dict(mo=cm, mc=cc)
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
    # v1.5.4 연구원(11.4): 시세 흐름 첫 화면 = 구별 주요 단지 12곳 그래프. 손으로 고르지 않음:
    #   ① 이 구 동네별 대장(전용 84㎡ 이상 ㎡당 최근가 1위, 300세대 이상 우선)을 ㎡당 가격 높은 순 → ② 12곳이 안 되면 구 안의 나머지 단지(최근 2년 매매 8건 이상)를
    #   300세대 이상 먼저, ㎡당 가격 높은 순으로 채움. 실거래 지번을 같이 쓰는 단지는 하나만
    sigk = lambda i: frozenset(k for k, _ in KEYS[i] if k[0] != "#")
    for g in out["gu"]:
        L = [d for hd, L2 in dong_cx.items() if CX[L2[0]["id"]]["gu"] == g for d in L2 if d["lp"]]
        hd_of = {d["id"]: CX[d["id"]]["hd"] for d in L}
        lead_ids = {d["id"] for hd, d in leads.items() if CX[d["id"]]["gu"] == g}
        order = sorted([d for d in L if d["id"] in lead_ids], key=lambda d: -d["lp"][0]) + \
                sorted([d for d in L if d["id"] not in lead_ids], key=lambda d: (d["u"] < lead_floor, -d["lp"][0]))
        sel = []
        for d in order:
            if len(sel) >= 12: break
            if all(sigk(d["id"]) != sigk(t["id"]) for t in sel): sel.append(d)
        out["gu"][g]["top"] = [dict(id=d["id"], n=d["n"], u=d["u"], y=d["y"], g=d["g"], hd=hd_of[d["id"]], rep=d["rep"], ppm=d["lp"][0], lead=d["id"] in lead_ids) for d in sel]
    return out, n_all
