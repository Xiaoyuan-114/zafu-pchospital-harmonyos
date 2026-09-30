CREATE TABLE `auth_sessions` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `token_digest` BINARY(32) NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `last_seen_at` DATETIME(3) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `revoked_at` DATETIME(3) NULL,
  `ip_digest` BINARY(32) NULL,
  `user_agent_digest` BINARY(32) NULL,
  UNIQUE INDEX `auth_sessions_token_digest_uq` (`token_digest`),
  INDEX `auth_sessions_user_revoked_expires_idx` (`user_id`, `revoked_at`, `expires_at`),
  INDEX `auth_sessions_expires_idx` (`expires_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `auth_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE = InnoDB;

CREATE TABLE `login_throttles` (
  `key_digest` BINARY(32) NOT NULL,
  `failed_count` INTEGER NOT NULL DEFAULT 0,
  `window_started_at` DATETIME(3) NOT NULL,
  `blocked_until` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `login_throttles_blocked_idx` (`blocked_until`),
  PRIMARY KEY (`key_digest`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE = InnoDB;
