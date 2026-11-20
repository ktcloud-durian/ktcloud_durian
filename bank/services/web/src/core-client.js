// 온프렘 내부 API 호출. 서비스 토큰을 붙이고, 응답 상태를 그대로 넘김
export function createCoreClient({ coreApiUrl, serviceToken, fetchImpl = fetch }) {
  async function call(path, { method = 'GET', body, clientIp } = {}) {
    const res = await fetchImpl(new URL(path, coreApiUrl), {
      method,
      headers: {
        'content-type': 'application/json',
        'x-service-token': serviceToken,
        ...(clientIp ? { 'x-client-ip': clientIp } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }
  return {
    login: (username, password, clientIp) => call('/internal/auth/login', { method: 'POST', body: { username, password }, clientIp }),
    summary: (customerId) => call(`/internal/customers/${customerId}/summary`),
    transactions: (accountNo, customerId, q, clientIp) => {
      const p = new URLSearchParams({ customerId: String(customerId), ...q });
      return call(`/internal/accounts/${encodeURIComponent(accountNo)}/transactions?${p}`, { clientIp });
    },
    transfer: (body, clientIp) => call('/internal/transfers', { method: 'POST', body, clientIp }),
    health: () => call('/health'),
  };
}
