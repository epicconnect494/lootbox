-- Append-only guards: ledger, receipts, audit, ownership chain, raffle draws, race score events.
CREATE OR REPLACE FUNCTION lb_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'table % is append-only (% blocked)', TG_TABLE_NAME, TG_OP USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ledger_transaction','ledger_entry','fairness_receipt','admin_audit_event','ownership_transfer','raffle_entry','race_score_event','pack_manifest_commitment','raffle_manifest']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_append_only ON %I', t, t);
    EXECUTE format('CREATE TRIGGER %I_append_only BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION lb_block_mutation()', t, t);
  END LOOP;
END $$;

-- raffle_draw rows may only transition status VALID -> SUPERSEDED; every other field is frozen.
CREATE OR REPLACE FUNCTION lb_raffle_draw_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'raffle_draw is append-only'; END IF;
  IF NEW.status = 'SUPERSEDED' AND OLD.status = 'VALID'
     AND NEW.winners::text = OLD.winners::text AND NEW.server_seed = OLD.server_seed AND NEW.public_randomness = OLD.public_randomness
     AND NEW.manifest_hash = OLD.manifest_hash AND NEW.draw_number = OLD.draw_number THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'raffle_draw may only be superseded, never edited';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS raffle_draw_guard ON raffle_draw;
CREATE TRIGGER raffle_draw_guard BEFORE UPDATE OR DELETE ON raffle_draw FOR EACH ROW EXECUTE FUNCTION lb_raffle_draw_guard();

-- Double-entry invariant: every ledger transaction must net to zero at commit time.
CREATE OR REPLACE FUNCTION lb_ledger_balanced() RETURNS trigger AS $$
DECLARE s bigint; c int;
BEGIN
  SELECT COALESCE(SUM(amount_minor),0), COUNT(*) INTO s, c FROM ledger_entry WHERE transaction_id = NEW.transaction_id;
  IF s <> 0 THEN
    RAISE EXCEPTION 'ledger transaction % is unbalanced (sum=%)', NEW.transaction_id, s USING ERRCODE = '23514';
  END IF;
  IF c < 2 THEN
    RAISE EXCEPTION 'ledger transaction % needs at least two entries', NEW.transaction_id USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS ledger_entry_balanced ON ledger_entry;
CREATE CONSTRAINT TRIGGER ledger_entry_balanced AFTER INSERT ON ledger_entry
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION lb_ledger_balanced();

-- Materialized balance maintenance: balance always equals the sum of entries.
CREATE OR REPLACE FUNCTION lb_apply_entry_balance() RETURNS trigger AS $$
BEGIN
  UPDATE wallet_account SET balance_minor = balance_minor + NEW.amount_minor, updated_at = now() WHERE id = NEW.account_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS ledger_entry_apply_balance ON ledger_entry;
CREATE TRIGGER ledger_entry_apply_balance AFTER INSERT ON ledger_entry FOR EACH ROW EXECUTE FUNCTION lb_apply_entry_balance();

-- Unique physical items: an item can be reserved for at most one thing and owned by at most one user.
CREATE OR REPLACE FUNCTION lb_inventory_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'RESERVED' AND OLD.status = 'RESERVED' AND (OLD.reserved_for_id <> NEW.reserved_for_id OR OLD.reserved_for_type <> NEW.reserved_for_type) THEN
    RAISE EXCEPTION 'inventory item % is already reserved', NEW.id USING ERRCODE = '23505';
  END IF;
  IF NEW.status IN ('IN_VAULT','LISTED','SHIP_REQUESTED','SHIPPED','DELIVERED') AND NEW.owner_user_id IS NULL THEN
    RAISE EXCEPTION 'inventory item % in status % must have an owner', NEW.id, NEW.status USING ERRCODE = '23514';
  END IF;
  IF NEW.status IN ('IN_STOCK','RESERVED','INTAKE') AND NEW.owner_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'inventory item % in status % cannot have an owner', NEW.id, NEW.status USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS inventory_item_guard ON inventory_item;
CREATE TRIGGER inventory_item_guard BEFORE UPDATE ON inventory_item FOR EACH ROW EXECUTE FUNCTION lb_inventory_guard();
