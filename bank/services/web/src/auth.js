import jwt from 'jsonwebtoken';

export const COOKIE = 'durian_session';
const ISSUER = 'durian-web';
const AUDIENCE = 'durian-bank';

export function createAuth({ jwtSecret, jwtTtlMin }) {
  return {
    sign(customer) {
      return jwt.sign({ sub: String(customer.customerId), name: customer.name }, jwtSecret, {
        algorithm: 'HS256', expiresIn: `${jwtTtlMin}m`, issuer: ISSUER, audience: AUDIENCE,
      });
    },
    // 서명 알고리즘을 HS256으로 고정 (alg: none 등 바꿔치기 방지), 발급자·대상·만료까지 확인
    verify(token) {
      return jwt.verify(token, jwtSecret, { algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE });
    },
  };
}

export function requireLogin(auth) {
  return (req, res, next) => {
    const header = req.get('authorization') || '';
    const token = req.cookies?.[COOKIE] || (header.startsWith('Bearer ') ? header.slice(7) : '');
    if (!token) return res.status(401).json({ error: 'login_required' });
    try {
      const claims = auth.verify(token);
      req.customerId = Number(claims.sub);
      req.customerName = claims.name;
      req.sessionExp = claims.exp * 1000; // 자동로그아웃 남은 시간 표시용
      if (!Number.isInteger(req.customerId)) throw new Error('bad sub');
      next();
    } catch {
      res.status(401).json({ error: 'login_required' });
    }
  };
}
