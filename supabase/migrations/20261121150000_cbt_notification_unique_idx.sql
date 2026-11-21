-- Unique CBT attempt notification constraint index
-- Prevents duplicate in-app notifications for the same CBT attempt per student,
-- even under concurrent submission finalisations across multiple serverless/node instances.

create unique index if not exists student_notifications_cbt_attempt_unique_idx
  on public.student_notifications (user_id, (metadata->>'attempt_id'))
  where notification_type = 'cbt_result';
