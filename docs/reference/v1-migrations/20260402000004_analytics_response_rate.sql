-- ============================================================================
-- Migration: analytics_response_rate
-- Description: Adds response-rate analytics RPCs and a supporting partial
--              index on the messages table. Computes conversation-level
--              response rate and first-response-time from existing data.
-- Dependencies: 20260301000015_messaging (messages table)
-- ============================================================================

-- ############################################################################
-- PART 1: PERFORMANCE INDEX
-- ############################################################################

-- Partial index covering the columns used by both RPCs below.
-- Excludes soft-deleted messages so the planner can skip them cheaply.

create index if not exists idx_messages_company_sender_created
	on messages (company_id, sender_type, created_at)
	where deleted_at is null;

-- Composite index for the reply-lookup join in both RPCs below.
-- Enables efficient nested-loop: exact match on (conversation_id, sender_type),
-- then range scan on created_at > customer_msg_at.
create index if not exists idx_messages_conv_sender_created
	on messages (conversation_id, sender_type, created_at)
	where deleted_at is null;

-- ############################################################################
-- PART 2: PERIOD AGGREGATE RPC
-- ############################################################################

-- Returns a single summary row for a company within a date range:
--   * total conversations where a customer/external_contact sent a message
--   * how many of those received a company_member reply
--   * response rate percentage
--   * average and median first-response time in seconds

create or replace function analytics_get_response_rate_stats(
	p_company_id uuid,
	p_from       date,
	p_to         date
)
returns table (
	total_conversations     bigint,
	responded_conversations bigint,
	response_rate           numeric,
	avg_response_time_sec   numeric,
	median_response_time_sec numeric
)
language sql
stable
security definer
set search_path = ''
as $$
	with first_customer_msg as (
		select distinct on (m.conversation_id)
			m.conversation_id,
			m.created_at as customer_msg_at
		from public.messages m
		where m.company_id = p_company_id
		  and m.sender_type in ('customer', 'external_contact')
		  and m.created_at >= p_from::timestamptz
		  and m.created_at <  (p_to + interval '1 day')::timestamptz
		  and m.deleted_at is null
		order by m.conversation_id, m.created_at asc
	),
	first_reply as (
		select
			fcm.conversation_id,
			min(r.created_at) as reply_at
		from first_customer_msg fcm
		join public.messages r
		  on r.conversation_id = fcm.conversation_id
		 and r.company_id = p_company_id
		 and r.sender_type = 'company_member'
		 and r.created_at > fcm.customer_msg_at
		 and r.deleted_at is null
		group by fcm.conversation_id
	),
	response_times as (
		select
			extract(epoch from (fr.reply_at - fcm.customer_msg_at)) as seconds
		from first_customer_msg fcm
		join first_reply fr on fr.conversation_id = fcm.conversation_id
	)
	select
		(select count(*) from first_customer_msg)::bigint as total_conversations,
		(select count(*) from first_reply)::bigint        as responded_conversations,
		case
			when (select count(*) from first_customer_msg) = 0 then 0
			else round(
				(select count(*) from first_reply)::numeric
				/ (select count(*) from first_customer_msg) * 100, 2
			)
		end as response_rate,
		(select round(avg(seconds)::numeric, 0) from response_times)  as avg_response_time_sec,
		(select round(
			percentile_cont(0.5) within group (order by seconds)::numeric, 0
		) from response_times) as median_response_time_sec;
$$;

comment on function analytics_get_response_rate_stats is
	'Aggregates conversation response rate and first-response-time for a company within a date range';

-- ############################################################################
-- PART 3: DAILY CHART RPC
-- ############################################################################

-- Returns one row per day with response-rate metrics, suitable for charting.
-- Each conversation is attributed to the date of its first customer message
-- (first-message attribution), matching Intercom/Zendesk/Meta conventions.
-- Daily conversation_count values sum to total_conversations from the stats RPC.

create or replace function analytics_get_response_rate_chart(
	p_company_id uuid,
	p_from       date,
	p_to         date
)
returns table (
	date                    date,
	conversation_count      bigint,
	responded_count         bigint,
	response_rate           numeric,
	avg_response_time_sec   numeric
)
language sql
stable
security definer
set search_path = ''
as $$
	with first_customer_msg as (
		select distinct on (m.conversation_id)
			m.conversation_id,
			m.created_at::date as msg_date,
			m.created_at       as customer_msg_at
		from public.messages m
		where m.company_id = p_company_id
		  and m.sender_type in ('customer', 'external_contact')
		  and m.created_at >= p_from::timestamptz
		  and m.created_at <  (p_to + interval '1 day')::timestamptz
		  and m.deleted_at is null
		order by m.conversation_id, m.created_at asc
	),
	first_reply as (
		select
			fcm.conversation_id,
			min(r.created_at) as reply_at,
			extract(epoch from (min(r.created_at) - fcm.customer_msg_at)) as seconds
		from first_customer_msg fcm
		join public.messages r
		  on r.conversation_id = fcm.conversation_id
		 and r.company_id = p_company_id
		 and r.sender_type = 'company_member'
		 and r.created_at > fcm.customer_msg_at
		 and r.deleted_at is null
		group by fcm.conversation_id, fcm.customer_msg_at
	)
	select
		fcm.msg_date as date,
		count(*)::bigint                              as conversation_count,
		count(fr.conversation_id)::bigint             as responded_count,
		case
			when count(*) = 0 then 0
			else round(
				count(fr.conversation_id)::numeric
				/ count(*) * 100, 2
			)
		end as response_rate,
		round(avg(fr.seconds)::numeric, 0)            as avg_response_time_sec
	from first_customer_msg fcm
	left join first_reply fr
	  on fr.conversation_id = fcm.conversation_id
	group by fcm.msg_date
	order by fcm.msg_date;
$$;

comment on function analytics_get_response_rate_chart is
	'Returns daily response-rate and first-response-time metrics for charting';
