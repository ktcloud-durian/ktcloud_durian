-- 두리안뱅크 고객 DB (온프렘 MariaDB). 고객 개인정보는 여기에만 저장 (DAT-04)
-- k3s 클러스터 저장소와 같은 서버를 쓰더라도 데이터베이스·계정은 따로 (기준서 DAT-04 조건)
SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS durian_bank CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE durian_bank;

CREATE TABLE IF NOT EXISTS customers (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  username         VARCHAR(40)  NOT NULL UNIQUE,
  password_hash    VARCHAR(100) NOT NULL,          -- bcrypt (평문 저장 금지)
  name             VARCHAR(40)  NOT NULL,
  phone            VARCHAR(20)  NOT NULL,
  failed_attempts  INT          NOT NULL DEFAULT 0,
  locked_until     DATETIME     NULL,               -- 5회 실패 시 15분 잠금
  last_login_at    DATETIME     NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounts (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  customer_id  INT          NOT NULL,
  account_no   VARCHAR(20)  NOT NULL UNIQUE,
  product      VARCHAR(40)  NOT NULL,
  balance      BIGINT       NOT NULL DEFAULT 0,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  account_id     INT          NOT NULL,
  occurred_at    DATETIME     NOT NULL,
  summary        VARCHAR(20)  NOT NULL,   -- 적요 (급여, 이체, 카드 등)
  memo           VARCHAR(60)  NOT NULL,   -- 기재내용
  withdraw       BIGINT       NOT NULL DEFAULT 0,
  deposit        BIGINT       NOT NULL DEFAULT 0,
  balance_after  BIGINT       NOT NULL,
  branch         VARCHAR(20)  NOT NULL DEFAULT '인터넷',
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  INDEX idx_tx_account_time (account_id, occurred_at)
);

-- 개인정보 조회·이체 기록 (누가 언제 무엇을 했는지)
CREATE TABLE IF NOT EXISTS audit_log (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  customer_id  INT          NULL,
  action       VARCHAR(30)  NOT NULL,
  account_no   VARCHAR(20)  NULL,
  client_ip    VARCHAR(45)  NULL,
  result       VARCHAR(20)  NOT NULL
);
