# Help Content Guide

This file is the working brief for generating per-page help content with ChatGPT.
The app will later let each page expose a `getHelpContent()` function. The returned
content should power a help modal with:

- Left side: a list of help options. Each option is a feature title or workflow title.
- Right side: the explanation for the selected option.

Use this guide as the source prompt when asking ChatGPT to generate help content
page by page.

## Master Prompt For ChatGPT

Copy this prompt into ChatGPT before asking it to generate a page:

```text
You are helping write in-app help content for a frontend-only Telemarketing CRM prototype.

The product is a CRM for sales advisors who call leads and sell fictional stock products and stock bundles. The app has mock data only. There is no backend. Users can be ADMIN, MANAGER, SALES, or VIEWER. The help content must be practical, concise, and written for people using the CRM, not developers.

The help modal UI has two columns:
- Left column: list of options. Each option is a feature title or workflow title.
- Right column: explanation for the selected option.

Generate help content for one page at a time. Return content using this schema:

type HelpContent = {
  pageId: string;
  pageTitle: string;
  pageSummary: string;
  options: HelpOption[];
};

type HelpOption = {
  id: string;
  title: string;
  summary: string;
  body: string[];
  steps?: string[];
  tips?: string[];
  roleNotes?: string[];
  relatedData?: string[];
};

Rules:
- Use Indonesian.
- Do not invent features that are not described in the page brief.
- Keep each option focused on one workflow or feature.
- The left-column label is `title`; keep it short, ideally 2-5 words.
- The right-column content comes from `summary`, `body`, `steps`, `tips`, `roleNotes`, and `relatedData`.
- Avoid marketing language.
- Avoid telling users about implementation details like Zustand, React Router, localStorage, or TypeScript.
- Mention role differences only when they affect what the user can do.
- If a page has list/table and detail navigation, explain how users should move from list to detail.
- If a page has calculated metrics, explain what the metric means and which user action can affect it.
- Return only the data object for the requested page. Do not add commentary outside the object.

Now generate help content for this page:
PAGE_ID: <fill from page catalog>
ROUTE: <fill from page catalog>
PAGE_TITLE: <fill from page catalog>
AUDIENCE: <fill from page catalog>
PAGE_PURPOSE: <fill from page catalog>
FEATURES_AND_FLOWS:
<paste the page-specific feature/flow bullets from this file>
RELATED_DATA:
<paste the related data/entities from this file>
```

## Proposed Runtime Shape

Each page can expose a local function like this:

```ts
export function getHelpContent(): HelpContent {
  return {
    pageId: "dashboard",
    pageTitle: "Dashboard",
    pageSummary: "Ringkasan aktivitas, pipeline, dan performa campaign.",
    options: [
      {
        id: "read-stats",
        title: "Membaca Ringkasan",
        summary: "Gunakan kartu metrik untuk melihat kondisi CRM secara cepat.",
        body: ["..."],
        steps: ["..."],
        tips: ["..."],
        roleNotes: ["..."],
        relatedData: ["deals", "activities", "campaigns"]
      }
    ]
  };
}
```

If help content is centralized later, the same object can be moved into a shared
registry:

```ts
const helpContentByPage: Record<string, HelpContent> = {
  dashboard: getDashboardHelpContent(),
  leads: getLeadsHelpContent()
};
```

## Data Schema Summary

Use these entities when explaining page behavior.

### Users And Roles

- `User`: app account with `id`, `name`, `email`, `role`, `avatar`, `is_active`.
- Roles:
  - `ADMIN`: full access, including audit logs and management features.
  - `MANAGER`: team oversight, assignment, campaign/product management.
  - `SALES`: works their own leads, calls, activities, and deals.
  - `VIEWER`: limited read-only access.

### Lead Flow

- `Lead`: prospect before conversion.
- Lead statuses: `NEW`, `CONTACTED`, `QUALIFIED`, `CONVERTED`, `LOST`.
- Lead sources: `WEBSITE`, `REFERRAL`, `COLD_CALL`, `SOCIAL_MEDIA`, `EVENT`, `ADVERTISEMENT`, `OTHER`.
- Lead can be assigned to a user.
- Qualified leads can be converted into contacts and optionally deals.

### Contact And Company

- `Contact`: person associated with a company or standalone prospect.
- `Company`: organization connected to leads, contacts, and deals.
- Contacts and companies can be linked to activities and deals.

### Deal Pipeline

- `Deal`: opportunity with title, value, stage, contact, company, assignee, and expected close date.
- Deal stages: `LEAD`, `QUALIFIED`, `PROPOSAL`, `NEGOTIATION`, `CLOSED_WON`, `CLOSED_LOST`.
- Stage changes create stage history.
- Closed lost deals require a lost reason.

### Activities

- `Activity`: logged work such as calls, meetings, tasks, notes, demos, and follow-ups.
- Activity types: `CALL`, `EMAIL`, `MEETING`, `TASK`, `NOTE`, `DEMO`, `FOLLOW_UP`.
- Activity results: `COMPLETED`, `NO_ANSWER`, `FOLLOW_UP_NEEDED`, `MEETING_SCHEDULED`, `DEAL_ADVANCED`, `CANCELLED`, `FAILED`.
- Call activities can include metadata like duration, prospect value, meeting schedule, or follow-up schedule.

### Products And Bundles

- `Product`: fictional stock product with ticker, category, risk score, annual return, market cap, and active status.
- `Bundle`: portfolio bundle made from multiple products.
- Bundle has `product_ids`, optional allocation weights, and calculated risk score.
- Campaigns can offer a product, a bundle, or mixed offer items.

### Campaigns

- `Campaign`: calling or outreach program tied to products/bundles.
- Campaign statuses: `ACTIVE`, `PAUSED`, `COMPLETED`.
- Campaign types: `PRODUCT`, `BUNDLE`, `MIXED`.
- Campaign performance is based on related activities and deals.

### Calling Session

- Calling session queues assigned leads for a selected active campaign.
- Sales ends each call by logging an outcome.
- Outcome form behavior:
  - `MEETING_SCHEDULED`: asks for meeting date and schedules a meeting activity.
  - `DEAL_ADVANCED` and `COMPLETED`: allow prospect value input.
  - `NO_ANSWER` and `FOLLOW_UP_NEEDED`: allow follow-up schedule.
  - `FAILED`: requires notes.

### Notifications And Audit Logs

- `Notification`: in-app notification for assigned work, comments, stage changes, and wins/losses.
- `AuditLog`: record of create, update, delete, stage change, assignment change, status change, conversion, and archive actions.

## Help Modal Content Guidelines

Use these conventions for every page:

- `pageSummary`: one sentence about what the page is for.
- `options`: 3-7 options per page.
- Each option should map to a user decision or workflow, not a UI component name.
- Good option titles:
  - "Membaca Pipeline"
  - "Membuat Lead"
  - "Mengubah Stage"
  - "Menjadwalkan Follow-up"
  - "Menganalisis Campaign"
- Avoid vague titles:
  - "Overview"
  - "Feature 1"
  - "Data"
- Prefer practical instruction:
  - What this section means.
  - When to use it.
  - What action changes the data.
  - What role can use it.

## Page Catalog

Use this catalog as the source input for page-by-page generation.

### Dashboard

- `PAGE_ID`: `dashboard`
- `ROUTE`: `/`
- `PAGE_TITLE`: `Dashboard`
- `AUDIENCE`: `ADMIN`, `MANAGER`, `SALES`, `VIEWER`
- `PAGE_PURPOSE`: Show top-level CRM performance, pipeline health, recent activity, stale deals, and user-specific summary.
- `FEATURES_AND_FLOWS`:
  - Read total deals, open deals, pipeline value, won deals, unread notifications, dialer time, calls made, and pickups.
  - Review pipeline by stage chart.
  - Review campaign performance list and sort/filter by rate, calls, pickups, or conversions.
  - Open recent activity or related person/deal via quick sheet/detail link.
  - Review stale deals that need attention.
  - Sales users see "My Summary" with their assigned deals, upcoming activities, and overdue activities.
  - Managers see team activity metrics.
- `RELATED_DATA`: `deals`, `activities`, `campaigns`, `notifications`, `users`, `call_sessions`.

### Login

- `PAGE_ID`: `login`
- `ROUTE`: `/login`
- `PAGE_TITLE`: `Login`
- `AUDIENCE`: unauthenticated demo user
- `PAGE_PURPOSE`: Let a demo user choose an account/role to enter the prototype.
- `FEATURES_AND_FLOWS`:
  - Choose a seeded demo account.
  - Understand role differences before entering.
  - After login, user lands in the main app.
- `RELATED_DATA`: `users`.

### Leads List

- `PAGE_ID`: `leads`
- `ROUTE`: `/leads`
- `PAGE_TITLE`: `Leads`
- `AUDIENCE`: `ADMIN`, `MANAGER`, `SALES`, `VIEWER`
- `PAGE_PURPOSE`: Manage prospect records before they become contacts or deals.
- `FEATURES_AND_FLOWS`:
  - Search/filter leads by status, source, assignee, or text.
  - Create a new lead and assign it to the current user or available sales user depending on role.
  - View lead status and source.
  - Navigate to lead detail from the table.
  - Open assignee profile links where access allows.
- `RELATED_DATA`: `leads`, `companies`, `users`, `activities`.

### Lead Detail

- `PAGE_ID`: `lead-detail`
- `ROUTE`: `/leads/:id`
- `PAGE_TITLE`: `Lead Detail`
- `AUDIENCE`: `ADMIN`, `MANAGER`, `SALES`, `VIEWER`
- `PAGE_PURPOSE`: Review and progress a single prospect through qualification and conversion.
- `FEATURES_AND_FLOWS`:
  - Edit lead profile fields when allowed.
  - Change lead status.
  - Convert qualified lead into a contact and optionally create a deal.
  - Add call, meeting, follow-up, task, note, demo, or email activity.
  - Review lead activity timeline.
  - Managers can reassign lead ownership.
  - Converted leads become read-only for conversion flow.
- `RELATED_DATA`: `leads`, `contacts`, `companies`, `deals`, `activities`, `users`.

### Contacts List

- `PAGE_ID`: `contacts`
- `ROUTE`: `/contacts`
- `PAGE_TITLE`: `Contacts`
- `AUDIENCE`: `ADMIN`, `MANAGER`, `SALES`, `VIEWER`
- `PAGE_PURPOSE`: Browse people who are already known contacts.
- `FEATURES_AND_FLOWS`:
  - Search contacts by name, email, phone, title, or company.
  - Create a contact when allowed.
  - View company association and deal count.
  - Navigate to contact detail.
- `RELATED_DATA`: `contacts`, `companies`, `deals`.

### Contact Detail

- `PAGE_ID`: `contact-detail`
- `ROUTE`: `/contacts/:id`
- `PAGE_TITLE`: `Contact Detail`
- `AUDIENCE`: `ADMIN`, `MANAGER`, `SALES`, `VIEWER`
- `PAGE_PURPOSE`: See all CRM context for one contact.
- `FEATURES_AND_FLOWS`:
  - Edit contact information when allowed.
  - Review company association.
  - View associated deals.
  - View recent activities involving this contact.
  - Navigate to related company, deals, and users.
- `RELATED_DATA`: `contacts`, `companies`, `deals`, `activities`, `users`.

### Companies List

- `PAGE_ID`: `companies`
- `ROUTE`: `/companies`
- `PAGE_TITLE`: `Companies`
- `AUDIENCE`: `ADMIN`, `MANAGER`, `SALES`, `VIEWER`
- `PAGE_PURPOSE`: Manage organizations connected to leads, contacts, and deals.
- `FEATURES_AND_FLOWS`:
  - Search companies by name, industry, website, email, or phone.
  - Create company when allowed.
  - Review contact count and deal count.
  - Navigate to company detail.
- `RELATED_DATA`: `companies`, `contacts`, `deals`.

### Company Detail

- `PAGE_ID`: `company-detail`
- `ROUTE`: `/companies/:id`
- `PAGE_TITLE`: `Company Detail`
- `AUDIENCE`: `ADMIN`, `MANAGER`, `SALES`, `VIEWER`
- `PAGE_PURPOSE`: Show company profile and connected CRM records.
- `FEATURES_AND_FLOWS`:
  - Edit company information when allowed.
  - Review contacts under the company.
  - Review leads under the company.
  - Review deals under the company.
  - Navigate to related records.
- `RELATED_DATA`: `companies`, `contacts`, `leads`, `deals`.

### Deals List

- `PAGE_ID`: `deals`
- `ROUTE`: `/deals`
- `PAGE_TITLE`: `Deals`
- `AUDIENCE`: `ADMIN`, `MANAGER`, `SALES`, `VIEWER`
- `PAGE_PURPOSE`: Manage active and closed sales opportunities.
- `FEATURES_AND_FLOWS`:
  - Switch between list and pipeline/kanban style views if available.
  - Create a deal when allowed.
  - Move deals through stages.
  - Enter lost reason when closing lost.
  - Review stage totals and pipeline value.
  - Navigate to deal detail.
- `RELATED_DATA`: `deals`, `contacts`, `companies`, `users`, `stage_history`.

### Deal Detail

- `PAGE_ID`: `deal-detail`
- `ROUTE`: `/deals/:id`
- `PAGE_TITLE`: `Deal Detail`
- `AUDIENCE`: `ADMIN`, `MANAGER`, `SALES`, `VIEWER`
- `PAGE_PURPOSE`: Work one opportunity from qualification to close.
- `FEATURES_AND_FLOWS`:
  - Edit title, value, expected close date, and stage when allowed.
  - Move stage forward or backward according to role permissions.
  - Assign owner when manager/admin.
  - Add activities tied to the deal.
  - Review stage history timeline.
  - Review related contact, company, and activities.
  - Closed lost requires lost reason.
- `RELATED_DATA`: `deals`, `contacts`, `companies`, `activities`, `stage_history`, `users`.

### Activities List

- `PAGE_ID`: `activities`
- `ROUTE`: `/activities`
- `PAGE_TITLE`: `Activities`
- `AUDIENCE`: `ADMIN`, `MANAGER`, `SALES`, `VIEWER`
- `PAGE_PURPOSE`: Track work logs and scheduled tasks across the CRM.
- `FEATURES_AND_FLOWS`:
  - Filter activities by type/result or search text.
  - Review subject, related entity, assigned user, result, and date.
  - Navigate to activity detail.
  - Use this page to audit recent work and pending follow-ups.
- `RELATED_DATA`: `activities`, `contacts`, `deals`, `leads`, `users`.

### Activity Detail

- `PAGE_ID`: `activity-detail`
- `ROUTE`: `/activities/:id`
- `PAGE_TITLE`: `Activity Detail`
- `AUDIENCE`: `ADMIN`, `MANAGER`, `SALES`, `VIEWER`
- `PAGE_PURPOSE`: Inspect and complete a single activity.
- `FEATURES_AND_FLOWS`:
  - Review type, result, scheduled date, completed date, duration, and description.
  - Review call metadata such as prospect value, meeting schedule, and follow-up schedule when present.
  - Complete pending activity with a result when allowed.
  - Add, edit, or delete comments depending on ownership and permissions.
  - Navigate to related lead, contact, or deal.
- `RELATED_DATA`: `activities`, `comments`, `users`, `deals`, `contacts`, `leads`.

### Calendar

- `PAGE_ID`: `calendar`
- `ROUTE`: `/calendar`
- `PAGE_TITLE`: `Calendar`
- `AUDIENCE`: `ADMIN`, `MANAGER`, `SALES`, `VIEWER`
- `PAGE_PURPOSE`: View and create scheduled meetings, tasks, and follow-ups.
- `FEATURES_AND_FLOWS`:
  - Review scheduled activities by date.
  - Create a new scheduled activity when allowed.
  - Choose type, assignee, subject, related lead/contact/deal, and date.
  - Use calendar to plan follow-up work from call outcomes.
- `RELATED_DATA`: `activities`, `users`, `deals`, `leads`, `contacts`.

### Campaigns

- `PAGE_ID`: `campaigns`
- `ROUTE`: `/campaigns`
- `PAGE_TITLE`: `Campaigns`
- `AUDIENCE`: `ADMIN`, `MANAGER`, `SALES`, `VIEWER`
- `PAGE_PURPOSE`: Manage campaign offerings, products, bundles, and performance.
- `FEATURES_AND_FLOWS`:
  - Campaigns tab: create campaigns, set status, target count, date range, script, and product/bundle offerings.
  - Products tab: review fictional stock products, ticker, category, risk, annual return, market cap, and active status.
  - Bundles tab: review portfolio bundles, component tickers, allocations, risk, and active status.
  - Performance tab: analyze total calls, pickups, conversions, conversion rate, funnel chart, outcome chart, campaign conversion chart, and product offer breakdown.
  - Managers/admins can create/update products, bundles, and campaigns.
- `RELATED_DATA`: `campaigns`, `products`, `bundles`, `activities`, `deals`, `users`.

### Campaign Detail

- `PAGE_ID`: `campaign-detail`
- `ROUTE`: `/campaigns/:id`
- `PAGE_TITLE`: `Campaign Detail`
- `AUDIENCE`: `ADMIN`, `MANAGER`, `SALES`, `VIEWER`
- `PAGE_PURPOSE`: Inspect one campaign's offering, call activity, and performance.
- `FEATURES_AND_FLOWS`:
  - Review campaign status, target count, date range, and script.
  - See offered product or bundle.
  - Review campaign calls, pickups, conversions, and rates.
  - Review recent campaign activity.
  - Navigate to related product/bundle and activity records.
- `RELATED_DATA`: `campaigns`, `products`, `bundles`, `activities`, `users`, `leads`, `contacts`.

### Product Detail

- `PAGE_ID`: `product-detail`
- `ROUTE`: `/products/:id`
- `PAGE_TITLE`: `Product Detail`
- `AUDIENCE`: `ADMIN`, `MANAGER`, `SALES`, `VIEWER`
- `PAGE_PURPOSE`: Explain one fictional stock product and its performance in campaigns.
- `FEATURES_AND_FLOWS`:
  - Review ticker, category, risk score, annual return, market cap, active status, and description.
  - See bundles that include this product.
  - Review calls made and conversion rate from related campaign activity and linked deals.
  - Review performance by campaign.
  - Navigate to related bundles and campaigns.
- `RELATED_DATA`: `products`, `bundles`, `campaigns`, `activities`, `deals`.

### Bundle Detail

- `PAGE_ID`: `bundle-detail`
- `ROUTE`: `/bundles/:id`
- `PAGE_TITLE`: `Bundle Detail`
- `AUDIENCE`: `ADMIN`, `MANAGER`, `SALES`, `VIEWER`
- `PAGE_PURPOSE`: Explain one stock bundle and its portfolio allocation.
- `FEATURES_AND_FLOWS`:
  - Review bundle status, product count, risk score, calls made, and conversion rate.
  - Understand portfolio allocation by product ticker and percentage.
  - Review campaign pickup rate.
  - Navigate to component products.
  - Review campaigns using this bundle.
- `RELATED_DATA`: `bundles`, `products`, `campaigns`, `activities`, `deals`.

### Team

- `PAGE_ID`: `team`
- `ROUTE`: `/team`
- `PAGE_TITLE`: `Team`
- `AUDIENCE`: `ADMIN`, `MANAGER`
- `PAGE_PURPOSE`: Review team members and their activity/deal performance.
- `FEATURES_AND_FLOWS`:
  - View non-viewer team members.
  - Compare activity count, deal count, won deals, pickup rates, or dialer time if shown.
  - Navigate to advisor performance profile.
  - Sales users cannot access the team list.
- `RELATED_DATA`: `users`, `activities`, `deals`.

### Advisor Performance

- `PAGE_ID`: `advisor-performance`
- `ROUTE`: `/team/:id`
- `PAGE_TITLE`: `Advisor Performance`
- `AUDIENCE`: `ADMIN`, `MANAGER`, `SALES own profile only`
- `PAGE_PURPOSE`: Show one user's sales and calling performance.
- `FEATURES_AND_FLOWS`:
  - Review calls made, pickups, conversion rate, and dialer time.
  - Review call outcome breakdown.
  - Review deals by stage.
  - Review campaign activity breakdown.
  - Review recent activities.
  - Sales users can open only their own profile; managers/admins can open any profile.
- `RELATED_DATA`: `users`, `activities`, `deals`, `campaigns`.

### Audit Logs

- `PAGE_ID`: `audit-logs`
- `ROUTE`: `/audit-logs`
- `PAGE_TITLE`: `Audit Logs`
- `AUDIENCE`: `ADMIN`
- `PAGE_PURPOSE`: Review system actions and user changes.
- `FEATURES_AND_FLOWS`:
  - Search audit logs by user, action, entity, metadata, or date.
  - Filter by user or action if available.
  - Review create/update/delete/stage/status/assignment/conversion events.
  - Use audit logs to understand who changed what and when.
- `RELATED_DATA`: `audit_logs`, `users`.

### No Access

- `PAGE_ID`: `no-access`
- `ROUTE`: access-controlled fallback
- `PAGE_TITLE`: `No Access`
- `AUDIENCE`: any role without permission
- `PAGE_PURPOSE`: Tell the user they cannot access a page.
- `FEATURES_AND_FLOWS`:
  - Explain that role restrictions block the page.
  - Suggest going back to a permitted page.
  - Do not expose data from the protected page.
- `RELATED_DATA`: `users`, `roles`.

## Optional Page Prompt Template

Use this shorter template after the master prompt has been established:

```text
Generate `HelpContent` for:
PAGE_ID:
ROUTE:
PAGE_TITLE:
AUDIENCE:
PAGE_PURPOSE:

FEATURES_AND_FLOWS:
- ...

RELATED_DATA:
- ...

Return only the object. Indonesian. Match the modal model: left option titles, right explanation content.
```

## Example Output Shape

Use this style as a reference. Do not copy the exact content to every page.

```ts
{
  pageId: "leads",
  pageTitle: "Leads",
  pageSummary: "Halaman ini dipakai untuk mengelola prospek sebelum menjadi contact atau deal.",
  options: [
    {
      id: "read-lead-list",
      title: "Membaca Lead",
      summary: "Gunakan daftar lead untuk melihat prospek aktif dan statusnya.",
      body: [
        "Setiap baris mewakili satu prospek.",
        "Status menunjukkan posisi lead dalam proses kualifikasi."
      ],
      steps: [
        "Cari lead dari kolom pencarian atau filter.",
        "Klik baris lead untuk membuka detail.",
        "Periksa status, assignee, dan aktivitas terakhir sebelum follow-up."
      ],
      tips: [
        "Prioritaskan lead QUALIFIED karena sudah siap dikonversi."
      ],
      roleNotes: [
        "Sales biasanya mengelola lead miliknya sendiri.",
        "Manager dapat memantau dan mengatur assignment tim."
      ],
      relatedData: ["leads", "activities", "users"]
    }
  ]
}
```
