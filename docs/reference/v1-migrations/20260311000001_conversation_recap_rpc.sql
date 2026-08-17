-- ============================================================================
-- Migration: conversation_recap_rpc
-- Description: RPC function returning conversation recap stats and participant
--              info for the chat recap page. Returns aggregated order/product
--              counts, total spent, media message counts, company info, and
--              customer info. SECURITY DEFINER with manual auth check.
-- Dependencies: conversations, orders, order_items, messages, companies,
--               users, company_customers, company_members (is_company_member)
-- ============================================================================

create or replace function get_conversation_recap(p_conversation_id uuid)
	returns jsonb
	language plpgsql
	security definer
	stable
	set search_path = ''
as $$
declare
	v_uid         uuid := (select auth.uid());
	v_conv        record;
	v_customer_id uuid;
	v_is_member   boolean;
begin
	select id, company_id, customer_user_id, customer_name
	  into v_conv
	  from public.conversations
	 where id = p_conversation_id;

	if v_conv is null then
		raise exception 'conversation_not_found'
			using errcode = 'P0002';
	end if;

	v_is_member := public.is_company_member(v_conv.company_id, v_uid);

	if v_conv.customer_user_id is distinct from v_uid and not v_is_member then
		raise exception 'access_denied'
			using errcode = '42501';
	end if;

	select cc.id into v_customer_id
	  from public.company_customers cc
	 where cc.company_id = v_conv.company_id
	   and cc.user_id = v_conv.customer_user_id;

	return jsonb_build_object(
		'orders_count',
			coalesce((
				select count(*)
				  from public.orders
				 where customer_id = v_customer_id
				   and company_id = v_conv.company_id
			), 0),

		'products_count',
			coalesce((
				select sum(oi.quantity)
				  from public.order_items oi
				  join public.orders o on o.id = oi.order_id
				 where o.customer_id = v_customer_id
				   and o.company_id = v_conv.company_id
			), 0),

		'total_spent',
			coalesce((
				select sum(total_price)
				  from public.orders
				 where customer_id = v_customer_id
				   and company_id = v_conv.company_id
			), 0),

		'images_count',
			(select count(*)
			   from public.messages
			  where conversation_id = p_conversation_id
			    and content_type = 'image'
			    and deleted_at is null),

		'files_count',
			(select count(*)
			   from public.messages
			  where conversation_id = p_conversation_id
			    and content_type = 'file'
			    and deleted_at is null),

		'voice_count',
			(select count(*)
			   from public.messages
			  where conversation_id = p_conversation_id
			    and content_type = 'audio'
			    and deleted_at is null),

		'is_company_member', v_is_member,

		'company',
			(select jsonb_build_object(
				'id', c.id,
				'name', c.name,
				'slug', c.slug,
				'logo_url', c.logo_url,
				'city', c.city,
				'area', c.area
			) from public.companies c where c.id = v_conv.company_id),

		'customer',
			jsonb_build_object(
				'name', v_conv.customer_name,
				'avatar_url', (
					select u.avatar
					  from public.users u
					 where u.id = v_conv.customer_user_id
				)
			)
	);
end;
$$;

comment on function get_conversation_recap(uuid) is
	'Returns conversation recap stats (order/product counts, media counts, participant info) for the chat recap page. '
	'Requires caller to be either the customer or a company member in the conversation.';

grant execute on function get_conversation_recap(uuid) to authenticated;
