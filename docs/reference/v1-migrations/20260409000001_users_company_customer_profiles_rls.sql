-- ============================================================================
-- Migration: users_company_customer_profiles_rls
-- Description: Allow company members to read profile data (avatar, username)
--              for customers who have linked user accounts. Required for
--              displaying customer avatars on order cards.
-- Dependencies: users (20260301000004), company_customers, company_members
-- ============================================================================

create policy "users: select company customer profiles"
	on users for select
	to authenticated
	using (
		not is_anonymous_user()
		and exists (
			select 1
			from company_customers cc
			join company_members cm on cm.company_id = cc.company_id
			where cc.user_id = users.id
			  and cm.user_id = (select auth.uid())
		)
	);
