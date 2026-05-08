-- +goose Up
-- ping_only grants need can_view=true so the grantee can browse the owner's
-- task list and choose which task to ping.
UPDATE task_access_grants
   SET can_view = TRUE
 WHERE access_level = 'ping_only'
   AND can_view = FALSE;

-- +goose Down
UPDATE task_access_grants
   SET can_view = FALSE
 WHERE access_level = 'ping_only';
