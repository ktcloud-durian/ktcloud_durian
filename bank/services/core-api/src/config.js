// 설정은 전부 환경 변수에서 읽음. 비밀값을 코드에 쓰지 않음 (SEC-01)
function required(name, minLen = 1) {
  const v = process.env[name];
  if (!v || v.length < minLen) {
    throw new Error(`${name} 환경 변수가 없거나 너무 짧아요 (최소 ${minLen}자)`);
  }
  return v;
}

export function loadConfig() {
  return {
    port: Number(process.env.PORT || 4000),
    serviceToken: required('SERVICE_TOKEN', 32),
    db: {
      host: required('DB_HOST'),
      port: Number(process.env.DB_PORT || 3306),
      user: required('DB_USER'),
      password: required('DB_PASSWORD'),
      database: process.env.DB_NAME || 'durian_bank',
    },
    seedDemo: process.env.SEED_DEMO === 'true',
    demoPassword: process.env.DEMO_PASSWORD || '',
  };
}
