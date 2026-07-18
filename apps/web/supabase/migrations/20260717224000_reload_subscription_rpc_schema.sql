-- PostgREST caches RPC signatures. Reload it after applying the subscription
-- entitlement migration so the chat API can immediately resolve
-- consume_subscription_quota(p_feature, p_units).
notify pgrst, 'reload schema';
