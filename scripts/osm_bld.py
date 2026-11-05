# v1.7.2 OSM 아파트 동(건물) 위치 받기(’26.11.5) — 단지 상세 '동' 버튼이 지도에 그 면적이 있는 동을 진하게 표시할 때 씀(화면 자료는 빌드 때 만듦)
# 자료: OpenStreetMap contributors(ODbL) via Overpass API. 광주광역시 범위 건물 중 이름이 '101동·제101동·1동·A동·가동' 꼴인 것
# 출력: <폴더>/bld_osm.json.gz = {asof, src, bbox, n, b:[[OSM id, 이름, 건물 종류, [[위도, 경도], …]], …]}
# 30일 안에 받은 파일이 있으면 건너뜀(인자 force면 다시 받음). 오류는 알리기만 함 — dash_auto.py 끝에서 부르므로 시세 갱신에는 영향 없음
import sys, json, gzip, time, datetime as dt, urllib.request, urllib.parse, pathlib
OUT = pathlib.Path(sys.argv[1]) / "bld_osm.json.gz"
FORCE = len(sys.argv) > 2 and sys.argv[2] == "force"
BBOX = (35.03, 126.64, 35.27, 127.03)   # 광주광역시 전체(남, 서, 북, 동)
NAME = "^(제)?[0-9]{1,4}동$|^[A-Z]동$|^(가|나|다|라|마|바|사|아|자|차|카|타|파|하)동$"   # 한글은 문자 집합 대신 |로(정규식 엔진이 바이트 단위일 때 대비)
Q = f'[out:json][timeout:300];way["building"]["name"~"{NAME}"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});out geom;'
MIRRORS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter",
           "https://overpass.private.coffee/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"]

def main():
    if OUT.exists() and not FORCE:
        try:
            with gzip.open(OUT, "rt", encoding="utf-8") as f: asof = json.load(f).get("asof", "")
            if asof and (dt.date.today() - dt.date.fromisoformat(asof)).days < 30:
                print("bld_osm 최신(" + asof + ") — 건너뜀"); return
        except Exception as e: print("bld_osm 기존 파일 읽기 실패:", e)
    body = urllib.parse.urlencode({"data": Q}).encode()
    for url in MIRRORS:
        try:
            req = urllib.request.Request(url, data=body, headers={"User-Agent": "ipji-lab dash-update (https://github.com/ipji-lab)"})
            with urllib.request.urlopen(req, timeout=330) as r: j = json.load(r)
            els = [e for e in j.get("elements", []) if e.get("type") == "way" and e.get("geometry")]
            if len(els) < 100: print("bld_osm 결과가 너무 적음:", url, len(els)); continue
            b = [[e["id"], e.get("tags", {}).get("name", ""), e.get("tags", {}).get("building", ""),
                  [[round(p["lat"], 6), round(p["lon"], 6)] for p in e["geometry"]]] for e in els]
            with gzip.open(OUT, "wt", encoding="utf-8") as f:
                f.write(json.dumps(dict(asof=dt.date.today().isoformat(), src="OpenStreetMap contributors(ODbL) via Overpass API",
                                        bbox=BBOX, n=len(b), b=b), ensure_ascii=False, separators=(",", ":")))
            print("bld_osm", len(b), "동 ·", url); return
        except Exception as e:
            print("bld_osm 실패:", url, e); time.sleep(5)
    print("bld_osm 모든 서버 실패 — 다음 실행 때 다시 받음")

if __name__ == "__main__":
    try: main()
    except Exception as e: print("bld_osm 오류:", e)
