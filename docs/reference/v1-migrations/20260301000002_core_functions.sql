-- ============================================================================
-- Migration: core_functions
-- Description: Shared utility functions used across multiple tables
-- Dependencies: None
-- Sources: 002_common_functions
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Timestamp Management
-- ----------------------------------------------------------------------------

create or replace function update_timestamp()
	returns trigger
	set search_path = ''
as $$
begin
	new.updated_at = now();
	return new;
end;
$$ language plpgsql;

comment on function update_timestamp() is 'Updates the updated_at column to current timestamp on row update';

-- ----------------------------------------------------------------------------
-- Order Number Generation
-- ----------------------------------------------------------------------------

create or replace function to_base36(n bigint)
	returns text
	language plpgsql
	set search_path = ''
as $$
declare
	base36_chars text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	res          text := '';
	remainder    integer;
begin
	if n = 0 then
		return '0';
	end if;
	while n > 0 loop
		remainder := n % 36;
		res := substr(base36_chars, remainder + 1, 1) || res;
		n := n / 36;
	end loop;
	return res;
end;
$$;

comment on function to_base36(bigint) is 'Converts a number to base36 string representation';

create or replace function obfuscate_seq(seq bigint)
	returns text
	language plpgsql
	set search_path = ''
as $$
declare
	secret_multiplier constant bigint := 73856093;
	secret_offset     constant bigint := 12345;
	obfuscated                 bigint;
begin
	obfuscated := (seq * secret_multiplier + secret_offset) % 1000000007;
	return public.to_base36(obfuscated);
end;
$$;

comment on function obfuscate_seq(bigint) is 'Obfuscates a sequence number using a mathematical transformation';


-- No SECURITY DEFINER needed — only reads auth.jwt()
create or replace function is_anonymous_user()
	returns boolean
	language sql
	stable
	set search_path = ''
as $$
	select coalesce((auth.jwt() -> 'is_anonymous')::boolean, false);
$$;

comment on function is_anonymous_user() is 'Check if current user is anonymous (guest)';
