# Telemarketing CRM — Prototype Brief

> **Purpose of this document:** This is a complete brief for building a **frontend-only prototype** of a Telemarketing CRM application. No real backend, no database — everything runs on React state and localStorage in the browser. Mock/seed data should be pre-populated so the app feels alive on first load.

---

## 1. What This App Is

A CRM (Customer Relationship Management) tool built specifically for a **telemarketing / advisory team** that sells financial products (stocks, index funds, bundled portfolios). The app helps:

- **Admins** oversee team performance, manage campaigns and products, and view audit trails.
- **Managers** monitor their team's calling activity, deal pipeline, and lead assignment.
- **Sales Reps / Telemarketers / Advisors** make calls, track leads, log activities, and close deals.
- **Viewers** (read-only) see dashboards and data without editing.

The core workflow: A telemarketer logs in → starts a calling session → gets assigned leads to call for a specific campaign/product → makes calls one by one → logs the outcome of each call → moves leads through the pipeline → closes deals.

---

## 2. User Roles (4 levels)

| Role | Level | What they can do |
|------|-------|-----------------|
| **ADMIN** | 3 | Everything. Manage users, view audit logs, archive/delete records, manage campaigns & products. |
| **MANAGER** | 2 | View team dashboards, assign leads/deals, reopen closed deals, move statuses backward, manage campaigns. |
| **SALES** | 1 | Create and edit their own records, make calls, log activities, convert leads, manage own deals. Can only update things they own. |
| **VIEWER** | 0 | Read-only access to all data. Cannot create or edit anything. |

### Demo Accounts (pre-seeded)

| Name | Role | Email |
|------|------|-------|
| Admin User | ADMIN | admin@demo.com |
| Sarah Manager | MANAGER | sarah@demo.com |
| Mike Sales | SALES | mike@demo.com |
| Jane Viewer | VIEWER | jane@demo.com |

Login is just picking an account from a list — no passwords needed for the prototype.

---

## 3. Data Models

### 3.1 Companies

A business entity that leads/contacts/deals belong to.

Fields: name, industry, website, phone, email, address, notes, created_by, timestamps, soft-delete.

### 3.2 Contacts

A person the team communicates with. Belongs to an optional Company.

Fields: first_name, last_name, email, phone, title (job title), company_id, source (where they came from), created_by, timestamps, soft-delete.

### 3.3 Leads

A potential customer that hasn't been qualified yet. Can be converted into a Contact.

Fields: first_name, last_name, email, phone, source, status, company_id, assigned_to_id, converted_contact_id (if converted), converted_at, notes, created_by, timestamps, soft-delete.

**Lead Statuses (in order):** NEW → CONTACTED → QUALIFIED → CONVERTED or LOST

**Lead Sources:** WEBSITE, REFERRAL, COLD_CALL, SOCIAL_MEDIA, EVENT, ADVERTISEMENT, OTHER

**Conversion flow:** Only QUALIFIED leads can convert. Conversion creates a Contact (and optionally a Deal). The lead is then marked CONVERTED and becomes read-only.

**Important:** Each lead should also show **when they were last contacted** (last activity date).

### 3.4 Deals

A potential sale being tracked through a pipeline.

Fields: title, value (currency), stage, contact_id (required), company_id, lead_id (if originated from lead), assigned_to_id, expected_close_date, lost_reason (only for CLOSED_LOST), closed_at, created_by, timestamps, soft-delete.

**Deal Stages (6, in order):**
1. LEAD — just entered the pipeline
2. QUALIFIED — verified as real opportunity
3. PROPOSAL — proposal sent
4. NEGOTIATION — actively negotiating
5. CLOSED_WON — deal closed successfully
6. CLOSED_LOST — deal lost (must include a reason why)

**Stage History:** Every stage change is recorded: from_stage, to_stage, who changed it, optional note, timestamp. Displayed as a timeline on the deal detail page.

### 3.5 Activities

Any interaction or task: calls, emails, meetings, notes, demos, follow-ups, tasks.

Fields: type, subject, description, result, scheduled_at, completed_at, metadata (JSON — e.g. call duration, attendees), deal_id, contact_id, lead_id, assigned_to_id, created_by, timestamps.

**Activity Types:** CALL, EMAIL, MEETING, TASK, NOTE, DEMO, FOLLOW_UP

**Activity Results:** COMPLETED, NO_ANSWER, FOLLOW_UP_NEEDED, MEETING_SCHEDULED, DEAL_ADVANCED, CANCELLED, FAILED

Activities can have **comments** (text discussion thread) and **attachments** (file references).

### 3.6 Products (NEW)

A financial product that the team sells. Think of individual stocks.

Fields: id, name, ticker/code, description, category, is_active, created_at.

Example products: Stock A, Stock B, Stock C, Stock D, Stock E.

### 3.7 Product Bundles (NEW)

A predefined combination of products sold together as a package.

Fields: id, name, description, product_ids (array of product IDs), is_active, created_at.

Example bundles:
- "Index Gabungan A" → contains [Stock A, Stock C]
- "Index Saham B" → contains [Stock B, Stock D]
- "Paket Premium" → contains [Stock A, Stock B, Stock E]

### 3.8 Campaigns (NEW)

A campaign defines what product or bundle is being offered in a calling session. When a telemarketer starts calling, they pick a campaign. This links every call to a specific product/bundle offering.

Fields: id, name, description, type ("PRODUCT" or "BUNDLE"), product_id or bundle_id, status (ACTIVE, PAUSED, COMPLETED), start_date, end_date, target_count (how many leads to call), created_by, created_at.

Each call/activity made under a campaign gets tagged with that campaign_id. This enables tracking:
- How many times Product A has been offered total
- How many times it was offered as a solo product vs. as part of Bundle X vs. Bundle Y
- Conversion rate per product and per bundle
- Per-campaign performance metrics

### 3.9 Notifications

In-app notifications for events like: lead assigned, deal stage changed, deal closed, new comment, etc.

Fields: recipient_id, type, title, message, entity_type, entity_id, is_read, read_at, created_at.

### 3.10 Audit Logs

Record of all significant actions for compliance.

Fields: user_id, action, entity_type, entity_id, metadata (JSON with details), created_at.

Actions tracked: CREATE, UPDATE, DELETE, STAGE_CHANGE, ASSIGNMENT_CHANGE, STATUS_CHANGE, CONVERSION, ARCHIVE.

---

## 4. Pages & Features

### 4.1 Login Page

Simple account picker. Show the 4 demo accounts with their name, role, and avatar. Click one to log in. Store the selected user in localStorage.

### 4.2 Dashboard

The main overview page. What it shows depends on the user's role.

**Stat Cards (always visible):**
- Total deals (with open count)
- Pipeline value (total value of open deals)
- Won this month (deals closed as WON in current month)
- Unread notifications

**NEW stat cards for telemarketing:**
- Time on dialer (total calling time across all sessions today)
- Calls made (total calls today)
- Pickups (calls where the lead actually answered)

**Pipeline Summary Widget:**
- Bar chart showing each deal stage with count + total value.

**Campaign/Product Performance Highlights (NEW):**
- A section showing performance per campaign: calls made, pickups, conversions, conversion rate.
- Also show per-product performance: how many times each product was offered (solo vs. in each bundle), and outcome rates.

**Recent Activities:**
- Last 8 activities across the team (or just own activities for SALES role).
- Shows: type badge, subject, creator name, related deal, date.

**Stale Deals:**
- Deals that haven't been updated in 7+ days.
- Shows: title, assignee, value, days since last update.

**Team Activity (MANAGER/ADMIN only):**
- Bar chart showing activity count per team member.

**My Summary (SALES only):**
- My deals by stage (count per stage)
- Upcoming activities (scheduled in future, not completed)
- Overdue activities (scheduled in past, not completed)

### 4.3 Leads Page

Paginated table of all leads.

**Columns:** Name, Email, Phone, Status (badge), Source, Company, Assigned To, **Last Contacted** (NEW — date of most recent activity for this lead).

**Filters:** Status, Source, Assignee, Company.

**Actions:** Create new lead, click row to view detail.

**Lead Detail Page:**
- All lead info in an editable form.
- Company info.
- Assigned user (with reassign button for MANAGER+).
- Conversion status (if already converted, show link to the resulting contact).
- Call history / activity timeline.
- Convert button (only for QUALIFIED leads) — opens a dialog to create Contact + optional Deal.

### 4.4 Contacts Page

Paginated table.

**Columns:** Name, Email, Phone, Title, Company, Deal Count.

**Contact Detail Page:**
- Contact info form.
- Company link.
- List of associated deals.
- Activity timeline.

### 4.5 Companies Page

Paginated table.

**Columns:** Name, Industry, Website, Contact Count, Deal Count.

**Company Detail Page:**
- Company info form.
- List of contacts, leads, and deals associated with this company.

### 4.6 Deals Page

Two views:

**Table View:** Sortable, filterable table with columns: Title, Value, Stage, Contact, Company, Assigned To, Expected Close.

**Pipeline/Kanban View:** 6 columns (one per stage). Deal cards can be dragged between columns. Each column header shows: stage name, deal count, total value. Moving a deal to CLOSED_LOST requires entering a lost reason.

**Deal Detail Page:**
- Deal properties (title, value, stage, expected close, lost reason if applicable).
- Contact and company info.
- Stage history timeline (chronological list of all stage changes with who/when/note).
- Activity timeline (recent activities linked to this deal).
- Stage change button (with confirmation dialog).
- Assign button (for MANAGER+).

### 4.7 Activities Page

Log of all activities.

**Columns:** Type (icon + label), Subject, Related entity (contact/deal/lead), Result, Assigned To, Date.

**Activity Detail Page:**
- Activity properties (type, subject, description, result, scheduled/completed dates).
- Related entity links.
- Comments section (add, edit, delete comments).
- Attachments list.
- "Complete" button that sets result + completed_at.

### 4.8 Campaigns Page (NEW)

This is a brand new page for managing what the team is selling.

**Two sections:**

**Section 1: Products**
- List of all products (name, ticker/code, category, active/inactive toggle).
- Add Product button → simple form: name, ticker, description, category.
- Edit/archive products.

**Section 2: Product Bundles**
- List of all bundles (name, included products shown as tags/chips, active/inactive toggle).
- Add Bundle button → form: name, description, select multiple products to include.
- Edit/archive bundles.

**Section 3: Campaigns**
- List of all campaigns (name, type [product/bundle], target product/bundle name, status, date range, progress).
- Add Campaign button → form: name, description, pick type (product or bundle), select the product or bundle, set dates, set target count.
- Campaign detail view showing:
  - Campaign info
  - Performance metrics: total calls, pickups, conversions, conversion rate
  - List of activities/calls made under this campaign
  - Breakdown of outcomes (completed, no answer, follow-up needed, etc.)

**Product Performance Dashboard (within Campaigns page or as a sub-section):**
- For each product: total times offered, times as solo product, times within each bundle, conversion rate.
- For each bundle: total times offered, conversion rate, which products within it perform best.

### 4.9 Telemarketer Calling Session (NEW — critical feature)

This is the core workflow for a telemarketer/advisor:

**Step 1: Start Calling**
- Telemarketer clicks a "Start Calling" button (prominent, in the header or dashboard).
- A form appears asking: "Which campaign are you calling for?" — dropdown of active campaigns.
- After selecting, the system shows a list of leads assigned to this telemarketer that haven't been contacted for this campaign yet.

**Step 2: Call Queue**
- The leads are shown as a list/queue.
- The first lead is auto-selected.
- A **slide-in panel from the right** opens showing the **Call Sheet**:
  - Lead's full details (name, phone, email, company, notes, previous call history)
  - The campaign/product being offered
  - **A call script** that the telemarketer should read/follow (can be associated with the campaign)
  - A "Start Call" button (this starts a timer tracking call duration)
  - Current call duration display

**Step 3: During the Call**
- Timer is running showing elapsed time.
- The script is visible for reference.
- Telemarketer can take notes in a live notes field.

**Step 4: End Call**
- Telemarketer clicks "End Call" button.
- The timer stops.
- The panel transitions to a **Call Outcome Form**:
  - Result: dropdown (COMPLETED, NO_ANSWER, FOLLOW_UP_NEEDED, MEETING_SCHEDULED, DEAL_ADVANCED, CANCELLED, FAILED)
  - If result is positive (COMPLETED, MEETING_SCHEDULED, DEAL_ADVANCED): option to advance deal stage or create a new deal
  - Notes: text area for what happened during the call
  - Schedule follow-up: optional date picker
  - Submit button

**Step 5: Next Lead**
- After submitting, the panel auto-advances to the next lead in the queue.
- The process repeats until the telemarketer clicks "Stop Calling" or runs out of leads.

**Tracking:**
- The entire session tracks: start time, end time, total time on dialer, number of calls made, number of pickups (result != NO_ANSWER).
- Each call creates an Activity record tagged with the campaign_id.
- These metrics feed into the dashboard's "Time on dialer", "Calls made", "Pickups" stat cards.

### 4.10 Telemarketer/Advisor Performance Page (NEW)

Accessible by ADMIN and MANAGER.

For each telemarketer/advisor, show:
- Name, role, status (active/inactive)
- **Today's stats:** time on dialer, calls made, pickups, conversion rate
- **This week/month stats:** same metrics aggregated
- **Call outcome breakdown:** pie chart or bar chart showing distribution of results
- **Campaign performance:** which campaigns they've worked on, how they performed in each
- **Deal pipeline:** their deals by stage
- **Activity log:** recent activities

This could be integrated into the existing Team page or be a dedicated page.

### 4.11 Notifications

- Bell icon in the top bar with unread count badge.
- Click to open a dropdown tray.
- Shows recent notifications with title, message, timestamp.
- Unread notifications have a blue dot indicator.
- "Mark all read" button.
- Click a notification to navigate to the relevant entity.
- Polling every 30 seconds (or just on navigation for the prototype).

### 4.12 Global Search

- Triggered by Cmd+K / Ctrl+K or clicking the search icon.
- Modal/command palette that searches across companies, contacts, leads, and deals.
- Results grouped by type with icons.
- Click a result to navigate to its detail page.

### 4.13 Audit Logs (ADMIN only)

- Table of all recorded actions.
- Columns: Timestamp, User, Action, Entity Type, Entity, Details.
- Filterable by user, action type, entity type.

### 4.14 Team Page (ADMIN only)

- List of all users with their role, status, and basic performance metrics.

---

## 5. Navigation Structure

**Sidebar:**
- Dashboard
- Leads
- Contacts
- Companies
- Deals
- Activities
- Campaigns (NEW)
- --- (separator) ---
- Team (ADMIN/MANAGER only)
- Audit Logs (ADMIN only)

**Top Bar:**
- "Start Calling" button (for SALES role — NEW)
- Global search (Cmd+K)
- Notification bell
- User avatar + dropdown (profile, logout)

---

## 6. Visual Design Direction

- Clean, professional SaaS look. Think: Linear, Notion, or HubSpot.
- Use a component library like shadcn/ui or similar.
- Light and dark mode support.
- Color-coded badges for statuses and stages:
  - Lead status: NEW (blue), CONTACTED (yellow), QUALIFIED (green), CONVERTED (purple), LOST (red)
  - Deal stage: LEAD (gray), QUALIFIED (blue), PROPOSAL (yellow), NEGOTIATION (orange), CLOSED_WON (green), CLOSED_LOST (red)
  - Activity type: Each type gets a distinct icon + color
- Responsive layout but desktop-first (this is primarily a desktop tool).
- The pipeline/kanban board should look polished with smooth drag-and-drop animations.
- The calling session panel should slide in from the right and feel like a focused workspace.

---

## 7. Mock Data Guidelines

Pre-seed the app with enough data to feel realistic:

- 4 users (the demo accounts above)
- 4-5 companies
- 8-10 contacts (spread across companies)
- 10-15 leads (various statuses, some assigned to different users)
- 8-12 deals (spread across all 6 stages, some assigned to different users)
- 15-20 activities (various types and results, linked to deals/contacts/leads)
- 5-6 products (Stock A through F)
- 3-4 bundles (combinations of products)
- 3-5 campaigns (linked to products/bundles, various statuses)
- 5-10 notifications
- 10-15 audit log entries
- Some deal stage history entries

Make the data tell a story — e.g., "Acme Corp" is a hot prospect with multiple touches, one deal in negotiation. "Northstar Health" has a stale deal. Some leads are new and uncontacted, some are qualified and ready to convert.

---

## 8. Technical Constraints for the Prototype

- **No backend.** Everything runs in the browser.
- **State management:** Use React state (useState/useReducer) or a lightweight store (Zustand, Jotai). Persist to localStorage so data survives page refresh.
- **No real authentication.** Just store the selected demo user in state/localStorage.
- **No real file uploads.** Attachment UI can exist but just stores file names, not actual files.
- **No real-time features.** Notifications are just pre-seeded + created locally when actions happen.
- **Routing:** Use React Router or Next.js App Router — your call.
- **Make it deployable** as a static site (e.g., Vercel, Netlify, GitHub Pages).

---

## 9. Summary of NEW Features (not in current codebase)

These are features that do NOT exist in the current project and need to be built fresh:

1. **Dashboard additions:** "Time on dialer", "Calls made", "Pickups" stat cards. Campaign/product performance highlights section.

2. **Campaigns page:** Full CRUD for Products, Product Bundles, and Campaigns. Performance tracking per campaign, per product, per bundle (how many times offered as solo vs. in which bundles).

3. **Telemarketer performance view:** Per-advisor stats visible to ADMIN/MANAGER — calls, pickups, time on dialer, conversion rates, campaign-level breakdown.

4. **Lead "last contacted" column:** Show when each lead was last contacted in the leads table.

5. **Per-lead call history:** On the lead detail page, show full call history with outcomes and notes.

6. **Per-deal details:** Keep the existing deal detail page with stage history, activities, etc.

7. **Calling session workflow:** The "Start Calling" → campaign selection → lead queue → call sheet panel → end call → outcome form → next lead flow. This is the biggest new feature.

8. **Call scripts:** Each campaign can have an associated script that's displayed during the calling session for the telemarketer to follow.
