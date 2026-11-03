# 2026-11 에셋 손질 기록 (검수 뒤 수리)

`src/assets/local` 의 그림 중 이번에 다시 손본 것을 만든 스크립트들. 작업용 임시 폴더(`R = .../assetqa/repair/`)에
예전 그림(`bak/`)과 녹화 프레임을 두고 돌렸으므로 **그대로는 안 돌아감** — 방법을 남겨 두는 기록.
녹화·스크린샷은 저장소에 없음(개인정보). 다시 만들 땐 같은 방식으로 경로만 바꿔서.

| 스크립트 | 만든 것 |
|---|---|
| `logo_vec.py` · `logo_mono.py` · `logo_ibk.py` · `logo_build.py` (+ `logo-render.cjs`) | 공용 은행 원 로고 `bank-ibk/ibksec/shinhyup/post/shinyoung/bnp` — 고해상 참고 그림의 모양을 potrace 로 따서 카카오 은행선택 스크린샷의 그림 자리에 닮음 변환으로 맞추고, 흰 그림(IBK 는 흰 테·하늘·남색·빨간 세모)을 크롬으로 그려 깨끗한 원 위에 얹음 |
| `flat_smooth.py` | `friends.png`: 색 묶음 지도를 4배로 키워 묶음마다 흐리게 → 다수결로 윤곽만 매끈하게 |
| `hbfix.py` · `smooth_alpha.py` | 하나 배너 5(스크린샷 잉크로 윤곽을 새로 따고 흰 테 없앰) · 배너 4·9(알파 윤곽만 매끈하게) |
| `hlogo.py` · `hana_install.py` · `hana_nudge.py` | 하나 저축은행·DAOL·LS(해석적 원) · 대신·부국(흰 테 걷기) · BNP(구멍 메우기), 잉크 상자로 잘라 `src/hana/art.ts` 자리 고침, 화면에서 잰 만큼 x·y 옮김 |
| `plate_shift.py` · `nh_teal.py` | 콕뱅크 판 그림: 판은 두고 안쪽 그림만 옮김 + 남은 검은 점 메움 · 별 배지 밖 청록 점 지움 |
| `nh_msg.py` · `nh_msg2.py` · `nh_card.py` | 콕뱅크 완료 '메시지' 타일: 판 한 색 + 카톡·문자 말풍선(맞춘 타원 + 꼬리)·글자·점을 벡터로, 메시지카드는 노란 번짐 지움 |
| `nh_tabs.py` | 콕뱅크 홈 탭 마스크 5개 → 매끈한 SVG (`nh-gh-tab-*.svg`) |
| `nh_logos.py` · `nh_samsung.py` · `nh_slogan.py` · `nh_coin2.py` | 콕뱅크 은행 타일 로고(KB·IBK·CAPE·우체국 벡터, 삼성증권 글자 다시 쓰기) · 시작화면 문구 다시 쓰기 · 송금 동전 테 정리 |
| `tighten.py` · `kb_cards.py` · `kb_install.py` · `svgclean.py` | 케이뱅크: 번진 누끼를 1기기px 안팎으로 조이고 테두리 색 정리 · 히든카드는 기울어진 둥근 네모로 다시 자름 · 잘라서 CSS 상자 고침 · potrace 부스러기 지움 |
| `svgtool.py` · `svg-render.cjs` · `view.py` | 공용: 마스크 → path, SVG 를 크롬에서 4배로 그려 줄임, 바탕별 확인판 |

예전 자르기 스크립트(`scripts/*-crops/*.py`, `extract-*.py`, `extract-assets.sh`)는 이제 **이미 있는 파일을 건너뜀**
(`scripts/keep_assets.py`). 다시 돌려도 손본 그림을 덮지 않음 — 정말 덮어쓰려면 `--force`(셸 스크립트는 `FORCE=1`).
