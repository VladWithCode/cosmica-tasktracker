-- +goose Up
-- +goose StatementBegin
CREATE TABLE task_access_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    grantee_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_level TEXT NOT NULL CHECK (access_level IN ('view', 'manage', 'ping_only')),
    can_view BOOLEAN NOT NULL DEFAULT FALSE,
    can_create BOOLEAN NOT NULL DEFAULT FALSE,
    can_ping BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMPTZ,
    CHECK (owner_user_id <> grantee_user_id)
);

CREATE UNIQUE INDEX task_access_grants_active_pair_unique
    ON task_access_grants(owner_user_id, grantee_user_id)
    WHERE revoked_at IS NULL;

CREATE INDEX task_access_grants_owner_idx ON task_access_grants(owner_user_id);
CREATE INDEX task_access_grants_grantee_idx ON task_access_grants(grantee_user_id);

CREATE TRIGGER update_task_access_grants_updated_at
BEFORE UPDATE ON task_access_grants
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TABLE task_pings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT,
    notification_sent BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX task_pings_task_idx ON task_pings(task_id);
CREATE INDEX task_pings_sender_idx ON task_pings(sender_user_id);
CREATE INDEX task_pings_recipient_idx ON task_pings(recipient_user_id);
CREATE INDEX task_pings_created_at_idx ON task_pings(created_at);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE task_pings;
DROP TABLE task_access_grants;
-- +goose StatementEnd
