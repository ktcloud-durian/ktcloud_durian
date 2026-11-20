import mysql from 'mysql2/promise';

// SQL은 전부 ? 자리표시자(파라미터 바인딩)로만 실행 → SQL 인젝션 방지
export function createPool(db) {
  return mysql.createPool({
    ...db,
    connectionLimit: 5,
    waitForConnections: true,
    charset: 'utf8mb4',
    dateStrings: true,
    timezone: '+09:00',
  });
}
