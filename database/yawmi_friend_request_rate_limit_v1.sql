create or replace function public.yawmi_friend_request(p_code text)
returns text language plpgsql security definer set search_path='' as $$
declare u uuid:=(select auth.uid()); other uuid; other_opt boolean; own_opt boolean;
begin
 if u is null then raise exception 'AUTH_REQUIRED';end if;
 select friends_enabled into own_opt from public.yawmi_public_profiles where user_id=u;
 select user_id,friends_enabled into other,other_opt from public.yawmi_public_profiles where public_code=upper(trim(p_code));
 if not coalesce(own_opt,false) or not coalesce(other_opt,false) or other is null or other=u
 then raise exception 'FRIENDS_UNAVAILABLE';end if;
 if exists(select 1 from public.yawmi_friend_requests
  where status='accepted' and ((requester=u and recipient=other) or(requester=other and recipient=u)))
 then return 'already_friends';end if;
 if exists(select 1 from public.yawmi_friend_requests where requester=other and recipient=u and status='pending')
 then raise exception 'ACCEPT_INCOMING_REQUEST_FIRST';end if;
 if exists(select 1 from public.yawmi_friend_requests where requester=u and recipient=other and status='pending')
 then return 'pending';end if;
 if (select count(*) from public.yawmi_friend_requests where requester=u and created_at>=now()-interval '1 day')>=20
 then raise exception 'FRIEND_REQUEST_RATE_LIMIT';end if;
 insert into public.yawmi_friend_requests(requester,recipient,status)
 values(u,other,'pending')
 on conflict(requester,recipient) do update set status='pending',created_at=now(),responded_at=null
 where public.yawmi_friend_requests.status='declined' and public.yawmi_friend_requests.created_at<now()-interval '7 days';
 if not found then return 'cooldown';end if;
 return 'pending';
end $$;
