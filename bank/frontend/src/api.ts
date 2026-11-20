// 백엔드(web 서비스) 호출 모음
// 로그인 토큰은 httpOnly 쿠키라 자바스크립트에서 읽거나 저장하지 않음 (XSS로 토큰을 훔칠 수 없게)

export type Account = { accountNo: string; product: string; balance: number };
export type Me = { name: string; phone: string; accounts: Account[]; sessionExpiresAt: number };
export type Tx = {
  occurredAt: string;
  summary: string;
  memo: string;
  withdraw: number;
  deposit: number;
  balanceAfter: number;
  branch: string;
};
export type TxResult = { account: Account & { holder: string }; items: Tx[] };
export type TxType = "all" | "deposit" | "withdraw";
export type AppConfig = { showBreachBanner: boolean; servedFrom: string };
export type ApiError = { status: number; error?: string; message?: string };

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      ...init,
    });
  } catch {
    throw { status: 0, error: "network", message: "서버에 연결할 수 없습니다." } as ApiError;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, ...data } as ApiError;
  return data as T;
}

const post = (body?: unknown): RequestInit => ({
  method: "POST",
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const api = {
  config: () => call<AppConfig>("/api/config"),
  login: (username: string, password: string) =>
    call<{ name: string }>("/api/login", post({ username, password })),
  logout: () => call<{ ok: true }>("/api/logout", post()),
  extend: () => call<{ sessionExpiresAt: number }>("/api/session/extend", post()),
  me: () => call<Me>("/api/me"),
  transactions: (accountNo: string, q: { from: string; to: string; type: TxType }) =>
    call<TxResult>(
      `/api/accounts/${encodeURIComponent(accountNo)}/transactions?${new URLSearchParams(q)}`,
    ),
  transfer: (fromAccount: string, toAccount: string, amount: number, memo?: string) =>
    call<{ balance: number }>("/api/transfer", post({ fromAccount, toAccount, amount, memo })),
};

export const statusOf = (e: unknown) => (e as ApiError)?.status ?? 0;
export const messageOf = (e: unknown, fallback = "잠시 후 다시 시도해 주세요.") =>
  (e as ApiError)?.message || fallback;

// 금액 표시: 0이면 "—"
export const won = (n: number) => (n ? n.toLocaleString("ko-KR") : "—");

// "2026-11-19 11:24:00" → "2026.11.19 11:24"
export const fmtDateTime = (s: string) => s.slice(0, 16).replace(/-/g, ".");

// 한국 시간 기준 YYYY-MM-DD
export function kstDate(offsetDays = 0) {
  const d = new Date(Date.now() + 9 * 3600_000 - offsetDays * 86400_000);
  return d.toISOString().slice(0, 10);
}
