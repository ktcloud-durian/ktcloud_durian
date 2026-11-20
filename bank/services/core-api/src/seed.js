import bcrypt from 'bcryptjs';

// 시연용 가짜 고객 3명. 비밀번호는 코드에 쓰지 않고 DEMO_PASSWORD 환경 변수로 받음
const CUSTOMERS = [
  { username: 'kimfake', name: '김가짜', phone: '010-1111-2222', accountNo: '101-2034-5678', balance: 3200000 },
  { username: 'leeexample', name: '이예시', phone: '010-3333-4444', accountNo: '101-2034-6789', balance: 15800000 },
  { username: 'parktest', name: '박테스트', phone: '010-5555-6666', accountNo: '101-2034-7890', balance: 740000 },
];

const SAMPLE = [
  ['급여', '두리안상사', 0, 3100000],
  ['카드', '편의점', 4500, 0],
  ['자동이체', '통신요금', 55000, 0],
  ['인터넷이체', '월세', 650000, 0],
  ['카드', '마트', 87300, 0],
  ['입금', '용돈', 0, 100000],
  ['카드', '카페', 6800, 0],
  ['출금', 'ATM', 200000, 0],
];

export async function seedIfEmpty(pool, demoPassword) {
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM customers');
  if (n > 0) return false;
  if (!demoPassword || demoPassword.length < 8) throw new Error('SEED_DEMO=true 이면 DEMO_PASSWORD(8자 이상)가 필요해요');
  const hash = await bcrypt.hash(demoPassword, 10);
  for (const c of CUSTOMERS) {
    const [r] = await pool.execute('INSERT INTO customers (username, password_hash, name, phone) VALUES (?, ?, ?, ?)', [c.username, hash, c.name, c.phone]);
    const [a] = await pool.execute('INSERT INTO accounts (customer_id, account_no, product, balance) VALUES (?, ?, ?, ?)', [r.insertId, c.accountNo, '두리안 입출금통장', c.balance]);
    // 거래 기록을 거꾸로 계산해서 현재 잔액에 맞춤
    let bal = c.balance;
    const rows = [];
    SAMPLE.forEach(([summary, memo, w, d], i) => {
      rows.push([a.insertId, `NOW() - INTERVAL ${i * 2 + 1} DAY`, summary, memo, w, d, bal]);
      bal = bal + w - d;
    });
    for (const [accId, when, summary, memo, w, d, after] of rows) {
      await pool.execute(
        `INSERT INTO transactions (account_id, occurred_at, summary, memo, withdraw, deposit, balance_after) VALUES (?, ${when}, ?, ?, ?, ?, ?)`,
        [accId, summary, memo, w, d, after],
      );
    }
  }
  return true;
}
