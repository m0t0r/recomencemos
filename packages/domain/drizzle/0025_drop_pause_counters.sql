-- The Pause switch has no daily ceiling any more (#311), and the migration after
-- this one narrows the `CHECK` on `rate_counter.action` to drop `profilePause`.
--
-- Authored rather than generated, for the seed's reason: this is data, and a
-- data step has no schema to be generated from. The narrowed constraint would
-- fail as it is added while any `profilePause` row remained, so the rows go
-- first. Each one counts flips that nothing will read again.

DELETE FROM "rate_counter" WHERE "action" = 'profilePause';
