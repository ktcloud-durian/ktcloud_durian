import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  api,
  fmtDateTime,
  kstDate,
  messageOf,
  statusOf,
  won,
  type AppConfig,
  type Me,
  type TxResult,
  type TxType,
} from "./api";

type Page = "main" | "login" | "transactions" | "transfer" | "denied" | "notice";
const PAGES: Page[] = ["main", "login", "transactions", "transfer", "denied", "notice"];

const assets = "/assets";

// 주소 형식: #page 또는 #page/값 (예: #transactions/101-2034-5678, #denied/403, #login/transfer)
function usePage() {
  const read = (): { page: Page; arg: string } => {
    const [p, ...rest] = window.location.hash.slice(1).split("/");
    const page = PAGES.includes(p as Page) ? (p as Page) : "main";
    return { page, arg: decodeURIComponent(rest.join("/")) };
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const sync = () => setRoute(read());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const go = useCallback((next: Page, arg?: string) => {
    window.location.hash = arg ? `${next}/${encodeURIComponent(arg)}` : next;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  return { ...route, go };
}

type Go = (page: Page, arg?: string) => void;

type Session = {
  me: Me | null;
  ready: boolean; // 첫 로그인 상태 확인이 끝났는지
  config: AppConfig;
  remaining: number; // 자동로그아웃까지 남은 초
  refresh: () => Promise<Me | null>;
  logout: () => Promise<void>;
  extend: () => Promise<void>;
};

function useSession(go: Go): Session {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState<AppConfig>({ showBreachBanner: false, servedFrom: "" });
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(async () => {
    try {
      const m = await api.me();
      setMe(m);
      return m;
    } catch {
      setMe(null);
      return null;
    } finally {
      setReady(true);
    }
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setMe(null);
  }, []);

  const extend = useCallback(async () => {
    try {
      const r = await api.extend();
      setMe((m) => (m ? { ...m, sessionExpiresAt: r.sessionExpiresAt } : m));
    } catch {
      setMe(null);
      go("login");
    }
  }, [go]);

  useEffect(() => {
    api.config().then(setConfig).catch(() => undefined);
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!me) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [me]);

  const remaining = me ? Math.max(0, Math.floor((me.sessionExpiresAt - now) / 1000)) : 0;

  // 시간이 다 되면 자동 로그아웃
  useEffect(() => {
    if (me && remaining === 0) {
      go("login", "expired");
      logout();
    }
  }, [me, remaining, logout, go]);

  return { me, ready, config, remaining, refresh, logout, extend };
}

type Ctx = { go: Go; s: Session };

const mmss = (sec: number) =>
  `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

function Header({ go, s }: Ctx) {
  const onLogout = async () => {
    go("main"); // 먼저 메인으로 옮기고 로그아웃 (로그인 필요 화면이 '접근 거부'로 튀지 않게)
    await s.logout();
  };
  return (
    <header className="site-header">
      <div className="utility">
        <div className="shell utility-inner">
          <span>개인&nbsp; | &nbsp;기업&nbsp; | &nbsp;자산관리</span>
          {s.me ? (
            <span className="logged-in">
              {s.me.name}님&nbsp; |{" "}
              <button type="button" className="text-link" onClick={onLogout}>
                로그아웃
              </button>
              &nbsp;| &nbsp;자동로그아웃 {mmss(s.remaining)}
              <button type="button" onClick={s.extend}>
                연장
              </button>
            </span>
          ) : (
            <span>
              <button type="button" className="text-link" onClick={() => go("login")}>
                로그인
              </button>
              &nbsp; | &nbsp;회원가입&nbsp; | &nbsp;인증센터&nbsp; | &nbsp;고객센터&nbsp; |
              &nbsp;글자크기&nbsp; 가&nbsp; 가
            </span>
          )}
        </div>
      </div>
      <div className="shell nav-row">
        <button className="brand" onClick={() => go("main")} aria-label="두리안 은행 메인">
          <img src={`${assets}/3bee0.svg`} alt="" />
          <strong>두리안 은행</strong>
        </button>
        <nav>
          <button onClick={() => go("transactions")}>조회</button>
          <button onClick={() => go("transfer")}>이체</button>
          <button>공과금</button>
          <button>금융상품</button>
          <button>외환</button>
          <button>뱅킹관리</button>
        </nav>
        <div className="nav-icons">
          <button aria-label="검색">
            <img src={`${assets}/16aa7.svg`} alt="" />
          </button>
          <button aria-label="전체 메뉴">
            <img src={`${assets}/88822.svg`} alt="" />
          </button>
        </div>
      </div>
    </header>
  );
}

function Footer({ servedFrom }: { servedFrom: string }) {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <div className="footer-copy">
          <div className="footer-rule" />
          <p>
            <b>개인정보처리방침</b>
            <i>|</i>이용약관<i>|</i>전자금융거래 이용약관<i>|</i>보호금융상품 안내<i>|</i>사이트맵
          </p>
          <p>
            (가상) 서울특별시 두리안구 은행로 100&nbsp; | &nbsp;고객센터 1588-0000&nbsp; (평일
            09:00~18:00)
          </p>
          <p className="copyright">
            Copyright 두리안은행. All rights reserved.{" "}
            <span>가상의 은행 서비스 · 모든 정보는 예시입니다.</span>
          </p>
          {servedFrom && <p className="served-from">응답 서버: {servedFrom}</p>}
        </div>
        <div className="call-center">
          <b>고객센터</b>
          <strong>1588-0000</strong>
        </div>
      </div>
    </footer>
  );
}

function QuickMenu({ go, main = false }: { go: Go; main?: boolean }) {
  return (
    <aside className={`quick-menu${main ? " quick-menu-main" : ""}`}>
      <button onClick={() => go("transactions")}>계좌조회</button>
      <button onClick={() => go("transfer")}>이체</button>
      <button>
        최근 본<br />
        메뉴
      </button>
      <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>맨 위로</button>
    </aside>
  );
}

function PageTitle({ crumb, children }: { crumb: string; children: ReactNode }) {
  return (
    <>
      <p className="crumb">{crumb}</p>
      <div className="page-title">
        <h1>{children}</h1>
      </div>
    </>
  );
}

function Layout({ children, ctx, quick = true }: { children: ReactNode; ctx: Ctx; quick?: boolean }) {
  return (
    <div className="page">
      <Header {...ctx} />
      {children}
      {quick && <QuickMenu go={ctx.go} />}
      <Footer servedFrom={ctx.s.config.servedFrom} />
    </div>
  );
}

// 로그인이 필요한 화면: 확인 중이면 빈 화면, 로그인 안 됐으면 접근 거부(AUTH-401)
function useRequireLogin({ go, s }: Ctx) {
  useEffect(() => {
    if (s.ready && !s.me) go("denied", "401");
  }, [s.ready, s.me, go]);
  return s.ready && s.me ? s.me : null;
}

function LoginPage({ ctx, arg }: { ctx: Ctx; arg: string }) {
  const { go, s } = ctx;
  const [tab, setTab] = useState<"id" | "certificate">("id");
  const [secure, setSecure] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(arg === "expired" ? "자동로그아웃되었습니다. 다시 로그인해 주세요." : "");
  const [busy, setBusy] = useState(false);
  const next: Page = PAGES.includes(arg as Page) && arg !== "login" ? (arg as Page) : "transactions";

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!username || !password) {
      setError("아이디와 비밀번호를 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.login(username, password);
      setPassword("");
      await s.refresh();
      go(next);
    } catch (e) {
      const st = statusOf(e);
      setPassword("");
      setError(
        st === 429
          ? "로그인 시도가 너무 많습니다. 1분 후 다시 시도해 주세요."
          : messageOf(e, "로그인할 수 없습니다. 잠시 후 다시 시도해 주세요."),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout ctx={ctx}>
      <main className="shell standard-main login-page">
        <PageTitle crumb="홈  >  로그인">로그인</PageTitle>
        <div className="login-tabs">
          <button className={tab === "id" ? "active" : ""} onClick={() => setTab("id")}>
            아이디 로그인
          </button>
          <button
            className={tab === "certificate" ? "active" : ""}
            onClick={() => setTab("certificate")}
          >
            인증서 로그인
          </button>
        </div>
        <div className="login-grid">
          {tab === "id" ? (
            <form className="login-form" onSubmit={onSubmit} noValidate>
              <label>
                <b>아이디</b>
                <span>
                  <input
                    aria-label="아이디"
                    placeholder="아이디 입력"
                    autoComplete="username"
                    maxLength={30}
                    value={username}
                    onChange={(e) => setUsername(e.target.value.trim())}
                  />
                </span>
              </label>
              <label>
                <b>비밀번호</b>
                <span className="password-wrap">
                  <input
                    aria-label="비밀번호"
                    type="password"
                    placeholder="비밀번호 입력"
                    autoComplete="current-password"
                    maxLength={64}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <em>
                    <input
                      type="checkbox"
                      checked={secure}
                      onChange={(e) => setSecure(e.target.checked)}
                    />
                    보안키패드
                  </em>
                </span>
              </label>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button className="primary login-submit" disabled={busy}>
                {busy ? "확인 중…" : "로그인"}
              </button>
              <p className="account-links">
                아이디 찾기&nbsp;&nbsp; | &nbsp;&nbsp;비밀번호 재설정&nbsp;&nbsp; |
                &nbsp;&nbsp;회원가입
              </p>
            </form>
          ) : (
            <div className="certificate-panel">
              <p>안전한 금융거래를 위해 인증서를 선택해 주세요.</p>
              <button className="primary" onClick={() => setTab("id")}>
                인증서 로그인
              </button>
              <p className="form-note">※ 시연 환경에서는 아이디 로그인만 지원합니다.</p>
            </div>
          )}
          <section className="login-notice">
            <h2>로그인 유의사항</h2>
            <p>•&nbsp; 로그인 5회 연속 실패 시 이용이 제한됩니다.</p>
            <p>•&nbsp; 공용 PC 사용 후 반드시 로그아웃해 주세요.</p>
            <p>•&nbsp; 은행은 전화·문자로 비밀번호를 묻지 않습니다.</p>
            <p>•&nbsp; 안전한 금융거래를 위한 보안프로그램 설치 안내</p>
          </section>
        </div>
        <div className="fraud-note">
          <b>금융사기 예방 안내</b>
          <span>
            검찰·금감원·은행을 사칭한 송금 요구에 주의하세요. 의심되는 전화는 끊고 직접 확인해
            주세요.
          </span>
        </div>
      </main>
    </Layout>
  );
}

const PERIODS: [string, number][] = [
  ["오늘", 0],
  ["1주일", 7],
  ["1개월", 30],
  ["3개월", 90],
];
const TYPES: [string, TxType][] = [
  ["전체", "all"],
  ["입금", "deposit"],
  ["출금", "withdraw"],
];
const PAGE_SIZE = 10;

function SideNav({ active, go }: { active: "transactions" | "transfer"; go: Go }) {
  return (
    <aside className="side-nav">
      <h2>{active === "transfer" ? "이체" : "조회"}</h2>
      {active === "transfer" ? (
        <>
          <button className="active">
            계좌이체 <b>›</b>
          </button>
          <button onClick={() => go("transactions")}>거래내역조회</button>
        </>
      ) : (
        <>
          <button>전체계좌조회</button>
          <button className="active">
            거래내역조회 <b>›</b>
          </button>
          <button>해지계좌조회</button>
        </>
      )}
    </aside>
  );
}

function downloadCsv(result: TxResult) {
  const head = ["거래일시", "적요", "기재내용", "출금(원)", "입금(원)", "잔액(원)", "거래점"];
  // 엑셀 수식 실행 방지: =,+,-,@ 로 시작하는 값 앞에 ' 붙이기
  const cell = (v: string | number) => {
    const s = String(v);
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const rows = result.items.map((t) =>
    [fmtDateTime(t.occurredAt), t.summary, t.memo, t.withdraw, t.deposit, t.balanceAfter, t.branch]
      .map(cell)
      .join(","),
  );
  const blob = new Blob(["﻿" + [head.map(cell).join(","), ...rows].join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `거래내역_${result.account.accountNo}_${kstDate()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function TransactionsPage({ ctx, arg }: { ctx: Ctx; arg: string }) {
  const { go } = ctx;
  const me = useRequireLogin(ctx);
  const [accountNo, setAccountNo] = useState(arg);
  const [period, setPeriod] = useState("1개월");
  const [from, setFrom] = useState(kstDate(30));
  const [to, setTo] = useState(kstDate());
  const [type, setType] = useState<TxType>("all");
  const [result, setResult] = useState<TxResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  // 주소에 계좌가 없으면 내 첫 번째 계좌
  const selected = accountNo || me?.accounts[0]?.accountNo || "";
  // 주소로 넘어온 계좌가 내 계좌 목록에 없어도 선택지에 넣음 → 조회하면 서버가 403으로 막는 걸 보여줄 수 있음
  const options = me
    ? [
        ...me.accounts,
        ...(arg && !me.accounts.some((a) => a.accountNo === arg)
          ? [{ accountNo: arg, product: "다른 계좌", balance: 0 }]
          : []),
      ]
    : [];

  const search = useCallback(
    async (q: { accountNo: string; from: string; to: string; type: TxType }) => {
      if (!q.accountNo) return;
      setLoading(true);
      setError("");
      try {
        setResult(await api.transactions(q.accountNo, { from: q.from, to: q.to, type: q.type }));
        setPage(1);
      } catch (e) {
        const st = statusOf(e);
        if (st === 401 || st === 403) {
          go("denied", String(st));
          return;
        }
        setResult(null);
        setError(st === 400 ? "조회 조건을 확인해 주세요." : messageOf(e));
      } finally {
        setLoading(false);
      }
    },
    [go],
  );

  // 처음 들어오면 기본 조건(1개월·전체)으로 한 번 조회
  useEffect(() => {
    if (me && selected) search({ accountNo: selected, from, to, type });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.accounts[0]?.accountNo]);

  if (!me) return <Layout ctx={ctx}>{null}</Layout>;

  const items = result?.items ?? [];
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const shown = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Layout ctx={ctx}>
      <main className="shell transaction-layout">
        <SideNav active="transactions" go={go} />
        <section className="transaction-content">
          <PageTitle crumb="홈  >  조회  >  거래내역조회">거래내역조회</PageTitle>
          <div className="search-box">
            <div className="search-fields">
              <label>
                <b>출금계좌번호</b>
                <span>
                  <select
                    aria-label="출금계좌번호"
                    value={selected}
                    onChange={(e) => setAccountNo(e.target.value)}
                  >
                    {options.map((a) => (
                      <option key={a.accountNo} value={a.accountNo}>
                        {a.product} {a.accountNo}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <div className="field-row period-row">
                <b>조회기간</b>
                <span>
                  <span className="period-buttons">
                    {PERIODS.map(([label, days]) => (
                      <button
                        type="button"
                        key={label}
                        className={period === label ? "active" : ""}
                        onClick={() => {
                          setPeriod(label);
                          setFrom(kstDate(days));
                          setTo(kstDate());
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </span>
                  <span className="dates">
                    <input
                      type="date"
                      aria-label="시작일"
                      value={from}
                      max={to}
                      onChange={(e) => {
                        setFrom(e.target.value);
                        setPeriod("");
                      }}
                    />{" "}
                    ~{" "}
                    <input
                      type="date"
                      aria-label="종료일"
                      value={to}
                      min={from}
                      max={kstDate()}
                      onChange={(e) => {
                        setTo(e.target.value);
                        setPeriod("");
                      }}
                    />
                  </span>
                </span>
              </div>
              <div className="field-row">
                <b>거래구분</b>
                <span className="radio-row">
                  {TYPES.map(([label, value]) => {
                    const on = type === value;
                    return (
                      <button
                        type="button"
                        key={value}
                        className="radio-option"
                        onClick={() => setType(value)}
                        aria-pressed={on}
                      >
                        <span className="radio-icon">
                          <img src={`${assets}/${on ? "87ffc.svg" : "01ef0.svg"}`} alt="" />
                          {on && <img className="radio-dot" src={`${assets}/d3a7d.svg`} alt="" />}
                        </span>
                        {label}
                      </button>
                    );
                  })}
                </span>
              </div>
            </div>
            <button
              className="primary search-submit"
              disabled={loading}
              onClick={() => search({ accountNo: selected, from, to, type })}
            >
              {loading ? "조회 중" : "조회"}
            </button>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {result && (
            <>
              <div className="account-summary">
                <span>
                  계좌번호 <b>{result.account.accountNo}</b>
                </span>
                <span>
                  예금주 <b>{result.account.holder}</b>
                </span>
                <span>
                  연락처 <b>{me.phone}</b>
                </span>
                <span>
                  잔액 <strong>{result.account.balance.toLocaleString("ko-KR")}원</strong>
                </span>
              </div>
              <div className="table-meta">
                <b>조회내역&nbsp; 총 {items.length}건</b>
                <span>단위: 원&nbsp; | &nbsp;최근 거래 순</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      {["거래일시", "적요", "기재내용", "출금(원)", "입금(원)", "잔액(원)", "거래점"].map(
                        (head) => (
                          <th key={head}>{head}</th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="empty-row">
                          조회 기간에 거래내역이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      shown.map((t, i) => (
                        <tr key={`${t.occurredAt}-${i}`}>
                          <td>{fmtDateTime(t.occurredAt)}</td>
                          <td>{t.summary}</td>
                          <td>{t.memo}</td>
                          <td>{won(t.withdraw)}</td>
                          <td className={t.deposit ? "deposit" : ""}>{won(t.deposit)}</td>
                          <td className="balance">{t.balanceAfter.toLocaleString("ko-KR")}</td>
                          <td>{t.branch}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="table-actions">
                <span>
                  {items.length ? `${(page - 1) * PAGE_SIZE + 1}–${(page - 1) * PAGE_SIZE + shown.length}` : 0} /{" "}
                  {items.length}건
                </span>
                <div>
                  <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                    ‹
                  </button>
                  {Array.from({ length: pages }, (_, i) => (
                    <button
                      key={i}
                      className={page === i + 1 ? "selected" : ""}
                      onClick={() => setPage(i + 1)}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button disabled={page === pages} onClick={() => setPage(page + 1)}>
                    ›
                  </button>
                </div>
                <span>
                  <button onClick={() => window.print()}>인쇄</button>
                  <button onClick={() => downloadCsv(result)}>엑셀저장</button>
                </span>
              </div>
            </>
          )}
          <div className="caution">
            <b>유의사항</b>
            <p>
              •&nbsp; 조회 결과는 거래 확인용이며, 증명서로 사용할 수 없습니다.
              <br />
              •&nbsp; 거래내역에 문의사항이 있으시면 고객센터 1588-0000으로 연락해 주세요.
            </p>
          </div>
        </section>
      </main>
    </Layout>
  );
}

const ACCOUNT_RE = /^\d{3}-\d{4}-\d{4}$/;

function TransferPage({ ctx }: { ctx: Ctx }) {
  const { go, s } = ctx;
  const me = useRequireLogin(ctx);
  const [fromAccount, setFromAccount] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [step, setStep] = useState<"input" | "confirm" | "done">("input");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState(0);

  if (!me) return <Layout ctx={ctx}>{null}</Layout>;

  const from = fromAccount || me.accounts[0]?.accountNo || "";
  const amt = Number(amount.replace(/,/g, ""));

  const check = () => {
    if (!ACCOUNT_RE.test(toAccount)) return "받는 계좌번호를 000-0000-0000 형식으로 입력해 주세요.";
    if (toAccount === from) return "같은 계좌로는 이체할 수 없습니다.";
    if (!Number.isInteger(amt) || amt <= 0) return "이체 금액을 입력해 주세요.";
    if (amt > 10_000_000) return "1회 이체 한도는 10,000,000원입니다.";
    if (memo.length > 20) return "받는 분 통장 표시는 20자까지 입력할 수 있습니다.";
    return "";
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await api.transfer(from, toAccount, amt, memo || undefined);
      setBalance(r.balance);
      setStep("done");
      s.refresh();
    } catch (e) {
      const st = statusOf(e);
      if (st === 401) {
        go("denied", "401");
        return;
      }
      setError(messageOf(e));
      setStep("input");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setToAccount("");
    setAmount("");
    setMemo("");
    setStep("input");
  };

  return (
    <Layout ctx={ctx}>
      <main className="shell transaction-layout">
        <SideNav active="transfer" go={go} />
        <section className="transaction-content">
          <PageTitle crumb="홈  >  이체  >  계좌이체">계좌이체</PageTitle>
          {step === "done" ? (
            <div className="result-box">
              <h2>이체가 완료되었습니다.</h2>
              <p>
                {toAccount} 계좌로 <b>{amt.toLocaleString("ko-KR")}원</b>을 보냈습니다.
              </p>
              <p>
                출금 후 잔액 <strong>{balance.toLocaleString("ko-KR")}원</strong>
              </p>
              <div>
                <button className="primary" onClick={reset}>
                  추가 이체
                </button>
                <button onClick={() => go("transactions", from)}>거래내역조회</button>
              </div>
            </div>
          ) : (
            <>
              <div className="search-box transfer-box">
                <div className="search-fields">
                  <label>
                    <b>출금계좌번호</b>
                    <span>
                      <select
                        aria-label="출금계좌번호"
                        value={from}
                        disabled={step === "confirm"}
                        onChange={(e) => setFromAccount(e.target.value)}
                      >
                        {me.accounts.map((a) => (
                          <option key={a.accountNo} value={a.accountNo}>
                            {a.product} {a.accountNo} (잔액 {a.balance.toLocaleString("ko-KR")}원)
                          </option>
                        ))}
                      </select>
                    </span>
                  </label>
                  <label>
                    <b>입금계좌번호</b>
                    <span>
                      <input
                        className="field-input"
                        aria-label="입금계좌번호"
                        placeholder="000-0000-0000"
                        inputMode="numeric"
                        maxLength={13}
                        value={toAccount}
                        readOnly={step === "confirm"}
                        onChange={(e) => setToAccount(e.target.value.replace(/[^\d-]/g, ""))}
                      />
                    </span>
                  </label>
                  <label>
                    <b>이체금액</b>
                    <span>
                      <input
                        className="field-input"
                        aria-label="이체금액"
                        placeholder="0"
                        inputMode="numeric"
                        value={amount}
                        readOnly={step === "confirm"}
                        onChange={(e) => {
                          const n = e.target.value.replace(/[^\d]/g, "").slice(0, 8);
                          setAmount(n ? Number(n).toLocaleString("ko-KR") : "");
                        }}
                      />
                      <em className="unit">원</em>
                    </span>
                  </label>
                  <label>
                    <b>받는 분 통장 표시</b>
                    <span>
                      <input
                        className="field-input"
                        aria-label="받는 분 통장 표시"
                        placeholder="미입력 시 '이체'"
                        maxLength={20}
                        value={memo}
                        readOnly={step === "confirm"}
                        onChange={(e) => setMemo(e.target.value)}
                      />
                    </span>
                  </label>
                </div>
                {step === "input" ? (
                  <button
                    className="primary search-submit"
                    onClick={() => {
                      const msg = check();
                      setError(msg);
                      if (!msg) setStep("confirm");
                    }}
                  >
                    다음
                  </button>
                ) : (
                  <div className="confirm-buttons">
                    <button className="primary search-submit" disabled={busy} onClick={submit}>
                      {busy ? "처리 중" : "이체"}
                    </button>
                    <button className="search-submit" disabled={busy} onClick={() => setStep("input")}>
                      수정
                    </button>
                  </div>
                )}
              </div>
              {step === "confirm" && (
                <p className="form-note">
                  {toAccount} 계좌로 {amt.toLocaleString("ko-KR")}원을 이체합니다. 내용을 확인하고
                  [이체]를 눌러 주세요.
                </p>
              )}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
            </>
          )}
          <div className="caution">
            <b>유의사항</b>
            <p>
              •&nbsp; 1회 이체 한도는 10,000,000원입니다. 본인 명의 계좌에서만 출금할 수 있습니다.
              <br />
              •&nbsp; 검찰·금감원을 사칭해 이체를 요구하면 즉시 전화를 끊고 1588-0000으로 확인해 주세요.
            </p>
          </div>
        </section>
      </main>
    </Layout>
  );
}

function DeniedPage({ ctx, arg }: { ctx: Ctx; arg: string }) {
  const { go } = ctx;
  const code = arg === "403" ? "AUTH-403" : "AUTH-401";
  return (
    <Layout ctx={ctx}>
      <main className="denied-main">
        <section className="denied-card">
          <img src={`${assets}/00b79.svg`} alt="" />
          <h1>고객님의 요청을 처리할 수 없습니다</h1>
          <p>
            {arg === "403"
              ? "본인 명의 계좌만 조회할 수 있습니다."
              : "로그인이 필요하거나, 본인 명의 계좌만 조회할 수 있습니다."}
          </p>
          <small>오류코드: {code}</small>
          <div>
            {arg === "403" && ctx.s.me ? (
              <button className="primary" onClick={() => go("transactions")}>
                내 계좌 조회
              </button>
            ) : (
              <button className="primary" onClick={() => go("login")}>
                로그인
              </button>
            )}
            <button onClick={() => go("main")}>메인으로</button>
          </div>
        </section>
      </main>
    </Layout>
  );
}

// "1일 동안 열지 않기" 저장 (브라우저 저장소가 막혀 있어도 화면은 정상 동작)
const HIDE_KEY = "durian_banner_hidden_until";
const bannerHidden = () => {
  try {
    return Number(localStorage.getItem(HIDE_KEY) || 0) > Date.now();
  } catch {
    return false;
  }
};

function AlertBanner({ onClose }: { onClose: (forADay: boolean) => void }) {
  const [forADay, setForADay] = useState(false);
  return (
    <div className="alert-banner">
      <div className="shell">
        <div className="alert-content">
          <div className="alert-title">
            <img src={`${assets}/20305.svg`} alt="" />
            <b>개인정보 유출 관련 안내</b>
          </div>
          <div>
            <p>
              일부 고객님의 정보가 유출된 사실을 확인하였습니다.
              <br />
              심려를 끼쳐 드려 죄송합니다.
            </p>
            <a href="#notice">자세히 보기 &gt;</a>
          </div>
        </div>
        <span className="alert-close">
          <button type="button" onClick={() => setForADay(!forADay)} aria-pressed={forADay}>
            {forADay ? "■" : "□"}&nbsp; 1일 동안 열지 않기
          </button>
          &nbsp; | &nbsp;
          <button type="button" onClick={() => onClose(forADay)}>
            닫기 ×
          </button>
        </span>
      </div>
    </div>
  );
}

const quickServices = [
  ["a97bd.svg", "공과금"],
  ["85d4a.svg", "환율"],
  ["a04af.svg", "인증센터"],
  ["f454a.svg", "빠른조회"],
  ["2ea2a.svg", "보안센터"],
  ["fdbf3.svg", "고객센터"],
];

function MainPage({ ctx }: { ctx: Ctx }) {
  const { go, s } = ctx;
  const [closed, setClosed] = useState(bannerHidden);
  const showAlert = s.config.showBreachBanner && !closed;
  const close = (forADay: boolean) => {
    if (forADay) {
      try {
        localStorage.setItem(HIDE_KEY, String(Date.now() + 86400_000));
      } catch {
        /* 저장 못 해도 이번에는 닫힘 */
      }
    }
    setClosed(true);
  };
  return (
    <div className="page main-page">
      {showAlert && <AlertBanner onClose={close} />}
      <Header {...ctx} />
      <main>
        <section className="hero">
          <div className="shell hero-inner">
            <div className="hero-copy">
              <span>이벤트</span>
              <h1>
                월급 받는 통장,
                <br />
                두리안으로 바꾸고 혜택까지
              </h1>
              <p>
                급여 이체부터 일상 속 금융 혜택까지,
                <br />
                두리안 입출금통장으로 편리하게 시작하세요.
              </p>
              <button>자세히보기</button>
            </div>
            <div className="hero-art">
              <div className="illustration">
                <img className="passbook" src={`${assets}/5f359.svg`} alt="" />
                <img className="coin rear" src={`${assets}/ca728.svg`} alt="" />
                <img className="coin left" src={`${assets}/494cf.svg`} alt="" />
                <img className="coin front" src={`${assets}/a68d6.svg`} alt="" />
              </div>
              <div className="pager">
                ‖&nbsp;&nbsp;&nbsp; &lt;&nbsp;&nbsp;&nbsp; <b>2/5</b>&nbsp;&nbsp;&nbsp; &gt;
              </div>
            </div>
            <div className="fast-banking">
              <div className="fast-cards">
                <button onClick={() => go("transactions")}>
                  조회 <img src={`${assets}/b7359.svg`} alt="" />
                </button>
                <button onClick={() => go("transfer")}>
                  이체 <img src={`${assets}/b7359.svg`} alt="" />
                </button>
              </div>
              <div className="service-grid">
                {quickServices.map(([icon, label]) => (
                  <button key={label}>
                    <img src={`${assets}/${icon}`} alt="" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
        <ProductStrip />
        <News go={go} breach={s.config.showBreachBanner} />
        <Recommendations />
        <Safety />
      </main>
      <QuickMenu go={go} main={showAlert} />
      <Footer servedFrom={s.config.servedFrom} />
    </div>
  );
}

function ProductStrip() {
  return (
    <section className="product-strip">
      <div className="shell">
        {[
          ["예적금", "목돈 모으기"],
          ["펀드", "펀드 랭킹"],
          ["환전", "외화 환전하기"],
          ["퇴직연금", "든든한 노후"],
          ["대출", "3분 한도조회"],
        ].map(([small, big]) => (
          <button key={small}>
            <span>{small}</span>
            <b>{big}</b>
          </button>
        ))}
      </div>
    </section>
  );
}

// 사고 공지는 유출 안내 스위치(SHOW_BREACH_BANNER)가 켜졌을 때만 새소식 맨 위에 보임
function News({ go, breach }: { go: Go; breach: boolean }) {
  return (
    <section className="shell news">
      <div>
        <header>
          <h2>새소식</h2>
          <button>+ 더보기</button>
        </header>
        {breach && (
          <button className="news-row important" onClick={() => go("notice")}>
            <span>개인정보 유출 관련 안내 및 사과문</span>
            <time>2026.11.20</time>
          </button>
        )}
        <button className="news-row">
          <span>인터넷뱅킹 정기 점검 안내</span>
          <time>2026.11.18</time>
        </button>
        <button className="news-row">
          <span>전자금융거래 이용약관 개정 안내</span>
          <time>2026.11.16</time>
        </button>
        {!breach && (
          <button className="news-row">
            <span>개인정보처리방침 개정 안내</span>
            <time>2026.11.10</time>
          </button>
        )}
      </div>
      <div>
        <header>
          <h2>이벤트</h2>
          <button>+ 더보기</button>
        </header>
        <button className="news-row">
          <span>급여 이체 고객 감사 이벤트</span>
          <time>2026.11.20~12.31</time>
        </button>
        <button className="news-row">
          <span>차곡차곡 적금 신규 가입 이벤트</span>
          <time>2026.11.01~11.30</time>
        </button>
        <button className="news-row">
          <span>모바일 알림 서비스 이용 이벤트</span>
          <time>2026.11.01~12.15</time>
        </button>
      </div>
    </section>
  );
}

function Recommendations() {
  const cards = [
    [
      "추천상품",
      "두리안 입출금통장",
      "급여와 생활비를 한 통장으로 관리하는",
      "편리한 입출금 전용 통장",
    ],
    [
      "추천상품",
      "두리안 차곡차곡 적금",
      "매달 정한 금액으로 시작하는 저축,",
      "목표에 맞춰 차곡차곡 모으세요.",
    ],
    [
      "서비스",
      "두리안 안심 알림 서비스",
      "입출금 내역과 주요 금융정보를",
      "알림으로 빠르게 확인하세요.",
    ],
  ];
  return (
    <section className="shell recommendations">
      <h2>추천상품</h2>
      <div>
        {cards.map((card) => (
          <article key={card[1]}>
            <span>{card[0]}</span>
            <h3>{card[1]}</h3>
            <p>
              {card[2]}
              <br />
              {card[3]}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Safety() {
  const items = [
    [
      "보이스피싱 예방 서비스",
      "의심되는 전화나 송금 요구에 주의하세요.",
      "금융사기 신고 및 상담은 고객센터로 문의해 주세요.",
    ],
    [
      "통장 양도는 불법",
      "통장·카드를 빌려주거나 판매하지 마세요.",
      "범죄에 이용되면 법적 책임이 발생할 수 있습니다.",
    ],
    [
      "보안카드 전체 번호 요구는 사기",
      "은행은 보안카드 전체 번호를 요구하지 않습니다.",
      "개인정보와 금융정보를 안전하게 지켜주세요.",
    ],
  ];
  return (
    <section className="shell safety">
      {items.map((item) => (
        <article key={item[0]}>
          <h3>{item[0]}</h3>
          <p>
            {item[1]}
            <br />
            {item[2]}
          </p>
        </article>
      ))}
    </section>
  );
}

function NoticePage({ ctx }: { ctx: Ctx }) {
  const { go, s } = ctx;
  const [checked, setChecked] = useState(false);
  return (
    <Layout ctx={ctx}>
      <main className="shell standard-main notice-page">
        <PageTitle crumb="홈  >  고객센터  >  공지사항">공지사항</PageTitle>
        <div className="notice-layout">
          <article className="notice-article">
            <header>
              <h2>고객 개인정보 유출 관련 안내</h2>
              <p>보안공지&nbsp; | &nbsp;2026.11.20</p>
            </header>
            <div className="notice-check">
              <button
                className="primary"
                onClick={() => (s.me ? setChecked(true) : go("login", "notice"))}
              >
                개인정보 유출여부 조회
              </button>
              <p>
                {checked
                  ? "※ 조회 결과는 등록된 연락처로 개별 통지해 드립니다."
                  : "※ 유출이 확인된 고객님께는 개별 통지를 진행하고 있습니다."}
              </p>
            </div>
            <div className="notice-body">
              <section>
                <h3>1. 유출 경위</h3>
                <p>
                  개발 과정에서 인증 서명키가 소스 코드에 포함되어 외부에 노출되었고,
                  <br />
                  이를 이용한 비정상 접근이 확인되었습니다.
                </p>
              </section>
              <section>
                <h3>2. 유출 항목</h3>
                <p>
                  성명, 휴대폰 번호, 계좌번호, 거래내역 일부
                  <br />
                  (비밀번호는 암호화되어 유출되지 않았습니다)
                </p>
              </section>
              <section>
                <h3>3. 당행 조치</h3>
                <p>노출된 키 즉시 폐기 및 교체, 비정상 접근 경로 차단, 모니터링 강화</p>
              </section>
              <section>
                <h3>4. 피해 최소화 방법</h3>
                <p>
                  출처가 불분명한 문자·링크 주의, 당행은 문자로 링크를 보내지 않습니다.
                  <br />
                  문의처: 정보보호 전담 상담센터 1588-0000
                </p>
              </section>
            </div>
            <h3 className="signature">두리안 은행</h3>
            <p className="notice-warning">
              ※ 당행은 고객정보 유출과 관련하여 URL 링크가 포함된 문자를 보내지 않습니다.
            </p>
            <div className="list-button">
              <button onClick={() => go("main")}>목록</button>
            </div>
          </article>
          <aside className="event-card">
            <span>이벤트</span>
            <h2>
              월급 받는 통장,
              <br />
              두리안으로
            </h2>
            <p>
              급여 이체 고객을 위한 혜택
              <br />
              2026.11.20~2026.12.31
            </p>
            <button>자세히보기&nbsp; &gt;</button>
          </aside>
        </div>
      </main>
    </Layout>
  );
}

export default function App() {
  const { page, arg, go } = usePage();
  const s = useSession(go);
  const ctx: Ctx = { go, s };
  if (page === "login") return <LoginPage key={arg} ctx={ctx} arg={arg} />;
  if (page === "transactions") return <TransactionsPage key={arg} ctx={ctx} arg={arg} />;
  if (page === "transfer") return <TransferPage ctx={ctx} />;
  if (page === "denied") return <DeniedPage ctx={ctx} arg={arg} />;
  if (page === "notice") return <NoticePage ctx={ctx} />;
  return <MainPage ctx={ctx} />;
}
