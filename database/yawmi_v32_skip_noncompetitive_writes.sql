-- YAWMI V32: Skip expensive competitive recalculation for changes to private
-- money, diary, goals, books, theme, and other non-competitive app sections.
-- Competitive scoring reads only the day record, task/habit definitions and focus sessions.
DO $migration$
DECLARE ddl text; old_condition text; new_condition text;
BEGIN
 SELECT pg_get_functiondef('public.yawmi_verify_document_activity()'::regprocedure)
 INTO ddl;
 old_condition := 'if tg_op=''UPDATE'' and old.data=new.data then return new;end if;';
 new_condition := 'if tg_op=''UPDATE''
 and old.data->''daily'' is not distinct from new.data->''daily''
 and old.data->''tasks'' is not distinct from new.data->''tasks''
 and old.data->''habits'' is not distinct from new.data->''habits''
 and old.data->''focusSessions'' is not distinct from new.data->''focusSessions''
 then return new;end if;';
 IF position(old_condition in ddl)=0 THEN
  IF position(new_condition in ddl)>0 THEN
   RETURN;
  END IF;
  RAISE EXCEPTION 'EXPECTED_YAWMI_SCORING_GUARD_NOT_FOUND';
 END IF;
 ddl := replace(ddl,old_condition,new_condition);
 EXECUTE ddl;
END $migration$;
-- No additional client privileges required. Existing audit/security/score rules stay intact.
