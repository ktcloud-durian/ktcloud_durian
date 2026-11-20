// 고객 DB 접근 (모든 쿼리는 파라미터 바인딩)
export const LOCK_THRESHOLD = 5;
export const LOCK_MINUTES = 15;

export function createRepo(pool) {
  return {
    async ping() {
      await pool.query('SELECT 1');
    },

    async findCustomerByUsername(username) {
      const [rows] = await pool.execute(
        'SELECT id, username, password_hash, name, failed_attempts, locked_until, ' +
          '(locked_until IS NOT NULL AND locked_until > NOW()) AS is_locked ' +
          'FROM customers WHERE username = ?',
        [username],
      );
      return rows[0] || null;
    },

    async recordLoginFailure(customerId) {
      // MariaDB는 SET을 왼쪽부터 적용 → 두 번째 식의 failed_attempts는 이미 +1 된 값
      // 잠금이 풀린 뒤 다시 틀리면 1부터 다시 셈
      await pool.execute(
        'UPDATE customers SET ' +
          'failed_attempts = IF(locked_until IS NOT NULL AND locked_until <= NOW(), 1, failed_attempts + 1), ' +
          'locked_until = IF(failed_attempts >= ?, NOW() + INTERVAL ? MINUTE, IF(locked_until <= NOW(), NULL, locked_until)) ' +
          'WHERE id = ?',
        [LOCK_THRESHOLD, LOCK_MINUTES, customerId],
      );
    },

    async recordLoginSuccess(customerId) {
      await pool.execute(
        'UPDATE customers SET failed_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = ?',
        [customerId],
      );
    },

    async getCustomerSummary(customerId) {
      const [c] = await pool.execute('SELECT id, name, phone FROM customers WHERE id = ?', [customerId]);
      if (!c[0]) return null;
      const [a] = await pool.execute(
        'SELECT account_no AS accountNo, product, balance FROM accounts WHERE customer_id = ? ORDER BY id',
        [customerId],
      );
      return { id: c[0].id, name: c[0].name, phone: c[0].phone, accounts: a };
    },

    async getAccountForCustomer(accountNo, customerId) {
      const [rows] = await pool.execute(
        'SELECT a.id, a.account_no AS accountNo, a.product, a.balance, c.name AS holder ' +
          'FROM accounts a JOIN customers c ON c.id = a.customer_id ' +
          'WHERE a.account_no = ? AND a.customer_id = ?',
        [accountNo, customerId],
      );
      return rows[0] || null;
    },

    async listTransactions(accountId, { from, to, type, limit }) {
      const where = ['account_id = ?', 'occurred_at >= ?', 'occurred_at < ? + INTERVAL 1 DAY'];
      const params = [accountId, from, to];
      if (type === 'deposit') where.push('deposit > 0');
      if (type === 'withdraw') where.push('withdraw > 0');
      const [rows] = await pool.execute(
        'SELECT occurred_at AS occurredAt, summary, memo, withdraw, deposit, balance_after AS balanceAfter, branch ' +
          `FROM transactions WHERE ${where.join(' AND ')} ORDER BY occurred_at DESC, id DESC LIMIT ${Number(limit)}`,
        params,
      );
      return rows;
    },

    // 이체: 잔액 확인과 차감을 한 트랜잭션으로 (FOR UPDATE로 동시 이체 방지)
    async transfer({ customerId, fromAccount, toAccount, amount, memo }) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [src] = await conn.execute(
          'SELECT id, balance FROM accounts WHERE account_no = ? AND customer_id = ? FOR UPDATE',
          [fromAccount, customerId],
        );
        if (!src[0]) throw Object.assign(new Error('forbidden'), { status: 403 });
        const [dst] = await conn.execute('SELECT id, balance FROM accounts WHERE account_no = ? FOR UPDATE', [toAccount]);
        if (!dst[0]) throw Object.assign(new Error('to_account_not_found'), { status: 404 });
        if (src[0].id === dst[0].id) throw Object.assign(new Error('same_account'), { status: 400 });
        if (Number(src[0].balance) < amount) throw Object.assign(new Error('insufficient_balance'), { status: 400 });

        const srcAfter = Number(src[0].balance) - amount;
        const dstAfter = Number(dst[0].balance) + amount;
        await conn.execute('UPDATE accounts SET balance = ? WHERE id = ?', [srcAfter, src[0].id]);
        await conn.execute('UPDATE accounts SET balance = ? WHERE id = ?', [dstAfter, dst[0].id]);
        await conn.execute(
          'INSERT INTO transactions (account_id, occurred_at, summary, memo, withdraw, deposit, balance_after) VALUES (?, NOW(), ?, ?, ?, 0, ?)',
          [src[0].id, '인터넷이체', memo, amount, srcAfter],
        );
        await conn.execute(
          'INSERT INTO transactions (account_id, occurred_at, summary, memo, withdraw, deposit, balance_after) VALUES (?, NOW(), ?, ?, 0, ?, ?)',
          [dst[0].id, '인터넷이체', memo, amount, dstAfter],
        );
        await conn.commit();
        return { balance: srcAfter };
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    },

    async audit({ customerId = null, action, accountNo = null, clientIp = null, result }) {
      await pool.execute(
        'INSERT INTO audit_log (customer_id, action, account_no, client_ip, result) VALUES (?, ?, ?, ?, ?)',
        [customerId, action, accountNo, clientIp, result],
      );
    },
  };
}
