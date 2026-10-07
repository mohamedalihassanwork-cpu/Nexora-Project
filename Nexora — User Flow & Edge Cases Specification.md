# Nexora — User Flow & Edge Cases Specification

**Based on:** *Nexora — Project Requirements v2* (Final Business & Product Requirements, MVP / Initial Operating Stage) **Purpose:** Describe how Nexora behaves for every actor, flow, state and exception, so a designer and a developer can build it without guessing business logic. **Not in this document:** code, technical architecture, infrastructure, data design.

---

## 0. How to Read This Document

### 0.1 Source discipline

- Every rule comes from the requirements. **§n** = section n of the requirements. **FD-n** = Final Decision number n in §34.
- Behavior that follows logically from the requirements but is not written in them is tagged **\[IMPLIED\]**. It is the most natural reading, but it should be confirmed.
- Where the requirements are silent or contradictory, the gap is written as a **MISSING DECISION** block. These blocks never contain an invented rule; they state what is unknown and what must be decided.

### 0.2 MISSING DECISION format

> **MISSING DECISION · MD-XXX-00 · \[Severity\] · Short title.** What the requirements do not say, and why it matters. **Decision needed:** the exact question that must be answered.

Severity: - **Critical** — design or development cannot finalize the flow without it, or there is a risk of lost money, double-selling or untraceable records. - **High** — changes what a screen shows, what data is captured, or what an owner is allowed to do. - **Medium** — refinement; a sensible default can be used until it is decided.

The full register of every MISSING DECISION is in **Part 8**.

### 0.3 Flow template

Every flow below is documented with the same headings:

1. Starting point
2. Step-by-step flow
3. Decisions and possible outcomes
4. Success path
5. Failure path
6. Refresh / leave / close / return
7. Changes during the flow (stock, payment, shift, order status)
8. Simultaneous actions by two users
9. Statuses and transitions

followed by **Edge cases** and the **Missing decisions** for that flow.

### 0.4 Glossary

| Term | Meaning (from the requirements) |
| --- | --- |
| **Customer** | A guest. No account is needed to buy or to track (§5, §19). |
| **Owner** | One of the two business owners, each with an individual login (§32). |
| **Shift** | A period in which one owner operates the store. Only the active owner's payment accounts are used for new customers (§15). |
| **Active owner** | The owner whose shift is currently open. |
| **Store open / closed** | Open = an owner shift is active. Closed = no shift is active (§6). |
| **Reservation** | A time-limited hold on stock, created when the customer enters the payment/checkout stage (§12). |
| **In-flight transaction** | A customer transaction that started (reservation created) before the shift closed. It continues using its locked details (§15, FD-16). |
| **Locked transaction details** | The payment account and payment instructions shown to the customer, which stay attached to the order (§14, FD-15). *What else is locked is undefined — see MD-CHK-04.* |
| **Order** | The record created by a purchase (§18). |
| **Case** | A Replacement Case, Refund Case or customer-service case attached to an order (§22, §30). |
| **Financial record** | A sale, expense, transfer, refund or adjustment belonging to an owner's balance (§23). |

### 0.5 Things Nexora cannot observe

Nexora has no payment gateway and no automated WhatsApp sending in this release (§17, §36). Therefore the system **cannot know**:

- whether the customer really transferred money, how much, or to which account;
- whether the owner actually pressed Send in WhatsApp;
- whether the delivered product works.

Every one of these is a manual human confirmation. Many edge cases below exist because of this.

---

## 1. Actors and Access

| Actor | Who | Needs login | Can do |
| --- | --- | --- | --- |
| **Guest customer** | Any public visitor | No | Browse, start checkout, pay externally, submit details, track an order, contact customer service via WhatsApp |
| **Owner A / Owner B** | The two business owners | Yes (individual login, §32) | Everything in the Owner Management System |
| **System** | Clock and rule enforcement | — | Countdowns, reservation release and expiry, final stock allocation decision (§29), status flags, audit logging |
| **External: payment apps** | Vodafone Cash, InstaPay, others | — | Outside Nexora. Money moves here. |
| **External: WhatsApp** | Customer-facing channel | — | Outside Nexora. Owner presses Send manually. |

> **DECISION · MD-ACC-01.** Both Owners have the same permissions in the MVP. Differences are limited to attribution, payment-account ownership, shift ownership, and wallet ownership.
> 
> **DECISION · MD-ACC-02.** Owner authentication uses email and password. Sessions remain active for 7 days unless the owner logs out. Password reset and account deactivation are supported. Customer accounts are out of scope for the MVP.
> 
> **DECISION · MD-ACC-03.** Adding, replacing, or deactivating Owners is managed in Settings. An Owner with historical activity is deactivated rather than deleted so attribution remains intact.

---

## 2. Global Principles (apply to every flow)

| # | Principle | Source |
| --- | --- | --- |
| G1 | **Server time rules.** Reservation expiry is decided by system time, never by the customer's device clock. | §4.2, §12 |
| G2 | **Final stock decision is made when the reservation is created.** What the storefront shows is informational. | §29 |
| G3 | **No double-sale.** The same unique item can never go to two customers. A customer can never buy more than actually available. | §10, §29, FD-13 |
| G4 | **Browsing never reserves stock.** | §12 |
| G5 | **Details shown to a customer are locked to their order.** Later shift or account changes only affect new customers. | §14, FD-15, FD-16 |
| G6 | **Financial ownership follows the payment account shown to the customer**, not the owner who happens to be on shift later. | §24, FD-15 |
| G7 | **A sale is recorded financially at Delivery**, not at payment acceptance. | §23, FD-17 |
| G8 | **Financial records are never freely edited or deleted.** Corrections are controlled reversal/adjustment actions. | §23, FD-19 |
| G9 | **Every operational action is attributed to a logged-in owner.** | §32, FD-24 |
| G10 | **Important actions leave history**: order status, stock, delivery, delivery errors, refunds, expenses, transfers, shifts, products, payment accounts, templates. | §33 |
| G11 | **Never promise unavailable stock.** The customer is sent to customer service instead. | §13 |
| G12 | **Payment verification and the final WhatsApp send are manual.** | §17, §20 |
| G13 | **Arabic-first, RTL, mobile and desktop** for both customer and owner experiences. Mixed content (English product names, emails, URLs, credentials, phone numbers) must display correctly inside Arabic text. | §4 |
| G14 | **Guest checkout only.** No customer account in this release. | §5 |
| G15 | **Only what is needed is asked of the customer.** | §9 |

---

## 3. State Models

Legend for the "Basis" column: **REQ** = stated in requirements. **IMPLIED** = follows from the operating cycle, confirm. **MISSING** = undefined, see the referenced decision.

### 3.1 Order statuses

Defined statuses (§18): **Reserved, Payment Submitted, Under Review, Accepted, Preparing, Delivered, Completed, Expired, Rejected, Cancelled.** Defined flag (§18): **Needs Customer Service.**

| # | From | To | Trigger | Actor | Basis |
| --- | --- | --- | --- | --- | --- |
| T1 | *(none)* | Reserved | Customer enters payment/checkout stage and a reservation is created | Customer / System | REQ §12, §18 — but when the order record exists is **MISSING (MD-CHK-01)** |
| T2 | Reserved | Payment Submitted | Customer submits required information | Customer | REQ §16 |
| T3 | Reserved | Expired | Reservation time ends without submission | System | IMPLIED — see MD-RSV-03 |
| T4 | Reserved | Cancelled *(or Expired, or no order)* | Customer leaves the payment page and the reservation is released | Customer | **MISSING (MD-RSV-03)** |
| T5 | Expired | Payment Submitted | Customer submits late **and** stock is available | Customer | REQ §13; resulting status **MISSING (MD-LTE-03)** |
| T6 | Expired | *(stays)* + **Needs Customer Service** flag | Customer submits late **and** stock is unavailable | System | REQ §13, §18; resulting status **MISSING (MD-LTE-03)** |
| T7 | Payment Submitted | Under Review | An owner starts reviewing | Owner | IMPLIED — trigger **MISSING (MD-REV-01)** |
| T8 | Under Review | Accepted | Owner accepts | Owner | REQ §17 |
| T9 | Under Review | Rejected | Owner rejects | Owner | REQ §17 |
| T10 | Accepted | Preparing | Owner prepares delivery | Owner | REQ §20 |
| T11 | Preparing | Delivered | Delivery done; **sale is posted to the financial record** | Owner | REQ §20, §23, FD-17 |
| T12 | Delivered | Completed | Unknown trigger | — | **MISSING (MD-ORD-02)** |
| T13 | Pre-delivery statuses | Cancelled | Unknown who/when | — | **MISSING (MD-ORD-03)** |
| T14 | Rejected | *(any)* | Reopening after a rejection | Owner | **MISSING (MD-REV-05)** |
| T15 | Delivered / Completed | *(any)* | Effect of a replacement or refund on the order's status | — | **MISSING (MD-ORD-04)** — there is no "Refunded" or "Replaced" status in §18 |

Terminal statuses (no further normal movement): Rejected, Cancelled, Expired *(unless late payment, T5/T6)*, Completed.

### 3.2 Reservation states (working names — the requirements do not name them)

| State | Meaning |
| --- | --- |
| **Active** | Countdown running, stock held |
| **Extended** | Still active, customer has used extension within the owner-configured maximum (§12) |
| **Submitted** | Customer completed submission; hold continues for the order (see MD-PAY-01 for how long) |
| **Released** | Customer left the payment page; stock immediately available again (§12, FD-6) |
| **Expired** | Time ran out; stock released |

| From | To | Trigger | Basis |
| --- | --- | --- | --- |
| — | Active | Customer enters payment stage; stock successfully held | REQ |
| Active | Extended | Customer extends within the maximum | REQ §12 |
| Active/Extended | Submitted | Customer submits | REQ §12 ("before completing the required submission") |
| Active/Extended | Released | Customer leaves the page | REQ §12; definition of "leave" **MISSING (MD-CHK-08)** |
| Active/Extended | Expired | Time ends | REQ §12 |
| Expired/Released | *(late path)* | Customer submits afterwards | REQ §13; see Flow 4.5 |

### 3.3 Shift states

| State | Meaning |
| --- | --- |
| **Closed / no active shift** | Store shows "closed". Buy disabled. No new reservations. |
| **Active** | One owner operating. Storefront open. |

Transitions: Closed → Active (owner opens), Active → Closed (owner closes, after the in-progress warning). An in-flight customer transaction survives the close (§15). Whether two shifts can be active at once is undefined (**MD-SHF-01**).

### 3.4 Stock states

| Stock model | States | Basis |
| --- | --- | --- |
| **Unique item** | Available → Reserved → Sold. Reserved → Available on release/expiry. | REQ §10, §28 (available / reserved / sold are all viewable) |
| **Counted** | A quantity split into available / reserved / sold amounts | REQ §10, §28 |
| **Unlimited / availability-based** | Available ↔ Unavailable, set by the owner | REQ §10 |

When an item becomes "Sold" (at reservation, at acceptance, or at delivery), and whether other item states exist (defective, removed, replaced) is **MISSING (MD-INV-02, MD-INV-03)**.

### 3.5 Delivery states

Not defined as a list in the requirements. The workflow implies: **Not started → Preparing → Message prepared → Delivered**, with a recorded **delivery error** when something goes wrong (§20). Exact states are **MISSING (MD-DLV-01)**.

### 3.6 Replacement Case, Refund Case, customer-service case

- **Replacement Case:** Open → Closed (replacement solved it) **or** → proceeds to a Refund Case (REQ §22). Other states are **MISSING (MD-RPL-01)**.
- **Refund Case:** exists only for refund-eligible products and is initiated by an owner (REQ §22). States are **MISSING (MD-RFD-01)**.
- **Customer-service case / flag:** **Needs Customer Service** flag exists (REQ §18). Its lifecycle is **MISSING (MD-CS-01)**.

### 3.7 Other entities

| Entity | Defined states | Gaps |
| --- | --- | --- |
| Product | Active / Inactive (REQ §28) | Draft, archived, deletion — MD-PRD-03 |
| Category | "Active" categories are shown (§6) | Category management — MD-PRD-04 |
| Payment account | None defined | Active/inactive, deletion — MD-PAC-02 |
| Message template | None defined | Active/inactive, deletion — MD-TPL-02 |
| Financial record | "Posted"; corrections by reversal/adjustment (§23) | How a reversed record is displayed — MD-WAL-05 |
| Transfer | Immediate, no approval (§25) | Reversal — MD-TRF-04 |
| Expense | Recorded (§26) | Reversal — MD-EXP-03 |

---

## Part 4 — Customer Flows

---

### 4.1 Browse the Storefront

**1. Starting point** The customer opens the storefront (home page, a category, or a direct product link). No login.

**2. Step-by-step flow** 1. The customer sees active categories and active products (§6). 2. The customer opens a product and sees: images, description, price, duration (if applicable), availability, delivery method information, the information that will be required from them, and instructions (§6, §7). 3. If purchasing is available, the Buy action is enabled. If the store is closed, Buy is disabled and the customer sees that the store is currently closed (§6, FD-1, FD-2). 4. At any time the customer can open **Track an order** (Flow 4.6).

**3. Decisions and outcomes**

| Decision | Outcome |
| --- | --- |
| Is an owner shift active? | Yes → Buy enabled. No → products and information stay visible, Buy disabled, "store is currently closed" shown. |
| Is the product active? | Inactive products are not shown (§28). |
| Is the product available / in stock? | Available → Buy enabled (when store open). Not available → customer cannot reserve; shown as unavailable **\[IMPLIED by §10, §29\]**. |
| Does the product have a max quantity per order? | Quantity selection is capped at the lower of max-per-order and available stock (§11). |

**4. Success path** The customer sees correct, current information and can start checkout.

**5. Failure path** - Product or category link no longer valid (product deactivated, category inactive). - Images fail to load or the product has no image. - Page fails to load. The customer must always see a clear Arabic message and a way back to the product list.

**6. Refresh / leave / close / return** - Browsing holds no state and no reservation (§12). Refresh simply re-reads current status. - Returning later shows the then-current store status, prices and availability.

**7. Changes during the flow** - **Stock changes:** the displayed availability is informational only (§29). The real decision happens when the customer presses Buy. - **Shift closes while customer is on the page:** the page may still show Buy as enabled. Pressing Buy must be refused with the "store is currently closed" message and no reservation created (§6, FD-2). - **Shift changes to the other owner:** no visible change to browsing; the next checkout uses the new owner's payment accounts (§14). - **Price or description edited by an owner:** reflected on the storefront (§27). The customer sees the new value on their next load; which price applies once they press Buy is **MISSING (MD-CHK-04)**. - **Product deactivated:** pressing Buy must fail with a clear unavailable message.

**8. Simultaneous actions** Many customers can view the same last unit and all see "available". Only the reservation step decides who gets it (§29).

**9. Statuses and transitions** Store: Open ↔ Closed. Product visibility: Active ↔ Inactive. Availability display: Available / Unavailable (final wording and whether exact remaining quantity is shown is **MD-BRW-01**).

**Edge cases** - E1. Customer keeps a product page open overnight, then presses Buy: all checks are re-run on press, nothing is trusted from the stale page. - E2. Product is out of stock but the store is open: Buy cannot produce a reservation; the page must say why (stock, not closed). - E3. Store closed but a customer has an existing order: tracking stays available **\[IMPLIED, §6 does not tie tracking to store status\]**. - E4. Product names/descriptions mix Arabic with English names, URLs or numbers: text must remain readable in RTL (§4.1). - E5. Product with no price or no image saved incorrectly: must not appear broken to customers (see Product validation, Flow 5.4). - E6. Customer opens many products and presses Buy on several in different tabs: see MD-CHK-07.

> **DECISION · MD-BRW-01.** Customers see Available, Low Stock, or Out of Stock instead of the exact remaining quantity by default.

---

### 4.2 Enter Checkout and Create the Reservation

**1. Starting point** Store is open, the product is active and available, and the customer presses **Buy** (with a quantity if the product allows more than one).

**2. Step-by-step flow** 1. Customer selects the product and, where applicable, a quantity (§11). 2. Customer enters the payment / checkout page (§16 step 2). 3. The system checks, at that moment: a shift is active; the product is active and available; the quantity does not exceed available stock or the product's max-per-order (§11, §29). 4. If everything is valid, the system creates the reservation: stock is held, the countdown starts with the **currently configured** duration (default 10 minutes, §12, FD-3/FD-4), and the active owner's payment accounts, instructions and shift are attached to this transaction (§14, §18). 5. The customer sees: the live countdown, the order summary, the applicable payment methods and payment information, and the information form (name, payment-transfer number, WhatsApp number, plus product-specific fields, §9, FD-10). 6. The customer continues to Flow 4.3 / 4.4.

**3. Decisions and outcomes**

| Decision | Outcome |
| --- | --- |
| Shift active? | No → refused, "store is currently closed". |
| Product active and available? | No → refused, clear message. |
| Requested quantity ≤ available and ≤ max-per-order? | Yes → proceed. No → refused or reduced; see MD-CHK-03. |
| Stock model | Unique: specific items held. Counted: quantity held. Unlimited: see MD-CHK-09. |
| Active owner has at least one usable payment account? | Undefined — MD-CHK-06. |

**4. Success path** Reservation is created, countdown starts, stock is held, payment details are shown and locked to this transaction.

**5. Failure path** - Store closed → no reservation. - Not enough stock (including "someone just took it") → no reservation; the customer is told the stock is no longer available. They must never be left holding a half-created reservation. - Product deactivated or turned unavailable between page load and press → refused. - System error during creation → no stock may remain held without a visible reservation. The customer can retry.

**6. Refresh / leave / close / return** - **Refresh on the payment page:** the same checkout and the same reservation continue; **no second reservation** is created (§12). The countdown shows the true remaining server time. - **Leaving the payment page** before completing the required submission releases the reservation and the stock becomes available again (§12, FD-6). What counts as "leaving" is **MISSING (MD-CHK-08)** — this is a critical ambiguity, because the customer must leave the page's focus to pay in a banking app. - **Closing the tab / browser:** same as leaving. - **Returning after release:** the old checkout is no longer valid; starting again is a brand-new reservation subject to current stock. What they see on the old link is **MD-RSV-03**. - **Second tab:** opening the same checkout in another tab must show the same reservation and the same countdown, not a new hold.

**7. Changes during the flow** - **Stock:** reserved stock is protected from other customers (§29). An owner removing or reducing stock that is currently reserved is undefined — **MD-INV-05**. - **Payment:** the account and instructions shown remain attached even if the owner later edits or deactivates that account or the shift changes (§14, FD-15). The new owner's accounts apply only to new customers. - **Shift:** if the shift closes, this customer's transaction continues (§15, FD-16). If the shift passes to the other owner, nothing changes for this customer. - **Settings:** a change to reservation duration affects new reservations only (§12, FD-5). A change to maximum extension: **MD-RSV-02**. - **Price / product edits:** **MD-CHK-04**. - **Order status:** while Reserved, the only moves are submit, release, expire.

**8. Simultaneous actions** - Two customers press Buy for the last unit: the system decides in order; the first gets the reservation, the second is refused with no side effects (§29). - Two customers whose quantities together exceed stock: the second cannot receive more than what is left (§29); partial offer vs refusal is **MD-CHK-03**. - Customer presses Buy at the same moment an owner closes the shift: whichever the system processes first decides. If the reservation was created first, it is an in-flight transaction and continues (FD-16). If the close was first, the customer is refused as closed. - Customer presses Buy while an owner removes stock: the system must not create a reservation for stock that was already removed.

**9. Statuses and transitions** Order: *(none)* → **Reserved** (T1). Reservation: → **Active**. Stock: Available → **Reserved**.

**Edge cases** - E1. Customer double-taps Buy: one reservation only. - E2. Same customer reserves the same product repeatedly in several tabs or devices to block stock: see MD-CHK-07. - E3. Customer chooses quantity greater than 1 for a unique-item product: that many distinct items must be held together or none (G3). - E4. Product has max-per-order lower than stock: the lower value wins (§11). - E5. Product has no max-per-order: available stock is the effective maximum (§11). - E6. Customer's device clock is wrong: no effect; only server time counts (G1). - E7. Customer goes offline during checkout: reservation keeps running on the server; when the customer reconnects the displayed countdown corrects itself. - E8. Reservation duration changed by an owner while the customer is mid-checkout: this customer's duration is unchanged (FD-5).

**Missing decisions for this flow**

> **DECISION · MD-CHK-01.** The Order is created when the reservation succeeds and receives its Order Number immediately. Reserved/abandoned orders remain stored for tracking and history.
> 
> **DECISION · MD-CHK-02.** Quantity is selected on the product page and shown again in checkout for confirmation. Quantity cannot be changed after reservation; the customer must cancel and create a new reservation.
> 
> **DECISION · MD-CHK-03.** If the customer requests more units than are currently available, the request is rejected in full. The system does not silently reduce the quantity.
> 
> **DECISION · MD-CHK-04.** At reservation time, the order locks the product snapshot, quantity, unit price, total price, currency, delivery type, refund eligibility and refund period, selected payment method and account, payment instructions, required customer fields, reservation duration, maximum extension, and the message-template version used for the order.
> 
> **DECISION · MD-CHK-05.** The customer must select one payment method before submission. That selection resolves to one specific payment account, which is locked to the order.
> 
> **DECISION · MD-CHK-06.** An Owner cannot open a shift without at least one active usable payment account. If all payment accounts become unavailable during an active shift, new checkout reservations are blocked and the storefront shows a payment-unavailable message.
> 
> **DECISION · MD-CHK-07.** A customer may hold at most 3 active reservations at the same time for the same WhatsApp number. Repeated reserve-and-abandon behavior may trigger a temporary block.
> 
> **DECISION · MD-CHK-08.** A reservation is released by an explicit cancel, navigating away from checkout, closing the tab/window, or leaving the checkout page. Switching to another app for payment does not release the reservation merely because the browser is backgrounded.
> 
> **DECISION · MD-CHK-09.** Unlimited/availability-based products do not allocate physical inventory. The reservation locks the checkout, price, payment details, and transaction for the reservation period only.

---

### 4.3 Countdown, Extension, Release and Expiry

**1. Starting point** The customer is on the payment page with an active reservation.

**2. Step-by-step flow** 1. The customer sees a live countdown driven by server time (§12). 2. At any time before expiry the customer may request an **extension**; it is granted only up to the owner-configured maximum extension (§12). 3. Either the customer submits (Flow 4.4), or leaves (reservation released), or the time ends (reservation expires). 4. On release or expiry, held stock becomes available to others again (§12).

**3. Decisions and outcomes**

| Situation | Outcome |
| --- | --- |
| Extension requested, total extension still ≤ configured maximum | Time is added. |
| Extension requested, would exceed maximum | Refused with a clear message; customer cannot extend beyond the maximum (§12). |
| Time reaches zero before submission | Reservation expires; stock released. Customer may still attempt a late submission (§13, Flow 4.5). |
| Customer leaves | Reservation released immediately (§12, FD-6). |

**4. Success path** Customer submits before time ends (possibly after extending).

**5. Failure path** - Reservation expires while the customer is paying. Stock returns to the pool. - Extension refused because the maximum has been used.

**6. Refresh / leave / close / return** - Refresh: same reservation, countdown corrected to server time. - Backgrounded tab or phone sleep: after returning, the countdown must reflect real elapsed server time, never "frozen". - Leave: release (subject to MD-CHK-08). - Return after expiry or release: see Flow 4.5.

**7. Changes during the flow** - **Shift closes:** the active reservation continues (FD-16). Whether extension is still allowed after the shift closes is **MD-RSV-04**. - **Stock:** held stock stays held until release/expiry; new stock added elsewhere does not affect it. - **Owner changes the maximum extension while the reservation is active:** undefined — **MD-RSV-02**. (Duration changes are explicitly new-only.) - **Order status:** Reserved only.

**8. Simultaneous actions** - Customer presses "extend" in two tabs or taps twice: must not grant more than the maximum. - Customer submits at the same instant the countdown ends: outcome is decided by the system's processing order; both outcomes converge safely when stock is still available (the late path accepts normally, §13), and when stock is gone the customer is directed to customer service. - Customer extends while an owner changes the maximum extension: see MD-RSV-02.

**9. Statuses and transitions** Reservation: Active → Extended → Submitted / Released / Expired (3.2). Order: Reserved → Payment Submitted (T2) / Expired (T3) / Cancelled-or-other (T4).

**Edge cases** - E1. Extension requested with 2 seconds left and slow network: server decides; the customer's screen must show the real result. - E2. Customer has used the full extension and the countdown reaches zero while they are filling the form: expiry happens; the late path applies on submission. - E3. Reservation expires while the customer has already paid: this is exactly the §13 case — stock availability is checked at submission. - E4. Released stock is instantly reserved by another customer; the first customer returns and pays: late path, stock may now be unavailable → customer service. - E5. Reservation released due to a brief connection drop (depends on MD-CHK-08).

> **DECISION · MD-RSV-01.** Reservation extension is allowed only before expiry, within the configured maximum extension, and only once per reservation.
> 
> **DECISION · MD-RSV-02.** Changing Maximum Extension affects new reservations only. Existing active reservations retain the extension limit that was assigned when they started.
> 
> **DECISION · MD-RSV-03.** On release or expiry, the held stock becomes available immediately. The order remains stored with status Expired and a reason such as Customer Left or Timeout, and it can enter the late-payment path during the allowed late-payment window.
> 
> **DECISION · MD-RSV-04.** Closing the active shift does not remove the extension already assigned to an in-flight reservation; the customer may still use it within that reservation's existing limit.

---

### 4.4 Submit Payment Information

**1. Starting point** The customer has an active reservation, has seen the payment instructions, and (normally) has made the external transfer. They are on the information form. *(A customer whose reservation has already ended enters through Flow 4.5.)*

**2. Step-by-step flow** 1. Customer pays externally using the displayed payment method (outside Nexora, §16 step 5). 2. Customer enters: name, the number used to make the transfer, WhatsApp number, and any product-specific required fields (email, account information, identifiers, §9, FD-10). 3. System validates the entries (Arabic validation messages, §4.1). 4. Customer submits the order. 5. System records the submission and shows a confirmation with the order number and how to track (§19). 6. The order is **Payment Submitted**. Submission does **not** mean payment is accepted (§16).

**3. Decisions and outcomes**

| Decision | Outcome |
| --- | --- |
| Are all required fields valid? | No → inline Arabic errors, nothing submitted. Yes → continue. |
| Is the reservation still active? | Yes → normal submission. No → late path (Flow 4.5). |
| Duplicate press / duplicate tab? | Only one order may result. |

**4. Success path** Order moves Reserved → **Payment Submitted** and appears in the owners' "awaiting payment review" list (§31). The customer can track it.

**5. Failure path** - Validation errors; fields highlighted in Arabic. - Network failure while submitting: the customer can safely retry without creating a duplicate order. - Stock gone after expiry → customer-service path (§13).

**6. Refresh / leave / close / return** - **Refresh before submit:** the same reservation continues. Whether typed form data is kept is **MD-PAY-02**. - **Refresh after submit:** shows the confirmation or order status, never a second submission. - **Browser back after submit:** must not re-submit. - **Close after submit:** the order already exists; the customer needs the order number to track. How a customer who lost it recovers it is **MD-TRK-03**. - **Leave before submit:** reservation released (FD-6) subject to MD-CHK-08.

**7. Changes during the flow** - **Stock:** after submission, the stock tied to this order must not be handed to someone else. How long that hold lasts while waiting for owner review is **MD-PAY-01**. - **Payment account edited/deactivated after the customer saw it:** the order remains tied to the account shown (§14). - **Shift closes after submission:** the order continues and still belongs to the account shown (FD-15, FD-16). - **Order status:** owners may start review any time after submission.

**8. Simultaneous actions** - Double-click or two tabs submitting the same checkout: one order. - Customer submits at the same time the reservation expires: see 4.3 §8. - Customer submits while an owner removes stock: the held stock must remain intact.

**9. Statuses and transitions** T2: Reserved → Payment Submitted. Reservation: Active/Extended → Submitted.

**Edge cases** - E1. Customer submits **without** having paid. The system cannot know (0.5). The owner will reject at review. - E2. Customer paid a different amount than required (under- or over-payment): the owner decides at review; the rule is undefined (**MD-REV-03**). - E3. Customer paid to a different account than the one shown: same — owner decision (**MD-REV-03**). - E4. Customer types the wrong transfer number: review may fail to match; correction rules are **MD-PAY-03**. - E5. Same payment-transfer number used on two orders by different customers: must remain distinguishable to the owner; handling is **MD-REV-04**. - E6. Customer WhatsApp number written in local format, international format, or with Arabic-Indic digits: input rules are **MD-PAY-04**. - E7. The payment-transfer number equals the WhatsApp number (common): allowed — nothing forbids it. - E8. Product-specific fields differ per product (email, account info, identifiers): the form must show only the fields that product needs (§9, G15). - E9. Customer pastes long text or credentials mixed Arabic/English into a field: must be preserved exactly and displayed correctly. - E10. §17 mentions the owner reviewing "payment evidence" but §9 never lists any evidence being collected: see MD-PAY-05.

> **DECISION · MD-PAY-01.** After payment submission, stock remains held for up to 30 minutes for payment review. If no decision is made by the end of that period, the order expires and the held stock is released.
> 
> **DECISION · MD-PAY-02.** Unsaved checkout data persists while the reservation remains active and survives refresh. After release or expiry, unnecessary unsaved data may be discarded. Submitted data becomes part of the order.
> 
> **DECISION · MD-PAY-03.** Submitted customer information is locked. If correction is required, the Owner marks the order Needs Correction; the customer receives a correction path and resubmits the required information.
> 
> **DECISION · MD-PAY-04.** Phone/WhatsApp numbers are normalized to E.164. Other fields use type-specific validation such as email, numeric, URL, text, or selection validation.
> 
> **DECISION · MD-PAY-05.** The customer submits the transfer number, selected payment method, and paid amount. Payment screenshots are optional in the MVP.

---

### 4.5 Late Payment After Expiry or Release

**1. Starting point** The customer's reservation has expired (or was released) and the customer has already paid or tries to submit anyway (§13).

**2. Step-by-step flow** 1. Customer attempts to submit payment information after expiry. 2. System checks **current** stock availability for the product and quantity (§13). 3. **Stock available:** the order proceeds and is reviewed through the normal process; late payment is not a special rejection (§13, FD-8). 4. **Stock not available:** the system does not promise stock. The customer is shown the single global customer-service WhatsApp number and the order is flagged **Needs Customer Service** (§13, FD-9, §18).

**3. Decisions and outcomes**

| Situation | Outcome |
| --- | --- |
| Full required stock available | Normal path → Payment Submitted. |
| Stock not available | Customer directed to customer-service WhatsApp; order flagged. |
| Only part of the quantity available | Undefined — MD-LTE-02. |
| Store currently closed (no active shift) | Undefined — MD-LTE-04. |

**4. Success path** Order proceeds exactly like a normal submission.

**5. Failure path** Stock unavailable → customer service. The customer has probably already transferred money, so this path must be clear and calm in tone, and the owner must see the flagged order on the dashboard (§31).

**6. Refresh / leave / close / return** - Refreshing during the late submission must not duplicate the order. - A customer who closes the page after being told to contact customer service still has the flagged order available for owners; whether they can track it depends on whether their numbers were captured (MD-LTE-01).

**7. Changes during the flow** - **Stock changes between the check and the submit:** the check and the hold must be one decision (G3). Two late payers for one remaining unit cannot both succeed. - **Price changed since the original reservation:** MD-CHK-04. - **Payment account changed since the customer saw it:** the money went to the account shown; ownership stays with it (G6). - **Shift:** MD-LTE-04.

**8. Simultaneous actions** - A late payer and a new customer both target the last unit: only one gets it. - Two late payers for the last unit: first processed wins; the other goes to customer service.

**9. Statuses and transitions** T5 (Expired → Payment Submitted) or T6 (Expired with **Needs Customer Service**). Resulting statuses: **MD-LTE-03**.

**Edge cases** - E1. Customer pays hours or days later: nothing in the requirements limits how late; see MD-LTE-05. - E2. Stock available but it is a *different unique item* than originally reserved: the customer should not care, but the owner's records must show the item actually allocated. - E3. Customer-service number not yet configured: see MD-SET-03. - E4. The same customer attempts a late submission twice: one order. - E5. The money was sent to Owner A's account; Owner B is on shift when the late submission arrives: ownership stays with A (FD-15).

> **DECISION · MD-LTE-01.** The customer reaches the late-payment path from Track Order or the previous order link using the Order Number plus either the transfer number or WhatsApp number.
> 
> **DECISION · MD-LTE-02.** If a late-payment order can no longer be fulfilled in full, it is not partially accepted automatically; it goes to Customer Service.
> 
> **DECISION · MD-LTE-03.** If the late payment can still be fulfilled from available stock, the order becomes Payment Submitted with a Late Submission flag. If the required stock is unavailable, the order remains Expired and receives a Needs Customer Service flag.
> 
> **DECISION · MD-LTE-04.** A closed store does not block a late payment for an existing order. The transaction continues to use the payment account that was locked when the order was created.
> 
> **DECISION · MD-LTE-05.** Late payment is allowed for up to 24 hours after expiry. After that window, the request can only be handled as a Customer Service inquiry.

---

### 4.6 Track an Order

**1. Starting point** The customer opens **Track an order** from the storefront (§6, §19).

**2. Step-by-step flow** 1. Customer enters the **Order Number** plus either the **payment-transfer number** or the **WhatsApp number** (§19, FD-26). 2. System looks up an order matching both values. 3. Customer sees relevant order information and current status, **without exposing sensitive account credentials** (§19).

**3. Decisions and outcomes**

| Situation | Outcome |
| --- | --- |
| Order number + one of the two numbers match | Order information and status shown. |
| No match | "Not found" style Arabic message; nothing about any order is revealed. |
| Order is flagged Needs Customer Service | **\[IMPLIED\]** the customer is shown the customer-service WhatsApp contact. |

**4. Success path** Customer sees the correct status and can understand what happens next.

**5. Failure path** - Wrong order number or number mismatch. - Fields left empty or malformed. - Page fails to load.

**6. Refresh / leave / close / return** - Tracking is a lookup; nothing is held. Refreshing re-reads current status. - Whether the device remembers the last lookup is undefined (**MD-TRK-02**).

**7. Changes during the flow** - **Order status changes** (owner accepts, delivers, etc.): the new status appears the next time the customer loads the page. Whether the page updates itself is **MD-TRK-02**. - **Stock / shift:** no effect on an existing order's tracking.

**8. Simultaneous actions** Customer viewing while an owner changes status: customer sees the old status until refresh; never a half-updated state.

**9. Statuses and transitions** Customer sees every order status (Reserved, Payment Submitted, Under Review, Accepted, Preparing, Delivered, Completed, Expired, Rejected, Cancelled) and the Needs Customer Service flag. Customer-friendly Arabic wording per status is **MD-TRK-01**.

**Edge cases** - E1. Order number is correct but the customer enters a different phone than the one they submitted: no match. - E2. Customer enters the number in a different format or with Arabic-Indic digits than they originally typed: must still match if it is the same number (**MD-PAY-04**). - E3. Several orders share a phone number: the order number selects the correct one. - E4. Someone guesses order numbers: the two-factor requirement (number + phone) is the protection; any further limit is **MD-TRK-04**. - E5. Order has not been submitted yet, so no phone numbers exist: nothing can be matched (MD-CHK-01). - E6. Delivered order: the tracking page must not show account credentials (§19). Whether a delivery *link* is shown is **MD-TRK-05**. - E7. Rejected, Cancelled, Expired orders: tracked like any other; what is shown and what the customer is told to do next is **MD-TRK-01**. - E8. Order with an open replacement or refund case: whether the customer sees this is **MD-TRK-01**.

> **DECISION · MD-TRK-01.** Tracking shows clear customer-facing statuses: Reserved, Payment Submitted, Under Review, Accepted, Preparing, Delivered, Completed, Expired, Rejected, and Needs Customer Service, with a reason when relevant.
> 
> **DECISION · MD-TRK-02.** Tracking uses Order Number plus Transfer Number or WhatsApp Number, with simple copy actions for the order number and key references.
> 
> **DECISION · MD-TRK-03.** If the customer loses the Order Number, they can recover an order using WhatsApp number plus transfer number and, after verification, view the matching order.
> 
> **DECISION · MD-TRK-04.** Tracking is rate-limited to 10 lookup attempts per 10 minutes per client/IP. Suspicious automated behavior may trigger an additional CAPTCHA check.
> 
> **DECISION · MD-TRK-05.** Tracking masks sensitive customer data and never reveals credentials, full payment details, or unique inventory contents.

---

## Part 5 — Owner Flows

---

### 5.1 Owner Sign-in and Accountability

**1. Starting point** An owner opens the Owner Management System.

**2. Step-by-step flow** 1. Owner signs in with their individual login (§32). 2. Owner lands on the dashboard (Flow 5.18). 3. Every action from here on is attributed to this owner (G9, FD-24).

**3. Decisions and outcomes** Valid login → dashboard. Invalid login → error in Arabic. Both owners may be signed in at the same time (each has an individual login; nothing forbids it).

**4. Success path** Owner reaches the system, and all actions record who did them.

**5. Failure path** Wrong credentials, forgotten password, locked account — rules undefined (MD-ACC-02).

**6. Refresh / leave / close / return** - Closing the browser does **not** close a shift **\[IMPLIED\]**: shift state belongs to the store, not to the browser session (see Flow 5.2). - Returning shows current state.

**7. Changes during the flow** Session ending in the middle of a form (for example mid-delivery preparation): what happens to unsaved input is undefined (MD-ACC-02).

**8. Simultaneous actions** Two owners work at the same time constantly (one on shift, one reviewing, etc.). See the concurrency matrix (Part 6.2).

**9. Statuses** Signed in / signed out only.

**Edge cases** - E1. Owner B performs an action on an order that belongs to Owner A's payment account: both must be recorded (the actor, and the owning account) — see MD-ACC-01. - E2. Same owner signed in on phone and desktop acting at once: two concurrent sessions of one person.

---

### 5.2 Shifts

**1. Starting point** An owner is signed in and wants to start or end operating the store.

**2. Step-by-step flow — Open shift** 1. Owner chooses **Open shift**. 2. System checks that opening is allowed (is another shift active? — MD-SHF-01; does the owner have a usable payment account? — MD-CHK-06). 3. Shift becomes Active; this owner becomes the **active owner**; opening owner and time are recorded (§32, §33). 4. The storefront changes from closed to open; Buy becomes enabled; new customers see this owner's payment accounts (§14, §15).

**2b. Step-by-step flow — Close shift** 1. Owner chooses **Close shift**. 2. System checks whether customers are currently purchasing (active reservations / started transactions). 3. If any exist, the owner is **warned that active customers are currently purchasing** (§15, FD-16). The owner chooses to proceed or cancel. 4. On confirm: shift becomes Closed; closing owner and time recorded. New customers see "The store is currently closed". New reservations cannot start (§15). 5. Existing active reservations and started orders **continue** using their locked details (§15, FD-16). Closing never invalidates a started transaction.

**3. Decisions and outcomes**

| Decision | Outcome |
| --- | --- |
| Another shift already active when owner tries to open | Undefined — MD-SHF-01. |
| In-progress customers when closing | Warning shown; owner may continue or cancel. |
| Orders waiting for review/delivery when closing | Not mentioned as a blocker; they continue (§15). |

**4. Success path** Open → store available. Close → store closed, all in-flight orders still processable.

**5. Failure path** - Open refused (another shift, no payment account — pending decisions). - Close request fails or is cancelled after the warning: the shift stays Active, nothing changes.

**6. Refresh / leave / close / return** - The shift stays Active after the owner closes the browser or loses connection **\[IMPLIED\]** — it ends only when an owner closes it. Forgotten shifts: MD-SHF-03. - On return the owner sees the true shift state.

**7. Changes during the flow** - **Customers purchasing during the warning:** the count may change while the owner reads the warning. The warning describes a moment in time; the close action itself does not wait for customers (§15). - **Payment accounts:** the new active owner's accounts apply to new transactions only (§14). - **Order statuses:** unaffected by a shift change; orders remain tied to the shift in which they started (§18, "Shift associated with the transaction").

**8. Simultaneous actions** - Both owners press Open at once: one result only (MD-SHF-01 defines which). - Close pressed while a customer presses Buy: whichever the system processes first decides (4.2 §8). - Owner A closes while Owner B is mid-review on one of A's orders: the review continues; closing does not affect review.

**9. Statuses and transitions** Closed → Active → Closed (3.3). Every change records owner and time.

**Edge cases** - E1. Handover: A closes, B opens later. In between, store is closed. A's in-flight orders (and A's payment account) remain A's (FD-15). - E2. Shift is closed while many orders await review and the closing owner is the only one able to verify their payments (money went to their account): see MD-REV-02. - E3. Owner opens a shift while there are old in-flight orders from a previous shift: no conflict; each order stays linked to its original shift. - E4. A shift runs past midnight in Africa/Cairo: dates on reports and records follow Cairo time (§4.2); which date a shift "belongs to" is MD-SHF-04. - E5. Owner closes a shift and immediately reopens it: allowed unless the decision on MD-SHF-01 forbids it; new reservations after reopening use the then-active owner's accounts. - E6. Closing with zero in-flight customers: no warning needed; close directly **\[IMPLIED\]**.

> **DECISION · MD-SHF-01.** Only one Owner Shift may be Active at a time. An owner normally opens and closes their own shift; the other owner may force-close an abandoned shift, with the action and reason recorded in the audit log.
> 
> **DECISION · MD-SHF-02.** Customers currently purchasing means any reservation that is Active or any order that is Payment Submitted/Under Review and not yet in a terminal state.
> 
> **DECISION · MD-SHF-03.** A shift does not auto-close simply because it has been open for a long time. It can be force-closed by the other owner, with the action logged.
> 
> **DECISION · MD-SHF-04.** Each shift stores open time, close time, Owner, orders handled, sales, rejections, customer-service cases, and payment accounts used.

---

### 5.3 Payment Accounts (Payment Methods)

**1. Starting point** An owner opens the payment-accounts area of their own profile or settings.

**2. Step-by-step flow** 1. Owner adds a payment account of a supported type (Vodafone Cash, InstaPay, other, §14) with its customer-facing payment instructions. 2. Owner may edit or deactivate/remove an account. 3. Active owner's accounts are what new customers see (§14, §15). 4. Every change is attributed and logged (§32 "changed a payment account", §33).

**3. Decisions and outcomes** - Account added → available to new customers only when its owner is the active owner. - Account edited → affects **new** transactions only. Orders already created keep the details the customer was shown (§14, FD-15). - Account removed/deactivated → same: history unaffected; whether removal is allowed at all is MD-PAC-02.

**4. Success path** New customers see correct current payment methods of the active owner.

**5. Failure path** - Invalid or incomplete account entry. - Attempt to remove an account that existing orders rely on (history must not be lost, G5/G10).

**6. Refresh / leave / close / return** Saved changes persist; unsaved edits are lost on leaving (standard behavior; no rule in the requirements says otherwise).

**7. Changes during the flow** - **Account edited while a customer is mid-checkout:** that customer keeps paying to the original details; the owner must still watch the old account for that payment. - **Shift change:** payment methods for new customers switch to the new active owner's. - **Stock/order status:** unrelated.

**8. Simultaneous actions** - Owner edits an account while a customer is viewing it: customer sees the version captured at reservation. - Both owners editing the same account (if allowed): MD-ACC-01.

**9. Statuses** Not defined (MD-PAC-02).

**Edge cases** - E1. Owner changes their phone number for Vodafone Cash after customers have been shown the old one: those customers' payments arrive at the old number; the order is still linked to the old details. - E2. Two accounts with the same number or the same account for both owners: nothing in the requirements allows or forbids it. - E3. Customer pays through a method not on the owner's list: owner decides at review. - E4. The active owner has several accounts: see MD-CHK-05. - E5. Customer transfer fees reduce the amount received: see MD-REV-03.

> **DECISION · MD-PAC-01.** A payment account contains payment method, account identifier, account holder name, display name, payment instructions, and Active/Inactive status.
> 
> **DECISION · MD-PAC-02.** A payment account that has been used by historical orders cannot be hard-deleted; it is deactivated. Hard delete is allowed only when it has never been used.
> 
> **DECISION · MD-PAC-03.** All active payment accounts of the current Owner are available to all active products by default. Product-specific account assignment is not part of the MVP.

---

### 5.4 Products

**1. Starting point** Owner opens the Products area (§28).

**2. Step-by-step flow — Create** 1. Owner enters: name, description, category, price, duration (if applicable), delivery type, stock type, customer information fields, optional maximum quantity per order, refund eligibility and refund period, availability, instructions, message-template configuration (§7). 2. Owner uploads a main image and optional additional images (§27). 3. Owner saves and activates the product; it appears on the storefront (§27, §28).

**2b. Edit / activate / deactivate** Owner edits any of the fields above, changes price, description or category, or activates/deactivates the product (§28). Updates reflect on the storefront (§27).

**3. Decisions and outcomes** - Delivery type chosen: Link, Email-based, Account, Customer-Account, Manual (§8). Customer fields adapt accordingly (§8, §9). - Stock type chosen: Unique, Counted, Unlimited/availability-based (§10). - Refund allowed vs not allowed; refund period configured (§7, §22). - Combinations that make no business sense (for example Account delivery with Unlimited stock) are not addressed (MD-PRD-02).

**4. Success path** Product is saved, visible to customers when active, and stock/availability matches the chosen stock model.

**5. Failure path** - Required fields missing or invalid (price, name, category). - Image upload fails. - Save fails: the owner must not believe it saved.

**6. Refresh / leave / close / return** Unsaved edits are lost on leaving; saved ones persist. Unsaved-change protection is not specified.

**7. Changes during the flow** - **Price edited while customers are in checkout or have orders:** MD-CHK-04. - **Product deactivated while customers are mid-checkout:** do those reservations continue? MD-PRD-05. - **Stock type or delivery type changed while stock/orders exist:** MD-PRD-02. - **Refund eligibility or period edited later:** which value applies to existing orders: MD-RFD-02. - **Template configuration changed:** MD-TPL-04. - **Shift state:** product editing does not depend on an active shift.

**8. Simultaneous actions** - Two owners edit the same product at once: conflict handling is undefined (MD-PRD-06). - Owner edits while a customer is reading: customer sees the old data until reload.

**9. Statuses and transitions** Active ↔ Inactive (§28). Availability states per stock model (3.4).

**Edge cases** - E1. Price set to 0, negative, or with decimals: price rules are undefined (MD-PRD-01). - E2. Max quantity per order set higher than current stock: the lower value governs at purchase (§11). - E3. Max quantity per order is blank: stock is the maximum (§11). - E4. Refund allowed but refund period empty: ambiguous; see MD-RFD-02. - E5. Main image removed or none uploaded: the storefront must still display the product acceptably. - E6. Image file problems (wrong type, huge size, many images): limits undefined (MD-PRD-01). - E7. A customer field is added/removed after orders exist: existing orders keep what they collected. - E8. Product with delivery type Customer-Account must collect customer account information (§8): handling of sensitive customer data (for example whether passwords are requested and who can see them) is MD-PRD-07. - E9. Category deactivated while products inside are active: see MD-PRD-04. - E10. Product deactivated with CS-flagged or unreviewed orders: those orders must remain processable.

> **DECISION · MD-PRD-01.** Each product-specific field defines its name, type, required/optional flag, validation rule, sensitive flag, and display order.
> 
> **DECISION · MD-PRD-02.** Delivery Type and Stock Model are independent but validated for logical combinations. Unique products require unique inventory items, counted products require quantities, and unlimited products do not require inventory items.
> 
> **DECISION · MD-PRD-03.** Product lifecycle is Active, Inactive, and Archived. Products with order or inventory history are never hard-deleted.
> 
> **DECISION · MD-PRD-04.** Categories can be created, edited, reordered, activated, and deactivated. Categories with products cannot be hard-deleted.
> 
> **DECISION · MD-PRD-05.** Deactivating a product does not affect in-flight orders or existing reservations; those transactions continue using their locked order snapshot.
> 
> **DECISION · MD-PRD-06.** Concurrent edits use optimistic concurrency. A stale Owner cannot silently overwrite a newer Product version; the system requires reload and retry after conflict.
> 
> **DECISION · MD-PRD-07.** Product-specific customer fields may be marked Sensitive. Sensitive values are visible only to Owners in the order/delivery flow and never on customer tracking pages or public messages.

---

### 5.5 Inventory

**1. Starting point** Owner opens a product's stock area (§28).

**2. Step-by-step flow** - **Unique stock:** owner adds individual items (accounts, links, codes, credentials); each item is individually tracked through Available → Reserved → Sold (§10, §28). - **Counted stock:** owner sets or adjusts the available quantity (for example 10) (§10). - **Unlimited / availability-based:** owner toggles the product available or unavailable (§10). - Owner can **add** stock, **remove** stock, and **view** available, reserved and sold stock (§28). - The storefront stays synchronized with stock (§28). - Every addition or removal is attributed to the owner (§32) and logged (§33).

**3. Decisions and outcomes**

| Action | Outcome |
| --- | --- |
| Add unique items | Items become Available and sellable. |
| Add counted quantity | Available quantity increases. |
| Remove available stock | Allowed. |
| Remove reserved stock | Undefined — MD-INV-05. |
| Remove sold stock | Undefined — MD-INV-05. |
| Toggle unlimited product unavailable | Customers can no longer start a purchase of it. Effect on in-flight checkouts: MD-CHK-09. |

**4. Success path** Stock is accurate and customers can purchase up to what is really available; nothing is sold twice (G3).

**5. Failure path** - Add fails (invalid or duplicate entry). - Bulk add where only some entries are valid. - Removal blocked because stock is in use.

**6. Refresh / leave / close / return** Saved stock persists. If a bulk add is interrupted, the owner must be able to see exactly which items were added.

**7. Changes during the flow** - **Customer reserves while the owner is editing stock:** the owner's view may be out of date; the final decision belongs to the system (G2). - **Release/expiry returns stock:** counts update. - **Rejected or cancelled order:** whether held stock returns is MD-REV-06. - **Refund / replacement:** whether the item or quantity returns or is marked defective is MD-INV-03.

**8. Simultaneous actions** - Two customers vs. one last item: only one reserves it (§29). - Owner removes an item as a customer reserves it: only one outcome; the item cannot be both removed and sold. - Two owners add the same unique item simultaneously: duplicate handling is MD-INV-04. - Two owners reduce counted stock at once: the result must not go below what is reserved/sold.

**9. Statuses and transitions** Unique item: Available → Reserved → Sold; Reserved → Available (release/expiry/rejection if decided). Counted: available/reserved/sold quantities. Unlimited: Available ↔ Unavailable.

**Edge cases** - E1. Customer wants quantity 3 of a unique product: 3 distinct items allocated; if only 2 can be allocated, none are (G3, MD-CHK-03). - E2. Same account or code entered twice by mistake: allowed? sold twice? see MD-INV-04. - E3. Unique item content contains Arabic, English, symbols and line breaks: stored and displayed exactly. - E4. Counted stock is lowered below the reserved count: must be refused or handled (MD-INV-05). - E5. Stock added while customers are on "unavailable" product pages: new stock becomes sellable immediately; there is no waiting-list or notification in the requirements. - E6. Stock added while CS-flagged late-payment orders wait for that product: whether owners are alerted is MD-CS-04. - E7. Product reaches zero stock: Buy cannot produce reservations; the owner dashboard shows out-of-stock (§31). - E8. Edit of an item's content (for example a corrected password) after it was reserved or sold: undefined (MD-INV-06). - E9. Counted product: when is the quantity considered sold (at reservation, acceptance or delivery) — MD-INV-02.

> **DECISION · MD-INV-01.** For unique products, a specific unique item is allocated at reservation and becomes Reserved. Its content is hidden from the customer until Delivery.
> 
> **DECISION · MD-INV-02.** Inventory moves from Reserved to Sold at Delivery, because the financial sale is also posted at Delivery.
> 
> **DECISION · MD-INV-03.** Inventory states are Available, Reserved, Sold, Defective, and Removed. Refunded digital items are not returned to Available stock.
> 
> **DECISION · MD-INV-04.** Unique inventory item content is checked after normalization; duplicate content is blocked with a warning rather than allowed.
> 
> **DECISION · MD-INV-05.** Reserved stock cannot be deleted or reduced below the reserved amount. The related reservation/order must be resolved first. Sold stock cannot be deleted in a way that changes historical orders; it may only be retired/removed as a separate inventory state.
> 
> **DECISION · MD-INV-06.** Reserved or Sold unique-item content cannot be edited directly. Correction uses a replacement/new item flow while preserving the original history.

---

### 5.6 Payment Review (Accept / Reject)

**1. Starting point** An order is in **Payment Submitted** and appears in "Orders awaiting payment review" (§31).

**2. Step-by-step flow** 1. Owner opens the order and sees the submitted details, the payment account shown to the customer, and the shift (§18). 2. The order becomes **Under Review** (when exactly — MD-REV-01). 3. Owner checks, outside Nexora, whether the payment arrived, comparing against the customer-provided information (§17). 4. Owner chooses **Accept** or **Reject** (§17). 5. The reviewing owner and the decision are recorded (§32, §33).

**3. Decisions and outcomes**

| Decision | Outcome |
| --- | --- |
| Payment arrived and matches | **Accept** → Accepted. Sale is **not** yet posted (FD-17). |
| Payment not found or invalid | **Reject** → Rejected. |
| Payment arrived but amount/account/name differ | Undefined — MD-REV-03. |
| Cannot decide yet | Undefined — whether a "waiting" state exists: MD-REV-01. |

**4. Success path** Order → Accepted; it appears in "Orders waiting for delivery" (§31).

**5. Failure path** - Reject: the order moves to Rejected. What happens to the reserved stock, to the customer's money if they did pay, and how the customer is told, is undefined (MD-REV-05, MD-REV-06, MD-REV-07). - Action fails to save: the owner must see that the status did not change.

**6. Refresh / leave / close / return** - Leaving a review half-done leaves the order Under Review; no timer is defined. - Another owner may open it afterwards (MD-REV-01 on locking).

**7. Changes during the flow** - **Stock:** the order's stock stays held during review (MD-PAY-01). - **Payment account changed meanwhile:** the order still points to the account the customer saw. - **Shift closed meanwhile:** review is still possible (FD-16 keeps in-flight orders alive). - **Customer edits or tracks:** the customer cannot change status; whether they can edit info is MD-PAY-03. - **Order status:** if another owner already decided, the second owner must see the current status and cannot decide again.

**8. Simultaneous actions** - Both owners open the same order: both see it; an acting lock or "already being reviewed" indicator is MD-REV-01. - Accept and Reject pressed at the same time: only the first processed takes effect; the second owner is shown the result. - Two Accepts at once: one Accepted transition, one history entry.

**9. Statuses and transitions** T7 (Payment Submitted → Under Review), T8 (→ Accepted), T9 (→ Rejected). Reopening a rejection: MD-REV-05.

**Edge cases** - E1. Customer paid and the owner rejects by mistake: reopening is undefined (MD-REV-05). - E2. Money arrives after the order was rejected or expired: undefined (MD-REV-05). - E3. Overpayment or underpayment: MD-REV-03. - E4. Duplicate transfer number across orders: MD-REV-04. - E5. The payment went to Owner A's account but Owner B (not on shift, not owning the account) opens the order: can B verify and accept, or only A? MD-REV-02. - E6. A payment is later reversed by the wallet/bank provider after acceptance (a chargeback-like scenario): undefined (MD-REV-08). - E7. Order has been under review for a long time while the customer waits: no deadline or alert exists (MD-PAY-01). - E8. Customer submits with a WhatsApp number the owner cannot reach: noticed only at delivery; see 5.9.

> **DECISION · MD-REV-01.** When an Owner starts working on a Payment Submitted order, it changes to Under Review and is temporarily claimed by that Owner for 10 minutes. If there is no activity after that period, another Owner can take over.
> 
> **DECISION · MD-REV-02.** Both Owners can view any order. Payment acceptance/rejection requires an Owner who can verify the receiving payment account; if the active reviewer cannot verify that account, the order is placed in Waiting for Account Owner rather than being accepted blindly.
> 
> **DECISION · MD-REV-03.** Underpayment requires rejection or customer-service handling. Overpayment is not auto-accepted and requires an Owner decision. Payment sent to the wrong account is rejected. A sender-name mismatch alone does not reject a transfer if the transfer reference and amount are otherwise verifiable.
> 
> **DECISION · MD-REV-04.** A transfer number can be accepted only once. Reuse on another order is flagged as a payment conflict and cannot complete a second approval.
> 
> **DECISION · MD-REV-05.** A Rejected order may be reopened to Under Review by an Owner with a reason. The system rechecks stock and payment information before allowing acceptance.
> 
> **DECISION · MD-REV-06.** When an order is rejected or cancelled before Delivery, any held reserved stock is released immediately. After Delivery, resolution is handled through Replacement or Refund rather than reservation release.
> 
> **DECISION · MD-REV-07.** A rejection requires a recorded reason. The reason is visible in Tracking and may be sent through a WhatsApp template. If the customer already paid, a Refund/Payment Return Case may be opened even when no sale was posted yet.
> 
> **DECISION · MD-REV-08.** A later payment reversal creates a Payment Reversal/Chargeback event and a financial adjustment against the payment-owning Owner without deleting historical records.

---

### 5.7 Order Management

**1. Starting point** Owner opens the Orders area or opens an order from the dashboard.

**2. Step-by-step flow** 1. Owner sees current orders, orders awaiting payment review, and orders waiting for delivery (§31). 2. Owner opens an order and sees: order number, product, quantity, price, customer name, payment-transfer number, WhatsApp number, product-specific information, payment method/account used, shift, status, reservation information, delivery information, responsible owners, and financial records (§18). 3. Owner takes the action permitted by the current status. 4. Every status change is traceable (§18, §33).

**3. Decisions and outcomes — which actions exist per status**

| Status | Accept / Reject | Prepare delivery | Mark delivered | Cancel | Replacement case | Refund |
| --- | --- | --- | --- | --- | --- | --- |
| Reserved | — | — | — | MD-ORD-03 | — | — |
| Payment Submitted | — (review starts) | — | — | MD-ORD-03 | — | MD-RFD-03 |
| Under Review | **Yes** (§17) | — | — | MD-ORD-03 | — | MD-RFD-03 |
| Accepted | — | **Yes** (§20) | — | MD-ORD-03 | — | MD-RFD-03 |
| Preparing | — | — | **Yes** (§20) | MD-ORD-03 | — | MD-RFD-03 |
| Delivered | — | — | — | — | **Yes** (§22) | **Yes if eligible** (§22) |
| Completed | — | — | — | — | MD-ORD-02 | MD-ORD-02 |
| Expired | — | — | — | — | — | — |
| Rejected | MD-REV-05 | — | — | — | — | MD-REV-07 |
| Cancelled | — | — | — | — | — | — |

**4. Success path** Orders progress Payment Submitted → … → Delivered → Completed with attribution at each step.

**5. Failure path** Status action attempted on an order whose status already changed: refused with the current status shown.

**6. Refresh / leave / close / return** The order list and detail always reflect current server status; an owner returning to a stale page must see the latest status before acting.

**7. Changes during the flow** Stock, payment account, shift or product edits made by someone else after the order exists do not rewrite the order (G5); what is locked is MD-CHK-04.

**8. Simultaneous actions** Two owners acting on the same order: only the first valid transition applies; the second owner sees the updated status and the other owner's name.

**9. Statuses and transitions** See 3.1.

**Edge cases** - E1. An order sits in Payment Submitted for days: no escalation defined (MD-PAY-01). - E2. Search/filter for an order using only the customer's phone or name: not defined; recommended as an owner need but not a requirement (not specified). - E3. Order for a product that was later edited or deactivated: the order stays readable with its original product information (MD-CHK-04). - E4. Order belonging to another owner's payment account: visible to both? (MD-ACC-01.)

> **DECISION · MD-ORD-01.** Order Number uses a short non-sequential format such as NX-YYMMDD-XXXXXX. Owner search supports Order Number, customer name, WhatsApp, transfer number, status, product, and date.
> 
> **DECISION · MD-ORD-02.** Completed means Delivery finished successfully and the financial sale posting succeeded. Delivered automatically advances to Completed after both conditions succeed.
> 
> **DECISION · MD-ORD-03.** A customer can cancel only before Payment Submission. An Owner may cancel before Delivery with a required reason. Cancellation after payment/acceptance may create a Refund or Payment Return Case.
> 
> **DECISION · MD-ORD-04.** Refund or Replacement does not erase Delivered or Completed. It is recorded as a separate linked Case/Resolution attached to the original order.

---

### 5.8 Delivery (Prepare and Complete)

**1. Starting point** An order is **Accepted** (payment verified, §17, §20).

**2. Step-by-step flow** 1. Owner chooses **Prepare delivery**; the order becomes **Preparing** (§18, §20). 2. The system prepares the correct delivery information for the product's delivery type (§20): - **Link:** the customer receives a link. - **Email-based:** the customer's email is used; the owner performs the required action for that email. - **Account:** the customer receives a unique account or credentials. - **Customer-Account:** the owner completes the required process for the customer's own account, using the customer-provided information. - **Manual:** the owner decides and completes delivery. 3. A WhatsApp message is generated (Flow 5.9). 4. Owner sends it and confirms delivery. The order becomes **Delivered**. 5. At Delivery the **financial sale record is posted** (§23, FD-17), and the owner who performed the delivery is recorded (§20, FD-24). 6. The order later becomes **Completed** (trigger undefined, MD-ORD-02).

**3. Decisions and outcomes**

| Situation | Outcome |
| --- | --- |
| Product delivery type | Selects the delivery content and any owner-side action. |
| Delivery completes correctly | Order Delivered; sale posted to the financial record of the owner who received the payment (G6). |
| Delivery error | The error, the responsible owner and the value associated with it are recorded (§20, FD-25). |
| Delivered item does not work | Replacement Case first (Flow 5.12). |

**4. Success path** Accepted → Preparing → Delivered, with one posted sale, one delivery attribution, and the customer holding what they bought.

**5. Failure path** - Delivery information cannot be produced (for example no item assigned or content missing). - WhatsApp cannot be opened or the number is unusable (Flow 5.9). - Wrong delivery sent: a **delivery error** is recorded against the responsible owner, with the associated value (FD-25). What financial effect, if any, follows is MD-DLV-03.

**6. Refresh / leave / close / return** - Leaving mid-preparation keeps the order in **Preparing**; nothing is posted until Delivered. - Because the system cannot see whether WhatsApp was sent (0.5), the order does not become Delivered by itself. The owner must record it (MD-DLV-02). - On return, the owner sees Preparing and can resume.

**7. Changes during the flow** - **Stock:** the item or quantity for this order is already allocated; changes by other owners must not alter it (MD-INV-05, MD-INV-06). - **Payment account / shift:** the order stays tied to its original account and shift; the delivering owner may differ from the payment owner (FD-24 attributes the delivery action to whoever performed it). - **Template edited:** MD-TPL-04. - **Order status changed by someone else:** acting on a stale screen must be refused with the current status shown.

**8. Simultaneous actions** - Both owners press **Prepare delivery** or **Mark delivered** on the same order: only one delivery, only one sale posting, one attribution (G7, G9). - One owner prepares while the other cancels: first valid transition wins.

**9. Statuses and transitions** T10 (Accepted → Preparing), T11 (Preparing → Delivered, posts sale), T12 (Delivered → Completed, MD-ORD-02). Delivery sub-states: MD-DLV-01.

**Edge cases** - E1. Order with quantity 3 of unique items: all three must be delivered; partial delivery handling is MD-DLV-04. - E2. Owner marks Delivered without actually sending anything: the system cannot know; it surfaces later as a customer complaint and is handled as a delivery error. - E3. Owner clicks "Delivered" twice or on two devices: exactly one sale posting. - E4. Delivered by mistake and needs undoing: the sale posting cannot be edited or deleted (FD-19); only a reversal/adjustment exists (MD-DLV-05). - E5. Customer gave the wrong email (Email-based): who bears the error, owner or customer, is MD-DLV-03. - E6. Customer-Account product: owner needs customer-provided info; if the info is wrong or missing, the owner must contact the customer through WhatsApp or customer service (no automated path exists). - E7. Delivered by Owner B but payment belongs to Owner A: sale posts to A's financial record, B recorded as delivering owner. - E8. Order accepted but stays unprepared for a long time: no deadline defined (MD-DLV-06). - E9. Accepted order whose product was later deactivated or has no remaining stock for manual items: must still be deliverable.

> **DECISION · MD-DLV-01.** Delivery substates are Not Started, Preparing, Ready to Send, Sent/Waiting Confirmation, and Delivered. Partially Delivered and Delivery Error are exception states.
> 
> **DECISION · MD-DLV-02.** The Owner confirms Delivery only after preparing the delivery and opening/sending the WhatsApp message. Confirming Delivery changes the order to Delivered and posts the financial sale.
> 
> **DECISION · MD-DLV-03.** A Delivery Error includes wrong credentials, wrong account, wrong link, wrong message, or incorrect delivery execution. The responsible Owner is recorded against the error.
> 
> **DECISION · MD-DLV-04.** Multi-quantity orders support partial delivery. Delivered Quantity is recorded, and the order remains partially delivered until the remaining quantity is delivered.
> 
> **DECISION · MD-DLV-05.** A Delivered order cannot be edited directly. Correction uses Reverse Delivery with a mandatory reason, followed by the required delivery and financial adjustment workflow.
> 
> **DECISION · MD-DLV-06.** The MVP does not promise a guaranteed customer-facing delivery time. Internally, the dashboard shows time since acceptance and can flag orders that exceed 15 minutes.

---

### 5.9 WhatsApp Delivery Message

**1. Starting point** An order is **Preparing** and the delivery data is ready (§20).

**2. Step-by-step flow** 1. The system generates the message from the product's configured template and the order data (§20, §21). 2. The owner reviews the generated message before sending (§21). 3. The owner opens WhatsApp for the customer's WhatsApp number with the message pre-filled (§20). 4. The owner presses **Send** inside WhatsApp. This step is always manual (§20, FD-11 equivalent for send). 5. The owner returns to Nexora and records the delivery (MD-DLV-02).

**3. Decisions and outcomes**

| Situation | Outcome |
| --- | --- |
| Template exists and all placeholders resolve | Message ready for review. |
| A placeholder has no value for this order | Undefined — MD-TPL-03. |
| No template configured for this product | Undefined — MD-TPL-02. |
| Customer number invalid or not on WhatsApp | Owner cannot reach the customer; see Failure. |
| Owner wants to modify the text | Undefined — MD-WA-01. |

**4. Success path** WhatsApp opens on the customer's chat with the full message; the owner sends it; the owner records Delivered.

**5. Failure path** - Number format cannot be used to open a chat (MD-WA-02). - Number is not on WhatsApp or the customer does not respond: delivery cannot complete; the owner uses the customer-service/manual-handling path (§30). - Owner opens WhatsApp but never sends: the order stays Preparing. - Owner sends to the wrong chat: delivery error (MD-DLV-03).

**6. Refresh / leave / close / return** - Opening WhatsApp takes the owner out of Nexora (possibly to a different app). On return the order must still be Preparing. - Refreshing regenerates the message; whether it uses today's template or the template as it was first generated is MD-TPL-04. - The system cannot tell whether the owner actually sent anything.

**7. Changes during the flow** - **Template edited meanwhile:** MD-TPL-04. - **Customer's WhatsApp number corrected meanwhile:** the message must target the corrected number (MD-PAY-03). - **Stock/payment/shift:** no effect on message generation. - **Order status:** if another owner already marked Delivered, this owner must be told before sending a second message.

**8. Simultaneous actions** Both owners open WhatsApp for the same order: the customer could receive the credentials twice. Prevention (for example a visible "already being delivered by Owner X") is MD-WA-03.

**9. Statuses and transitions** Order stays **Preparing** during this flow. Message sub-states: MD-DLV-01.

**Edge cases** - E1. Customer number saved as 01xxxxxxxxx: WhatsApp needs a full international form; the country assumption is MD-WA-02. - E2. Customer is outside Egypt: same. - E3. Message contains credentials with symbols or mixed Arabic/English text: must arrive character-exact and readable. - E4. Very long message (many items): behavior at WhatsApp's limits is not defined (MD-TPL-05). - E5. Resending to the same customer (customer says they did not get it): whether resending is logged and what it means for "delivered" is MD-WA-04. - E6. Owner opens WhatsApp on a device where the customer's chat exists with a different owner: message history is outside Nexora's control. - E7. Delivery messages contain sensitive data and are visible to both owners on screen (MD-ACC-01).

> **DECISION · MD-WA-01.** The Owner may edit the generated WhatsApp message before opening WhatsApp. Once generated, the message is independent of later template changes.
> 
> **DECISION · MD-WA-02.** WhatsApp numbers are normalized before generating the WhatsApp link. Egyptian numbers are normalized to +20 and other numbers follow E.164 format.
> 
> **DECISION · MD-WA-03.** Opening WhatsApp marks the message Prepared/Opened. The Owner must explicitly click Mark as Sent after sending. Resend requires confirmation and a reason.
> 
> **DECISION · MD-WA-04.** Each delivery keeps a message log of Generated, Opened, Marked Sent, and Resent actions, with actor and timestamp.

---

### 5.10 Message Templates

**1. Starting point** Owner opens the Message Templates area (§21).

**2. Step-by-step flow** 1. Owner creates a template in Arabic text, inserting dynamic data: customer name, product name, order number, delivery link, account information, email, product-specific fields (§21). 2. Owner assigns the template to a product through the product's message-template configuration (§7). 3. When delivery is prepared, the system fills the template from the order (§21). 4. Owner edits or retires templates as needed. Template changes are attributed and logged (§33).

**3. Decisions and outcomes** - Template saved → available to assign. - Template edited → future messages use the new text; in-flight handling: MD-TPL-04. - Template removed → products using it: MD-TPL-02.

**4. Success path** Delivery message is produced automatically, correct, and ready for review.

**5. Failure path** - Placeholder written incorrectly or unknown. - Template empty. - Save fails.

**6. Refresh / leave / close / return** Unsaved edits are lost on leaving; saved ones persist.

**7. Changes during the flow** - **Product fields renamed/removed while a template uses them:** MD-TPL-03. - **Template edited while an owner is mid-delivery:** MD-TPL-04. - **Shift/stock/payment:** no effect.

**8. Simultaneous actions** Two owners editing one template: conflict handling is the same open question as products (MD-PRD-06).

**9. Statuses** Not defined (MD-TPL-02).

**Edge cases** - E1. Template uses a field the product does not collect (for example email): the message would contain a blank — MD-TPL-03. - E2. Credentials and links inside Arabic text may flip direction or wrap incorrectly: must display and copy correctly (§4.1). - E3. Order with several unique items: the message must hold several credentials; MD-TPL-05. - E4. Two products share a template: edits affect both. - E5. Product has no template at delivery time: MD-TPL-02.

> **DECISION · MD-TPL-01.** Template types are Delivery, Replacement, Refund/Payment Return, and Customer Service.
> 
> **DECISION · MD-TPL-02.** There is one Active Default template per context. Template changes apply to new deliveries only; the order stores the template version used for that transaction.
> 
> **DECISION · MD-TPL-03.** Templates use a controlled placeholder catalogue such as Order Number, Customer Name, Product, Quantity, Price, Delivery Information, and Tracking Link. A required placeholder with missing data blocks message generation.
> 
> **DECISION · MD-TPL-04.** Changing a template never changes a message already generated for an existing order; it affects only future generations.
> 
> **DECISION · MD-TPL-05.** One WhatsApp message is generated per order by default. Separate messages are used only when the delivery method technically requires them.

---

### 5.11 Customer-Service Cases

**1. Starting point** An order is flagged **Needs Customer Service** (late payment without stock, §13), or a customer contacts the global customer-service WhatsApp number about a delivery problem or other matter (§30).

**2. Step-by-step flow** 1. The flagged order appears on the dashboard under customer-service cases (§31). 2. The customer contacts the single global customer-service WhatsApp number (§30, FD-27). 3. The owner investigates the order and decides the outcome. 4. The outcome is carried out through normal flows (new stock and delivery, replacement, refund, cancellation). 5. The flag is cleared when resolved.

**3. Decisions and outcomes** All outcomes are undefined (MD-CS-02).

**4. Success path** Customer's problem is resolved through the delivery, replacement or refund flows and the flag is cleared.

**5. Failure path** The customer never contacts customer service, or contacts with incorrect information. The flagged order remains open on the dashboard.

**6. Refresh / leave / close / return** Flags persist until resolved; no auto-clearing is defined.

**7. Changes during the flow** - **Stock added later:** a flagged late-payment order may now be fulfillable; whether it is re-offered to the owner is MD-CS-04. - **Customer-service number changed:** changes for everyone (single global setting, FD-27); customers already told the old number are not informed. - **Shift/payment:** the money went to the originally shown account (FD-15).

**8. Simultaneous actions** Two owners handling the same flagged order: ownership and conflict rules are MD-CS-03.

**9. Statuses** Flag only: Needs Customer Service. Lifecycle: MD-CS-01.

**Edge cases** - E1. The customer-service WhatsApp is one number shared by two owners: who monitors it and from which device is not specified (MD-CS-03). - E2. The customer paid and stock is gone, so the money must go back. Refund Case rules are tied to products that are refundable and to delivered orders (MD-RFD-03). - E3. A customer contacts customer service with no order (general question): the system only provides the number (§30); whether such contacts are recorded is MD-CS-05. - E4. Customer quotes the wrong order number: owner must verify by phone and transfer details.

> **DECISION · MD-CS-01.** Customer Service Case states are Open, Contacted, Waiting, Resolved, and Closed.
> 
> **DECISION · MD-CS-02.** A Customer Service Case may be resolved by Fulfill Order, Wait for Stock, Refund/Payment Return, or Close/Reject. A late-payment case with unavailable stock remains open or waiting until one of those outcomes is chosen.
> 
> **DECISION · MD-CS-03.** Each Customer Service Case may have an Assigned Owner. Either Owner may claim an unassigned case; once claimed, the assignee is recorded.
> 
> **DECISION · MD-CS-04.** When stock is added for a product with waiting Customer Service cases, the system creates one consolidated alert for that product rather than repeated alerts.
> 
> **DECISION · MD-CS-05.** Standalone Customer Service Cases are supported without an Order and store customer name, contact, subject, notes, owner, status, and timestamps.

---

### 5.12 Replacement Case

**1. Starting point** A **delivered** product does not work as expected. The customer reports it (through customer service, §30), and the owner opens a **Replacement Case** from the order (§22, FD-23).

**2. Step-by-step flow** 1. Customer reports the problem through the customer-service WhatsApp number (§30). 2. Owner opens the order and starts a Replacement Case (§22). 3. Owner provides a replacement (a new unique item, or re-doing the manual/customer-account process) and delivers it via WhatsApp (Flow 5.9). 4. If the replacement solves the problem, the case is **closed** (§22). 5. If not, the order may proceed to a **Refund Case**, when the product is refundable (§22).

**3. Decisions and outcomes**

| Situation | Outcome |
| --- | --- |
| Replacement resolves the issue | Case closed. |
| Replacement does not resolve it and product is refund-eligible | May proceed to Refund Case (Flow 5.13). |
| Replacement does not resolve it and product is not refundable | Undefined — MD-RPL-03. |
| No replacement stock available | Undefined — MD-RPL-02. |
| Product is Counted, Unlimited or Manual (no unique item) | What a "replacement" is: MD-RPL-02. |

**4. Success path** Customer receives a working replacement; case closed; no refund.

**5. Failure path** Replacement also fails; no stock for replacement; customer unreachable.

**6. Refresh / leave / close / return** Open case persists on the order until the owner closes it or moves it to a refund.

**7. Changes during the flow** - **Stock:** replacement items come from the same inventory customers buy from; allocation must be protected so the item is not sold to someone else in the meantime (G3). - **Shift:** whether a shift must be active for owners to handle cases is MD-RPL-04. - **Refund eligibility or period edits:** MD-RFD-02. - **Order status:** no status change defined (MD-ORD-04).

**8. Simultaneous actions** - Both owners open a Replacement Case for the same order: one case. - Replacement and refund started at the same time on the same order: they must not both complete (MD-RFD-05).

**9. Statuses and transitions** Case: Open → Closed, or Open → proceeds to Refund Case (REQ §22). Other states: MD-RPL-01.

**Edge cases** - E1. Replacement given, customer reports failure again: further replacements allowed or forced to refund? MD-RPL-03. - E2. Customer says item does not work but it does (customer error): owner decides; no rule exists. - E3. The faulty item's status and the cost of the error: MD-INV-03, MD-DLV-03. - E4. Replacement requested after the refund period or after Completed: MD-RPL-03. - E5. Replacement is delivered to a different WhatsApp number than the original: MD-PAY-03. - E6. Replacement of a multi-item order where only one item failed: MD-DLV-04. - E7. Replacement does not create a new sale for the customer (no new payment): how it is recorded financially is MD-RPL-05.

> **DECISION · MD-RPL-01.** Replacement Case stores reason, affected item/quantity, original delivery owner, case owner, replacement item, status, and timestamps. States are Open, Processing, Completed, and Failed.
> 
> **DECISION · MD-RPL-02.** Replacement uses available stock from the same product. Unique products use a new unique item, counted products use available quantity, and unlimited products require no inventory allocation.
> 
> **DECISION · MD-RPL-03.** Each affected item/quantity may receive at most one replacement. If that replacement fails, the case may proceed to a Refund Case when refund rules allow it.
> 
> **DECISION · MD-RPL-04.** Replacement Cases do not require an active shift; an existing customer transaction may be resolved after the shift closes.
> 
> **DECISION · MD-RPL-05.** A free replacement does not create a new sale. It creates an inventory movement and replacement record. Any external cost can be recorded separately as an expense.

---

### 5.13 Refund Case

**1. Starting point** The order is on the owner's order page and the owner decides to initiate a refund (§22). **Customers cannot issue refunds** (§22, FD-22).

**2. Step-by-step flow** 1. Owner opens the order and starts a refund (the initiating owner is recorded, §32). 2. System checks the product is **refund-allowed** and the request is **within the configured refund period** (§22, FD-20, FD-21). 3. Owner confirms. A Refund Case is created. 4. The refund is carried out and recorded in the financial record (§23); corrections follow the reversal/adjustment mechanism (FD-19).

**3. Decisions and outcomes**

| Situation | Outcome |
| --- | --- |
| Product refund-allowed and within period | Owner may initiate. |
| Product refund-not-allowed | Refund cannot be initiated through the normal flow; any override: MD-RFD-04. |
| Outside the refund period | Not eligible; any override: MD-RFD-04. |
| Replacement already attempted and failed | Refund Case "may follow when eligible and appropriate" (FD-23); who judges "appropriate": MD-RFD-04. |
| Order not yet Delivered (Accepted, Preparing, rejected-but-paid, CS case) | Undefined — MD-RFD-03. |

**4. Success path** Refund Case is completed; the refund is recorded against the correct owner; history shows who initiated it.

**5. Failure path** Eligibility check fails; refund cannot be completed (customer unreachable); a refund is attempted twice for the same order.

**6. Refresh / leave / close / return** A started refund persists as a case; completing it twice must not create two refunds (MD-RFD-05).

**7. Changes during the flow** - **Product refund setting or period edited:** MD-RFD-02. - **Wallet changes:** refund affects the relevant owner's balance (MD-RFD-06). - **Shift:** MD-RPL-04. - **Order status:** MD-ORD-04.

**8. Simultaneous actions** - Both owners initiate a refund on the same order: only one refund. - Refund and replacement concurrently: MD-RFD-05. - Refund and a transfer/expense draining the same wallet at once: MD-RFD-06.

**9. Statuses and transitions** Refund Case states: MD-RFD-01. Financial: a refund record is added; the original sale record is untouched (G8).

**Edge cases** - E1. Refund period measured from what moment (order, acceptance, delivery): MD-RFD-02. - E2. Partial refund (one of several items, or a reduced amount): MD-RFD-03. - E3. The owner who received the money differs from the owner who initiates the refund: whose balance pays? MD-RFD-06. - E4. Refund after a replacement succeeded partly: MD-RPL-03. - E5. Refund for a delivered unique item: the item cannot return to stock as valid (MD-INV-03). - E6. Refund pushes an owner's balance below zero: MD-WAL-03. - E7. How the money physically reaches the customer (to the payment-transfer number, to another number): MD-RFD-07.

> **DECISION · MD-RFD-01.** Refund Case stores reason, refund amount, customer recipient, payment method, initiating owner, completion date, external transfer reference, and status.
> 
> **DECISION · MD-RFD-02.** Refund period uses a global default with a product-level override. It starts from the Delivery date, is measured in days, and the effective period is locked onto the order at reservation time.
> 
> **DECISION · MD-RFD-03.** Refunds are full-order refunds or per-quantity refunds only; arbitrary amounts are not allowed. Refunds are allowed for eligible Delivered orders, failed replacements, and paid-but-rejected Payment Return Cases.
> 
> **DECISION · MD-RFD-04.** Refund overrides are allowed only for explicit exceptions such as seller-caused delivery errors or management exceptions, and a reason is mandatory.
> 
> **DECISION · MD-RFD-05.** The same quantity cannot receive both a successful replacement and a refund. A partial replacement and refund may coexist only for different affected quantities. Concurrent duplicate refunds are blocked.
> 
> **DECISION · MD-RFD-06.** A refund is charged to the Wallet of the Owner whose payment account received the customer payment, not the owner who initiated the refund. A negative balance is allowed when the refund causes it.
> 
> **DECISION · MD-RFD-07.** Refunds are carried out manually using the same external payment channel used for the purchase, to the recorded payment/transfer number unless a changed destination is explicitly requested and documented.

---

### 5.14 Wallets and Financial Records

**1. Starting point** Owner opens their wallet / financial records (§23, §24), or a financial event happens elsewhere (delivery, refund, expense, transfer).

**2. Step-by-step flow** 1. Each owner has financial balances for the business activity they handle (§24). 2. Financial records are: **sales, expenses, transfers, refunds, adjustments** (§23). 3. **Sale:** posted **at Delivery**, not at payment acceptance (§23, FD-17). It is posted to the owner who owns the payment account shown to the customer, even if the active shift changed afterwards (§24, FD-15). 4. **Expense:** posted when an owner records it (Flow 5.16). **Transfer:** posted immediately (Flow 5.15). **Refund:** posted when a refund is completed (Flow 5.13). 5. Posted records are **not edited or deleted**. A correction is a separate, explicit **reversal/adjustment** that keeps the original visible (§23, FD-19). 6. Every record shows who created it and links to its source (order, transfer pair, expense) (§32, §33).

**3. Decisions and outcomes**

| Event | Financial effect |
| --- | --- |
| Payment accepted | **None yet** (FD-17). |
| Order Delivered | Sale posted to the payment-account owner. |
| Delivered by a different owner than the payment owner | Sale still belongs to the payment-account owner; the delivering owner is recorded as the actor. |
| Expense recorded | Affects the relevant financial record (§26); which wallet: MD-EXP-02. |
| Refund completed | Refund record (MD-RFD-06 for the wallet). |
| Mistake in a posted record | Reversal/adjustment only (FD-19). |

**4. Success path** Every money movement has exactly one owner, one author, one source and a permanent trail.

**5. Failure path** - A sale must never be posted twice (double delivery click) and must never be missing for a Delivered order (success criteria, §35). If posting fails, the owner must see that the delivery is not complete. - A reversal attempted twice on the same record.

**6. Refresh / leave / close / return** Records are server-side; leaving mid-reversal creates nothing until confirmed.

**7. Changes during the flow** - **Shift change:** does not move ownership of existing orders' money (FD-15). - **Payment account edited:** history keeps the account shown to the customer at the time. - **Order status change after delivery (refund/replacement):** MD-ORD-04. - **Product price edited after the sale:** the posted amount does not change (G8).

**8. Simultaneous actions** - Two owners press Delivered at once: one sale. - A sale posting and a transfer or refund hitting one balance at once: each applied in order; balances must stay consistent (MD-WAL-03 on negatives). - Both owners reverse the same record: only one reversal.

**9. Statuses and transitions** Record: Posted → (Reversed/Adjusted by a new linked record). Display of the original after reversal: MD-WAL-05.

**Edge cases** - E1. Money accepted (customer paid) but never delivered: the owner physically holds the money but no sale exists yet. How balances show this is MD-WAL-02. - E2. Delivery then replacement then refund: the sale, then a refund record; no deletion. - E3. A delivery marked by mistake: the sale must be reversed, not removed (MD-DLV-05). - E4. A reversal of a reversal: allowed? MD-WAL-05. - E5. Decimal amounts and rounding in EGP: MD-WAL-06. - E6. Records near midnight in Africa/Cairo: the record date follows Cairo time (§4.2); how reports group them: MD-DSH-01. - E7. One owner wants to correct the other owner's record: MD-ACC-01, MD-WAL-04.

> **DECISION · MD-WAL-01.** Each Owner has one Business Wallet that aggregates the Owner's financial activity across all of their payment accounts. Payment-account ownership is separate from the wallet.
> 
> **DECISION · MD-WAL-02.** Wallet Balance equals posted Sales minus Expenses minus Refunds plus Transfers In minus Transfers Out plus or minus posted Adjustments. Accepted-but-undelivered orders do not count as posted balance, but may be shown separately as pending money.
> 
> **DECISION · MD-WAL-03.** Negative balances are allowed for refunds and expenses so the financial record remains truthful. Transfers are blocked when they would exceed the sender's available balance.
> 
> **DECISION · MD-WAL-04.** Both Owners can view all Wallet and financial history. Posted records cannot be edited directly. Reversals and adjustments are allowed with a mandatory reason and audit trail.
> 
> **DECISION · MD-WAL-05.** A reversal or adjustment creates a new linked record with reason, author, and timestamp. The original remains visible and is marked Reversed or Adjusted. Direct deletion is never used.
> 
> **DECISION · MD-WAL-06.** All monetary values use two decimal places and are displayed in EGP with two decimal places.

---

### 5.15 Transfers Between Owners

**1. Starting point** An owner opens the transfer action in the wallet area (§25).

**2. Step-by-step flow** 1. Owner enters the amount (and any other required details, MD-TRF-03). 2. Owner confirms. 3. The transfer is recorded **immediately** (§25, FD-18): the sender's balance decreases and the receiver's balance increases. 4. Both sides are one **linked business transaction** (§25). 5. **No receiver approval** is needed in this version (§25). 6. Creating owner and time are recorded (§32); the transfer remains in history (§25, §33).

**3. Decisions and outcomes**

| Situation | Outcome |
| --- | --- |
| Valid amount, enough balance (if required) | Transfer recorded immediately. |
| Amount exceeds the sender's balance | Undefined — MD-TRF-01. |
| Amount zero or negative | Invalid; not recorded. |
| Wrong transfer discovered later | Reversal/adjustment only (FD-19). |

**4. Success path** Both balances change at once and both owners can see one linked entry.

**5. Failure path** Invalid amount; save failure. A transfer must be either fully recorded on both sides or not at all; never one side only.

**6. Refresh / leave / close / return** - If the owner loses connection right after confirming, on return they must be able to check history to see whether it was recorded, before trying again (to avoid recording twice). - Back button after success must not resubmit.

**7. Changes during the flow** Another event may change the sender's balance between opening the form and confirming (sale, expense, refund, other transfer). The check, if any (MD-TRF-01), uses the balance at confirmation time.

**8. Simultaneous actions** - A→B and B→A at the same moment: both recorded as two independent transfers. - Two transfers from the same sender that together exceed the balance: depends on MD-TRF-01. - An expense and a transfer against one balance at once. - The receiver sees the new balance without acknowledgement; there is no approval step (§25).

**9. Statuses and transitions** Recorded (immediate). Reversal: MD-TRF-04.

**Edge cases** - E1. Transfer to oneself: not meaningful; blocked or not — MD-TRF-03. - E2. The receiver disagrees ("I never received this"): since no approval exists, the only correction is a reversal/adjustment (MD-TRF-04). - E3. Transfer amount with decimals: MD-WAL-06. - E4. Is the transfer a record of cash/money already moved outside Nexora, or an instruction that moves it? Nexora has no payment rails (0.5), so it is **\[IMPLIED\]** to be a record; MD-TRF-02. - E5. Backdated transfer: MD-TRF-03. - E6. Transfer during an active shift vs not: no dependency stated.

> **DECISION · MD-TRF-01.** A transfer cannot exceed the sender's available balance. The system blocks the transfer and shows the insufficient-balance message.
> 
> **DECISION · MD-TRF-02.** A Nexora transfer is only a record of money that the Owners moved between themselves outside Nexora; Nexora does not move the funds.
> 
> **DECISION · MD-TRF-03.** Transfer fields are amount, receiver, note, and timestamp. The sender is always the signed-in Owner. The MVP does not allow backdated transfers.
> 
> **DECISION · MD-TRF-04.** The sender can reverse a transfer. The receiver does not need to approve. Reversal creates a linked reversal record and reverses both wallet effects.

---

### 5.16 Expenses

**1. Starting point** An owner opens the expense entry (§26).

**2. Step-by-step flow** 1. Owner enters: amount, category, description, date, responsible owner (§26). 2. Owner saves; the expense is recorded and affects the relevant financial records (§26). 3. Expenses appear in financial summaries (§26, §31). 4. A recorded expense is never edited or deleted; corrections use reversal/adjustment (FD-19).

**3. Decisions and outcomes** Valid entry → recorded. Invalid amount or missing required field → blocked. Mistake found later → reversal/adjustment.

**4. Success path** Expense is recorded against the correct owner and appears in summaries.

**5. Failure path** Validation errors; save failure (the owner must see that nothing was recorded).

**6. Refresh / leave / close / return** Unsaved entries are lost; after saving, refresh or back must not create a duplicate.

**7. Changes during the flow** Balance changes by other events do not block an expense unless a negative-balance rule exists (MD-WAL-03).

**8. Simultaneous actions** - Both owners enter the same shared expense (for example one bill): two records; nothing prevents duplicates. - Expense and transfer against the same balance at once.

**9. Statuses and transitions** Recorded → Reversed/Adjusted by a linked record (MD-EXP-03).

**Edge cases** - E1. Amount zero or negative: invalid. - E2. Date in the future or far in the past: MD-EXP-04. - E3. Responsible owner differs from the signed-in owner (A enters B's expense): MD-EXP-02. - E4. Expense paid personally by an owner for the business: how it is reimbursed is not defined (MD-EXP-02). - E5. Category missing or misspelled: MD-EXP-01. - E6. Expense larger than the balance: MD-WAL-03.

> **DECISION · MD-EXP-01.** Expense categories come from a fixed list plus Other. Selecting Other requires a note.
> 
> **DECISION · MD-EXP-02.** An expense is deducted from the balance of the Responsible Owner. One Owner may enter an expense for the other Owner, but the Responsible Owner is stored explicitly.
> 
> **DECISION · MD-EXP-03.** Any Owner may reverse an expense using a linked reversal record and a mandatory reason.
> 
> **DECISION · MD-EXP-04.** Expense date defaults to the current Cairo date. Backdating is allowed up to 7 days; future dates are not allowed.

---

### 5.17 Settings

**1. Starting point** Owner opens Settings.

**2. Settings named in the requirements**

| Setting | What it controls | Source |
| --- | --- | --- |
| Reservation duration | Length of new reservations (default 10 minutes). **New reservations only.** | §12, FD-4, FD-5 |
| Maximum reservation extension | How far customers may extend | §12, FD-7 |
| Refund period | The allowed refund window (per product or global — MD-RFD-02) | §7, §22, FD-21 |
| Customer-service WhatsApp number | **One global number** for the whole store | §13, §30, FD-27 |
| Payment accounts | Each owner's own accounts | Flow 5.3 |
| Message templates | Delivery message text | Flow 5.10 |
| Language/currency/time zone | Arabic, RTL, EGP, Africa/Cairo defaults; English is a future option | §4 |

**3. Step-by-step flow** Owner changes a setting → system validates → saves → effect applies as stated for that setting.

**4. Decisions and outcomes** - Reservation duration changed → future reservations only; existing ones keep their assigned duration (§12). - Customer-service number changed → used from then on for everyone (single global setting).

**5. Success path** New value takes effect exactly as described, and customers see consistent behavior.

**6. Failure path** Invalid value (zero, negative, text, absurdly long); save failure.

**7. Refresh / leave / close / return** Unsaved changes lost; saved changes persist.

**8. Changes during the flow** - **Duration changed while customers are mid-checkout:** they keep their original duration (FD-5). - **Maximum extension changed:** MD-RSV-02. - **Refund period changed:** MD-RFD-02. - **Customer-service number changed while a customer has the old one on screen:** the customer's screen keeps what they saw; new displays use the new number.

**9. Simultaneous actions** Both owners change the same setting: last confirmed value stands unless a conflict warning is decided (MD-PRD-06). A setting is global, so a change by either owner affects both (MD-SET-01).

**Statuses** None.

**Edge cases** - E1. Duration set to 0 or an extreme value: limits undefined (MD-SET-02). - E2. Maximum extension set to 0: reasonable meaning is "no extension allowed" **\[IMPLIED\]**; confirm in MD-SET-02. - E3. Customer-service number blank or invalid and a late payment needs it: MD-SET-03. - E4. Setting changes are not listed in the audit list of §33: MD-SET-04.

> **DECISION · MD-SET-01.** Both Owners may change global settings. Every change is recorded with the Owner, timestamp, old value, and new value.
> 
> **DECISION · MD-SET-02.** Reservation duration is 1–60 minutes with a default of 10 minutes. Maximum extension is 0–60 minutes. Refund period is 0–30 days by default and may be overridden per product.
> 
> **DECISION · MD-SET-03.** One global customer-service WhatsApp number is mandatory before the first shift can open. It must pass WhatsApp/E.164 validation.
> 
> **DECISION · MD-SET-04.** Changes to global settings are written to the audit log with setting name, previous value, new value, Owner, and timestamp.

---

### 5.18 Dashboard and Activity History

**1. Starting point** An owner signs in or opens the dashboard (§31).

**2. Step-by-step flow** 1. The dashboard shows: current store status, active shift, current orders, orders awaiting payment review, orders waiting for delivery, reserved stock, available stock, low/out-of-stock products, sales, expenses, transfers, owner balances, customer-service cases, recent activities (§31). 2. The owner drills into any item to act (review a payment, prepare a delivery, restock). 3. Activity history lets owners review what happened: order status changes, stock changes, delivery actions and errors, refunds, expenses, transfers, shift changes, product changes, payment-account changes, message-template changes (§33).

**3. Decisions and outcomes** First version prioritizes operational clarity over advanced analytics (§31).

**4. Success path** Both owners see the same accurate operational picture and a traceable history.

**5. Failure path** Stale or inconsistent numbers; data fails to load.

**6. Refresh / leave / close / return** Dashboard always shows current server data; whether it updates by itself is MD-DSH-03.

**7. Changes during the flow** Customers reserve, submit and expire in real time; counts of reserved/available stock and awaiting-review orders change continuously.

**8. Simultaneous actions** Both owners viewing the same dashboard may act on the same item; Part 6.2 defines the outcomes.

**9. Statuses** Dashboard shows all order, shift and stock statuses defined in Part 3.

**Edge cases** - E1. Owner opens the dashboard with no active shift: the store status says closed; actions on in-flight orders remain available. - E2. A product has stock but only reserved units: shows low or zero available while reserved is non-zero. - E3. Many orders await review with none being claimed: no reminder exists (MD-DSH-03). - E4. Financial totals around midnight, across shifts and across months: MD-DSH-01. - E5. History for an owner who no longer uses the system: MD-ACC-03.

> **DECISION · MD-DSH-01.** Dashboard date ranges are Today, Last 7 Days, Last 30 Days, and Custom. Grouping is daily for short ranges and weekly for longer ranges.
> 
> **DECISION · MD-DSH-02.** The default low-stock threshold is 3 units and is configurable from Settings.
> 
> **DECISION · MD-DSH-03.** The dashboard refreshes live enough to surface new payment submissions, low stock, customer-service cases, delivery errors, and shift events without requiring a manual full-page reload.
> 
> **DECISION · MD-DSH-04.** Order, financial, and audit history is retained without normal deletion. History supports filtering by date, status, Owner, product, customer, and transaction source.

---

## Part 6 — Cross-Flow Matrices

### 6.1 What happens when something changes mid-flow

Each row is a phase; each column is something changing underneath it.

| Phase | Stock changes | Payment account / payment info changes | Shift changes | Order status changes |
| --- | --- | --- | --- | --- |
| **Browsing** | Display is informational; final decision at reservation (§29). | Not applicable. | Closed → Buy refused at press. Handover → next checkout uses new owner's accounts. | Not applicable. |
| **Reserved (on payment page)** | Reserved stock is protected from other customers. Owner removal of it: MD-INV-05. | The customer keeps the details shown; owner edits apply to new customers only (§14, FD-15). | Shift close does not invalidate (FD-16). Handover does not move this order's money. | Only submit, release, expire (3.2). |
| **Payment Submitted / Under Review** | Held for the order; duration MD-PAY-01. | Order stays tied to the account shown. | Review still possible; who reviews: MD-REV-02. | Whichever owner acts first wins; second sees the new status. |
| **Accepted** | Allocated; may not be altered by others (MD-INV-05). | Unchanged. | Delivery still possible. | Cancel: MD-ORD-03. |
| **Preparing** | Allocated; item edits: MD-INV-06. | Unchanged. | Delivery still possible. | Double delivery prevented; Delivered posts the sale once. |
| **Delivered** | Item/quantity is sold; refund/replacement impact: MD-INV-03. | Sale belongs to the account shown. | None. | Refund/replacement effect on status: MD-ORD-04. |
| **Late payment (expired/released)** | Availability re-checked at submission; one decision (§13). | Money went to the account shown originally. | Closed: MD-LTE-04. | Status result: MD-LTE-03. |

### 6.2 Two users acting at the same time

| # | Scenario | Required outcome | Basis | Open decision |
| --- | --- | --- | --- | --- |
| C1 | Two customers reserve the last unique item | One reservation succeeds; the other is refused with no side effect | §29, G3 | — |
| C2 | Two customers' quantities together exceed counted stock | Total held never exceeds available; second is refused or reduced | §11, §29 | MD-CHK-03 |
| C3 | Customer presses Buy as owner closes the shift | First processed wins; reservation created first continues (FD-16) | §15 | — |
| C4 | Customer presses Buy as owner removes that stock | No reservation for removed stock | G2, G3 | MD-INV-05 |
| C5 | Customer submits as the reservation expires | One outcome, safe either way when stock exists | §13 | — |
| C6 | Double-click or two tabs submit | One order | §12 | — |
| C7 | Two late payers, one unit | One accepted, one to customer service | §13 | MD-LTE-02 |
| C8 | Late payer vs new customer | Only one gets the unit | §29 | — |
| C9 | Two owners press Open shift | One shift result | §15 | MD-SHF-01 |
| C10 | Owner changes reservation duration while customer reserves | New reservations only | FD-5 | — |
| C11 | Two owners review the same order | Only the first decision applies; second sees result | §17 | MD-REV-01 |
| C12 | Accept vs Reject at the same time | One transition only | §17 | — |
| C13 | Both owners Prepare/Mark delivered | One delivery, one sale posting | §20, FD-17 | MD-DLV-02, MD-WA-03 |
| C14 | Both owners open WhatsApp for the same order | Prevent duplicate credentials | §20 | MD-WA-03 |
| C15 | Owner edits template while another prepares a message | Defined behavior needed | §21 | MD-TPL-04 |
| C16 | Owner edits a payment account while a customer is paying | Customer keeps shown details | §14 | — |
| C17 | Owner edits product price during checkout | Defined behavior needed | §27 | MD-CHK-04 |
| C18 | Owner deactivates product during checkout | Defined behavior needed | §28 | MD-PRD-05 |
| C19 | Two owners add the same unique item | Defined behavior needed | §10 | MD-INV-04 |
| C20 | Two owners edit the same product/template/setting | Defined behavior needed | §28 | MD-PRD-06 |
| C21 | A→B and B→A transfers at once | Both recorded independently | §25 | — |
| C22 | Expense and transfer drain the same balance | Consistent balances | §23 | MD-WAL-03, MD-TRF-01 |
| C23 | Two owners start a refund on the same order | One refund | §22 | MD-RFD-05 |
| C24 | Refund and replacement at once | Must not both complete | §22 | MD-RFD-05 |
| C25 | Two owners reverse the same financial record | One reversal | FD-19 | MD-WAL-05 |
| C26 | Customer tracks while owner changes status | Customer sees old status until refresh | §19 | MD-TRK-02 |

---

## Part 7 — Ambiguities and Conflicts Inside the Requirements

These are places where two parts of the requirements pull in different directions, or where one rule cannot be applied without a missing definition. Each is resolved only by the decisions in Part 8.

| # | Issue | Where | Resolved by |
| --- | --- | --- | --- |
| A1 | The customer must leave the page's focus to pay in a banking app, but leaving the page releases the reservation. | §12, §16, FD-6 | MD-CHK-08 |
| A2 | Late payers may "attempt to submit payment after expiry", but a customer who left has no page to submit from. | §12, §13 | MD-LTE-01 |
| A3 | "Reserved" is an order status, but tracking needs data entered only at submission. | §18, §19 | MD-CHK-01 |
| A4 | Refund period is both a product field and a global management setting. | §7, §22, FD-21 | MD-RFD-02 |
| A5 | The stock list shows "sold", but a sale posts at Delivery. | §23, §28 | MD-INV-02 |
| A6 | Payment Submitted and Under Review, Delivered and Completed are listed but not distinguished. | §18 | MD-REV-01, MD-ORD-02 |
| A7 | Only payment info is explicitly locked, but "locked transaction details" is used broadly. | §14, FD-16 | MD-CHK-04 |
| A8 | "Payment evidence" is reviewed, but none is collected in §9. | §9, §17 | MD-PAY-05 |
| A9 | Customers choose "a payment method" in the overview, but §16 only shows methods; ownership needs to know which was used. | §2, §14, §16 | MD-CHK-05 |
| A10 | Money belongs to the account owner, but nothing says whether another owner may verify it. | §14, §17, FD-15 | MD-REV-02 |
| A11 | Order statuses have no outcome for refunds or replacements. | §18, §22 | MD-ORD-04 |
| A12 | Customer-service WhatsApp is the entry point for delivery problems, but replacement initiation by the customer is never described. | §22, §30 | MD-RPL-01, MD-CS-02 |
| A13 | Audit lists in §32 and §33 do not match, and neither mentions settings changes. | §32, §33 | MD-SET-04 |
| A14 | "Refund when eligible and appropriate" is used without defining appropriate. | FD-23 | MD-RFD-04 |
| A15 | Wallets are plural per owner, but the structure is not defined. | §24 | MD-WAL-01 |
| A16 | §6 says "start checkout" and §16 says "payment page"; whether these are one page or two, and where quantity is chosen, is unclear. | §6, §16 | MD-CHK-02 |

---

## Part 8 — Register of All MISSING DECISIONS

**Total: 118** — Critical: 20 · High: 54 · Medium: 44.

Resolve the **Critical** items first: they block the core flows (reservation, payment, stock, delivery, money). Each item's full explanation and the exact decision needed is in the flow where it appears (search for its ID).

### Critical

| ID | Decision |
| --- | --- |
| MD-CHK-01 | The Order is created when the reservation succeeds and receives its Order Number immediately. Reserved/abandoned orders remain stored for tracking and history. |
| MD-CHK-04 | At reservation time, the order locks the product snapshot, quantity, unit price, total price, currency, delivery type, refund eligibility and refund period, selected payment method and account, payment instructions, required customer fields, reservation duration, maximum extension, and the message-template version used for the order. |
| MD-CHK-05 | The customer must select one payment method before submission. That selection resolves to one specific payment account, which is locked to the order. |
| MD-CHK-08 | A reservation is released by an explicit cancel, navigating away from checkout, closing the tab/window, or leaving the checkout page. Switching to another app for payment does not release the reservation merely because the browser is backgrounded. |
| MD-RSV-03 | On release or expiry, the held stock becomes available immediately. The order remains stored with status Expired and a reason such as Customer Left or Timeout, and it can enter the late-payment path during the allowed late-payment window. |
| MD-PAY-01 | After payment submission, stock remains held for up to 30 minutes for payment review. If no decision is made by the end of that period, the order expires and the held stock is released. |
| MD-LTE-01 | The customer reaches the late-payment path from Track Order or the previous order link using the Order Number plus either the transfer number or WhatsApp number. |
| MD-LTE-03 | If the late payment can still be fulfilled from available stock, the order becomes Payment Submitted with a Late Submission flag. If the required stock is unavailable, the order remains Expired and receives a Needs Customer Service flag. |
| MD-SHF-01 | Only one Owner Shift may be Active at a time. An owner normally opens and closes their own shift; the other owner may force-close an abandoned shift, with the action and reason recorded in the audit log. |
| MD-INV-02 | Inventory moves from Reserved to Sold at Delivery, because the financial sale is also posted at Delivery. |
| MD-INV-05 | Reserved stock cannot be deleted or reduced below the reserved amount. The related reservation/order must be resolved first. Sold stock cannot be deleted in a way that changes historical orders; it may only be retired/removed as a separate inventory state. |
| MD-REV-02 | Both Owners can view any order. Payment acceptance/rejection requires an Owner who can verify the receiving payment account; if the active reviewer cannot verify that account, the order is placed in Waiting for Account Owner rather than being accepted blindly. |
| MD-REV-06 | When an order is rejected or cancelled before Delivery, any held reserved stock is released immediately. After Delivery, resolution is handled through Replacement or Refund rather than reservation release. |
| MD-REV-07 | A rejection requires a recorded reason. The reason is visible in Tracking and may be sent through a WhatsApp template. If the customer already paid, a Refund/Payment Return Case may be opened even when no sale was posted yet. |
| MD-DLV-02 | The Owner confirms Delivery only after preparing the delivery and opening/sending the WhatsApp message. Confirming Delivery changes the order to Delivered and posts the financial sale. |
| MD-CS-02 | A Customer Service Case may be resolved by Fulfill Order, Wait for Stock, Refund/Payment Return, or Close/Reject. A late-payment case with unavailable stock remains open or waiting until one of those outcomes is chosen. |
| MD-RFD-02 | Refund period uses a global default with a product-level override. It starts from the Delivery date, is measured in days, and the effective period is locked onto the order at reservation time. |
| MD-RFD-03 | Refunds are full-order refunds or per-quantity refunds only; arbitrary amounts are not allowed. Refunds are allowed for eligible Delivered orders, failed replacements, and paid-but-rejected Payment Return Cases. |
| MD-RFD-06 | A refund is charged to the Wallet of the Owner whose payment account received the customer payment, not the owner who initiated the refund. A negative balance is allowed when the refund causes it. |
| MD-WAL-02 | Wallet Balance equals posted Sales minus Expenses minus Refunds plus Transfers In minus Transfers Out plus or minus posted Adjustments. Accepted-but-undelivered orders do not count as posted balance, but may be shown separately as pending money. |

### High

| ID | Decision |
| --- | --- |
| MD-ACC-01 | Both Owners have the same permissions in the MVP. Differences are limited to attribution, payment-account ownership, shift ownership, and wallet ownership. |
| MD-ACC-02 | Owner authentication uses email and password. Sessions remain active for 7 days unless the owner logs out. Password reset and account deactivation are supported. Customer accounts are out of scope for the MVP. |
| MD-CHK-02 | Quantity is selected on the product page and shown again in checkout for confirmation. Quantity cannot be changed after reservation; the customer must cancel and create a new reservation. |
| MD-CHK-03 | If the customer requests more units than are currently available, the request is rejected in full. The system does not silently reduce the quantity. |
| MD-CHK-06 | An Owner cannot open a shift without at least one active usable payment account. If all payment accounts become unavailable during an active shift, new checkout reservations are blocked and the storefront shows a payment-unavailable message. |
| MD-CHK-07 | A customer may hold at most 3 active reservations at the same time for the same WhatsApp number. Repeated reserve-and-abandon behavior may trigger a temporary block. |
| MD-CHK-09 | Unlimited/availability-based products do not allocate physical inventory. The reservation locks the checkout, price, payment details, and transaction for the reservation period only. |
| MD-RSV-01 | Reservation extension is allowed only before expiry, within the configured maximum extension, and only once per reservation. |
| MD-PAY-03 | Submitted customer information is locked. If correction is required, the Owner marks the order Needs Correction; the customer receives a correction path and resubmits the required information. |
| MD-PAY-04 | Phone/WhatsApp numbers are normalized to E.164. Other fields use type-specific validation such as email, numeric, URL, text, or selection validation. |
| MD-PAY-05 | The customer submits the transfer number, selected payment method, and paid amount. Payment screenshots are optional in the MVP. |
| MD-LTE-02 | If a late-payment order can no longer be fulfilled in full, it is not partially accepted automatically; it goes to Customer Service. |
| MD-LTE-04 | A closed store does not block a late payment for an existing order. The transaction continues to use the payment account that was locked when the order was created. |
| MD-TRK-01 | Tracking shows clear customer-facing statuses: Reserved, Payment Submitted, Under Review, Accepted, Preparing, Delivered, Completed, Expired, Rejected, and Needs Customer Service, with a reason when relevant. |
| MD-TRK-03 | If the customer loses the Order Number, they can recover an order using WhatsApp number plus transfer number and, after verification, view the matching order. |
| MD-SHF-03 | A shift does not auto-close simply because it has been open for a long time. It can be force-closed by the other owner, with the action logged. |
| MD-PAC-01 | A payment account contains payment method, account identifier, account holder name, display name, payment instructions, and Active/Inactive status. |
| MD-PAC-02 | A payment account that has been used by historical orders cannot be hard-deleted; it is deactivated. Hard delete is allowed only when it has never been used. |
| MD-PRD-02 | Delivery Type and Stock Model are independent but validated for logical combinations. Unique products require unique inventory items, counted products require quantities, and unlimited products do not require inventory items. |
| MD-PRD-05 | Deactivating a product does not affect in-flight orders or existing reservations; those transactions continue using their locked order snapshot. |
| MD-PRD-07 | Product-specific customer fields may be marked Sensitive. Sensitive values are visible only to Owners in the order/delivery flow and never on customer tracking pages or public messages. |
| MD-INV-01 | For unique products, a specific unique item is allocated at reservation and becomes Reserved. Its content is hidden from the customer until Delivery. |
| MD-INV-03 | Inventory states are Available, Reserved, Sold, Defective, and Removed. Refunded digital items are not returned to Available stock. |
| MD-REV-01 | When an Owner starts working on a Payment Submitted order, it changes to Under Review and is temporarily claimed by that Owner for 10 minutes. If there is no activity after that period, another Owner can take over. |
| MD-REV-03 | Underpayment requires rejection or customer-service handling. Overpayment is not auto-accepted and requires an Owner decision. Payment sent to the wrong account is rejected. A sender-name mismatch alone does not reject a transfer if the transfer reference and amount are otherwise verifiable. |
| MD-REV-05 | A Rejected order may be reopened to Under Review by an Owner with a reason. The system rechecks stock and payment information before allowing acceptance. |
| MD-ORD-02 | Completed means Delivery finished successfully and the financial sale posting succeeded. Delivered automatically advances to Completed after both conditions succeed. |
| MD-ORD-03 | A customer can cancel only before Payment Submission. An Owner may cancel before Delivery with a required reason. Cancellation after payment/acceptance may create a Refund or Payment Return Case. |
| MD-ORD-04 | Refund or Replacement does not erase Delivered or Completed. It is recorded as a separate linked Case/Resolution attached to the original order. |
| MD-DLV-03 | A Delivery Error includes wrong credentials, wrong account, wrong link, wrong message, or incorrect delivery execution. The responsible Owner is recorded against the error. |
| MD-DLV-04 | Multi-quantity orders support partial delivery. Delivered Quantity is recorded, and the order remains partially delivered until the remaining quantity is delivered. |
| MD-DLV-05 | A Delivered order cannot be edited directly. Correction uses Reverse Delivery with a mandatory reason, followed by the required delivery and financial adjustment workflow. |
| MD-WA-02 | WhatsApp numbers are normalized before generating the WhatsApp link. Egyptian numbers are normalized to +20 and other numbers follow E.164 format. |
| MD-WA-03 | Opening WhatsApp marks the message Prepared/Opened. The Owner must explicitly click Mark as Sent after sending. Resend requires confirmation and a reason. |
| MD-TPL-01 | Template types are Delivery, Replacement, Refund/Payment Return, and Customer Service. |
| MD-TPL-02 | There is one Active Default template per context. Template changes apply to new deliveries only; the order stores the template version used for that transaction. |
| MD-TPL-03 | Templates use a controlled placeholder catalogue such as Order Number, Customer Name, Product, Quantity, Price, Delivery Information, and Tracking Link. A required placeholder with missing data blocks message generation. |
| MD-CS-01 | Customer Service Case states are Open, Contacted, Waiting, Resolved, and Closed. |
| MD-RPL-01 | Replacement Case stores reason, affected item/quantity, original delivery owner, case owner, replacement item, status, and timestamps. States are Open, Processing, Completed, and Failed. |
| MD-RPL-02 | Replacement uses available stock from the same product. Unique products use a new unique item, counted products use available quantity, and unlimited products require no inventory allocation. |
| MD-RPL-03 | Each affected item/quantity may receive at most one replacement. If that replacement fails, the case may proceed to a Refund Case when refund rules allow it. |
| MD-RFD-01 | Refund Case stores reason, refund amount, customer recipient, payment method, initiating owner, completion date, external transfer reference, and status. |
| MD-RFD-04 | Refund overrides are allowed only for explicit exceptions such as seller-caused delivery errors or management exceptions, and a reason is mandatory. |
| MD-RFD-05 | The same quantity cannot receive both a successful replacement and a refund. A partial replacement and refund may coexist only for different affected quantities. Concurrent duplicate refunds are blocked. |
| MD-RFD-07 | Refunds are carried out manually using the same external payment channel used for the purchase, to the recorded payment/transfer number unless a changed destination is explicitly requested and documented. |
| MD-WAL-01 | Each Owner has one Business Wallet that aggregates the Owner's financial activity across all of their payment accounts. Payment-account ownership is separate from the wallet. |
| MD-WAL-03 | Negative balances are allowed for refunds and expenses so the financial record remains truthful. Transfers are blocked when they would exceed the sender's available balance. |
| MD-WAL-04 | Both Owners can view all Wallet and financial history. Posted records cannot be edited directly. Reversals and adjustments are allowed with a mandatory reason and audit trail. |
| MD-WAL-05 | A reversal or adjustment creates a new linked record with reason, author, and timestamp. The original remains visible and is marked Reversed or Adjusted. Direct deletion is never used. |
| MD-TRF-01 | A transfer cannot exceed the sender's available balance. The system blocks the transfer and shows the insufficient-balance message. |
| MD-TRF-04 | The sender can reverse a transfer. The receiver does not need to approve. Reversal creates a linked reversal record and reverses both wallet effects. |
| MD-EXP-02 | An expense is deducted from the balance of the Responsible Owner. One Owner may enter an expense for the other Owner, but the Responsible Owner is stored explicitly. |
| MD-SET-03 | One global customer-service WhatsApp number is mandatory before the first shift can open. It must pass WhatsApp/E.164 validation. |
| MD-DSH-03 | The dashboard refreshes live enough to surface new payment submissions, low stock, customer-service cases, delivery errors, and shift events without requiring a manual full-page reload. |

### Medium

| ID | Decision |
| --- | --- |
| MD-ACC-03 | Adding, replacing, or deactivating Owners is managed in Settings. An Owner with historical activity is deactivated rather than deleted so attribution remains intact. |
| MD-BRW-01 | Customers see Available, Low Stock, or Out of Stock instead of the exact remaining quantity by default. |
| MD-RSV-02 | Changing Maximum Extension affects new reservations only. Existing active reservations retain the extension limit that was assigned when they started. |
| MD-RSV-04 | Closing the active shift does not remove the extension already assigned to an in-flight reservation; the customer may still use it within that reservation's existing limit. |
| MD-PAY-02 | Unsaved checkout data persists while the reservation remains active and survives refresh. After release or expiry, unnecessary unsaved data may be discarded. Submitted data becomes part of the order. |
| MD-LTE-05 | Late payment is allowed for up to 24 hours after expiry. After that window, the request can only be handled as a Customer Service inquiry. |
| MD-TRK-02 | Tracking uses Order Number plus Transfer Number or WhatsApp Number, with simple copy actions for the order number and key references. |
| MD-TRK-04 | Tracking is rate-limited to 10 lookup attempts per 10 minutes per client/IP. Suspicious automated behavior may trigger an additional CAPTCHA check. |
| MD-TRK-05 | Tracking masks sensitive customer data and never reveals credentials, full payment details, or unique inventory contents. |
| MD-SHF-02 | Customers currently purchasing means any reservation that is Active or any order that is Payment Submitted/Under Review and not yet in a terminal state. |
| MD-SHF-04 | Each shift stores open time, close time, Owner, orders handled, sales, rejections, customer-service cases, and payment accounts used. |
| MD-PAC-03 | All active payment accounts of the current Owner are available to all active products by default. Product-specific account assignment is not part of the MVP. |
| MD-PRD-01 | Each product-specific field defines its name, type, required/optional flag, validation rule, sensitive flag, and display order. |
| MD-PRD-03 | Product lifecycle is Active, Inactive, and Archived. Products with order or inventory history are never hard-deleted. |
| MD-PRD-04 | Categories can be created, edited, reordered, activated, and deactivated. Categories with products cannot be hard-deleted. |
| MD-PRD-06 | Concurrent edits use optimistic concurrency. A stale Owner cannot silently overwrite a newer Product version; the system requires reload and retry after conflict. |
| MD-INV-04 | Unique inventory item content is checked after normalization; duplicate content is blocked with a warning rather than allowed. |
| MD-INV-06 | Reserved or Sold unique-item content cannot be edited directly. Correction uses a replacement/new item flow while preserving the original history. |
| MD-REV-04 | A transfer number can be accepted only once. Reuse on another order is flagged as a payment conflict and cannot complete a second approval. |
| MD-REV-08 | A later payment reversal creates a Payment Reversal/Chargeback event and a financial adjustment against the payment-owning Owner without deleting historical records. |
| MD-ORD-01 | Order Number uses a short non-sequential format such as NX-YYMMDD-XXXXXX. Owner search supports Order Number, customer name, WhatsApp, transfer number, status, product, and date. |
| MD-DLV-01 | Delivery substates are Not Started, Preparing, Ready to Send, Sent/Waiting Confirmation, and Delivered. Partially Delivered and Delivery Error are exception states. |
| MD-DLV-06 | The MVP does not promise a guaranteed customer-facing delivery time. Internally, the dashboard shows time since acceptance and can flag orders that exceed 15 minutes. |
| MD-WA-01 | The Owner may edit the generated WhatsApp message before opening WhatsApp. Once generated, the message is independent of later template changes. |
| MD-WA-04 | Each delivery keeps a message log of Generated, Opened, Marked Sent, and Resent actions, with actor and timestamp. |
| MD-TPL-04 | Changing a template never changes a message already generated for an existing order; it affects only future generations. |
| MD-TPL-05 | One WhatsApp message is generated per order by default. Separate messages are used only when the delivery method technically requires them. |
| MD-CS-03 | Each Customer Service Case may have an Assigned Owner. Either Owner may claim an unassigned case; once claimed, the assignee is recorded. |
| MD-CS-04 | When stock is added for a product with waiting Customer Service cases, the system creates one consolidated alert for that product rather than repeated alerts. |
| MD-CS-05 | Standalone Customer Service Cases are supported without an Order and store customer name, contact, subject, notes, owner, status, and timestamps. |
| MD-RPL-04 | Replacement Cases do not require an active shift; an existing customer transaction may be resolved after the shift closes. |
| MD-RPL-05 | A free replacement does not create a new sale. It creates an inventory movement and replacement record. Any external cost can be recorded separately as an expense. |
| MD-WAL-06 | All monetary values use two decimal places and are displayed in EGP with two decimal places. |
| MD-TRF-02 | A Nexora transfer is only a record of money that the Owners moved between themselves outside Nexora; Nexora does not move the funds. |
| MD-TRF-03 | Transfer fields are amount, receiver, note, and timestamp. The sender is always the signed-in Owner. The MVP does not allow backdated transfers. |
| MD-EXP-01 | Expense categories come from a fixed list plus Other. Selecting Other requires a note. |
| MD-EXP-03 | Any Owner may reverse an expense using a linked reversal record and a mandatory reason. |
| MD-EXP-04 | Expense date defaults to the current Cairo date. Backdating is allowed up to 7 days; future dates are not allowed. |
| MD-SET-01 | Both Owners may change global settings. Every change is recorded with the Owner, timestamp, old value, and new value. |
| MD-SET-02 | Reservation duration is 1–60 minutes with a default of 10 minutes. Maximum extension is 0–60 minutes. Refund period is 0–30 days by default and may be overridden per product. |
| MD-SET-04 | Changes to global settings are written to the audit log with setting name, previous value, new value, Owner, and timestamp. |
| MD-DSH-01 | Dashboard date ranges are Today, Last 7 Days, Last 30 Days, and Custom. Grouping is daily for short ranges and weekly for longer ranges. |
| MD-DSH-02 | The default low-stock threshold is 3 units and is configurable from Settings. |
| MD-DSH-04 | Order, financial, and audit history is retained without normal deletion. History supports filtering by date, status, Owner, product, customer, and transaction source. |

---

## Part 9 — Scope Reminder

- This document covers behavior only. Infrastructure cost, hosting, backup, recovery and data portability (§3) are business needs of the project but are not user flows and are intentionally not specified here.
- The items listed as future expansion in §36 (customer accounts, automated WhatsApp sending, paid messaging APIs, marketing automation, loyalty, advanced analytics, large teams, full accounting) are out of scope for every flow above.
- When a MISSING DECISION is answered, update the matching flow, state table (Part 3) and matrices (Part 6) so the document stays the single source of truth for behavior.