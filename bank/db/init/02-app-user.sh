#!/bin/bash
# 앱 전용 계정: durian_bank 에만, 필요한 권한만 (DROP·ALTER·GRANT 없음, IAM-04 최소 권한)
set -euo pipefail
: "${APP_DB_PASSWORD:?APP_DB_PASSWORD 가 필요해요}"
mariadb -uroot -p"${MARIADB_ROOT_PASSWORD}" <<SQL
CREATE USER IF NOT EXISTS 'durian_app'@'%' IDENTIFIED BY '${APP_DB_PASSWORD}';
GRANT SELECT, INSERT, UPDATE ON durian_bank.customers    TO 'durian_app'@'%';
GRANT SELECT, INSERT, UPDATE ON durian_bank.accounts     TO 'durian_app'@'%';
GRANT SELECT, INSERT         ON durian_bank.transactions TO 'durian_app'@'%';
GRANT INSERT                 ON durian_bank.audit_log    TO 'durian_app'@'%';
FLUSH PRIVILEGES;
SQL
