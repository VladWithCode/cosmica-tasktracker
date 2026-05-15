-- +goose Up
-- +goose StatementBegin
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
UPDATE users
SET email = LOWER(email)
WHERE email IS NOT NULL
  AND email <> ''
  AND email <> LOWER(email);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
    ON users (LOWER(email))
    WHERE email IS NOT NULL AND email <> '';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS users_email_unique;
UPDATE users
SET email = username || '@local.invalid'
WHERE email IS NULL OR email = '';
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
-- +goose StatementEnd
