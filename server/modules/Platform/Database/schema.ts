import {
  pgSchema,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  date,
  jsonb
} from 'drizzle-orm/pg-core';

export const nexora = pgSchema('nexora');

// Helper for timestamptz columns with default now()
const tstz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const createdAt = () => tstz('created_at').defaultNow().notNull();
const updatedAt = () => tstz('updated_at').defaultNow().notNull();

// 1. Identity & Store Ops
export const owners = nexora.table('owners', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  status: text('status', { enum: ['active', 'deactivated'] }).notNull(),
  createdAt: createdAt(),
});

export const shifts = nexora.table('shifts', {
  id: uuid('id').primaryKey(),
  ownerId: uuid('owner_id').notNull().references(() => owners.id),
  openedAt: tstz('opened_at').defaultNow().notNull(),
  closedAt: tstz('closed_at'),
  closedByOwnerId: uuid('closed_by_owner_id').references(() => owners.id),
  closeKind: text('close_kind', { enum: ['normal', 'forced'] }),
  closeReason: text('close_reason'),
  businessDateOpened: date('business_date_opened', { mode: 'string' }).notNull(),
});

export const settings = nexora.table('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  version: integer('version').default(1).notNull(),
  updatedBy: uuid('updated_by').references(() => owners.id),
  updatedAt: updatedAt(),
});

// 2. Catalog
export const categories = nexora.table('categories', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
});

export const messageTemplates = nexora.table('message_templates', {
  id: uuid('id').primaryKey(),
  type: text('type', { enum: ['delivery', 'replacement', 'refund_return', 'customer_service'] }).notNull(),
  name: text('name').notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  status: text('status', { enum: ['active', 'archived'] }).notNull(),
  currentVersionId: uuid('current_version_id'), // FK mapped below
});

export const messageTemplateVersions = nexora.table('message_template_versions', {
  id: uuid('id').primaryKey(),
  templateId: uuid('template_id').notNull().references(() => messageTemplates.id),
  versionNo: integer('version_no').notNull(),
  body: text('body').notNull(),
  createdBy: uuid('created_by').references(() => owners.id),
  createdAt: createdAt(),
});

export const products = nexora.table('products', {
  id: uuid('id').primaryKey(),
  categoryId: uuid('category_id').notNull().references(() => categories.id),
  name: text('name').notNull(),
  description: text('description'),
  instructions: text('instructions'),
  price: numeric('price', { precision: 12, scale: 2 }).notNull(),
  durationLabel: text('duration_label'),
  deliveryType: text('delivery_type', { enum: ['link', 'email', 'account', 'customer_account', 'manual'] }).notNull(),
  stockType: text('stock_type', { enum: ['unique', 'counted', 'unlimited'] }).notNull(),
  isAvailable: boolean('is_available').default(true).notNull(),
  maxQtyPerOrder: integer('max_qty_per_order'),
  refundAllowed: boolean('refund_allowed').default(false).notNull(),
  refundPeriodDays: integer('refund_period_days'),
  deliveryTemplateId: uuid('delivery_template_id').references(() => messageTemplates.id),
  status: text('status', { enum: ['active', 'inactive', 'archived'] }).notNull(),
  version: integer('version').default(1).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const productFields = nexora.table('product_fields', {
  id: uuid('id').primaryKey(),
  productId: uuid('product_id').notNull().references(() => products.id),
  key: text('key').notNull(),
  label: text('label').notNull(),
  type: text('type').notNull(),
  required: boolean('required').default(false).notNull(),
  validation: jsonb('validation'),
  isSensitive: boolean('is_sensitive').default(false).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
});

export const productImages = nexora.table('product_images', {
  id: uuid('id').primaryKey(),
  productId: uuid('product_id').notNull().references(() => products.id),
  fileKey: text('file_key').notNull(),
  isMain: boolean('is_main').default(false).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
});

// 4. Payment Accounts
export const paymentAccounts = nexora.table('payment_accounts', {
  id: uuid('id').primaryKey(),
  ownerId: uuid('owner_id').notNull().references(() => owners.id),
  methodType: text('method_type', { enum: ['vodafone_cash', 'instapay', 'other'] }).notNull(),
  identifier: text('identifier').notNull(),
  holderName: text('holder_name'),
  displayName: text('display_name'),
  instructions: text('instructions'),
  status: text('status', { enum: ['active', 'inactive'] }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// 5. Inventory
export const inventoryItems = nexora.table('inventory_items', {
  id: uuid('id').primaryKey(),
  productId: uuid('product_id').notNull().references(() => products.id),
  content: text('content').notNull(),
  contentFingerprint: text('content_fingerprint').notNull(),
  status: text('status', { enum: ['available', 'reserved', 'sold', 'defective', 'removed'] }).notNull(),
  supersedesItemId: uuid('supersedes_item_id'), // Self ref
  addedBy: uuid('added_by').references(() => owners.id),
  createdAt: createdAt(),
  retiredBy: uuid('retired_by').references(() => owners.id),
  retiredAt: tstz('retired_at'),
});

export const stockPools = nexora.table('stock_pools', {
  productId: uuid('product_id').primaryKey().references(() => products.id),
  available: integer('available').default(0).notNull(),
  reserved: integer('reserved').default(0).notNull(),
  sold: integer('sold').default(0).notNull(),
  defective: integer('defective').default(0).notNull(),
  updatedAt: updatedAt(),
});

export const inventoryMovements = nexora.table('inventory_movements', {
  id: uuid('id').primaryKey(),
  productId: uuid('product_id').notNull().references(() => products.id),
  itemId: uuid('item_id').references(() => inventoryItems.id),
  qty: integer('qty').notNull(),
  fromState: text('from_state'),
  toState: text('to_state').notNull(),
  reason: text('reason', { enum: ['added', 'reserved', 'released', 'expired', 'sold', 'replaced', 'defective', 'removed', 'adjusted'] }).notNull(),
  orderId: uuid('order_id'), // FK to orders
  unitId: uuid('unit_id'), // FK to order_units
  actorType: text('actor_type', { enum: ['owner', 'customer', 'system'] }).notNull(),
  actorOwnerId: uuid('actor_owner_id').references(() => owners.id),
  occurredAt: createdAt(),
});

// 6. Orders
export const orders = nexora.table('orders', {
  id: uuid('id').primaryKey(),
  orderNumber: text('order_number').notNull().unique(),
  status: text('status', { enum: ['reserved', 'payment_submitted', 'under_review', 'accepted', 'preparing', 'delivered', 'completed', 'expired', 'rejected', 'cancelled'] }).notNull(),
  closingReason: text('closing_reason'),
  closingNote: text('closing_note'),
  
  productId: uuid('product_id').notNull().references(() => products.id),
  productSnapshot: jsonb('product_snapshot').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  currency: text('currency').default('EGP').notNull(),
  
  shiftId: uuid('shift_id').notNull().references(() => shifts.id),
  paymentOwnerId: uuid('payment_owner_id').notNull().references(() => owners.id),
  offeredPayments: jsonb('offered_payments').notNull(),
  paymentAccountId: uuid('payment_account_id').references(() => paymentAccounts.id),
  paymentSnapshot: jsonb('payment_snapshot'),
  
  holdExpiresAt: tstz('hold_expires_at'),
  holdKind: text('hold_kind', { enum: ['checkout', 'review', 'none'] }).notNull(),
  holdDurationSec: integer('hold_duration_sec').notNull(),
  maxExtensionSec: integer('max_extension_sec').notNull(),
  extendedSec: integer('extended_sec').default(0).notNull(),
  
  customerName: text('customer_name'),
  customerWhatsappE164: text('customer_whatsapp_e164'),
  transferNumberNorm: text('transfer_number_norm'),
  customerFields: jsonb('customer_fields'),
  currentSubmissionId: uuid('current_submission_id'), // FK to payment_submissions
  
  reviewClaimedBy: uuid('review_claimed_by').references(() => owners.id),
  reviewClaimExpiresAt: tstz('review_claim_expires_at'),
  
  deliveredQuantity: integer('delivered_quantity').default(0).notNull(),
  
  accessTokenHash: text('access_token_hash').notNull(),
  clientRequestId: text('client_request_id').notNull().unique(),
  clientFingerprintHash: text('client_fingerprint_hash').notNull(),
  
  createdAt: createdAt(),
  submittedAt: tstz('submitted_at'),
  acceptedAt: tstz('accepted_at'),
  completedAt: tstz('completed_at'),
  updatedAt: updatedAt(),
  version: integer('version').default(1).notNull(),
});

export const supportCases = nexora.table('support_cases', {
  id: uuid('id').primaryKey(),
  orderId: uuid('order_id').references(() => orders.id),
  origin: text('origin', { enum: ['late_payment_no_stock', 'delivery_problem', 'payment_issue', 'general'] }).notNull(),
  customerName: text('customer_name'),
  contactE164: text('contact_e164'),
  subject: text('subject').notNull(),
  notes: text('notes'),
  status: text('status', { enum: ['open', 'contacted', 'waiting', 'resolved', 'closed'] }).notNull(),
  resolution: text('resolution', { enum: ['fulfill_order', 'wait_for_stock', 'refund_return', 'close_reject'] }),
  assignedOwnerId: uuid('assigned_owner_id').references(() => owners.id),
  createdAt: createdAt(),
  resolvedAt: tstz('resolved_at'),
});

export const replacementCases = nexora.table('replacement_cases', {
  id: uuid('id').primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id),
  supportCaseId: uuid('support_case_id').references(() => supportCases.id),
  reason: text('reason').notNull(),
  status: text('status', { enum: ['open', 'processing', 'completed', 'failed'] }).notNull(),
  caseOwnerId: uuid('case_owner_id').references(() => owners.id),
  createdBy: uuid('created_by').references(() => owners.id),
  createdAt: createdAt(),
  closedAt: tstz('closed_at'),
});

export const refundCases = nexora.table('refund_cases', {
  id: uuid('id').primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id),
  kind: text('kind', { enum: ['post_delivery', 'failed_replacement', 'payment_return'] }).notNull(),
  status: text('status', { enum: ['open', 'completed', 'cancelled'] }).notNull(),
  reason: text('reason').notNull(),
  overrideReason: text('override_reason'),
  quantity: integer('quantity').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  recipientNumber: text('recipient_number').notNull(),
  paymentMethod: text('payment_method').notNull(),
  chargedOwnerId: uuid('charged_owner_id').notNull().references(() => owners.id),
  initiatedBy: uuid('initiated_by').notNull().references(() => owners.id),
  completedBy: uuid('completed_by').references(() => owners.id),
  completedAt: tstz('completed_at'),
  externalReference: text('external_reference'),
  supportCaseId: uuid('support_case_id').references(() => supportCases.id),
});

export const deliveries = nexora.table('deliveries', {
  id: uuid('id').primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id),
  kind: text('kind', { enum: ['initial', 'replacement'] }).notNull(),
  replacementCaseId: uuid('replacement_case_id').references(() => replacementCases.id),
  quantity: integer('quantity').notNull(),
  state: text('state', { enum: ['preparing', 'ready_to_send', 'sent_waiting_confirmation', 'delivered', 'reversed', 'cancelled'] }).notNull(),
  preparedBy: uuid('prepared_by').references(() => owners.id),
  deliveredBy: uuid('delivered_by').references(() => owners.id),
  preparedAt: tstz('prepared_at').defaultNow().notNull(),
  confirmedAt: tstz('confirmed_at'),
  reversedBy: uuid('reversed_by').references(() => owners.id),
  reversedAt: tstz('reversed_at'),
  reversedReason: text('reversed_reason'),
  createdAt: createdAt(),
});

export const orderUnits = nexora.table('order_units', {
  id: uuid('id').primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id),
  state: text('state', { enum: ['held', 'released', 'delivered', 'replaced', 'refunded'] }).notNull(),
  inventoryItemId: uuid('inventory_item_id').references(() => inventoryItems.id),
  deliveryId: uuid('delivery_id').references(() => deliveries.id),
  deliveredAt: tstz('delivered_at'),
  replacesUnitId: uuid('replaces_unit_id'), // Self Ref UNIQUE
  replacementCaseId: uuid('replacement_case_id').references(() => replacementCases.id),
  refundCaseId: uuid('refund_case_id').references(() => refundCases.id),
  releasedReason: text('released_reason'),
  createdAt: createdAt(),
});

export const orderFlags = nexora.table('order_flags', {
  id: uuid('id').primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id),
  flag: text('flag', { enum: ['needs_customer_service', 'late_submission', 'needs_correction', 'payment_conflict'] }).notNull(),
  raisedByType: text('raised_by_type').notNull(),
  raisedByActor: text('raised_by_actor'),
  raisedAt: tstz('raised_at').defaultNow().notNull(),
  clearedBy: uuid('cleared_by').references(() => owners.id),
  clearedAt: tstz('cleared_at'),
  note: text('note'),
});

export const orderStatusHistory = nexora.table('order_status_history', {
  id: uuid('id').primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id),
  fromStatus: text('from_status'),
  toStatus: text('to_status').notNull(),
  reasonCode: text('reason_code'),
  note: text('note'),
  actorType: text('actor_type', { enum: ['customer', 'owner', 'system'] }).notNull(),
  actorOwnerId: uuid('actor_owner_id').references(() => owners.id),
  occurredAt: createdAt(),
});

// 7. Payment Reviews
export const paymentSubmissions = nexora.table('payment_submissions', {
  id: uuid('id').primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id),
  attemptNo: integer('attempt_no').notNull(),
  kind: text('kind', { enum: ['normal', 'late', 'correction'] }).notNull(),
  customerName: text('customer_name').notNull(),
  whatsappE164: text('whatsapp_e164').notNull(),
  transferNumberRaw: text('transfer_number_raw').notNull(),
  transferNumberNorm: text('transfer_number_norm').notNull(),
  paymentMethod: text('payment_method').notNull(),
  paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }).notNull(),
  proofFileKey: text('proof_file_key'),
  fields: jsonb('fields'),
  outcome: text('outcome', { enum: ['received', 'superseded', 'no_stock'] }),
  submittedAt: tstz('submitted_at').defaultNow().notNull(),
});

export const paymentReviews = nexora.table('payment_reviews', {
  id: uuid('id').primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id),
  submissionId: uuid('submission_id').notNull().references(() => paymentSubmissions.id),
  reviewerOwnerId: uuid('reviewer_owner_id').notNull().references(() => owners.id),
  decision: text('decision', { enum: ['accepted', 'rejected', 'needs_correction'] }).notNull(),
  reason: text('reason'),
  verifiedAmount: numeric('verified_amount', { precision: 12, scale: 2 }),
  acceptedReferenceNorm: text('accepted_reference_norm'),
  reopenedFromReviewId: uuid('reopened_from_review_id'), // Self Ref
  paymentOwnerId: uuid('payment_owner_id').notNull().references(() => owners.id),
  decidedAt: tstz('decided_at').defaultNow().notNull(),
});

// 8. Deliveries & Errors
export const deliveryMessages = nexora.table('delivery_messages', {
  id: uuid('id').primaryKey(),
  deliveryId: uuid('delivery_id').notNull().references(() => deliveries.id),
  templateVersionId: uuid('template_version_id').notNull().references(() => messageTemplateVersions.id),
  whatsappE164: text('whatsapp_e164').notNull(),
  bodyGenerated: text('body_generated').notNull(),
  bodyFinal: text('body_final').notNull(),
  status: text('status', { enum: ['generated', 'opened', 'marked_sent'] }).notNull(),
  generatedBy: uuid('generated_by').notNull().references(() => owners.id),
  generatedAt: tstz('generated_at').defaultNow().notNull(),
  openedAt: tstz('opened_at'),
  markedSentBy: uuid('marked_sent_by').references(() => owners.id),
  markedSentAt: tstz('marked_sent_at'),
  supersedesMessageId: uuid('supersedes_message_id'), // Self ref
  resendReason: text('resend_reason'),
});

export const deliveryErrors = nexora.table('delivery_errors', {
  id: uuid('id').primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id),
  deliveryId: uuid('delivery_id').references(() => deliveries.id),
  errorType: text('error_type', { enum: ['wrong_credentials', 'wrong_account', 'wrong_link', 'wrong_message', 'other'] }).notNull(),
  responsibleOwnerId: uuid('responsible_owner_id').notNull().references(() => owners.id),
  valueAmount: numeric('value_amount', { precision: 12, scale: 2 }),
  description: text('description'),
  recordedBy: uuid('recorded_by').notNull().references(() => owners.id),
  createdAt: createdAt(),
});

// 10. Finance
export const wallets = nexora.table('wallets', {
  id: uuid('id').primaryKey(),
  ownerId: uuid('owner_id').notNull().unique().references(() => owners.id),
  balance: numeric('balance', { precision: 12, scale: 2 }).default('0').notNull(),
  version: integer('version').default(1).notNull(),
  updatedAt: updatedAt(),
});

export const ledgerEntries = nexora.table('ledger_entries', {
  id: uuid('id').primaryKey(),
  walletId: uuid('wallet_id').notNull().references(() => wallets.id),
  kind: text('kind', { enum: ['sale', 'refund', 'expense', 'transfer_out', 'transfer_in', 'adjustment'] }).notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  occurredAt: tstz('occurred_at').defaultNow().notNull(),
  businessDate: date('business_date', { mode: 'string' }).notNull(),
  sourceType: text('source_type', { enum: ['delivery', 'refund_case', 'expense', 'transfer', 'manual'] }).notNull(),
  sourceId: uuid('source_id').notNull(),
  orderId: uuid('order_id').references(() => orders.id),
  performedByOwnerId: uuid('performed_by_owner_id').references(() => owners.id),
  groupId: uuid('group_id'),
  reversesEntryId: uuid('reverses_entry_id'), // Self Ref UNIQUE
  reason: text('reason'),
  idempotencyKey: text('idempotency_key'),
  createdAt: createdAt(),
});

export const transfers = nexora.table('transfers', {
  id: uuid('id').primaryKey(),
  senderOwnerId: uuid('sender_owner_id').notNull().references(() => owners.id),
  receiverOwnerId: uuid('receiver_owner_id').notNull().references(() => owners.id),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  note: text('note'),
  groupId: uuid('group_id').notNull(),
  reversalOfTransferId: uuid('reversal_of_transfer_id'), // Self ref UNIQUE
  createdBy: uuid('created_by').notNull().references(() => owners.id),
  createdAt: createdAt(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
});

export const expenses = nexora.table('expenses', {
  id: uuid('id').primaryKey(),
  responsibleOwnerId: uuid('responsible_owner_id').notNull().references(() => owners.id),
  category: text('category').notNull(),
  categoryNote: text('category_note'),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  description: text('description'),
  expenseDate: date('expense_date', { mode: 'string' }).notNull(),
  recordedBy: uuid('recorded_by').notNull().references(() => owners.id),
  createdAt: createdAt(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
});

// 11. Audit Log & Idempotency
export const auditLog = nexora.table('audit_log', {
  id: uuid('id').primaryKey(),
  occurredAt: createdAt(),
  actorType: text('actor_type').notNull(),
  actorOwnerId: uuid('actor_owner_id').references(() => owners.id),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  orderId: uuid('order_id').references(() => orders.id),
  before: jsonb('before'),
  after: jsonb('after'),
  reason: text('reason'),
  requestId: text('request_id'),
  ipHash: text('ip_hash'),
});

export const idempotencyKeys = nexora.table('idempotency_keys', {
  key: text('key').primaryKey(),
  scope: text('scope').notNull(),
  operation: text('operation').notNull(),
  requestFingerprint: text('request_fingerprint'),
  response: jsonb('response').notNull(),
  createdAt: createdAt(),
  expiresAt: tstz('expires_at').notNull(),
});
