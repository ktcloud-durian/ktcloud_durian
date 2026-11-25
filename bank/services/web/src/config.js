// 설정은 전부 환경 변수에서. 토큰 서명키를 코드에 쓰지 않음 (쿠팡 사례의 반대, SEC-01)
function required(name, minLen = 1) {
  const v = process.env[name];
  if (!v || v.length < minLen) throw new Error(`${name} 환경 변수가 없거나 너무 짧아요 (최소 ${minLen}자)`);
  return v;
}

export function loadConfig() {
  return {
    port: Number(process.env.PORT || 3000),
    coreApiUrl: required('CORE_API_URL'),
    serviceToken: required('SERVICE_TOKEN', 32),
    jwtSecret: required('JWT_SECRET', 32),
    jwtTtlMin: Number(process.env.JWT_TTL_MIN || 10),
    cookieSecure: process.env.COOKIE_SECURE !== 'false', // 로컬 http에서만 false
    showBreachBanner: process.env.SHOW_BREACH_BANNER === 'true',
    servedFrom: process.env.SERVED_FROM || 'AWS 서울 리전',
    trustProxyHops: Math.min(Math.max(Number(process.env.TRUST_PROXY_HOPS || 1), 0), 3),
  };
}
