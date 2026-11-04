# v1.5.2 시세 흐름 공통 계산(’26.11.4). dash_v15.py(로컬 자료)·dash_auto.py(GitHub Actions, API)가 같이 씀
# 입력: 매매 실거래 행 (umd, jibun, aptNm, 연, 월, 일, 금액(만원), 전용㎡, 해제여부), 분양권 전매 행(같은 모양), 단지 목록 [{id,n,u,y,ym,g,hd,gu,rtk}], 기준일
# 출력(v3): months(자료 첫 달~이번 달, 전체 기간) · city/gu(84㎡대 지수) · dongs(동네: 대장 단지 기준 비싼 순·평균 등급·주요 단지 6곳) · px(모든 단지 평형대별 월 시세, 희소 배열 [달 번호, 중위가, 건수])
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
def build(rows, cxs, today, src_text, silv=None, start=None):
    if start is None: start = min(f"{r[3]}-{r[4]:02d}" for r in rows)
    M = months_from(start, today); MI = {m: i for i, m in enumerate(M)}; N = len(M)
    def bucket(rs):
        B = collections.defaultdict(list); n = 0
        for umd, jb, nm, yy, mo, dd, amt, ar, cancel in rs:
            n += 1
            if cancel or not (30 <= ar <= 250): continue
            key = f"{yy}-{mo:02d}"
            if key in MI: B[rtkey(umd, jb, nm)].append((key, amt, ar, yy * 10000 + mo * 100 + dd))
        return B, n
    BYK, n_all = bucket(rows); SVK, _ = bucket(silv or [])
    CX = {c["id"]: c for c in cxs}
    RTG = collections.defaultdict(list)
    for c in cxs:
        for k in c["rtk"]: RTG[tuple(k)].append(c["id"])
    def series(cid, src):
        tr = []
        for k, ids in RTG.items():
            if cid not in ids: continue
            sh = CX[cid]["u"] / sum(CX[i]["u"] for i in set(ids) if i in CX)
            for m, p, a, d in src.get(k, []): tr.append((m, p, a, d, sh))
        return tr
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
    def sparse(tb):   # [(달 번호, 월 중위가, 월 건수)] 거래 있는 달만
        by = collections.defaultdict(list)
        for t in tb: by[MI[t[0]]].append(t)
        return [[i, _med([t[1] for t in v]), round(sum(t[4] for t in v), 1)] for i, v in sorted(by.items())]
    def bandinfo(tb, sv):   # tb: 매매 [(m, p, a, d, sh)], sv: 분양권
        vm = [(t[0], t[1]) for t in tb]
        p_now = recent(vm) or _med([t[1] for t in sorted(tb, key=lambda t: -t[3])[:3]])
        y1 = [t[1] for t in tb if M[max(0, N - 15)] <= t[0] <= M[max(0, N - 12)]]; p12 = _med(y1) if len(y1) >= 2 else None
        y3 = [t[1] for t in tb if M[max(0, N - 39)] <= t[0] <= M[max(0, N - 36)]]; p36 = _med(y3) if len(y3) >= 2 else None   # 3년 전 같은 분기 중위
        peak = max(t[1] for t in tb); last = max(tb, key=lambda t: t[3])
        d = dict(s=sparse(tb), n=round(sum(t[4] for t in tb)), n24=round(sum(t[4] for t in tb if t[0] >= M[max(0, N - 24)])), p=p_now,
                 c12=(round((p_now / p12 - 1) * 100, 1) if p12 and p_now else None), c36=(round((p_now / p36 - 1) * 100, 1) if p36 and p_now else None),
                 peak=peak, pk=M[MI[max(tb, key=lambda t: t[1])[0]]], vs=(round(p_now / peak * 100) if p_now else None), last=[last[3], last[1], round(last[2], 1)])
        if sv: d["sv"] = sparse(sv); d["svn"] = round(sum(t[4] for t in sv))
        return d
    px = {}; dong_cx = collections.defaultdict(list); dong_g = collections.defaultdict(list); city_tr = []; gu_tr = collections.defaultdict(list); dong_tr = collections.defaultdict(list)
    for cid, c in CX.items():
        if c.get("g"): dong_g[c["hd"]].append(c["g"])
        tr = series(cid, BYK); sv = series(cid, SVK)
        if not tr and not sv: continue
        city_tr += tr; gu_tr[c["gu"]] += tr; dong_tr[c["hd"]] += tr
        byb = collections.defaultdict(list); bys = collections.defaultdict(list)
        for t in tr: byb[band(t[2])].append(t)
        for t in sv: bys[band(t[2])].append(t)
        bands = {k: bandinfo(v, bys.get(k)) for k, v in byb.items() if len(v) >= 3}
        if not bands: continue
        rep = max(bands, key=lambda k: bands[k]["n24"] * 1000 + bands[k]["n"])   # 대표 평형대 = 최근 2년 거래 최다(동률이면 전체)
        n24 = round(sum(t[4] for t in tr if t[0] >= M[max(0, N - 24)]))
        px[cid] = dict(rep=rep, ym=c.get("ym"), b=bands)
        if n24 >= 8 and bands[rep]["p"]:
            dong_cx[c["hd"]].append(dict(id=cid, n=c["n"], u=c["u"], y=c["y"], g=c.get("g"), rep=rep, ppm=bands[rep]["p"] / float(rep if rep != "160" else 165), n24=n24))
    out = dict(v=3, src=src_text, asof=today.isoformat(), months=M, bandLabel=BAND_LABEL, city={}, gu={}, dongs={}, px=px)
    cm, cc = idx84(city_tr); out["city"] = dict(mo=cm, mc=cc)
    for g, trs in gu_tr.items():
        gm, gc = idx84(trs); out["gu"][g] = dict(mo=gm, mc=gc, p=recent([(m, p / a * 84.9) for m, p, a, _, _ in trs if 76 <= a <= 95], need=5, back=(6, 12)))
    for hd, L in dong_cx.items():
        if len(L) < 2: continue
        L.sort(key=lambda d: -d["ppm"]); top = [L[0]]   # 대장 = ㎡당 최근가 1위
        for d in sorted(L, key=lambda d: -d["u"]):
            if d not in top and len(top) < 6: top.append(d)
        dm, dc = idx84(dong_tr[hd]); trs = dong_tr[hd]
        c36 = [px[d["id"]]["b"][d["rep"]]["c36"] for d in top if px[d["id"]]["b"][d["rep"]]["c36"] is not None]
        c12 = [px[d["id"]]["b"][d["rep"]]["c12"] for d in top if px[d["id"]]["b"][d["rep"]]["c12"] is not None]
        gs = dong_g.get(hd) or []
        out["dongs"][hd] = dict(gu=CX[L[0]["id"]]["gu"], n=len(L), n24=round(sum(s for m, _, _, _, s in trs if m >= M[max(0, N - 24)])),
                                p=round(L[0]["ppm"] * 84.9), top=L[0]["n"], topRep=L[0]["rep"], topP=px[L[0]["id"]]["b"][L[0]["rep"]]["p"],   # 연구원(11.4): 동네 순위는 대장 아파트 가격 순. p = 대장 ㎡당 최근가 × 84.9(84㎡ 환산), topP = 대장 대표 평형 실제 최근가
                                gavg=(round(statistics.mean(gs), 1) if gs else None), mo=dm, mc=dc,
                                c36=(round(statistics.median(c36), 1) if len(c36) >= 3 else None), c12=(round(statistics.median(c12), 1) if len(c12) >= 3 else None),
                                cx=[dict(id=d["id"], n=d["n"], u=d["u"], y=d["y"], g=d["g"], rep=d["rep"], n24=d["n24"]) for d in top])
    return out, n_all
