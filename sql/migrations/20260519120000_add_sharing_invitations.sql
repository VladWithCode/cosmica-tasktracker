-- +goose Up
CREATE TABLE IF NOT EXISTS sharing_invitations (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    grant_id    UUID        NOT NULL REFERENCES task_access_grants(id) ON DELETE CASCADE,
    owner_user_id   UUID    NOT NULL,
    grantee_user_id UUID    NOT NULL,
    read_at     TIMESTAMPTZ NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sharing_invitations_grantee ON sharing_invitations(grantee_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sharing_invitations_grant ON sharing_invitations(grant_id);

-- +goose Down
DROP TABLE IF EXISTS sharing_invitations;
