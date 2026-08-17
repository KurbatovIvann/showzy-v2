-- ============================================================================
-- Migration: comments_show_username
-- Description: Updates product_comments_view to display usernames instead of
--              real names. Username is required during onboarding.
-- Dependencies: public_profiles_and_users_rls (20260306000001)
-- ============================================================================

create or replace view product_comments_view
with (security_invoker = on)
as
select
	pc.id,
	pc.product_id,
	pc.company_id,
	pc.user_id,
	pc.parent_id,
	pc.content,
	pc.is_company_reply,
	pc.created_at,
	pc.updated_at,
	p.username as user_name,
	p.avatar as user_avatar
from product_comments pc
left join public_profiles p on pc.user_id = p.id;

comment on view product_comments_view is 'Product comments with user display information';
