-- Activity deletion is a soft delete and reverses points in the same transaction.
-- Keep rewards and point entries as historical accounting records if an activity
-- is physically removed by maintenance; do not cascade-delete or re-award them.
-- A maintenance hard delete must reconcile awarded rewards before removing the activity.
CREATE INDEX `community_activity_rewards_activity_id_idx`
    ON `community_activity_rewards`(`activity_id`);
