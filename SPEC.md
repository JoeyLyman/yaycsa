# Farm Order Intake System — Technical Specification

## Overview

A wholesale farm order management system that:

1. Receives orders via email (parsed by n8n + LLM)
2. Creates draft orders in Vendure via the Admin API
3. Presents draft orders in a side-by-side review UI (raw email vs parsed order)
4. Allows manual editing and confirmation
5. Triggers confirmation emails on order approval

Vendure is the backend from day one — handling products, customers, orders, pricing, and fulfillment. The SvelteKit frontend is a custom order intake UI that talks to Vendure's GraphQL API.

---

## Tech Stack

- **Backend:** Vendure (NestJS + TypeORM + GraphQL + Postgres)
- **Frontend:** SvelteKit 2 (Svelte 5) + Tailwind CSS + shadcn-svelte
- **Automation:** n8n (email parsing, LLM integration, email sending)
- **Database:** PostgreSQL (managed by Vendure's TypeORM migrations)
- **Tooling:** Vendure CLI (non-interactive mode for scaffolding)

---

## Project Structure — Monorepo

The project uses a monorepo with npm/pnpm workspaces:

```
yaycsa/
├── apps/
│   ├── server/                        # Vendure backend
│   │   ├── src/
│   │   │   ├── vendure-config.ts      # Main Vendure configuration
│   │   │   ├── index.ts               # Server entry point
│   │   │   ├── plugins/
│   │   │   │   └── order-intake/      # Custom plugin for email order intake
│   │   │   │       ├── order-intake.plugin.ts
│   │   │   │       ├── entities/      # Custom TypeORM entities (if needed beyond custom fields)
│   │   │   │       ├── services/      # Business logic (email matching, pricing)
│   │   │   │       └── api/           # Custom GraphQL resolvers & schema
│   │   │   └── migrations/           # TypeORM migrations
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── storefront/                    # SvelteKit frontend (order intake UI)
│       ├── src/
│       │   ├── lib/
│       │   │   ├── graphql/           # GraphQL queries/mutations & generated types
│       │   │   ├── components/        # Svelte components
│       │   │   └── utils/             # Shared utilities
│       │   ├── routes/                # SvelteKit pages
│       │   └── app.d.ts
│       ├── package.json
│       ├── svelte.config.js
│       ├── vite.config.ts
│       └── tsconfig.json
│
├── package.json                       # Workspace root
├── pnpm-workspace.yaml                # (or npm workspaces in root package.json)
└── SPEC.md
```

---

## Vendure Configuration

### Database

Vendure uses TypeORM with PostgreSQL. The database schema is fully managed by Vendure — no manual SQL or Drizzle needed.

### Custom Fields

Custom fields extend Vendure's built-in entities without creating separate tables. Defined in `vendure-config.ts`:

#### Order Custom Fields

```typescript
{
  name: 'rawEmailText',
  type: 'text',
  label: [{ languageCode: LanguageCode.en, value: 'Raw Email Text' }],
  nullable: true,
},
{
  name: 'rawEmailFrom',
  type: 'string',
  label: [{ languageCode: LanguageCode.en, value: 'Raw Email From' }],
  nullable: true,
},
{
  name: 'rawEmailSubject',
  type: 'string',
  label: [{ languageCode: LanguageCode.en, value: 'Raw Email Subject' }],
  nullable: true,
},
{
  name: 'receivedAt',
  type: 'datetime',
  label: [{ languageCode: LanguageCode.en, value: 'Email Received At' }],
  nullable: true,
},
{
  name: 'fulfillmentType',
  type: 'string',
  label: [{ languageCode: LanguageCode.en, value: 'Fulfillment Type' }],
  options: [
    { value: 'delivery', label: [{ languageCode: LanguageCode.en, value: 'Delivery' }] },
    { value: 'pickup', label: [{ languageCode: LanguageCode.en, value: 'Pickup' }] },
  ],
  defaultValue: 'delivery',
},
{
  name: 'deliveryRoute',
  type: 'string',
  label: [{ languageCode: LanguageCode.en, value: 'Delivery Route' }],
  nullable: true,
  // e.g. 'pdx_wed', 'pdx_sat', 'corvallis_tue'
},
{
  name: 'orderReceivedEmailSent',
  type: 'boolean',
  defaultValue: false,
},
{
  name: 'orderConfirmedEmailSent',
  type: 'boolean',
  defaultValue: false,
},
```

#### OrderLine Custom Fields

```typescript
{
  name: 'flag',
  type: 'text',
  label: [{ languageCode: LanguageCode.en, value: 'LLM Flag' }],
  nullable: true,
  // e.g. "Assumed 'each chicory' means all 4 radicchio varieties"
},
{
  name: 'editedFields',
  type: 'string',
  list: true,
  label: [{ languageCode: LanguageCode.en, value: 'Edited Fields' }],
  // tracks which fields user manually edited: ['quantity', 'productVariantId']
},
{
  name: 'originalValues',
  type: 'text',
  label: [{ languageCode: LanguageCode.en, value: 'Original Parsed Values' }],
  nullable: true,
  // JSON string of LLM's original parse before user edits
},
```

#### Customer Custom Fields

```typescript
{
  name: 'defaultUnitPreference',
  type: 'string',
  label: [{ languageCode: LanguageCode.en, value: 'Default Unit Preference' }],
  nullable: true,
  // hint for LLM: 'bunch', 'case', etc.
},
{
  name: 'deliveryAddress',
  type: 'text',
  label: [{ languageCode: LanguageCode.en, value: 'Delivery Address' }],
  nullable: true,
},
{
  name: 'defaultDeliveryRoute',
  type: 'string',
  label: [{ languageCode: LanguageCode.en, value: 'Default Delivery Route' }],
  nullable: true,
},
{
  name: 'notes',
  type: 'text',
  label: [{ languageCode: LanguageCode.en, value: 'Internal Notes' }],
  nullable: true,
},
```

#### ProductVariant Custom Fields

```typescript
{
  name: 'unitType',
  type: 'string',
  label: [{ languageCode: LanguageCode.en, value: 'Unit Type' }],
  options: [
    { value: 'ct', label: [{ languageCode: LanguageCode.en, value: 'Count' }] },
    { value: 'lb', label: [{ languageCode: LanguageCode.en, value: 'Pound' }] },
    { value: 'pt', label: [{ languageCode: LanguageCode.en, value: 'Pint' }] },
  ],
},
```

---

## Customer Groups & Pricing

### Customer Groups

Vendure's built-in CustomerGroup system handles pricing tiers:

| Group Name | Description |
|------------|-------------|
| `restaurant` | Standard restaurant pricing |
| `coop` | Co-op pricing |
| `grocery` | Grocery store pricing |
| `distributor` | Distributor pricing |

Individual customers can also have custom pricing overrides.

### Pricing Strategy

Implement a custom `ProductVariantPriceCalculationStrategy` to handle tiered pricing with quantity breaks:

```typescript
// Pricing logic (same as before, now inside a Vendure strategy)
// 1. Look up customer's group
// 2. Find price breaks for that group + product variant
// 3. Find highest min_qty where min_qty <= order_quantity
// 4. Per-unit price = case_price / min_qty
// 5. Line total = quantity * per_unit_price, rounded to 2 decimals
```

**Example for Arugula at "restaurant" tier:**
| min_qty | case_price | per_unit (derived) |
|---------|------------|-------------------|
| 1 | $3.00 | $3.00 |
| 12 | $22.00 | $1.833... |
| 24 | $38.00 | $1.583... |

Price break data can be stored via:
- A custom entity in the order-intake plugin, or
- Vendure's built-in price/promotion system (if it can handle quantity breaks), or
- An external data source (e.g. Google Sheets) synced to Vendure

The best approach should be evaluated during implementation.

---

## Order Lifecycle

### Vendure's Draft Order Flow

Vendure has built-in draft order support that maps perfectly to the email intake workflow:

1. **n8n parses email** → calls Vendure Admin API to create a **Draft Order**
2. Draft orders are invisible to customers (Shop API) while in draft state
3. Operator reviews in the SvelteKit intake UI
4. On "Confirm" → draft is completed, becomes a real order
5. On "Reject" → draft is cancelled

### Custom Order States (if needed)

Vendure's order state machine can be extended:

```
Draft → AddingItems → ReviewPending → ArrangingPayment → ...
```

A custom `OrderProcess` can add states like `ReviewPending` to represent "parsed from email, awaiting human review."

---

## Order Intake Plugin

The `order-intake` plugin is the core custom functionality. It adds:

### 1. Webhook Endpoint

A REST endpoint (or custom GraphQL mutation) that n8n calls after parsing an email:

**Endpoint:** `POST /order-intake/webhook`

**Payload from n8n:**

```json
{
  "raw_email": {
    "from": "chef@restauranta.com",
    "subject": "Wednesday order",
    "body": "Hi guys! Can we get for Wednesday:\n25# salad mix\n12ct rosemary\n...",
    "received_at": "2025-12-14T10:32:00Z"
  },
  "parsed": {
    "customer_name": "Restaurant A",
    "customer_email": "chef@restauranta.com",
    "delivery_date": "wednesday",
    "lines": [
      { "product": "Salad Mix", "quantity": 25, "flag": null },
      { "product": "Rosemary", "quantity": 12, "flag": null },
      {
        "product": "Celeriac",
        "quantity": 50,
        "flag": "Quantity 50lb higher than usual 25lb order"
      },
      {
        "product": "Radicchio, Castelfranco",
        "quantity": 12,
        "flag": "Interpreted 'each chicory type' as all radicchio varieties"
      }
    ]
  }
}
```

### 2. Webhook Processing Logic

1. Match `customer_email` to existing Vendure Customer (or flag for review)
2. Look up customer's CustomerGroup (pricing tier)
3. Match each `product` name to a Vendure ProductVariant (fuzzy match, flag if uncertain)
4. Look up delivery route from `delivery_date`
5. Create a Draft Order via Vendure's Admin API:
   - Set customer
   - Add order lines with matched ProductVariants
   - Set custom fields (rawEmailText, rawEmailFrom, flags, etc.)
6. Return order ID

### 3. Custom GraphQL Extensions

Additional queries/mutations for the intake UI that go beyond Vendure's built-in API:

- Query draft orders with email metadata
- Bulk operations on draft orders
- Trigger confirmation email (fires event → n8n webhook)

---

## SvelteKit Storefront (Order Intake UI)

The SvelteKit app is not a customer-facing storefront — it's an **internal admin tool** for reviewing and confirming email-parsed orders. It talks to Vendure's **Admin API** (not Shop API).

### Routes

```
src/routes/
├── +page.svelte                       # Dashboard / draft order queue
├── orders/
│   ├── +page.svelte                   # All orders list (filterable by status)
│   └── [id]/
│       └── +page.svelte               # Single order view/edit (intake review UI)
├── customers/
│   ├── +page.svelte                   # Customer list
│   └── [id]/
│       └── +page.svelte               # Customer detail/edit
└── products/
    └── +page.svelte                   # Product/pricing management
```

### Order Intake Review UI

Side-by-side panels:

- **Left panel (40% width):** Raw email text, read-only
- **Right panel (60% width):** Parsed order, fully editable

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ORDER: ORD-2025-0142                                    Status: DRAFT  │
├─────────────────────────────────────────────────────────────────────────┤
│ Customer:    [Restaurant A            ▼]    Tier: restaurant (auto)    │
│ Fulfillment: [● Delivery  ○ Pickup      ]                             │
│ Delivery:    [Portland Wednesday      ▼]                              │
│ Address:     [123 Main St, Portland OR___________________________]    │
│ Received:    Dec 14, 2025 10:32 AM                                    │
├─────────────────────────────────────────────────────────────────────────┤
│ Product              Qty     Unit Price    Line Total    Flag          │
│ ─────────────────────────────────────────────────────────────────────  │
│ [Salad Mix      ▼]   [25  ]  $10.50        $262.50                    │
│ [Rosemary       ▼]   [12  ]  $2.83         $34.00                     │
│ [Cilantro       ▼]   [4   ]  $4.00         $16.00                     │
│ [Arugula        ▼]   [24  ]  $1.58         $38.00                     │
│ [Celeriac       ▼]   [50  ]  $2.50         $125.00       ⚠ 50lb >    │
│                                                          usual 25lb   │
│ [Radic. Castel. ▼]   [12  ]  $2.67         $32.00        ⚠ Interpreted│
│ [Radic. Chioggia▼]   [12  ]  $2.67         $32.00        "each chicory│
│ [Radic. Rosalba ▼]   [12  ]  $2.67         $32.00        type" as 4  │
│ [Radic. Treviso ▼]   [12  ]  $2.33         $28.00        varieties   │
│                                                                        │
│ [+ Add Line]                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                           ORDER TOTAL:   $867.50      │
│                                                                        │
│ Notes: [Extra rosemary if available________________________________]  │
│                                                                        │
│              [CONFIRM]                      [REJECT]                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Visual Indicators

1. **Row with flag (LLM uncertainty):** Red/pink background row
2. **User-edited cell:** Green text color
3. **Tracking edits:** When user changes a cell value, add the field name to `editedFields` custom field and store original in `originalValues`

### Interactions

- **Customer dropdown:** Searchable via Vendure's customer list query. On select, auto-fills pricing tier, default delivery route, and address from customer custom fields.
- **Product dropdown:** Searchable via Vendure's product variant list. On select, recalculates unit price based on customer's group and quantity.
- **Quantity input:** On change, recalculates unit price (tier break) and line total.
- **Add Line button:** Appends empty row, adds to draft order via mutation.
- **Delete line:** X button on row hover, removes from draft order via mutation.
- **Confirm button:** Completes the draft order in Vendure, triggers confirmation email event.
- **Reject button:** Cancels the draft order in Vendure.

### GraphQL Client

The SvelteKit app uses a GraphQL client to talk to Vendure's Admin API. Options include:
- **Houdini** (SvelteKit-native GraphQL client, used in Vendure's official SvelteKit starter)
- **urql** or **Apollo Client**
- Plain `fetch` with generated types from Vendure's schema

---

## n8n Integration

### Flow: Email → Draft Order

1. **Email trigger** (Outlook/Gmail) receives order email
2. **LLM node** (Claude API) parses email into structured JSON
3. **HTTP Request node** POSTs parsed data to Vendure's order-intake webhook
4. Draft order appears in the SvelteKit intake UI

### Flow: Order Confirmed → Confirmation Email

1. Vendure fires an event when draft order is completed
2. n8n listens for webhook/event
3. n8n formats and sends confirmation email to customer

### LLM Prompt for Email Parsing

```
You are parsing wholesale farm orders from email. Extract structured order data.

CUSTOMER CONTEXT:
Customer: {customer_name}
Default unit preference: {default_unit_preference} (use this if unit not specified)
Pricing tier: {pricing_tier}

AVAILABLE PRODUCTS:
{product_list}

AVAILABLE DELIVERY OPTIONS:
{delivery_options}

Parse the following email and return JSON:

EMAIL:
{email_body}

Return this exact JSON structure:
{
  "customer_name": "string (from email signature or sender)",
  "delivery_date": "string (delivery option code like 'pdx_wed' or null if unclear)",
  "lines": [
    {
      "product": "exact product name from available products",
      "quantity": number,
      "flag": "string explaining any assumption made, or null if confident"
    }
  ]
}

RULES:
1. Match product names to the available products list. Use exact names.
2. If customer says "1 cilantro" without unit, use their default_unit_preference.
3. If customer says "each type" or "all varieties", expand to individual products.
4. Flag any line where you made an assumption or are uncertain.
5. Flag quantities that seem unusually high or low compared to typical orders.
6. If you cannot match a product, include it with flag "Could not match product: [original text]"
```

---

## Delivery / Fulfillment

Delivery routes are managed via Vendure's ShippingMethod system or as a custom entity:

| Code | Display Name | Day of Week |
|------|-------------|-------------|
| `pdx_wed` | Portland Wednesday | Wednesday |
| `pdx_sat` | Portland Saturday | Saturday |
| `corvallis_tue` | Corvallis Tuesday | Tuesday |

Pickup options:

| Code | Display Name | Location |
|------|-------------|----------|
| `farm_fri` | Farm Pickup Friday | 1234 Farm Road, Philomath OR |
| `market_sat` | Farmers Market Saturday | Corvallis Farmers Market |

---

## Product Catalog

Products are managed in Vendure's admin panel or via the Admin API. Each product has variants with the `unitType` custom field.

**Example products:**
| Category (Facet) | Product | Variant Unit Type |
|-------------------|---------|------------------|
| Mixed & Bulk Greens | Salad Mix | lb |
| Herbs | Cilantro | ct |
| Herbs | Rosemary | ct |
| Greens | Arugula | ct |
| Greens | Rainbow Chard | ct |
| Greens | Kale, Lacinato | ct |
| Greens | Radicchio, Castelfranco | ct |
| Vegetables | Red Beets | lb |
| Vegetables | Sweet Carrots | lb |
| Vegetables | Celeriac | lb |
| Vegetables | Sunchokes | lb |
| Winter Squash | Butternut | lb |
| Value Added | Tlacololero Chiles (Dried) | pt |
| Flowers | Dry Flower Bouquet (Mixed) | ct |

Categories are implemented as Vendure **Facets** (not separate tables).

---

## Google Sheets Export

Export functionality for team visibility. Can be implemented as:
- A Vendure plugin that exports order data to Google Sheets on confirmation
- An n8n flow triggered by order confirmation events
- A button in the SvelteKit UI that calls an export endpoint

**Sheet structure:**
- Tab 1: `Orders` — one row per order
- Tab 2: `Order Lines` — one row per line item, with order number for reference

---

## Getting Started

### 1. Scaffold the Vendure Server

```bash
npx @vendure/create apps/server
# Choose PostgreSQL as the database
# Skip the default Next.js storefront (we'll use SvelteKit)
```

### 2. Set Up the Monorepo

Configure workspaces at the repo root so both `apps/server` and `apps/storefront` can be managed together.

### 3. Move SvelteKit into the Monorepo

The existing SvelteKit app becomes `apps/storefront/`. Update packages (Svelte 5, Tailwind v4, shadcn-svelte).

### 4. Configure Vendure

- Add custom fields to `vendure-config.ts`
- Set up customer groups for pricing tiers
- Create the order-intake plugin
- Run initial migration

### 5. Build the Intake UI

- Set up GraphQL client in SvelteKit (Houdini or similar)
- Build the order review components
- Connect to Vendure's Admin API

### 6. Set Up n8n

- Email trigger (Outlook)
- LLM node (Claude API) with parsing prompt
- HTTP Request node to POST to the order-intake webhook

### 7. Seed Data

Use Vendure's Admin API or admin panel to create:
- Products with variants and unit types
- Customer groups (restaurant, coop, grocery, distributor)
- Customers assigned to groups
- Delivery routes / shipping methods
