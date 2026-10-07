-- NEX-002: Baseline schema migration

-- Ensure pgcrypto is available for gen_random_bytes in UUIDv7 function
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Create schema and secure public
CREATE SCHEMA IF NOT EXISTS nexora;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL PRIVILEGES ON SCHEMA public FROM anon;
REVOKE ALL PRIVILEGES ON SCHEMA public FROM authenticated;

-- Create Roles
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'nexora_app') THEN
    CREATE ROLE nexora_app WITH NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'nexora_migrator') THEN
    CREATE ROLE nexora_migrator WITH NOLOGIN;
  END IF;
END
$$;

-- Grant usage on schema to app
GRANT USAGE ON SCHEMA nexora TO nexora_app;

-- UUIDv7 Function
CREATE OR REPLACE FUNCTION nexora.uuid_generate_v7() RETURNS uuid AS $$
DECLARE
  unix_ts_ms bytea;
  uuid_bytes bytea;
BEGIN
  unix_ts_ms = substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3);
  uuid_bytes = unix_ts_ms || gen_random_bytes(10);
  uuid_bytes = set_byte(uuid_bytes, 6, (b'01110000' | (get_byte(uuid_bytes, 6) & b'00001111'))::integer);
  uuid_bytes = set_byte(uuid_bytes, 8, (b'10000000' | (get_byte(uuid_bytes, 8) & b'00111111'))::integer);
  RETURN encode(uuid_bytes, 'hex')::uuid;
END
$$ LANGUAGE plpgsql VOLATILE;

-- 1. Identity & Store Ops
CREATE TABLE nexora.owners (
    id uuid PRIMARY KEY DEFAULT nexora.uuid_generate_v7(),
    name text NOT NULL,
    email text UNIQUE NOT NULL,
    password_hash text NOT NULL,
    status text NOT NULL CHECK (status IN ('active', 'deactivated')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE nexora.shifts (
    id uuid PRIMARY KEY DEFAULT nexora.uuid_generate_v7(),
    owner_id uuid NOT NULL REFERENCES nexora.owners(id),
    opened_at timestamptz NOT NULL DEFAULT now(),
    closed_at timestamptz,
    closed_by_owner_id uuid REFERENCES nexora.owners(id),
    close_kind text CHECK (close_kind IN ('normal', 'forced')),
    close_reason text,
    business_date_opened date NOT NULL DEFAULT current_date
);
-- Partial unique index: at most one open shift globally
CREATE UNIQUE INDEX shifts_single_open_idx ON nexora.shifts ((true)) WHERE closed_at IS NULL;

CREATE TABLE nexora.settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    version int NOT NULL DEFAULT 1,
    updated_by uuid REFERENCES nexora.owners(id),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Catalog
CREATE TABLE nexora.categories (
    id uuid PRIMARY KEY DEFAULT nexora.uuid_generate_v7(),
    name text NOT NULL,
    slug text UNIQUE NOT NULL,
    sort_order int NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE nexora.products (
    id uuid PRIMARY KEY DEFAULT nexora.uuid_generate_v7(),
    category_id uuid NOT NULL REFERENCES nexora.categories(id),
    name text NOT NULL,
    description text,
    instructions text,
    price numeric(12,2) NOT NULL CHECK (price >= 0),
    duration_label text,
    delivery_type text NOT NULL CHECK (delivery_type IN ('link', 'email', 'account', 'customer_account', 'manual')),
    stock_type text NOT NULL CHECK (stock_type IN ('unique', 'counted', 'unlimited')),
    is_available boolean NOT NULL DEFAULT true,
    max_qty_per_order int,
    refund_allowed boolean NOT NULL DEFAULT false,
    refund_period_days int,
    delivery_template_id uuid, -- FK added later
    status text NOT NULL CHECK (status IN ('active', 'inactive', 'archived')),
    version int NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE nexora.product_fields (
    id uuid PRIMARY KEY DEFAULT nexora.uuid_generate_v7(),
    product_id uuid NOT NULL REFERENCES nexora.products(id),
    key text NOT NULL,
    label text NOT NULL,
    type text NOT NULL,
    required boolean NOT NULL DEFAULT false,
    validation jsonb,
    is_sensitive boolean NOT NULL DEFAULT false,
    sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE nexora.product_images (
    id uuid PRIMARY KEY DEFAULT nexora.uuid_generate_v7(),
    product_id uuid NOT NULL REFERENCES nexora.products(id),
    file_key text NOT NULL,
    is_main boolean NOT NULL DEFAULT false,
    sort_order int NOT NULL DEFAULT 0
);
-- Partial unique: one main image per product
CREATE UNIQUE INDEX product_images_main_idx ON nexora.product_images(product_id) WHERE is_main = true;

-- 3. Messaging
CREATE TABLE nexora.message_templates (
    id uuid PRIMARY KEY DEFAULT nexora.uuid_generate_v7(),
    type text NOT NULL CHECK (type IN ('delivery', 'replacement', 'refund_return', 'customer_service')),
    name text NOT NULL,
    is_default boolean NOT NULL DEFAULT false,
    status text NOT NULL CHECK (status IN ('active', 'archived')),
    current_version_id uuid -- FK added later
);
-- Partial unique: one default template per type
CREATE UNIQUE INDEX message_templates_default_idx ON nexora.message_templates(type) WHERE is_default = true;

CREATE TABLE nexora.message_template_versions (
    id uuid PRIMARY KEY DEFAULT nexora.uuid_generate_v7(),
    template_id uuid NOT NULL REFERENCES nexora.message_templates(id),
    version_no int NOT NULL,
    body text NOT NULL,
    created_by uuid REFERENCES nexora.owners(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- FK for product delivery_template_id and message_templates current_version_id
ALTER TABLE nexora.products ADD CONSTRAINT fk_delivery_template FOREIGN KEY (delivery_template_id) REFERENCES nexora.message_templates(id);
ALTER TABLE nexora.message_templates ADD CONSTRAINT fk_current_version FOREIGN KEY (current_version_id) REFERENCES nexora.message_template_versions(id);

-- 4. Payment Accounts
CREATE TABLE nexora.payment_accounts (
    id uuid PRIMARY KEY DEFAULT nexora.uuid_generate_v7(),
    owner_id uuid NOT NULL REFERENCES nexora.owners(id),
    method_type text NOT NULL CHECK (method_type IN ('vodafone_cash', 'instapay', 'other')),
    identifier text NOT NULL,
    holder_name text,
    display_name text,
    instructions text,
    status text NOT NULL CHECK (status IN ('active', 'inactive')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Inventory
CREATE TABLE nexora.inventory_items (
    id uuid PRIMARY KEY DEFAULT nexora.uuid_generate_v7(),
    product_id uuid NOT NULL REFERENCES nexora.products(id),
    content text NOT NULL, -- Encrypted at app layer
    content_fingerprint text NOT NULL,
    status text NOT NULL CHECK (status IN ('available', 'reserved', 'sold', 'defective', 'removed')),
    supersedes_item_id uuid REFERENCES nexora.inventory_items(id),
    added_by uuid REFERENCES nexora.owners(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    retired_by uuid REFERENCES nexora.owners(id),
    retired_at timestamptz
);
-- Partial unique: duplicate fingerprint check (MD-INV-04)
CREATE UNIQUE INDEX inventory_items_fingerprint_idx ON nexora.inventory_items(product_id, content_fingerprint) WHERE status <> 'removed';

CREATE TABLE nexora.stock_pools (
    product_id uuid PRIMARY KEY REFERENCES nexora.products(id),
    available int NOT NULL DEFAULT 0 CHECK (available >= 0),
    reserved int NOT NULL DEFAULT 0 CHECK (reserved >= 0),
    sold int NOT NULL DEFAULT 0 CHECK (sold >= 0),
    defective int NOT NULL DEFAULT 0 CHECK (defective >= 0),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE nexora.inventory_movements (
    id uuid PRIMARY KEY DEFAULT nexora.uuid_generate_v7(),
    product_id uuid NOT NULL REFERENCES nexora.products(id),
    item_id uuid REFERENCES nexora.inventory_items(id),
    qty int NOT NULL CHECK (qty > 0),
    from_state text,
    to_state text NOT NULL,
    reason text NOT NULL CHECK (reason IN ('added', 'reserved', 'released', 'expired', 'sold', 'replaced', 'defective', 'removed', 'adjusted')),
    order_id uuid, -- FK later
    unit_id uuid, -- FK later
    actor_type text NOT NULL CHECK (actor_type IN ('owner', 'customer', 'system')),
    actor_owner_id uuid REFERENCES nexora.owners(id),
    occurred_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Orders
CREATE TABLE nexora.orders (
    id uuid PRIMARY KEY DEFAULT nexora.uuid_generate_v7(),
    order_number text UNIQUE NOT NULL,
    status text NOT NULL CHECK (status IN ('reserved', 'payment_submitted', 'under_review', 'accepted', 'preparing', 'delivered', 'completed', 'expired', 'rejected', 'cancelled')),
    closing_reason text,
    closing_note text,
    
    product_id uuid NOT NULL REFERENCES nexora.products(id),
    product_snapshot jsonb NOT NULL,
    quantity int NOT NULL CHECK (quantity > 0),
    unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
    total_amount numeric(12,2) NOT NULL CHECK (total_amount >= 0),
    currency text NOT NULL DEFAULT 'EGP',
    
    shift_id uuid NOT NULL REFERENCES nexora.shifts(id),
    payment_owner_id uuid NOT NULL REFERENCES nexora.owners(id),
    offered_payments jsonb NOT NULL,
    payment_account_id uuid REFERENCES nexora.payment_accounts(id),
    payment_snapshot jsonb,
    
    hold_expires_at timestamptz,
    hold_kind text NOT NULL CHECK (hold_kind IN ('checkout', 'review', 'none')),
    hold_duration_sec int NOT NULL,
    max_extension_sec int NOT NULL,
    extended_sec int NOT NULL DEFAULT 0,
    
    customer_name text,
    customer_whatsapp_e164 text,
    transfer_number_norm text,
    customer_fields jsonb,
    current_submission_id uuid, -- FK later
    
    review_claimed_by uuid REFERENCES nexora.owners(id),
    review_claim_expires_at timestamptz,
    
    delivered_quantity int NOT NULL DEFAULT 0 CHECK (delivered_quantity >= 0),
    
    access_token_hash text NOT NULL,
    client_request_id text UNIQUE NOT NULL,
    client_fingerprint_hash text NOT NULL,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    submitted_at timestamptz,
    accepted_at timestamptz,
    completed_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),
    version int NOT NULL DEFAULT 1
);

-- Add missing FKs on inventory_movements
ALTER TABLE nexora.inventory_movements ADD CONSTRAINT fk_im_order FOREIGN KEY (order_id) REFERENCES nexora.orders(id);

CREATE TABLE nexora.replacement_cases (
    id uuid PRIMARY KEY DEFAULT nexora.uuid_generate_v7(),
    order_id uuid NOT NULL REFERENCES nexora.orders(id),
    support_case_id uuid, -- FK later
    reason text NOT NULL,
    status text NOT NULL CHECK (status IN ('open', 'processing', 'completed', 'failed')),
    case_owner_id uuid REFERENCES nexora.owners(id),
    created_by uuid REFERENCES nexora.owners(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    closed_at timestamptz
);

CREATE TABLE nexora.refund_cases (
    id uuid PRIMARY KEY DEFAULT nexora.uuid_generate_v7(),
    order_id uuid NOT NULL REFERENCES nexora.orders(id),
    kind text NOT NULL CHECK (kind IN ('post_delivery', 'failed_replacement', 'payment_return')),
    status text NOT NULL CHECK (status IN ('open', 'completed', 'cancelled')),
    reason text NOT NULL,
    override_reason text,
    quantity int NOT NULL CHECK (quantity > 0),
    amount numeric(12,2) NOT NULL CHECK (amount >= 0),
    recipient_number text NOT NULL,
    payment_method text NOT NULL,
    charged_owner_id uuid NOT NULL REFERENCES nexora.owners(id),
    initiated_by uuid NOT NULL REFERENCES nexora.owners(id),
    completed_by uuid REFERENCES nexora.owners(id),
    completed_at timestamptz,
    external_reference text,
    support_case_id uuid -- FK later
);

CREATE TABLE nexora.deliveries (
    id uuid PRIMARY KEY DEFAULT nexora.uuid_generate_v7(),
    order_id uuid NOT NULL REFERENCES nexora.orders(id),
    kind text NOT NULL CHECK (kind IN ('initial', 'replacement')),
    replacement_case_id uuid REFERENCES nexora.replacement_cases(id),
    quantity int NOT NULL CHECK (quantity > 0),
    state text NOT NULL CHECK (state IN ('preparing', 'ready_to_send', 'sent_waiting_confirmation', 'delivered', 'reversed', 'cancelled')),
    prepared_by uuid REFERENCES nexora.owners(id),
    delivered_by uuid REFERENCES nexora.owners(id),
    prepared_at timestamptz NOT NULL DEFAULT now(),
    confirmed_at timestamptz,
    reversed_by uuid REFERENCES nexora.owners(id),
    reversed_at timestamptz,
    reversed_reason text,
    created_at timestamptz NOT NULL DEFAULT now()
);
-- Partial unique: one active delivery per order
CREATE UNIQUE INDEX deliveries_active_idx ON nexora.deliveries(order_id) WHERE state IN ('preparing', 'ready_to_send', 'sent_waiting_confirmation');

CREATE TABLE nexora.order_units (
    id uuid PRIMARY KEY DEFAULT nexora.uuid_generate_v7(),
    order_id uuid NOT NULL REFERENCES nexora.orders(id),
    state text NOT NULL CHECK (state IN ('held', 'released', 'delivered', 'replaced', 'refunded')),
    inventory_item_id uuid REFERENCES nexora.inventory_items(id),
    delivery_id uuid REFERENCES nexora.deliveries(id),
    delivered_at timestamptz,
    replaces_unit_id uuid REFERENCES nexora.order_units(id) UNIQUE,
    replacement_case_id uuid REFERENCES nexora.replacement_cases(id),
    refund_case_id uuid REFERENCES nexora.refund_cases(id),
    released_reason text,
    created_at timestamptz NOT NULL DEFAULT now()
);
-- Partial unique: one active unit per item
CREATE UNIQUE INDEX order_units_active_item_idx ON nexora.order_units(inventory_item_id) WHERE state IN ('held', 'delivered');

ALTER TABLE nexora.inventory_movements ADD CONSTRAINT fk_im_unit FOREIGN KEY (unit_id) REFERENCES nexora.order_units(id);

CREATE TABLE nexora.order_flags (
    id uuid PRIMARY KEY DEFAULT nexora.uuid_generate_v7(),
    order_id uuid NOT NULL REFERENCES nexora.orders(id),
    flag text NOT NULL CHECK (flag IN ('needs_customer_service', 'late_submission', 'needs_correction', 'payment_conflict')),
    raised_by_type text NOT NULL,
    raised_by_actor text,
    raised_at timestamptz NOT NULL DEFAULT now(),
    cleared_by uuid REFERENCES nexora.owners(id),
    cleared_at timestamptz,
    note text
);
CREATE UNIQUE INDEX order_flags_active_idx ON nexora.order_flags(order_id, flag) WHERE cleared_at IS NULL;

CREATE TABLE nexora.order_status_history (
    id uuid PRIMARY KEY DEFAULT nexora.uuid_generate_v7(),
    order_id uuid NOT NULL REFERENCES nexora.orders(id),
    from_status text,
    to_status text NOT NULL,
    reason_code text,
    note text,
    actor_type text NOT NULL CHECK (actor_type IN ('customer', 'owner', 'system')),
    actor_owner_id uuid REFERENCES nexora.owners(id),
    occurred_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Payment Reviews
CREATE TABLE nexora.payment_submissions (
    id uuid PRIMARY KEY DEFAULT nexora.uuid_generate_v7(),
    order_id uuid NOT NULL REFERENCES nexora.orders(id),
    attempt_no int NOT NULL,
    kind text NOT NULL CHECK (kind IN ('normal', 'late', 'correction')),
    customer_name text NOT NULL,
    whatsapp_e164 text NOT NULL,
    transfer_number_raw text NOT NULL,
    transfer_number_norm text NOT NULL,
    payment_method text NOT NULL,
    paid_amount numeric(12,2) NOT NULL CHECK (paid_amount >= 0),
    proof_file_key text,
    fields jsonb,
    outcome text CHECK (outcome IN ('received', 'superseded', 'no_stock')),
    submitted_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (order_id, attempt_no)
);
ALTER TABLE nexora.orders ADD CONSTRAINT fk_order_submission FOREIGN KEY (current_submission_id) REFERENCES nexora.payment_submissions(id);

CREATE TABLE nexora.payment_reviews (
    id uuid PRIMARY KEY DEFAULT nexora.uuid_generate_v7(),
    order_id uuid NOT NULL REFERENCES nexora.orders(id),
    submission_id uuid NOT NULL REFERENCES nexora.payment_submissions(id),
    reviewer_owner_id uuid NOT NULL REFERENCES nexora.owners(id),
    decision text NOT NULL CHECK (decision IN ('accepted', 'rejected', 'needs_correction')),
    reason text,
    verified_amount numeric(12,2) CHECK (verified_amount >= 0),
    accepted_reference_norm text,
    reopened_from_review_id uuid REFERENCES nexora.payment_reviews(id),
    payment_owner_id uuid NOT NULL REFERENCES nexora.owners(id),
    decided_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payment_reviews_accepted_submission_idx ON nexora.payment_reviews(submission_id) WHERE decision = 'accepted';

-- 8. Deliveries & Errors
CREATE TABLE nexora.delivery_messages (
    id uuid PRIMARY KEY DEFAULT nexora.uuid_generate_v7(),
    delivery_id uuid NOT NULL REFERENCES nexora.deliveries(id),
    template_version_id uuid NOT NULL REFERENCES nexora.message_template_versions(id),
    whatsapp_e164 text NOT NULL,
    body_generated text NOT NULL,
    body_final text NOT NULL,
    status text NOT NULL CHECK (status IN ('generated', 'opened', 'marked_sent')),
    generated_by uuid NOT NULL REFERENCES nexora.owners(id),
    generated_at timestamptz NOT NULL DEFAULT now(),
    opened_at timestamptz,
    marked_sent_by uuid REFERENCES nexora.owners(id),
    marked_sent_at timestamptz,
    supersedes_message_id uuid REFERENCES nexora.delivery_messages(id),
    resend_reason text
);

CREATE TABLE nexora.delivery_errors (
    id uuid PRIMARY KEY DEFAULT nexora.uuid_generate_v7(),
    order_id uuid NOT NULL REFERENCES nexora.orders(id),
    delivery_id uuid REFERENCES nexora.deliveries(id),
    error_type text NOT NULL CHECK (error_type IN ('wrong_credentials', 'wrong_account', 'wrong_link', 'wrong_message', 'other')),
    responsible_owner_id uuid NOT NULL REFERENCES nexora.owners(id),
    value_amount numeric(12,2),
    description text,
    recorded_by uuid NOT NULL REFERENCES nexora.owners(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 9. Aftercare Support Cases
CREATE TABLE nexora.support_cases (
    id uuid PRIMARY KEY DEFAULT nexora.uuid_generate_v7(),
    order_id uuid REFERENCES nexora.orders(id),
    origin text NOT NULL CHECK (origin IN ('late_payment_no_stock', 'delivery_problem', 'payment_issue', 'general')),
    customer_name text,
    contact_e164 text,
    subject text NOT NULL,
    notes text,
    status text NOT NULL CHECK (status IN ('open', 'contacted', 'waiting', 'resolved', 'closed')),
    resolution text CHECK (resolution IN ('fulfill_order', 'wait_for_stock', 'refund_return', 'close_reject')),
    assigned_owner_id uuid REFERENCES nexora.owners(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz
);
ALTER TABLE nexora.replacement_cases ADD CONSTRAINT fk_rc_sc FOREIGN KEY (support_case_id) REFERENCES nexora.support_cases(id);
ALTER TABLE nexora.refund_cases ADD CONSTRAINT fk_rfc_sc FOREIGN KEY (support_case_id) REFERENCES nexora.support_cases(id);

-- 10. Finance
CREATE TABLE nexora.wallets (
    id uuid PRIMARY KEY DEFAULT nexora.uuid_generate_v7(),
    owner_id uuid UNIQUE NOT NULL REFERENCES nexora.owners(id),
    balance numeric(12,2) NOT NULL DEFAULT 0,
    version int NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE nexora.ledger_entries (
    id uuid PRIMARY KEY DEFAULT nexora.uuid_generate_v7(),
    wallet_id uuid NOT NULL REFERENCES nexora.wallets(id),
    kind text NOT NULL CHECK (kind IN ('sale', 'refund', 'expense', 'transfer_out', 'transfer_in', 'adjustment')),
    amount numeric(12,2) NOT NULL, -- Signed amounts allowed
    occurred_at timestamptz NOT NULL DEFAULT now(),
    business_date date NOT NULL,
    source_type text NOT NULL CHECK (source_type IN ('delivery', 'refund_case', 'expense', 'transfer', 'manual')),
    source_id uuid NOT NULL,
    order_id uuid REFERENCES nexora.orders(id),
    performed_by_owner_id uuid REFERENCES nexora.owners(id),
    group_id uuid,
    reverses_entry_id uuid REFERENCES nexora.ledger_entries(id) UNIQUE,
    reason text,
    idempotency_key text,
    created_at timestamptz NOT NULL DEFAULT now()
);
-- Partial unique: one sale per delivery, one refund per case
CREATE UNIQUE INDEX ledger_entries_source_idx ON nexora.ledger_entries(source_type, source_id, kind) WHERE reverses_entry_id IS NULL;

CREATE TABLE nexora.transfers (
    id uuid PRIMARY KEY DEFAULT nexora.uuid_generate_v7(),
    sender_owner_id uuid NOT NULL REFERENCES nexora.owners(id),
    receiver_owner_id uuid NOT NULL REFERENCES nexora.owners(id),
    amount numeric(12,2) NOT NULL CHECK (amount > 0),
    note text,
    group_id uuid NOT NULL,
    reversal_of_transfer_id uuid REFERENCES nexora.transfers(id) UNIQUE,
    created_by uuid NOT NULL REFERENCES nexora.owners(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    idempotency_key text UNIQUE NOT NULL,
    CHECK (sender_owner_id <> receiver_owner_id)
);

CREATE TABLE nexora.expenses (
    id uuid PRIMARY KEY DEFAULT nexora.uuid_generate_v7(),
    responsible_owner_id uuid NOT NULL REFERENCES nexora.owners(id),
    category text NOT NULL,
    category_note text,
    amount numeric(12,2) NOT NULL CHECK (amount > 0),
    description text,
    expense_date date NOT NULL,
    recorded_by uuid NOT NULL REFERENCES nexora.owners(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    idempotency_key text UNIQUE NOT NULL
);

-- 11. Audit Log & Idempotency
CREATE TABLE nexora.audit_log (
    id uuid PRIMARY KEY DEFAULT nexora.uuid_generate_v7(),
    occurred_at timestamptz NOT NULL DEFAULT now(),
    actor_type text NOT NULL,
    actor_owner_id uuid REFERENCES nexora.owners(id),
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    order_id uuid REFERENCES nexora.orders(id),
    before jsonb,
    after jsonb,
    reason text,
    request_id text,
    ip_hash text
);

CREATE TABLE nexora.idempotency_keys (
    key text PRIMARY KEY,
    scope text NOT NULL,
    operation text NOT NULL,
    request_fingerprint text,
    response jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
);

-- TRIGGERS: Immutability for 🔒 tables
CREATE OR REPLACE FUNCTION nexora.raise_immutable_error()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Table is immutable. UPDATE and DELETE are not allowed.';
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER trg_immutable_message_template_versions
BEFORE UPDATE OR DELETE ON nexora.message_template_versions
FOR EACH ROW EXECUTE FUNCTION nexora.raise_immutable_error();

CREATE TRIGGER trg_immutable_inventory_movements
BEFORE UPDATE OR DELETE ON nexora.inventory_movements
FOR EACH ROW EXECUTE FUNCTION nexora.raise_immutable_error();

CREATE TRIGGER trg_immutable_order_status_history
BEFORE UPDATE OR DELETE ON nexora.order_status_history
FOR EACH ROW EXECUTE FUNCTION nexora.raise_immutable_error();

CREATE TRIGGER trg_immutable_payment_submissions
BEFORE UPDATE OR DELETE ON nexora.payment_submissions
FOR EACH ROW EXECUTE FUNCTION nexora.raise_immutable_error();

CREATE TRIGGER trg_immutable_delivery_errors
BEFORE UPDATE OR DELETE ON nexora.delivery_errors
FOR EACH ROW EXECUTE FUNCTION nexora.raise_immutable_error();

CREATE TRIGGER trg_immutable_ledger_entries
BEFORE UPDATE OR DELETE ON nexora.ledger_entries
FOR EACH ROW EXECUTE FUNCTION nexora.raise_immutable_error();

CREATE TRIGGER trg_immutable_audit_log
BEFORE UPDATE OR DELETE ON nexora.audit_log
FOR EACH ROW EXECUTE FUNCTION nexora.raise_immutable_error();

-- App User Privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA nexora TO nexora_app;
-- Revoke update and delete on immutable tables
REVOKE UPDATE, DELETE ON nexora.message_template_versions FROM nexora_app;
REVOKE UPDATE, DELETE ON nexora.inventory_movements FROM nexora_app;
REVOKE UPDATE, DELETE ON nexora.order_status_history FROM nexora_app;
REVOKE UPDATE, DELETE ON nexora.payment_submissions FROM nexora_app;
REVOKE UPDATE, DELETE ON nexora.delivery_errors FROM nexora_app;
REVOKE UPDATE, DELETE ON nexora.ledger_entries FROM nexora_app;
REVOKE UPDATE, DELETE ON nexora.audit_log FROM nexora_app;
-- Revoke truncate to be safe
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA nexora FROM nexora_app;

-- Migrator User Privileges
GRANT ALL PRIVILEGES ON SCHEMA nexora TO nexora_migrator;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA nexora TO nexora_migrator;
-- Ensure migrator can truncate if needed and alter etc.
