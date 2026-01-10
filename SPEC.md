# Farm Order Intake System — Technical Specification

## Overview

A wholesale farm order management system that:

1. Receives orders via email (parsed by n8n + LLM)
2. Presents draft orders in a side-by-side review UI (raw email vs parsed order)
3. Allows manual editing and confirmation
4. Stores confirmed orders in a normalized database
5. Triggers confirmation emails on order approval

This is a stepping stone toward a full Vendure.js marketplace. The database schema is designed to align with Vendure's `Order` and `OrderLine` entities for future migration.

---

## Tech Stack

- **Frontend:** SvelteKit 2 (Svelte 5)
- **Database:** Supabase (Postgres)
- **Automation:** n8n (email parsing, LLM integration, email sending)
- **Future:** Vendure.js backend, same Supabase instance

---

## Database Schema

### `unit_types`

Lookup table for unit measurements.

```sql
create table unit_types (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,        -- 'ct', 'lb', 'pt'
  display_name text not null        -- 'count', 'pound', 'pint'
);
```

**Seed data:**
| code | display_name |
|------|--------------|
| ct | count |
| lb | pound |
| pt | pint |

---

### `products`

The farm's product catalog.

```sql
create table products (
  id uuid primary key default gen_random_uuid(),
  category text not null,                           -- 'Herbs', 'Greens', 'Vegetables', 'Winter Squash', 'Value Added', 'Flowers'
  name text not null,                               -- 'Cilantro', 'Arugula', 'Salad Mix'
  unit_type_id uuid references unit_types(id),      -- base unit: ct, lb, pt
  active boolean default true,
  created_at timestamptz default now()
);
```

**Example products:**
| category | name | unit_type |
|----------|------|-----------|
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

---

### `pricing`

Tiered pricing per product. The `case_price` is the price for exactly `min_qty` units. Per-unit price is derived as `case_price / min_qty`.

```sql
create table pricing (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  pricing_tier text not null,                       -- 'restaurant', 'coop', 'grocery', 'distributor', 'customer_x_custom'
  min_qty int not null,                             -- 1, 12, 24 (tier break points)
  case_price decimal(10,2) not null,                -- $3, $22, $38 (price for exactly min_qty units)
  created_at timestamptz default now(),
  unique(product_id, pricing_tier, min_qty)
);
```

**Pricing logic:**

- Find the highest `min_qty` where `min_qty <= order_quantity`
- Per-unit price = `case_price / min_qty`
- Line total = `quantity * per_unit_price`, rounded to 2 decimals

**Example for Arugula at "restaurant" tier:**
| min_qty | case_price | per_unit (derived) |
|---------|------------|-------------------|
| 1 | $3.00 | $3.00 |
| 12 | $22.00 | $1.833... |
| 24 | $38.00 | $1.583... |

Customer orders 18 arugula → falls in 12-23 range → $22/12 = $1.833/unit → 18 × $1.833 = $33.00

---

### `customers`

```sql
create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pricing_tier text not null default 'restaurant',  -- references pricing.pricing_tier
  default_unit_preference text,                     -- hint for LLM: 'bunch', 'case', etc.
  default_delivery_option_id uuid references delivery_options(id),
  default_pickup_option_id uuid references pickup_options(id),
  delivery_address text,
  notes text,                                       -- internal notes about this customer
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

**Pricing tier examples:**

- `restaurant` — standard restaurant pricing
- `coop` — co-op pricing
- `grocery` — grocery store pricing
- `distributor` — distributor pricing
- `restaurant_a_custom` — custom pricing for a specific customer

---

### `customer_contacts`

Multiple contacts per customer.

```sql
create table customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade,
  name text,
  email text,
  phone text,
  role text,                                        -- 'chef', 'buyer', 'owner', 'manager'
  is_primary boolean default false,
  created_at timestamptz default now()
);
```

---

### `delivery_options`

Available delivery routes/days.

```sql
create table delivery_options (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                        -- 'pdx_wed', 'pdx_sat', 'corvallis_tue'
  display_name text not null,                       -- 'Portland Wednesday', 'Portland Saturday', 'Corvallis Tuesday'
  day_of_week int,                                  -- 0=Sunday, 1=Monday, ..., 6=Saturday
  active boolean default true,
  created_at timestamptz default now()
);
```

---

### `pickup_options`

Available pickup locations/times.

```sql
create table pickup_options (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                        -- 'farm_fri', 'farmers_market_sat'
  display_name text not null,                       -- 'Farm Pickup Friday', 'Farmers Market Saturday'
  location text,                                    -- address or description
  day_of_week int,
  active boolean default true,
  created_at timestamptz default now()
);
```

---

### `orders`

One row per order. Maps to Vendure's `Order` entity.

```sql
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,                -- 'ORD-2025-0142' (auto-generated)
  customer_id uuid references customers(id),
  delivery_option_id uuid references delivery_options(id),
  pickup_option_id uuid references pickup_options(id),
  fulfillment_type text default 'delivery',         -- 'delivery' or 'pickup'
  delivery_address text,                            -- can override customer default
  status text not null default 'draft',             -- 'draft', 'confirmed', 'rejected', 'fulfilled'
  raw_email_text text,                              -- original email body for review
  raw_email_from text,                              -- sender email address
  raw_email_subject text,
  received_at timestamptz,                          -- when email was received
  notes text,                                       -- order-specific notes
  order_total decimal(10,2),                        -- calculated sum of line totals
  order_received_email_sent boolean default false,
  order_confirmed_email_sent boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

**Order number format:** `ORD-{YEAR}-{SEQUENCE}` e.g., `ORD-2025-0142`

---

### `order_lines`

One row per line item. Maps to Vendure's `OrderLine` entity.

```sql
create table order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id),
  quantity decimal(10,2) not null,                  -- amount ordered (e.g., 24, 25.5)
  unit_price decimal(10,2) not null,                -- per-unit price at time of order (derived from pricing)
  line_total decimal(10,2) not null,                -- quantity * unit_price, rounded
  flag text,                                        -- LLM's note if uncertain (e.g., "Assumed 'each chicory' means all 4 radicchio varieties")
  edited_fields text[],                             -- tracks which fields user manually edited: ['quantity', 'product_id']
  original_values jsonb,                            -- LLM's original parse before user edits: {"quantity": 12, "product_id": "..."}
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

---

## SvelteKit Application Structure

```
src/
├── lib/
│   ├── db/
│   │   ├── supabase.ts              # Supabase client
│   │   ├── schema.ts                # Type definitions matching DB schema
│   │   └── queries/
│   │       ├── orders.ts            # Order CRUD operations
│   │       ├── customers.ts         # Customer queries
│   │       ├── products.ts          # Product queries
│   │       └── pricing.ts           # Pricing lookups
│   ├── components/
│   │   ├── OrderIntake.svelte       # Main order review component
│   │   ├── OrderLineRow.svelte      # Single editable line item
│   │   ├── RawEmailPanel.svelte     # Left panel showing raw email
│   │   ├── ParsedOrderPanel.svelte  # Right panel with editable order
│   │   ├── CustomerSelect.svelte    # Customer dropdown with search
│   │   ├── ProductSelect.svelte     # Product dropdown with search
│   │   └── DeliverySelect.svelte    # Delivery/pickup option selector
│   └── utils/
│       ├── pricing.ts               # Price calculation logic
│       └── orderNumber.ts           # Order number generation
├── routes/
│   ├── +page.svelte                 # Dashboard / order list
│   ├── orders/
│   │   ├── +page.svelte             # All orders list (filterable by status)
│   │   ├── [id]/
│   │   │   └── +page.svelte         # Single order view/edit
│   │   └── intake/
│   │       └── +page.svelte         # Draft order intake/review page
│   ├── customers/
│   │   ├── +page.svelte             # Customer list
│   │   └── [id]/
│   │       └── +page.svelte         # Customer detail/edit
│   ├── products/
│   │   └── +page.svelte             # Product/pricing management
│   └── api/
│       ├── orders/
│       │   ├── +server.ts           # POST: create order, GET: list orders
│       │   └── [id]/
│       │       ├── +server.ts       # GET, PUT, DELETE single order
│       │       └── confirm/
│       │           └── +server.ts   # POST: confirm order (triggers email)
│       ├── webhooks/
│       │   └── n8n/
│       │       └── +server.ts       # POST: receives parsed orders from n8n
│       └── export/
│           └── sheets/
│               └── +server.ts       # POST: export to Google Sheets
└── app.d.ts                         # TypeScript declarations
```

---

## Order Intake UI Specification

### Layout

Side-by-side panels:

- **Left panel (40% width):** Raw email text, read-only
- **Right panel (60% width):** Parsed order, fully editable

### Right Panel Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ORDER: ORD-2025-0142                                    Status: DRAFT   │
├─────────────────────────────────────────────────────────────────────────┤
│ Customer:    [Restaurant A            ▼]    Tier: restaurant (auto)    │
│ Fulfillment: [● Delivery  ○ Pickup      ]                              │
│ Delivery:    [Portland Wednesday      ▼]                               │
│ Address:     [123 Main St, Portland OR___________________________]     │
│ Received:    Dec 14, 2025 10:32 AM                                     │
├─────────────────────────────────────────────────────────────────────────┤
│ Product              Qty     Unit Price    Line Total    Flag          │
│ ───────────────────────────────────────────────────────────────────────│
│ [Salad Mix      ▼]   [25  ]  $10.50        $262.50                     │
│ [Rosemary       ▼]   [12  ]  $2.83         $34.00                      │
│ [Cilantro       ▼]   [4   ]  $4.00         $16.00                      │
│ [Arugula        ▼]   [24  ]  $1.58         $38.00                      │
│ [Watercress     ▼]   [24  ]  $2.25         $54.00                      │
│ [Sunchokes      ▼]   [20  ]  $5.00         $100.00                     │
│ [Celeriac       ▼]   [50  ]  $2.50         $125.00       ⚠️ 50lb >     │
│                                                          usual 25lb    │
│ [Red Beets      ▼]   [25  ]  $1.20         $30.00                      │
│ [Rainbow Chard  ▼]   [24  ]  $1.75         $42.00                      │
│ [Kale, Lacinato ▼]   [24  ]  $1.75         $42.00                      │
│ [Radic. Castel. ▼]   [12  ]  $2.67         $32.00        ⚠️ Interpreted│
│ [Radic. Chioggia▼]   [12  ]  $2.67         $32.00        "each chicory │
│ [Radic. Rosalba ▼]   [12  ]  $2.67         $32.00        type" as 4    │
│ [Radic. Treviso ▼]   [12  ]  $2.33         $28.00        varieties     │
│                                                                         │
│ [+ Add Line]                                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                           ORDER TOTAL:   $867.50       │
│                                                                         │
│ Notes: [Extra rosemary if available________________________________]   │
│                                                                         │
│              [CONFIRM ✓]                    [REJECT ✗]                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### Visual Indicators

1. **Row with flag (LLM uncertainty):** Red/pink background row
2. **User-edited cell:** Green text color
3. **Tracking edits:** When user changes a cell value, add the field name to `edited_fields[]` and store original in `original_values`

### Interactions

- **Customer dropdown:** Searchable, shows customer name. On select, auto-fills pricing tier, default delivery option, and address.
- **Product dropdown:** Searchable by name or category. On select, recalculates unit price based on customer's tier and quantity.
- **Quantity input:** On change, recalculates unit price (tier break) and line total.
- **Add Line button:** Appends empty row.
- **Delete line:** X button on row hover.
- **Confirm button:**
  1. Validates all required fields
  2. Updates `status` to 'confirmed'
  3. Calculates final `order_total`
  4. Triggers n8n webhook for confirmation email
- **Reject button:**
  1. Updates `status` to 'rejected'
  2. Optionally triggers notification

---

## Pricing Calculation Logic

```typescript
interface PriceBreak {
  min_qty: number;
  case_price: number;
}

function calculateLineTotal(
  productId: string,
  pricingTier: string,
  quantity: number,
  priceBreaks: PriceBreak[]
): { unitPrice: number; lineTotal: number } {
  // Sort by min_qty descending
  const sorted = [...priceBreaks].sort((a, b) => b.min_qty - a.min_qty);

  // Find highest min_qty <= quantity
  const applicableBreak = sorted.find(b => b.min_qty <= quantity);

  if (!applicableBreak) {
    throw new Error(`No price break found for quantity ${quantity}`);
  }

  // Per-unit price = case_price / min_qty
  const unitPrice = applicableBreak.case_price / applicableBreak.min_qty;

  // Line total, rounded to 2 decimals
  const lineTotal = Math.round(quantity * unitPrice * 100) / 100;

  return { unitPrice, lineTotal };
}
```

---

## n8n Integration

### Webhook: Receive Parsed Order

**Endpoint:** `POST /api/webhooks/n8n`

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
			{ "product": "Cilantro", "quantity": 4, "flag": null },
			{
				"product": "Celeriac",
				"quantity": 50,
				"flag": "Quantity 50lb higher than usual 25lb order"
			},
			{
				"product": "Radicchio, Castelfranco",
				"quantity": 12,
				"flag": "Interpreted 'each chicory type' as all radicchio varieties"
			},
			{
				"product": "Radicchio, Chioggia",
				"quantity": 12,
				"flag": "Interpreted 'each chicory type' as all radicchio varieties"
			},
			{
				"product": "Radicchio, Rosalba",
				"quantity": 12,
				"flag": "Interpreted 'each chicory type' as all radicchio varieties"
			},
			{
				"product": "Radicchio, Treviso",
				"quantity": 12,
				"flag": "Interpreted 'each chicory type' as all radicchio varieties"
			}
		]
	}
}
```

**Server logic:**

1. Match `customer_email` to existing customer (or flag for review)
2. Look up customer's pricing tier
3. Match each `product` name to `products.name` (fuzzy match, flag if uncertain)
4. Look up delivery option from `delivery_date`
5. Calculate prices for each line
6. Create `orders` row with `status: 'draft'`
7. Create `order_lines` rows
8. Return order ID

### Webhook: Trigger Confirmation Email

**Endpoint:** `POST /api/orders/[id]/confirm`

**Response includes:**

```json
{
  "order_id": "uuid",
  "order_number": "ORD-2025-0142",
  "customer_email": "chef@restauranta.com",
  "customer_name": "Restaurant A",
  "lines": [...],
  "order_total": 867.50,
  "delivery_option": "Portland Wednesday"
}
```

n8n listens for this and sends formatted confirmation email.

---

## Google Sheets Export

**Endpoint:** `POST /api/export/sheets`

Exports orders to a Google Sheet for team visibility. Uses Google Sheets API.

**Sheet structure:**

- Tab 1: `Orders` — one row per order
- Tab 2: `Order Lines` — one row per line item, with order_number for reference

---

## LLM Prompt for n8n (Email Parsing)

Use this prompt when calling Claude API to parse incoming order emails:

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

## Future: Vendure Migration Path

When ready to migrate to Vendure:

1. **Same Supabase project, separate schema**
   - Keep intake tables in `public` schema
   - Vendure tables in `vendure` schema

2. **Migration script**
   - Map `customers` → Vendure `Customer`
   - Map `products` → Vendure `ProductVariant`
   - Map `orders` + `order_lines` → Vendure `Order` + `OrderLine`
   - Custom fields for farm-specific data (pricing tier, delivery options)

3. **Gradual transition**
   - Phase 1: Vendure handles product catalog, pricing
   - Phase 2: Customer-facing order form uses Vendure storefront API
   - Phase 3: Full Vendure order management, retire intake system

---

## Getting Started

1. **Set up Supabase project**
   - Create new project
   - Run schema SQL (see Database Schema section)
   - Get connection string and anon key

2. **Initialize SvelteKit**

   ```bash
   npx sv create farm-orders
   cd farm-orders
   npm install @supabase/supabase-js
   ```

3. **Environment variables**

   ```
   PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   PUBLIC_SUPABASE_ANON_KEY=xxx
   ```

4. **Build core components**
   - Start with OrderIntake.svelte (the review UI)
   - Then order list and customer management
   - Then n8n webhook integration

5. **Set up n8n**
   - Email trigger (Outlook)
   - LLM node (Claude API) with parsing prompt
   - HTTP Request node to POST to webhook endpoint

---

## Sample Data for Testing

### Customers

```sql
insert into customers (name, pricing_tier, default_unit_preference, delivery_address, notes) values
('Restaurant A', 'restaurant', 'bunch', '123 Main St, Portland OR', 'Chef prefers early delivery'),
('Green Grocer Co-op', 'coop', 'case', '456 Oak Ave, Corvallis OR', 'Orders heavy on greens'),
('Farm Direct Distributor', 'distributor', 'case', '789 Industrial Blvd, Portland OR', null);
```

### Delivery Options

```sql
insert into delivery_options (code, display_name, day_of_week) values
('pdx_wed', 'Portland Wednesday', 3),
('pdx_sat', 'Portland Saturday', 6),
('corvallis_tue', 'Corvallis Tuesday', 2);
```

### Pickup Options

```sql
insert into pickup_options (code, display_name, location, day_of_week) values
('farm_fri', 'Farm Pickup Friday', '1234 Farm Road, Philomath OR', 5),
('market_sat', 'Farmers Market Saturday', 'Corvallis Farmers Market', 6);
```
