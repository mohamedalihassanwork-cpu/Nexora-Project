# Nexora — Project Requirements v2
## Final Business & Product Requirements

**Status:** Final Business Requirements for MVP / Initial Operating Stage  
**Product:** Nexora  
**Primary Language:** Arabic  
**Direction:** RTL  
**Currency:** EGP  
**Business Time Zone:** Africa/Cairo  

---

## 1. Project Overview

Nexora is a digital commerce platform for selling digital subscriptions, accounts, links, codes, and other digital products.

The system consists of two connected experiences:

1. **Customer Storefront** — where customers browse products, enter checkout, reserve stock, choose a payment method, submit their payment information, and track their orders.
2. **Owner Management System** — where the two business owners manage products, inventory, orders, shifts, payment methods, deliveries, wallets, expenses, transfers, refunds, templates, and operational history.

The initial product is intended to be simple, fast, mobile-friendly, and inexpensive to operate.

---

## 2. Core Business Objective

Nexora must allow the two owners to operate a digital-product store with minimal manual work outside of payment verification and final customer communication.

The core operating cycle is:

**Open Shift → Store Available → Customer Selects Product → Checkout → Stock Reservation → Payment → Customer Submits Details → Owner Reviews Payment → Accept → Prepare Delivery → Send via WhatsApp → Deliver → Financial Record → Complete**

---

## 3. Zero-Cost Initial Operating Requirement

Zero mandatory recurring infrastructure cost is a core requirement for the initial MVP and early operating stage.

The system must be designed so that it can initially operate using free or zero-cost services and/or infrastructure wherever practical.

The goal is not permanent free operation. The goal is to launch and operate the initial version at near-zero mandatory infrastructure cost until the business grows enough to justify paid services.

The chosen solution must:

- Support shared access for both owners and the public website.
- Be reachable online by customers and both owners.
- Avoid mandatory paid hosting, database, messaging automation, or communication services during the initial stage wherever practical.
- Keep the business data portable.
- Support backup and recovery.
- Allow gradual migration to paid infrastructure as the business grows.

A local-only setup that cannot simultaneously support the public website and both owners is not sufficient as the primary operating model.

---

## 4. Language, Localization and Device Support

### 4.1 Arabic-First Requirement

Arabic is the primary language of Nexora.

The complete customer-facing experience and owner management system must be designed and presented in Arabic by default.

The system must support:

- Arabic UI text.
- RTL layout.
- Arabic form labels and validation messages.
- Arabic error and success messages.
- Arabic checkout and order tracking.
- Arabic admin dashboard.
- Arabic message templates.
- Arabic product descriptions and content.
- Arabic-compatible mixed content such as English product names, emails, URLs, account credentials, and phone numbers.

The system should remain structurally ready for English as an optional future language without changing the underlying business logic.

### 4.2 Currency and Time

- Default currency: **EGP**.
- Default business timezone: **Africa/Cairo**.
- Reservation countdowns must be based on system/server time.

### 4.3 Responsive Experience

The same web application must work properly on:

- Mobile phones.
- Tablets.
- Desktop and laptop screens.

Both the customer storefront and owner management system must be usable on mobile and desktop.

The customer storefront should be mobile-first.

---

## 5. Customer Access

Customers use Nexora as guests by default.

A customer must not be required to create an account simply to make a purchase.

Customer accounts may be added in a future phase, but guest checkout is the default initial experience.

---

## 6. Customer Storefront

The storefront must allow customers to:

- View active product categories.
- View active products.
- View product images.
- View product descriptions.
- View prices.
- View duration when applicable.
- View product availability.
- View delivery method information.
- View the information required from the customer.
- Open product details.
- Start checkout when purchasing is currently available.
- Track an existing order.

### Store Availability Behavior

The store remains visible even when no owner shift is active.

When there is no active shift:

- Products remain visible.
- Product information remains visible.
- The customer sees that the **store is currently closed**.
- The Buy action is disabled.
- No new reservation may be created.

---

## 7. Products

Each product must support configurable:

- Product name.
- Description.
- Category.
- Price.
- Duration where applicable.
- Product images.
- Delivery type.
- Stock type.
- Customer information fields.
- Maximum quantity when applicable.
- Refund eligibility.
- Refund period.
- Availability.
- Instructions.
- Message template configuration.

A product may use different supported stock/delivery models depending on the business case. The platform must not be restricted to one product model globally.

---

## 8. Product Delivery Types

Nexora must support products that may be delivered through different workflows, including:

### Link Delivery

The customer receives a link.

### Email-Based Delivery

The customer provides an email address and the owner uses that information for delivery.

### Account Delivery

The customer receives a unique account or access credentials.

### Customer-Account Delivery

The customer provides information related to an account they own and the owner completes the required process.

### Manual Delivery

The owner manually determines and completes the delivery process.

The system must allow the appropriate customer information to be collected according to the selected product.

---

## 9. Customer Information Collection

Every order must collect the minimum information required for the selected product.

Base information for payment-related orders includes:

- Customer name.
- The number used to make the payment transfer.
- Customer WhatsApp number.

Additional product-specific fields may include:

- Email.
- Account information.
- Product-specific identifiers.
- Other required information defined by the product.

The customer must not be asked for unnecessary information.

---

## 10. Inventory and Stock Models

Nexora must support different types of inventory depending on the product.

### Unique Inventory

Used when every stock item is unique, such as:

- Individual accounts.
- Individual links.
- Codes.
- Credentials.

Each item is individually tracked and can move through availability states.

### Counted Inventory

Used when the business manages an identical stock quantity rather than individual item records.

Example:

**Available Quantity = 10**

### Unlimited / Availability-Based Products

Used when the product does not require individual stock tracking and the owner simply controls whether the product is currently available.

The system must prevent selling beyond actual available stock for stock-backed products.

---

## 11. Quantity Rules

Nexora does not impose a universal maximum quantity across all products.

Customers may purchase more than one unit when the available inventory supports it.

The system must automatically prevent a customer from purchasing more than the currently available quantity.

Example:

If a product has 10 available accounts, the customer cannot purchase 11.

Each product may optionally have its own **Maximum Quantity Per Order** configured by the owner.

If the owner does not configure a lower maximum, available inventory is the effective maximum for stock-backed products.

---

## 12. Reservation System

Stock is reserved when the customer enters the payment page / checkout stage.

Browsing a product does not reserve stock.

### Default Reservation Duration

The default reservation duration is:

**10 minutes**

The owner may change the reservation duration from the management system.

A change to the reservation duration affects **new reservations only**.

Existing reservations keep the duration that was assigned when they were created.

### Reservation Countdown

The customer sees a live countdown during the reservation.

The reservation expiry is controlled by system time, not the customer's device clock.

### Leaving the Payment Page

If the customer leaves the payment/checkout page before completing the required submission, their active reservation is released and the reserved stock becomes available again.

A refresh or temporary continuation of the same checkout must not unintentionally create a second reservation.

### Reservation Extension

The customer may extend their active reservation.

The maximum allowed extension is controlled by an owner-configurable setting.

The customer may not extend beyond the configured maximum extension.

---

## 13. Expired Reservation and Late Payment

If the reservation time expires and the customer has already paid or attempts to submit payment after expiry, the system checks current stock availability.

### If Stock Is Available

The order may proceed and is accepted through the normal review process.

The late payment is not treated as a special rejection by itself.

### If Stock Is No Longer Available

The system must not promise unavailable stock.

The customer must be directed to the Nexora customer-service WhatsApp number.

The customer-service WhatsApp number is a single global number managed from the owner management system.

The order must be flagged for customer-service handling.

---

## 14. Payment Methods and Owner Shifts

Nexora supports two owners who operate the store through shifts.

Each owner has their own payment accounts, such as:

- Vodafone Cash.
- InstaPay.
- Other supported payment methods.

When a shift is active, the customer's payment methods come from the active owner's configured payment accounts.

### Payment Information Snapshot

The payment account and payment instructions shown to a customer during their transaction must remain attached to that order.

If the shift later changes, the order still belongs financially to the payment account that was shown to the customer at the time of that transaction.

The new active owner's payment methods apply to new customers/transactions.

---

## 15. Shift Management

Each owner can:

- Open their shift.
- Operate the store.
- Close their shift.

Only the currently active owner's payment methods are used for new customer payment instructions.

### Closing a Shift

An owner may request to close the shift even when there are customers or active purchase processes currently in progress.

Before closing, the system must warn the owner that active customers are currently purchasing.

After the shift is closed:

- New customers see **"The store is currently closed"**.
- New purchases and new reservations cannot start.
- Existing active reservations/orders that already started must be allowed to continue according to their existing locked transaction information.

Closing a shift must not invalidate an already-started customer transaction.

---

## 16. Checkout and Payment Submission

The checkout process must be simple and direct.

The customer:

1. Selects the product.
2. Enters the payment/checkout page.
3. The reservation begins and the 10-minute countdown starts.
4. Sees the applicable payment methods and payment information.
5. Completes the external payment transfer.
6. Enters the required customer information.
7. Submits the order.

Payment is manually reviewed by an owner.

Submitting an order does not automatically mean payment has been accepted.

---

## 17. Payment Verification

Payment verification is manual in the initial version.

The owner reviews the submitted order and determines whether the payment has arrived.

The owner can accept or reject the order according to the review result.

The owner remains responsible for reviewing the payment evidence and customer-provided payment information.

---

## 18. Order Management

Every purchase creates an order that can be tracked operationally.

Orders should contain relevant information including:

- Order number.
- Product.
- Quantity.
- Price.
- Customer name.
- Payment transfer number.
- WhatsApp number.
- Product-specific information.
- Payment method/account used.
- Shift associated with the transaction.
- Order status.
- Reservation information when applicable.
- Delivery information.
- Responsible owners/operators.
- Relevant financial records.

### Order Statuses

The system must support the operational lifecycle required by Nexora, including:

- Reserved.
- Payment Submitted.
- Under Review.
- Accepted.
- Preparing.
- Delivered.
- Completed.
- Expired.
- Rejected.
- Cancelled.

The system may additionally flag an order as **Needs Customer Service** when a late payment is received but the original stock is no longer available.

Every important status transition must be traceable.

---

## 19. Order Tracking

Customers do not need accounts to track their orders.

A customer may retrieve an order using either of these methods:

### Method 1

**Order Number + Payment Transfer Number**

### Method 2

**Order Number + Customer WhatsApp Number**

The tracking experience should show relevant order information and current status without exposing sensitive account credentials.

---

## 20. Delivery

After payment is accepted, the owner prepares the delivery.

Delivery may involve:

- Link.
- Account credentials.
- Email-based delivery.
- Product-specific information.
- Manual delivery instructions.

The system prepares the correct delivery information for the selected product.

### WhatsApp Delivery

The system generates a WhatsApp message based on the configured template and order information.

The system opens WhatsApp for the customer number with the prepared message.

The final Send action remains manual and is performed by the owner.

The Nexora customer-service WhatsApp number is managed as one global system setting.

### Delivery Accountability

The owner/operator who performs the delivery must be recorded.

If a delivery error occurs, the system records the responsible person and the value associated with the error where applicable.

Delivery errors must remain traceable to the responsible owner/operator.

---

## 21. Message Templates

Owners must be able to create and manage message templates from the management system.

Templates may contain dynamic data such as:

- Customer name.
- Product name.
- Order number.
- Delivery link.
- Account information.
- Email.
- Product-specific fields.

Templates are prepared automatically from order information.

The owner can review the generated message before sending it through WhatsApp.

---

## 22. Delivery Problems, Replacement and Refund

When a delivered digital product does not work as expected, the preferred first response is a **Replacement Case**.

If replacement resolves the problem, the case is closed.

If replacement does not resolve the problem, the order may proceed to a **Refund Case** when the product is eligible for refund.

### Refund Eligibility

Refund eligibility is configured at the product level.

Each product can be configured as:

- Refund allowed.
- Refund not allowed.

The allowed refund period is also configured from the management system.

### Refund Authority

Customers cannot issue refunds themselves.

Refunds are initiated by the Nexora owners from the order management system.

For a refundable product, the owners can initiate a refund through the order page according to the configured refund period and business rules.

---

## 23. Financial Records

Nexora must track operational money movement for each owner.

Financial records include:

- Sales.
- Expenses.
- Transfers.
- Refunds.
- Adjustments where applicable.

### When a Sale Is Recorded Financially

The business financial record for a sale is posted at **Delivery**.

Payment Acceptance confirms that the payment has been verified, but the corresponding financial sale record is recognized when the order is delivered.

### Financial Record Integrity

Financial records must not be freely edited or deleted after posting.

Corrections should use an explicit reversal/adjustment mechanism so the original transaction history remains traceable.

---

## 24. Owner Wallets and Payment Accounts

Each owner has financial balances associated with the business activity they handle.

Payment accounts belong to the corresponding owner.

A customer payment made to Owner A's payment account remains associated with Owner A's account even if the active shift changes afterward.

The financial system must preserve clear ownership of each transaction.

---

## 25. Transfers Between Owners

Owners can transfer money between each other.

Transfers are **immediate**.

When a transfer is recorded:

- Sender balance decreases.
- Receiver balance increases.
- Both sides are recorded as one linked business transaction.

No receiver approval is required for the initial version.

The transfer must include sufficient transaction history for later review.

---

## 26. Expenses

Owners can record business expenses.

Each expense should include:

- Amount.
- Category.
- Description.
- Date.
- Responsible owner.

Expenses affect the relevant financial records and are visible in financial summaries.

---

## 27. Product Images

Owners can upload product images.

A product may have:

- Main image.
- Additional images.

Product images must appear on the customer storefront.

Product updates made by the owners must reflect on the storefront.

---

## 28. Product and Stock Management by Owners

Owners must be able to:

- Create products.
- Edit products.
- Activate/deactivate products.
- Change prices.
- Change product descriptions.
- Change categories.
- Configure delivery type.
- Configure stock type.
- Add stock.
- Remove stock.
- View available stock.
- View reserved stock.
- View sold stock.
- Manage unique stock items where applicable.
- Configure optional maximum quantity.
- Configure refund eligibility and refund period.
- Configure customer fields.
- Upload images.

The system must keep stock synchronized with the customer storefront.

---

## 29. Stock Reservation and Double-Sale Protection

The system must ensure that the same unique stock item cannot be sold to two customers.

When multiple customers attempt to purchase limited stock simultaneously:

- Only valid available stock may be reserved.
- The system must prevent duplicate allocation.
- A customer must not be able to purchase more than the actual available quantity.

The customer-facing availability display is informational; the final stock decision occurs when the reservation is created.

---

## 30. Customer Service

Nexora must have one global customer-service WhatsApp number.

The number is managed from the owner management system.

The customer-service WhatsApp number is used for cases such as:

- Late payment when original stock is no longer available.
- Other customer-service cases.
- Delivery problems requiring manual handling.

---

## 31. Admin Dashboard

The owner management system should provide a clear overview of:

- Current store status.
- Active shift.
- Current orders.
- Orders awaiting payment review.
- Orders waiting for delivery.
- Reserved stock.
- Available stock.
- Low/out-of-stock products.
- Sales.
- Expenses.
- Transfers.
- Owner balances.
- Customer-service cases.
- Recent activities.

The first version should prioritize operational clarity over advanced analytics.

---

## 32. Owners, Roles and Accountability

The first version supports two business owners.

Each owner has an individual login.

The system must record which owner:

- Opened a shift.
- Closed a shift.
- Reviewed a payment.
- Accepted or rejected an order.
- Prepared a delivery.
- Sent/prepared a WhatsApp delivery.
- Added or removed stock.
- Recorded an expense.
- Created a transfer.
- Initiated a refund.
- Changed a product.
- Changed a payment account.

Operational actions must remain attributable to the responsible owner/operator.

---

## 33. Activity History and Auditability

Important actions must be recorded so that the owners can review what happened later.

The system should retain traceability for:

- Order status changes.
- Stock changes.
- Delivery actions.
- Delivery errors.
- Refunds.
- Expenses.
- Transfers.
- Shift changes.
- Product changes.
- Payment-account changes.
- Message-template changes.

---

## 34. Core Business Rules — Final Decisions

The following rules are considered final business decisions for the current project scope:

1. The storefront remains visible when no shift is active.
2. When no shift is active, the Buy action is disabled and the customer sees that the store is currently closed.
3. A reservation starts when the customer enters the payment/checkout stage.
4. The default reservation duration is 10 minutes.
5. Changing the reservation duration affects new reservations only.
6. Leaving the payment page releases the active reservation.
7. Customers may extend an active reservation up to an owner-configured maximum extension.
8. Late payment is accepted normally when the required stock is still available.
9. Late payment with unavailable stock directs the customer to the single global Nexora customer-service WhatsApp number.
10. Customers provide their name, payment-transfer number, and WhatsApp number, plus any product-specific required fields.
11. Payment verification is manual and performed by an owner.
12. Product inventory can use supported stock models according to the product use case.
13. Customers cannot purchase beyond actual available stock.
14. A product may optionally define its own maximum quantity per order.
15. The payment account shown to a customer remains associated with the order and its financial ownership even if the active shift changes afterward.
16. Closing a shift warns the owner when customers are currently purchasing; new customers see the store as closed, while already-started customer transactions continue according to their locked transaction details.
17. Sales are financially recorded at Delivery, not merely at payment acceptance.
18. Transfers between owners are immediate.
19. Financial records are not freely edited or deleted; corrections use controlled reversal/adjustment actions.
20. Refund eligibility is configured per product.
21. Refund period is configurable from the owner management system.
22. Refunds are initiated by the owners from the management system.
23. A non-working product is handled through a Replacement Case first; a Refund Case may follow when eligible and appropriate.
24. Delivery actions are attributable to the owner/operator who performed them.
25. Delivery errors are recorded against the responsible owner/operator, including the value associated with the error where applicable.
26. Customers can track orders using Order Number plus either the payment-transfer number or the WhatsApp number.
27. The customer-service WhatsApp number is a single global setting.
28. Nexora is Arabic-first and RTL-first across the customer and management experiences.
29. Nexora is designed to work on mobile and desktop.
30. The initial operating model targets near-zero mandatory infrastructure cost while remaining online, shared, recoverable, and portable.

---

## 35. Success Criteria

The initial release is successful when an owner can complete the following real workflow without requiring external operational systems except for the actual payment transfer and final WhatsApp send:

**Open Shift → Customer Browses → Customer Enters Checkout → Stock Reserved → Customer Pays → Customer Submits Required Data → Owner Reviews Payment → Accept → Prepare Delivery → Open WhatsApp with Prepared Message → Send → Deliver → Financial Record Is Posted → Order Completed**

The system must also handle the defined exceptions and edge cases without creating double-selling, ownership ambiguity, broken reservation logic, or untraceable financial movements.

---

## 36. Scope Boundary

The first release is intentionally focused on the operational needs of a two-owner digital-commerce business.

The following may be considered later expansion rather than initial requirements unless explicitly added:

- Customer accounts as a required purchasing mechanism.
- Automated WhatsApp sending.
- Paid messaging APIs.
- Advanced marketing automation.
- Loyalty systems.
- Advanced analytics.
- Large multi-team staffing structures.
- Full accounting software functionality.

The system must, however, be structured so that future growth can be added without rebuilding the core business workflow.
