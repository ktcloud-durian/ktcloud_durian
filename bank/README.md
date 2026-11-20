# 두리안뱅크 (시연용 가상 은행)

"데이터는 안에, 서비스는 밖에"를 보여 주는 웹 서비스. 모든 고객 정보는 가짜.

```
고객 브라우저 ──HTTPS(ALB 443)──▶ web (AWS)  ──서비스 토큰 + Tailscale──▶ core-api (온프렘) ──▶ MariaDB (온프렘)
                                 화면·로그인·토큰                         고객 DB 조회·이체·감사 기록
                                 DB에 직접 접근 안 함                     web만 호출 가능
```

## 폴더
| 경로 | 내용 |
|---|---|
| `frontend` | 고객 화면 (React + Vite, Figma Make 디자인). 메인·로그인·거래내역조회·이체·접근 거부·공지 |
| `services/web` | 고객용 웹 서버 (Express). 화면 제공, 로그인, JWT 발급, 본인 계좌 확인 |
| `services/core-api` | 내부 API (Express + MariaDB). 고객·계좌·거래, 로그인 5회 실패 잠금, 감사 기록 |
| `db/init` | 테이블 만들기, 앱 전용 최소 권한 계정 |
| `docker-compose.yml` | 노트북에서 셋 다 실행 (web은 DB 네트워크에 못 닿게 분리) |

## 노트북에서 실행
```bash
cp .env.example .env
# .env 의 change-me 값을 전부 바꾸기 (openssl rand -base64 48 로 만들면 됨)
docker compose up -d --build
docker compose ps          # 3개 모두 running / healthy
```
http://localhost:8080 → 아이디 `kimfake` / 비밀번호는 `.env`의 `DEMO_PASSWORD`
(가짜 고객: kimfake 김가짜, leeexample 이예시, parktest 박테스트)

유출 안내 띠·공지를 켜려면 `.env`에 `SHOW_BREACH_BANNER=true` → `docker compose up -d web`

## 화면만 고칠 때 (빠른 개발)
```bash
docker compose up -d                 # 백엔드는 그대로 띄워 두고
cd frontend && pnpm install && pnpm dev   # http://localhost:5173 (저장하면 바로 반영, /api는 8080으로 넘어감)
```
화면 주소: `#main` `#login` `#transactions` `#transfer` `#notice` `#denied/401` `#denied/403`
`#transactions/101-2034-6789` 처럼 남의 계좌번호를 주소에 넣고 [조회] → 서버가 403으로 막고 접근 거부(AUTH-403) 화면

## 화면 ↔ API
| 화면 | 하는 일 |
|---|---|
| 메인 | `/api/config`로 유출 안내 띠·사고 공지 표시 여부 결정, 푸터에 응답 서버 표시 |
| 로그인 | `/api/login`. 틀리면 안내 문구, 5회 실패 잠금(423)·시도 제한(429) 문구 |
| 상단 | 로그인 상태·자동로그아웃 남은 시간(10분), [연장] `/api/session/extend`, 0이 되면 자동 로그아웃 |
| 거래내역조회 | `/api/me` + `/api/accounts/:no/transactions` 기간(오늘·1주일·1개월·3개월·직접)·입금/출금, 10건씩 페이지, 인쇄, 엑셀(CSV) 저장 |
| 이체 | 입력 → 확인 → `/api/transfer` → 완료(출금 후 잔액). 형식·한도는 화면과 서버 양쪽에서 확인 |
| 접근 거부 | 401(로그인 없음·위조 토큰) → AUTH-401, 403(남의 계좌) → AUTH-403 |

## API (web)
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/config` | 유출 안내 띠 표시 여부, 응답 서버 이름 |
| POST | `/api/login` | `{username,password}` → httpOnly 쿠키. 실패 401, 5회 실패 잠금 423, IP당 1분 10회 제한 429 |
| POST | `/api/logout` | 쿠키 삭제 |
| GET | `/api/me` | 이름, 전화번호(가림), 계좌 목록, 자동로그아웃 시각 |
| POST | `/api/session/extend` | 로그인 연장 (유효한 토큰일 때만 새 토큰) |
| GET | `/api/accounts/:no/transactions?from=&to=&type=` | 거래내역. **본인 계좌가 아니면 403** |
| POST | `/api/transfer` | `{fromAccount,toAccount,amount,memo}` 이체 |

## 보안 설계 (보안 기준서 대응)
| 항목 | 구현 | 기준 |
|---|---|---|
| 비밀값 | 서명키·DB 비밀번호·서비스 토큰은 전부 환경 변수(Secret). 짧으면 실행 거부 | SEC-01 |
| 비밀번호 | bcrypt 해시. 없는 아이디도 같은 시간 들여 비교 (아이디 존재 여부 숨김) | IAM-03 |
| 로그인 | 5회 실패 15분 잠금(DB), IP당 1분 10회 제한 | IAM-03 |
| 토큰 | HS256 고정(alg 바꿔치기 방지), 발급자·대상·10분 만료 확인, httpOnly·SameSite=Strict 쿠키 | SEC-01 |
| 권한 | 토큰 주인 계좌만 조회·이체 (web·core-api 양쪽에서 확인) | 쿠팡 사례 |
| SQL | 전부 파라미터 바인딩, 입력 형식 검사 | Semgrep 기준 |
| DB 계정 | 앱 계정은 필요한 테이블·권한만 (DROP·ALTER·GRANT 없음), k3s 저장소와 계정 분리 | IAM-04, DAT-04 |
| 네트워크 | web은 DB에 직접 못 닿음. core-api는 서비스 토큰 + Tailscale ACL로만 | DAT-04, NET-06 |
| 기록 | 로그인·조회·이체 감사 기록(audit_log), JSON 로그에 비밀번호·토큰 없음 | LOG-03 |
| 응답 | 보안 헤더(CSP: 스크립트·글꼴·요청 모두 자기 서버만), 오류 내용 숨김, 전화번호 가림 | DAT-03 |
| 화면 | 토큰을 자바스크립트에 두지 않음(httpOnly), 외부 CDN·폰트 없음(글꼴도 직접 포함), 엑셀 저장 시 수식 실행 방지, 소스맵 미포함 | DAT-03 |
| 이미지 | 3단계 빌드(화면 → 서버 패키지 → 실행), 실행 이미지에 npm·pnpm 없음, root 아님, 읽기 전용 파일시스템 | SRV-03·04 |

## 테스트
```bash
cd services/web && npm ci && npm test        # 10개 (위조 토큰, alg:none, 남의 계좌 403, 세션 연장 등)
cd frontend && pnpm install && pnpm build    # 타입 검사 + 빌드
cd services/core-api && npm ci && npm test   # 6개 (서비스 토큰, 5회 잠금, 감사 기록 등)
```
실제 MariaDB로도 확인함: 로그인·본인 계좌·남의 계좌 403·위조 토큰 401·이체·잔액 초과·SQL 인젝션 아이디·감사 기록
브라우저(Playwright)로도 확인함: 메인 띠·로그인 실패 문구·거래내역·기간/입금 필터·남의 계좌 AUTH-403·이체(확인→완료·한도·잔액 부족)·연장·로그아웃·자동로그아웃, CSP 위반 0건

이미지 빌드는 저장소 루트에서: `docker build -f services/web/Dockerfile .` (core-api는 `docker build services/core-api`)
