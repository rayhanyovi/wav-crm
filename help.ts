export type HelpContent = {
  pageId: string;
  pageTitle: string;
  pageSummary: string;
  options: HelpOption[];
};

export type HelpOption = {
  id: string;
  title: string;
  summary: string;
  body: string[];
  steps?: string[];
  tips?: string[];
  roleNotes?: string[];
  relatedData?: string[];
};

export const dashboardHelpContent: HelpContent = {
  pageId: "dashboard",
  pageTitle: "Dashboard",
  pageSummary:
    "The Dashboard displays a summary of CRM performance, pipeline status, recent activity, and work that needs follow-up.",
  options: [
    {
      id: "read-main-metrics",
      title: "Reading the Summary",
      summary:
        "Use the main metric cards to quickly assess the overall CRM status.",
      body: [
        "Total deals shows the number of recorded sales opportunities.",
        "Open deals and pipeline value help you see still-active opportunities.",
        "Won deals shows deals that have been successfully closed.",
      ],
      tips: [
        "Don't just look at deal count. Also pay attention to pipeline value and stage.",
        "A large pipeline isn't necessarily healthy if many deals have been stalled for too long.",
      ],
      relatedData: ["deals", "activities", "notifications", "call_sessions"],
    },
    {
      id: "read-pipeline-chart",
      title: "Reading the Pipeline",
      summary:
        "Use the pipeline chart to see the distribution of deals by stage.",
      body: [
        "Each stage shows the position of deals in the sales process.",
        "Early stages like LEAD and QUALIFIED indicate opportunities that still need to be worked.",
        "Later stages like CLOSED_WON and CLOSED_LOST indicate the final outcome of deals.",
      ],
      steps: [
        "Look at the number of deals in each stage.",
        "Compare deal values across stages.",
        "Look for stages that are overcrowded, as this may indicate a bottleneck.",
      ],
      tips: [
        "If many deals are stalling at PROPOSAL or NEGOTIATION, the team may need to follow up more actively.",
      ],
      relatedData: ["deals", "stage_history"],
    },
    {
      id: "review-campaigns",
      title: "Analyzing Campaigns",
      summary:
        "Use the campaign performance list to compare call results and conversions.",
      body: [
        "Campaign performance helps identify which outreach programs are most effective.",
        "Rate, calls, pickups, and conversions indicate the quality of responses from campaign targets.",
      ],
      steps: [
        "Sort campaigns by rate, calls, pickups, or conversions.",
        "Compare campaigns with a sufficiently high number of calls.",
        "Prioritize campaigns with better pickup and conversion rates.",
      ],
      tips: [
        "A campaign with a high conversion rate but low call volume may still need to be tested at larger scale.",
      ],
      relatedData: ["campaigns", "activities", "deals", "users"],
    },
    {
      id: "open-recent-activity",
      title: "Recent Activity",
      summary:
        "Use recent activity to see work that has just been done by the team.",
      body: [
        "Activities can be calls, meetings, tasks, notes, demos, emails, or follow-ups.",
        "Recent activity helps you understand the latest changes to leads, contacts, or deals.",
      ],
      steps: [
        "Open an activity from the recent list.",
        "Review the activity outcome and its notes.",
        "Use the detail link to open the related person or deal.",
      ],
      relatedData: ["activities", "leads", "contacts", "deals"],
    },
    {
      id: "review-stale-deals",
      title: "Stale Deals",
      summary:
        "Use stale deals to find opportunities that need renewed attention.",
      body: [
        "A stale deal is one that has not moved or received any new activity within a certain period.",
        "These deals are at risk of being lost if not followed up on promptly.",
      ],
      steps: [
        "Open the stale deals list.",
        "Check the stage and most recent activity.",
        "Decide whether a follow-up, meeting, or stage update is needed.",
      ],
      tips: [
        "Prioritize stale deals with high value and a close expected close date.",
      ],
      relatedData: ["deals", "activities", "users"],
    },
    {
      id: "role-summary",
      title: "Role Summary",
      summary: "Some parts of the dashboard change based on the user's role.",
      body: [
        "Sales users see a summary of their own work.",
        "Managers see their team's activity metrics.",
        "Admins and Viewers can see summaries based on their available access permissions.",
      ],
      roleNotes: [
        "Sales users use My Summary to monitor their assigned deals, upcoming activities, and overdue activities.",
        "Managers use team metrics to see productivity and areas where support may be needed.",
        "Viewers can only read data without making any changes.",
      ],
      relatedData: ["users", "deals", "activities"],
    },
  ],
};

export const leadsHelpContent: HelpContent = {
  pageId: "leads",
  pageTitle: "Leads",
  pageSummary:
    "The Leads page is used to manage prospects before they become contacts or deals.",
  options: [
    {
      id: "read-lead-list",
      title: "Reading Leads",
      summary:
        "Use the lead list to view prospects, their status, source, and owner.",
      body: [
        "Each row represents one prospect.",
        "Status shows the lead's position in the qualification process.",
        "Source shows where the lead came from.",
      ],
      steps: [
        "Check the lead status to understand the follow-up stage.",
        "Check the source to know the prospect's origin.",
        "Click a lead row to open its details.",
      ],
      tips: [
        "Leads with a NEW status should generally be prioritized for prompt outreach.",
      ],
      relatedData: ["leads", "companies", "users", "activities"],
    },
    {
      id: "search-filter-leads",
      title: "Searching for Leads",
      summary:
        "Use search and filters to find leads that need to be worked on.",
      body: [
        "Filters help narrow the list by status, source, assignee, or search text.",
        "Search is useful when you want to find a specific lead quickly.",
      ],
      steps: [
        "Enter a keyword in the search field.",
        "Select status, source, or assignee filters if needed.",
        "Open the most relevant lead from the results.",
      ],
      tips: [
        "Use the assignee filter to see leads belonging to a specific sales rep.",
      ],
      relatedData: ["leads", "users"],
    },
    {
      id: "create-lead",
      title: "Creating a Lead",
      summary:
        "Create a new lead when there is a prospect that hasn't been entered into the CRM yet.",
      body: [
        "A new lead should contain enough contact information for follow-up.",
        "The assignment determines who is responsible for reaching out to the lead.",
      ],
      steps: [
        "Click the action to create a new lead.",
        "Fill in the available prospect information.",
        "Select an assignee based on role permissions.",
        "Save the lead so it can be worked from the list.",
      ],
      roleNotes: [
        "Sales reps typically create leads for themselves.",
        "Managers or Admins can assign leads to available sales reps.",
        "Viewers cannot create leads.",
      ],
      relatedData: ["leads", "users", "companies"],
    },
    {
      id: "understand-status-source",
      title: "Status and Source",
      summary:
        "Status and source help determine follow-up priority and context.",
      body: [
        "NEW status means the lead has just come in and hasn't been processed much.",
        "CONTACTED means the lead has been reached out to at least once.",
        "QUALIFIED means the lead is suitable to move forward to the conversion process.",
        "CONVERTED means the lead has become a contact and possibly a deal.",
        "LOST means the lead will not be pursued further.",
      ],
      tips: [
        "Don't change a lead to QUALIFIED unless there is a clear indication of interest.",
        "Use source to evaluate which channels produce better prospects.",
      ],
      relatedData: ["leads", "activities"],
    },
    {
      id: "open-lead-detail",
      title: "Opening Details",
      summary:
        "Open a lead's detail page to view its history and take follow-up actions.",
      body: [
        "The lead list only shows a summary.",
        "The lead detail page is used to view full information, activities, status, and conversion options.",
      ],
      steps: [
        "Find a lead from the list.",
        "Click the lead row you want to review.",
        "Use the detail page to edit, add activities, or convert the lead if it qualifies.",
      ],
      relatedData: ["leads", "activities", "contacts", "deals"],
    },
    {
      id: "assignee-access",
      title: "Assignee Access",
      summary:
        "The assignee link helps identify who is responsible for a lead.",
      body: [
        "The assignee is the user assigned to handle the lead.",
        "If access permits, the assignee's profile can be opened to view performance context or responsibilities.",
      ],
      roleNotes: [
        "Managers and Admins generally have broader access to user profiles.",
        "Sales reps may be limited to data relevant to their own work.",
        "Viewers can only see available information without changing assignments.",
      ],
      relatedData: ["leads", "users"],
    },
  ],
};

export const leadDetailHelpContent: HelpContent = {
  pageId: "lead-detail",
  pageTitle: "Lead Detail",
  pageSummary:
    "The Lead Detail page is used to review, update, and convert a single prospect.",
  options: [
    {
      id: "review-lead-profile",
      title: "Lead Profile",
      summary:
        "Use the profile section to understand the basic information about the prospect.",
      body: [
        "The lead profile contains information that helps sales reps follow up effectively.",
        "Clean data reduces the risk of contacting the wrong person or company.",
      ],
      steps: [
        "Check the name, contact details, company, source, and assignee.",
        "Make sure important information is complete.",
        "Edit the data if any information needs to be updated.",
      ],
      roleNotes: [
        "Users with edit permission can update lead information.",
        "Viewers can only read data.",
      ],
      relatedData: ["leads", "companies", "users"],
    },
    {
      id: "change-lead-status",
      title: "Changing Status",
      summary: "Change the lead status to reflect follow-up progress.",
      body: [
        "Status helps the team understand the lead's current position.",
        "Status changes should follow actual activity outcomes, not assumptions.",
      ],
      steps: [
        "Review the lead's most recent activity.",
        "Select the appropriate new status.",
        "Make sure the activity notes support the status change.",
      ],
      tips: [
        "Use CONTACTED after the lead has been successfully reached.",
        "Use QUALIFIED only if the lead is genuinely ready to be processed further.",
      ],
      relatedData: ["leads", "activities"],
    },
    {
      id: "convert-lead",
      title: "Converting a Lead",
      summary:
        "Convert a lead when the prospect is qualified and ready to become a contact.",
      body: [
        "A qualified lead can be converted into a contact.",
        "During conversion, a deal can also be created if there is a clear sales opportunity.",
        "Once converted, the conversion flow does not need to be run again.",
      ],
      steps: [
        "Make sure the lead status is QUALIFIED.",
        "Run the conversion process.",
        "Choose whether to create a new deal.",
        "Review the contact or deal created after conversion.",
      ],
      tips: [
        "Don't create a deal if there isn't a sufficiently concrete opportunity yet.",
      ],
      roleNotes: [
        "Converted leads become read-only for the conversion flow.",
        "Viewers cannot perform conversions.",
      ],
      relatedData: ["leads", "contacts", "companies", "deals"],
    },
    {
      id: "add-lead-activity",
      title: "Adding an Activity",
      summary: "Log activities to keep the lead's follow-up history clear.",
      body: [
        "Activities can be calls, meetings, follow-ups, tasks, notes, demos, or emails.",
        "Activity history helps the team understand what has already been done and what the next steps are.",
      ],
      steps: [
        "Select the appropriate activity type.",
        "Fill in the outcome, schedule, or relevant notes.",
        "Save the activity so it appears on the lead's timeline.",
      ],
      tips: ["Always write a brief note after a call so context isn't lost."],
      relatedData: ["activities", "leads", "users"],
    },
    {
      id: "review-timeline",
      title: "Lead Timeline",
      summary:
        "Use the timeline to read the history of interactions with the lead.",
      body: [
        "The timeline shows activities that have been performed on the lead.",
        "The sequence of activities helps trace progress from first contact to final decision.",
      ],
      steps: [
        "Read activities starting from the most recent.",
        "Review the outcome of the last call or follow-up.",
        "Determine the next action based on that history.",
      ],
      relatedData: ["activities", "leads"],
    },
    {
      id: "reassign-lead",
      title: "Reassigning a Lead",
      summary:
        "Managers can change the lead owner when responsibility needs to be transferred.",
      body: [
        "Reassignment is useful when a lead needs to be handed off to another sales rep.",
        "Changes to the assignee should be made clearly to avoid duplicate follow-up.",
      ],
      steps: [
        "Check the current assignee.",
        "Select the new sales rep who will handle the lead.",
        "Make sure the new sales rep understands the context from previous activities.",
      ],
      roleNotes: [
        "Managers and Admins can perform reassignments.",
        "Sales reps may not always be able to move leads to other users.",
        "Viewers cannot change the assignee.",
      ],
      relatedData: ["leads", "users", "activities"],
    },
  ],
};

export const contactsHelpContent: HelpContent = {
  pageId: "contacts",
  pageTitle: "Contacts",
  pageSummary:
    "The Contacts page is used to view people who have been recorded as contacts in the CRM.",
  options: [
    {
      id: "read-contact-list",
      title: "Reading Contacts",
      summary:
        "Use the contact list to view people already known to the sales team.",
      body: [
        "Contacts typically come from converted leads or are created directly.",
        "Each contact can be linked to a company and deals.",
      ],
      steps: [
        "View name, email, phone, title, and company.",
        "Check deal count to understand the contact's level of involvement.",
        "Click a contact to open its details.",
      ],
      relatedData: ["contacts", "companies", "deals"],
    },
    {
      id: "search-contacts",
      title: "Searching for Contacts",
      summary: "Use search to find contacts based on available information.",
      body: [
        "Search can be used with name, email, phone, title, or company.",
        "This helps find a contact without having to scroll through a long list.",
      ],
      steps: [
        "Enter a keyword in the search field.",
        "Match results with the company or contact information.",
        "Open the correct contact's detail page.",
      ],
      tips: ["Use the company name if you can't remember the person's name."],
      relatedData: ["contacts", "companies"],
    },
    {
      id: "create-contact",
      title: "Creating a Contact",
      summary:
        "Create a new contact when a person is relevant enough to be recorded in the CRM.",
      body: [
        "A contact should be created when the prospect's identity and context are sufficiently clear.",
        "Contacts can be linked to a company to make organizational history easier to read.",
      ],
      steps: [
        "Click the action to create a contact.",
        "Fill in key information such as name and contact details.",
        "Link to a company if applicable.",
        "Save the contact.",
      ],
      roleNotes: [
        "Admins, Managers, or Sales reps with appropriate permissions can create contacts.",
        "Viewers can only read data.",
      ],
      relatedData: ["contacts", "companies"],
    },
    {
      id: "company-association",
      title: "Company Association",
      summary:
        "Company association shows the organization linked to a contact.",
      body: [
        "Company association helps the team understand the business context of a contact.",
        "One company can have multiple contacts.",
      ],
      tips: [
        "Check the company before creating a new contact to avoid creating data that is disconnected from the same organization.",
      ],
      relatedData: ["contacts", "companies", "deals"],
    },
    {
      id: "open-contact-detail",
      title: "Opening Details",
      summary:
        "Open a contact's detail page to view the full context of that person.",
      body: [
        "The list page only shows a summary.",
        "The contact detail page shows the company, deals, and activities associated with the contact.",
      ],
      steps: [
        "Find the contact from the list.",
        "Click the contact row.",
        "Use the detail page to view related deals and activities.",
      ],
      relatedData: ["contacts", "companies", "deals", "activities"],
    },
  ],
};

export const contactDetailHelpContent: HelpContent = {
  pageId: "contact-detail",
  pageTitle: "Contact Detail",
  pageSummary:
    "The Contact Detail page displays the complete CRM context for a single contact.",
  options: [
    {
      id: "review-contact-info",
      title: "Contact Info",
      summary:
        "Use the contact information section to view the person's basic data.",
      body: [
        "Contact information helps sales reps reach the right person.",
        "Complete data makes follow-up and activity logging easier.",
      ],
      steps: [
        "Check name, email, phone, and title.",
        "Make sure the information is still current.",
        "Edit if any data needs to be updated.",
      ],
      roleNotes: [
        "Users with edit permission can update contact information.",
        "Viewers can only read information.",
      ],
      relatedData: ["contacts", "users"],
    },
    {
      id: "review-company",
      title: "Associated Company",
      summary:
        "View the linked company to understand the contact's organizational context.",
      body: [
        "The company helps group contacts, leads, and deals within a single organization.",
        "This association is useful so the team doesn't view a contact in isolation from their business context.",
      ],
      steps: [
        "Check the name of the linked company.",
        "Open the company detail if you need to see other contacts or deals within the same organization.",
      ],
      relatedData: ["contacts", "companies"],
    },
    {
      id: "review-contact-deals",
      title: "Related Deals",
      summary:
        "Use the related deals list to see sales opportunities involving this contact.",
      body: [
        "Deals show sales opportunities that are ongoing or have already been processed.",
        "The deal stage helps identify the current position of each opportunity.",
      ],
      steps: [
        "View deals linked to the contact.",
        "Check the value and stage of each deal.",
        "Open a deal's detail page to see a more complete history and activities.",
      ],
      tips: [
        "Prioritize contacts with open deals of high value or a near expected close date.",
      ],
      relatedData: ["contacts", "deals", "activities"],
    },
    {
      id: "review-contact-activities",
      title: "Recent Activities",
      summary:
        "Use recent activities to understand the communication history with this contact.",
      body: [
        "Activities show calls, meetings, tasks, notes, demos, emails, or follow-ups involving the contact.",
        "This history helps avoid repetitive or disconnected follow-ups.",
      ],
      steps: [
        "Read the most recent activities first.",
        "Review the outcome and notes of each activity.",
        "Determine the next step based on that history.",
      ],
      relatedData: ["contacts", "activities", "users"],
    },
    {
      id: "navigate-related-records",
      title: "Related Navigation",
      summary:
        "Use related links to navigate to the company, deal, or user relevant to this contact.",
      body: [
        "Contact detail is a starting point for viewing broader context.",
        "Related links allow navigation without having to search again from a list page.",
      ],
      steps: [
        "Click the company to view the contact's organization.",
        "Click a deal to open the related sales opportunity.",
        "Click a user if you need to see the owner or related activities.",
      ],
      relatedData: ["contacts", "companies", "deals", "users"],
    },
  ],
};

export const companiesHelpContent: HelpContent = {
  pageId: "companies",
  pageTitle: "Companies",
  pageSummary:
    "The Companies page is used to manage organizations linked to leads, contacts, and deals.",
  options: [
    {
      id: "read-company-list",
      title: "Reading Companies",
      summary:
        "Use the company list to view organizations recorded in the CRM.",
      body: [
        "Companies help group people, prospects, and sales opportunities within a single organization.",
        "Contact count and deal count show how much data is linked to a company.",
      ],
      steps: [
        "View name, industry, website, email, or phone.",
        "Check the contact count and deal count.",
        "Click a company to open its details.",
      ],
      relatedData: ["companies", "contacts", "deals"],
    },
    {
      id: "search-companies",
      title: "Searching for Companies",
      summary:
        "Use search to find a company based on organizational information.",
      body: [
        "Search can use name, industry, website, email, or phone.",
        "This is useful for verifying whether a company has already been recorded.",
      ],
      steps: [
        "Enter a keyword in the search field.",
        "Review the results that appear.",
        "Open the matching company or create a new one if it doesn't exist.",
      ],
      tips: [
        "Always search first before creating a new company to avoid duplicate data.",
      ],
      relatedData: ["companies"],
    },
    {
      id: "create-company",
      title: "Creating a Company",
      summary:
        "Create a new company when the organization hasn't been recorded in the CRM yet.",
      body: [
        "A new company should be created when there is a lead, contact, or deal that needs to be linked to that organization.",
        "Well-organized company data helps the team view all business relationships in one place.",
      ],
      steps: [
        "Click the action to create a company.",
        "Fill in key information such as name, industry, website, email, or phone.",
        "Save the company.",
        "Link relevant leads, contacts, or deals if available.",
      ],
      roleNotes: [
        "Users with appropriate permissions can create companies.",
        "Viewers can only read data.",
      ],
      relatedData: ["companies", "contacts", "leads", "deals"],
    },
    {
      id: "review-counts",
      title: "Contacts and Deals",
      summary:
        "Use contact and deal counts to understand activity at a company.",
      body: [
        "Contact count shows the number of people linked to the company.",
        "Deal count shows the number of sales opportunities associated with the company.",
      ],
      tips: [
        "A company with many contacts but few deals may still have untapped opportunities.",
        "A company with many deals should be reviewed to ensure follow-ups don't overlap.",
      ],
      relatedData: ["companies", "contacts", "deals"],
    },
    {
      id: "open-company-detail",
      title: "Opening Details",
      summary: "Open a company's detail page to see all linked records.",
      body: [
        "The list page only shows a company summary.",
        "The company detail page shows the contacts, leads, and deals under that organization.",
      ],
      steps: [
        "Find the company from the list.",
        "Click the company row.",
        "Use the detail page to view its full relationships.",
      ],
      relatedData: ["companies", "contacts", "leads", "deals"],
    },
  ],
};

export const companyDetailHelpContent: HelpContent = {
  pageId: "company-detail",
  pageTitle: "Company Detail",
  pageSummary:
    "The Company Detail page displays the company profile and all linked CRM records.",
  options: [
    {
      id: "review-company-profile",
      title: "Company Profile",
      summary:
        "Use the company profile to understand the organization's basic information.",
      body: [
        "The company profile contains information such as name, industry, website, email, or phone.",
        "This information helps the team understand the organization's context before following up.",
      ],
      steps: [
        "Review the company's key information.",
        "Make sure contact details and the website are still current.",
        "Edit the data if any information needs to be updated.",
      ],
      roleNotes: [
        "Users with edit permission can update company information.",
        "Viewers can only read data.",
      ],
      relatedData: ["companies"],
    },
    {
      id: "review-company-contacts",
      title: "Company Contacts",
      summary: "View the contact list to see people linked to this company.",
      body: [
        "Contacts help identify who can be reached within the organization.",
        "Multiple contacts within the same company may have different roles or follow-up contexts.",
      ],
      steps: [
        "Open the contacts section.",
        "Check name, title, and contact information.",
        "Click a contact to open that person's detail page.",
      ],
      relatedData: ["companies", "contacts"],
    },
    {
      id: "review-company-leads",
      title: "Company Leads",
      summary: "View leads still in the prospecting process for this company.",
      body: [
        "Leads show prospects that have not yet become contacts or deals.",
        "This section helps you see whether there are still prospects from this company that need to be processed.",
      ],
      steps: [
        "Open the leads section.",
        "Check the status of each lead.",
        "Open a lead's detail page if follow-up or conversion is needed.",
      ],
      tips: [
        "Be careful with leads that resemble existing contacts to avoid duplicating work.",
      ],
      relatedData: ["companies", "leads", "contacts"],
    },
    {
      id: "review-company-deals",
      title: "Company Deals",
      summary:
        "Use the deals list to see sales opportunities linked to this company.",
      body: [
        "Deals show opportunities that are ongoing or have already been closed.",
        "Stage and value help assess follow-up priority.",
      ],
      steps: [
        "Open the deals section.",
        "Check the stage, value, and owner.",
        "Click a deal to view its details and activities.",
      ],
      tips: [
        "Companies with multiple open deals need coordination to ensure sales approaches don't conflict with each other.",
      ],
      relatedData: ["companies", "deals", "users"],
    },
    {
      id: "navigate-company-records",
      title: "Record Navigation",
      summary:
        "Use related links to navigate to contacts, leads, or deals from this company.",
      body: [
        "Company detail serves as the central hub for organizational context.",
        "From this page, users can navigate to related records without searching again.",
      ],
      steps: [
        "Click a contact to view information about the related person.",
        "Click a lead to process a prospect.",
        "Click a deal to view the sales opportunity.",
      ],
      relatedData: ["companies", "contacts", "leads", "deals"],
    },
  ],
};

export const dealsHelpContent: HelpContent = {
  pageId: "deals",
  pageTitle: "Deals",
  pageSummary:
    "The Deals page is used to manage active and closed sales opportunities across the CRM.",
  options: [
    {
      id: "read-deal-list",
      title: "Read Deals",
      summary:
        "Use the deal list to review opportunities, owners, stages, and estimated value.",
      body: [
        "Each row represents one sales opportunity.",
        "The stage shows where the deal currently sits in the sales process.",
        "The value helps estimate the potential revenue or opportunity size.",
      ],
      steps: [
        "Review the deal title, company, contact, owner, stage, and value.",
        "Check whether the deal is still open or already closed.",
        "Open the deal detail page for deeper context.",
      ],
      tips: [
        "Do not judge the pipeline only by total value. A large deal in an early stage is still uncertain.",
      ],
      relatedData: ["deals", "contacts", "companies", "users"],
    },
    {
      id: "switch-view",
      title: "List or Pipeline",
      summary:
        "Use the available view mode to inspect deals either as a table or by pipeline stage.",
      body: [
        "The list view is useful for scanning many deals quickly.",
        "The pipeline or kanban view is useful for understanding stage distribution.",
      ],
      steps: [
        "Use list view when searching or comparing deal details.",
        "Use pipeline view when reviewing stage movement.",
        "Open a deal from either view to inspect its full detail.",
      ],
      tips: [
        "If many deals are stuck in one stage, that stage may need attention.",
      ],
      relatedData: ["deals", "stage_history"],
    },
    {
      id: "create-deal",
      title: "Create Deal",
      summary:
        "Create a deal when there is a clear sales opportunity tied to a contact or company.",
      body: [
        "A deal should represent a real opportunity, not just a general lead.",
        "Deal value and expected close date help the team prioritize work.",
      ],
      steps: [
        "Start a new deal from the available action.",
        "Enter the title, value, contact, company, owner, and expected close date.",
        "Choose the starting stage.",
        "Save the deal so it appears in the pipeline.",
      ],
      roleNotes: [
        "Users with edit permission can create deals.",
        "Viewer can only inspect existing deals.",
      ],
      relatedData: ["deals", "contacts", "companies", "users"],
    },
    {
      id: "move-stage",
      title: "Move Stage",
      summary:
        "Move a deal through stages as the opportunity progresses or changes direction.",
      body: [
        "Stages represent the deal journey from lead to closed result.",
        "Stage changes should reflect real progress, such as a proposal sent or negotiation started.",
      ],
      steps: [
        "Select the deal that needs updating.",
        "Move it to the stage that matches the current situation.",
        "Check the deal detail if you need to review previous activity before changing the stage.",
      ],
      tips: [
        "Avoid moving deals forward without supporting activity or customer response.",
      ],
      relatedData: ["deals", "stage_history", "activities"],
    },
    {
      id: "close-lost",
      title: "Close Lost",
      summary:
        "Use Closed Lost when the opportunity is no longer moving forward.",
      body: [
        "Closed Lost records that the deal did not succeed.",
        "A lost reason is required so the team can understand why the opportunity was lost.",
      ],
      steps: [
        "Move the deal to CLOSED_LOST.",
        "Enter the lost reason.",
        "Save the update so the pipeline reflects the actual result.",
      ],
      tips: [
        "Use a clear lost reason. Vague notes make future analysis less useful.",
      ],
      relatedData: ["deals", "stage_history"],
    },
    {
      id: "review-totals",
      title: "Review Totals",
      summary:
        "Use stage totals and pipeline value to understand the current sales position.",
      body: [
        "Stage totals show how many deals are in each stage.",
        "Pipeline value shows the estimated value of open opportunities.",
        "Closed won and closed lost deals help measure outcomes.",
      ],
      tips: [
        "A healthy pipeline usually has movement across stages, not just many deals stuck at the beginning.",
      ],
      relatedData: ["deals", "stage_history"],
    },
  ],
};

export const dealDetailHelpContent: HelpContent = {
  pageId: "deal-detail",
  pageTitle: "Deal Detail",
  pageSummary:
    "The Deal Detail page is used to work on one opportunity from qualification to close.",
  options: [
    {
      id: "review-deal-info",
      title: "Deal Info",
      summary:
        "Use the deal information section to understand the opportunity and its current state.",
      body: [
        "The deal title, value, expected close date, and stage describe the opportunity.",
        "The contact, company, and owner show who is involved and who is responsible.",
      ],
      steps: [
        "Review the deal value and expected close date.",
        "Check the current stage.",
        "Open related contact or company records if more context is needed.",
      ],
      relatedData: ["deals", "contacts", "companies", "users"],
    },
    {
      id: "edit-deal",
      title: "Edit Deal",
      summary: "Update deal fields when the opportunity details change.",
      body: [
        "Deal information should stay accurate as conversations progress.",
        "Changing value or expected close date helps keep the pipeline realistic.",
      ],
      steps: [
        "Edit the title, value, expected close date, or stage if allowed.",
        "Confirm that the update reflects the latest customer situation.",
        "Save the changes.",
      ],
      roleNotes: [
        "Users with edit permission can update deal fields.",
        "Viewer can only read deal information.",
      ],
      relatedData: ["deals", "users"],
    },
    {
      id: "change-stage",
      title: "Change Stage",
      summary:
        "Move the deal forward or backward when the opportunity changes stage.",
      body: [
        "Stage movement helps the team understand sales progress.",
        "A deal can move backward if the opportunity becomes less certain.",
      ],
      steps: [
        "Review recent activity before changing the stage.",
        "Choose the stage that best matches the current situation.",
        "Save the stage update.",
      ],
      tips: ["Stage changes should be based on actual progress, not optimism."],
      roleNotes: [
        "Stage movement depends on role permissions.",
        "Manager or Admin may have broader control over stage updates.",
      ],
      relatedData: ["deals", "stage_history", "activities"],
    },
    {
      id: "assign-owner",
      title: "Assign Owner",
      summary:
        "Assign or update the deal owner when responsibility needs to change.",
      body: [
        "The owner is the user responsible for progressing the deal.",
        "Clear ownership helps avoid missed follow-ups or duplicate work.",
      ],
      steps: [
        "Check the current owner.",
        "Select the new owner if reassignment is needed.",
        "Make sure the new owner understands the deal context.",
      ],
      roleNotes: [
        "Manager and Admin can assign deal ownership.",
        "Sales users may have limited ownership controls.",
        "Viewer cannot change ownership.",
      ],
      relatedData: ["deals", "users", "activities"],
    },
    {
      id: "add-deal-activity",
      title: "Add Activity",
      summary:
        "Log activities so the deal history shows what has happened and what should happen next.",
      body: [
        "Activities can include calls, emails, meetings, tasks, notes, demos, or follow-ups.",
        "A clear activity history makes handover and review easier.",
      ],
      steps: [
        "Choose the activity type.",
        "Add the result, date, and notes.",
        "Save the activity so it appears in the deal timeline.",
      ],
      tips: [
        "After important calls, record the outcome immediately while the context is fresh.",
      ],
      relatedData: ["activities", "deals", "contacts", "users"],
    },
    {
      id: "review-stage-history",
      title: "Stage History",
      summary:
        "Use stage history to understand how the deal moved through the pipeline.",
      body: [
        "Stage history records previous stage changes.",
        "This helps explain why a deal progressed, stalled, or closed.",
      ],
      steps: [
        "Review the stage timeline.",
        "Check when the deal changed stages.",
        "Compare stage changes with related activities.",
      ],
      relatedData: ["deals", "stage_history", "activities"],
    },
    {
      id: "lost-reason",
      title: "Lost Reason",
      summary: "Enter a lost reason when closing a deal as lost.",
      body: [
        "Closed lost deals require a reason.",
        "The reason helps the team learn why opportunities fail.",
      ],
      steps: [
        "Move the deal to CLOSED_LOST.",
        "Enter a clear lost reason.",
        "Save the update.",
      ],
      tips: [
        "Useful lost reasons are specific, such as no budget, not interested, wrong timing, or chose another offer.",
      ],
      relatedData: ["deals", "stage_history"],
    },
  ],
};

export const activitiesHelpContent: HelpContent = {
  pageId: "activities",
  pageTitle: "Activities",
  pageSummary:
    "The Activities page is used to track work logs, scheduled tasks, and follow-ups across the CRM.",
  options: [
    {
      id: "read-activity-list",
      title: "Read Activities",
      summary:
        "Use the activity list to review work that has been done or scheduled.",
      body: [
        "Each activity represents a CRM action such as a call, email, meeting, task, note, demo, or follow-up.",
        "The result shows the outcome of the activity.",
        "The date helps identify recent work and upcoming tasks.",
      ],
      steps: [
        "Review the subject, type, result, assigned user, and date.",
        "Check the related lead, contact, or deal.",
        "Open the activity detail for full information.",
      ],
      relatedData: ["activities", "contacts", "deals", "leads", "users"],
    },
    {
      id: "filter-activities",
      title: "Filter Activities",
      summary: "Use filters and search to find specific activity records.",
      body: [
        "Filtering by type helps separate calls, meetings, tasks, notes, demos, emails, and follow-ups.",
        "Filtering by result helps identify completed work, failed attempts, no answers, or follow-up needs.",
      ],
      steps: [
        "Enter search text if looking for a specific subject or note.",
        "Select an activity type or result filter.",
        "Open the matching activity for more detail.",
      ],
      tips: [
        "Use result filters to quickly find follow-ups that still need action.",
      ],
      relatedData: ["activities", "users"],
    },
    {
      id: "review-related-entity",
      title: "Related Record",
      summary:
        "Use the related record to understand what the activity is connected to.",
      body: [
        "An activity can be tied to a lead, contact, or deal.",
        "This connection explains why the activity was created and what business context it belongs to.",
      ],
      steps: [
        "Check the related entity shown in the activity row.",
        "Open the activity detail if the relationship is unclear.",
        "Navigate to the related lead, contact, or deal when needed.",
      ],
      relatedData: ["activities", "leads", "contacts", "deals"],
    },
    {
      id: "audit-recent-work",
      title: "Audit Work",
      summary: "Use activities to review what the team has recently done.",
      body: [
        "Activities provide a practical history of CRM work.",
        "Managers can use this page to understand follow-up quality and sales effort.",
      ],
      steps: [
        "Sort or filter recent activities.",
        "Check activity results and notes.",
        "Open important records to review the full context.",
      ],
      roleNotes: [
        "Manager and Admin can use activities for team oversight.",
        "Sales users use activities to track their own work and next steps.",
        "Viewer can inspect available activity records without editing them.",
      ],
      relatedData: ["activities", "users", "deals"],
    },
    {
      id: "pending-followups",
      title: "Pending Follow-ups",
      summary:
        "Use the activity list to find scheduled work that still needs attention.",
      body: [
        "Follow-up activities help keep prospects and deals from being forgotten.",
        "Pending or upcoming activities should be reviewed regularly.",
      ],
      steps: [
        "Filter or scan for follow-up and task activities.",
        "Check the scheduled date.",
        "Open the related record before taking action.",
      ],
      tips: [
        "Overdue follow-ups should be handled before starting lower-priority new work.",
      ],
      relatedData: ["activities", "leads", "contacts", "deals"],
    },
  ],
};

export const activityDetailHelpContent: HelpContent = {
  pageId: "activity-detail",
  pageTitle: "Activity Detail",
  pageSummary:
    "The Activity Detail page is used to inspect, complete, and discuss a single CRM activity.",
  options: [
    {
      id: "review-activity-info",
      title: "Activity Info",
      summary:
        "Use the activity details to understand what happened or what is scheduled.",
      body: [
        "The type explains what kind of work the activity represents.",
        "The result shows the outcome.",
        "Scheduled and completed dates help distinguish planned work from finished work.",
      ],
      steps: [
        "Review the activity type and subject.",
        "Check the result, scheduled date, completed date, duration, and description.",
        "Use the related record link for more CRM context.",
      ],
      relatedData: ["activities", "users", "deals", "contacts", "leads"],
    },
    {
      id: "review-call-metadata",
      title: "Call Details",
      summary:
        "Review call metadata when the activity was created from a calling workflow.",
      body: [
        "Call activities may include duration, prospect value, meeting schedule, or follow-up schedule.",
        "These details explain the outcome of the call more clearly than the result alone.",
      ],
      steps: [
        "Check the call result.",
        "Review prospect value if it was entered.",
        "Review meeting or follow-up schedule if available.",
      ],
      tips: [
        "A call marked as completed is more useful when the notes explain what was discussed.",
      ],
      relatedData: ["activities", "deals", "leads", "contacts"],
    },
    {
      id: "complete-activity",
      title: "Complete Activity",
      summary: "Complete a pending activity when the work has been done.",
      body: [
        "Completing an activity records the result of the work.",
        "The selected result should match what actually happened.",
      ],
      steps: [
        "Review the activity before completing it.",
        "Choose the correct result.",
        "Add notes if context is needed.",
        "Save the completion.",
      ],
      roleNotes: [
        "Users with permission can complete activities.",
        "Viewer cannot complete or update activities.",
      ],
      relatedData: ["activities", "users"],
    },
    {
      id: "manage-comments",
      title: "Manage Comments",
      summary:
        "Use comments to discuss context, corrections, or follow-up notes on the activity.",
      body: [
        "Comments help users add extra context without changing the main activity record.",
        "Comment permissions may depend on ownership and role.",
      ],
      steps: [
        "Read existing comments before adding a new one.",
        "Add a clear comment if more context is needed.",
        "Edit or delete comments only when allowed.",
      ],
      roleNotes: [
        "Comment editing or deletion may depend on ownership and permission.",
        "Viewer may only be able to read comments.",
      ],
      relatedData: ["comments", "activities", "users"],
    },
    {
      id: "navigate-related-record",
      title: "Open Related",
      summary:
        "Use related links to move from the activity to the lead, contact, or deal it belongs to.",
      body: [
        "The activity detail only explains one piece of work.",
        "The related record gives the larger sales context.",
      ],
      steps: [
        "Check whether the activity is linked to a lead, contact, or deal.",
        "Open the related record.",
        "Review the timeline or deal context before taking the next step.",
      ],
      relatedData: ["activities", "leads", "contacts", "deals"],
    },
  ],
};

export const calendarHelpContent: HelpContent = {
  pageId: "calendar",
  pageTitle: "Calendar",
  pageSummary:
    "The Calendar page is used to view and create scheduled meetings, tasks, and follow-ups.",
  options: [
    {
      id: "review-schedule",
      title: "Review Schedule",
      summary: "Use the calendar to see scheduled CRM activities by date.",
      body: [
        "The calendar helps users plan meetings, tasks, and follow-ups.",
        "Scheduled activities give visibility into what needs to happen next.",
      ],
      steps: [
        "Select the date or time period you want to review.",
        "Check the activities scheduled for that date.",
        "Open an activity if you need more detail.",
      ],
      tips: [
        "Review upcoming activities before starting outreach so important follow-ups are not missed.",
      ],
      relatedData: ["activities", "users", "deals", "leads", "contacts"],
    },
    {
      id: "create-scheduled-activity",
      title: "Schedule Activity",
      summary:
        "Create a scheduled activity when work needs to happen at a specific time.",
      body: [
        "Scheduled activities can represent meetings, tasks, or follow-ups.",
        "A clear subject and related record make the schedule easier to understand later.",
      ],
      steps: [
        "Start a new scheduled activity.",
        "Choose the type, assignee, subject, related record, and date.",
        "Save the activity so it appears on the calendar.",
      ],
      roleNotes: [
        "Users with permission can create scheduled activities.",
        "Viewer can only review available calendar items.",
      ],
      relatedData: ["activities", "users", "deals", "leads", "contacts"],
    },
    {
      id: "choose-related-record",
      title: "Link Record",
      summary:
        "Connect a scheduled activity to the correct lead, contact, or deal.",
      body: [
        "The related record explains why the activity exists.",
        "Linking the activity prevents scheduled work from becoming disconnected from the sales context.",
      ],
      steps: [
        "Choose whether the activity relates to a lead, contact, or deal.",
        "Select the correct record.",
        "Confirm that the subject and schedule match the intended follow-up.",
      ],
      tips: [
        "If the activity is about an open opportunity, link it to the deal rather than leaving it generic.",
      ],
      relatedData: ["activities", "leads", "contacts", "deals"],
    },
    {
      id: "plan-followup",
      title: "Plan Follow-up",
      summary: "Use the calendar to plan next actions after call outcomes.",
      body: [
        "Call outcomes such as NO_ANSWER or FOLLOW_UP_NEEDED may require future follow-up.",
        "Scheduling the next action keeps the lead or deal from being forgotten.",
      ],
      steps: [
        "Review the call outcome.",
        "Choose an appropriate follow-up date.",
        "Create or confirm the scheduled follow-up activity.",
      ],
      tips: [
        "A follow-up should include enough context so the next user knows why it was scheduled.",
      ],
      relatedData: ["activities", "call_sessions", "leads", "deals"],
    },
    {
      id: "manage-workload",
      title: "Manage Workload",
      summary:
        "Use the calendar to understand how much scheduled work is assigned to each user.",
      body: [
        "A crowded calendar can indicate too many follow-ups or meetings assigned to one person.",
        "A light calendar may indicate available capacity or missing scheduled next steps.",
      ],
      steps: [
        "Review scheduled activities by date.",
        "Check the assignee for each activity.",
        "Adjust future planning if one user has too much scheduled work.",
      ],
      roleNotes: [
        "Manager and Admin can use the calendar to review team workload.",
        "Sales users use it to manage their own upcoming work.",
        "Viewer can inspect the schedule without making changes.",
      ],
      relatedData: ["activities", "users"],
    },
  ],
};

export const campaignsHelpContent: HelpContent = {
  pageId: "campaigns",
  pageTitle: "Campaigns",
  pageSummary:
    "The Campaigns page is used to manage outreach programs, fictional stock products, bundles, and campaign performance.",
  options: [
    {
      id: "manage-campaigns",
      title: "Manage Campaigns",
      summary:
        "Use the Campaigns tab to review and manage calling or outreach programs.",
      body: [
        "A campaign defines what the sales team is offering and who the outreach is focused on.",
        "Campaign status helps show whether the campaign is active, paused, or completed.",
        "The script gives sales users guidance when making calls.",
      ],
      steps: [
        "Open the Campaigns tab.",
        "Review campaign status, target count, date range, script, and offer type.",
        "Create or update a campaign if your role allows it.",
        "Open a campaign detail page to inspect its performance and activity.",
      ],
      roleNotes: [
        "Manager and Admin can create or update campaigns.",
        "Sales users use active campaigns during calling work.",
        "Viewer can review campaign information without changing it.",
      ],
      relatedData: ["campaigns", "products", "bundles", "users"],
    },
    {
      id: "review-products",
      title: "Review Products",
      summary:
        "Use the Products tab to understand the fictional stock products available for campaigns.",
      body: [
        "Each product has a ticker, category, risk score, annual return, market cap, and active status.",
        "Product information helps users understand what is being offered in a campaign.",
        "Inactive products should not be treated as current campaign offers.",
      ],
      steps: [
        "Open the Products tab.",
        "Review ticker, category, risk score, annual return, market cap, and active status.",
        "Open product detail if you need campaign performance or bundle usage.",
      ],
      tips: [
        "Risk score is useful context, but it should not be treated as a real investment recommendation.",
      ],
      roleNotes: [
        "Manager and Admin can create or update products.",
        "Sales and Viewer users can review product information.",
      ],
      relatedData: ["products", "campaigns", "bundles"],
    },
    {
      id: "review-bundles",
      title: "Review Bundles",
      summary:
        "Use the Bundles tab to understand portfolio-style offers made from multiple products.",
      body: [
        "A bundle groups multiple fictional stock products into one offer.",
        "Allocations show how much of the bundle is assigned to each product.",
        "The bundle risk score summarizes the overall risk profile.",
      ],
      steps: [
        "Open the Bundles tab.",
        "Review component tickers, allocation percentages, risk score, and active status.",
        "Open bundle detail to inspect allocation and related campaigns.",
      ],
      tips: [
        "A bundle with several products may still be high risk if its allocation is concentrated in high-risk products.",
      ],
      roleNotes: [
        "Manager and Admin can create or update bundles.",
        "Sales and Viewer users can review bundle information.",
      ],
      relatedData: ["bundles", "products", "campaigns"],
    },
    {
      id: "analyze-performance",
      title: "Analyze Performance",
      summary:
        "Use the Performance tab to compare campaign results across calls, pickups, and conversions.",
      body: [
        "Total calls show outreach volume.",
        "Pickups show how many calls reached a prospect.",
        "Conversions show how many opportunities moved into a successful outcome.",
        "Conversion rate compares conversions against the relevant campaign activity.",
      ],
      steps: [
        "Open the Performance tab.",
        "Review total calls, pickups, conversions, and conversion rate.",
        "Compare funnel, outcome, campaign conversion, and product offer breakdown charts.",
        "Use the results to identify which campaign or offer performs better.",
      ],
      tips: [
        "Do not overvalue a high conversion rate if the campaign has very few calls.",
        "Compare campaigns with similar call volume when possible.",
      ],
      relatedData: ["campaigns", "activities", "deals", "products", "bundles"],
    },
    {
      id: "understand-offers",
      title: "Offer Types",
      summary:
        "Use campaign type to understand whether a campaign offers a product, bundle, or mixed set of items.",
      body: [
        "PRODUCT campaigns focus on one fictional stock product.",
        "BUNDLE campaigns focus on one portfolio bundle.",
        "MIXED campaigns can include multiple offer items.",
      ],
      steps: [
        "Check the campaign type.",
        "Review the product, bundle, or offer items attached to the campaign.",
        "Open related product or bundle details if more context is needed.",
      ],
      tips: [
        "Mixed campaigns can be harder to analyze because performance may come from different offer items.",
      ],
      relatedData: ["campaigns", "products", "bundles"],
    },
    {
      id: "use-campaign-data",
      title: "Use Results",
      summary:
        "Use campaign data to decide what should be continued, paused, or reviewed.",
      body: [
        "Campaign performance helps managers understand whether outreach is producing useful results.",
        "Sales users can use campaign context to prepare better calls.",
        "Low pickup or conversion rates may indicate weak targeting, offer mismatch, or poor timing.",
      ],
      steps: [
        "Compare campaigns by calls, pickups, conversions, and conversion rate.",
        "Review offer breakdown to see which products or bundles are involved.",
        "Inspect campaign detail before making decisions based on summary numbers.",
      ],
      roleNotes: [
        "Manager and Admin use campaign results for oversight and campaign planning.",
        "Sales users use campaign context during call execution.",
        "Viewer can review results without changing campaign setup.",
      ],
      relatedData: ["campaigns", "activities", "deals", "users"],
    },
  ],
};

export const campaignDetailHelpContent: HelpContent = {
  pageId: "campaign-detail",
  pageTitle: "Campaign Detail",
  pageSummary:
    "The Campaign Detail page is used to inspect one campaign's offer, call activity, and performance.",
  options: [
    {
      id: "review-campaign-info",
      title: "Campaign Info",
      summary:
        "Use campaign information to understand the purpose, timing, status, and script of the campaign.",
      body: [
        "The status shows whether the campaign is active, paused, or completed.",
        "The target count and date range explain the campaign scope.",
        "The script gives sales users a reference during calls.",
      ],
      steps: [
        "Review campaign status, target count, and date range.",
        "Read the campaign script.",
        "Check whether the campaign is still active before using it for calls.",
      ],
      relatedData: ["campaigns", "users"],
    },
    {
      id: "review-offer",
      title: "Review Offer",
      summary:
        "Use the offer section to understand what the campaign is selling.",
      body: [
        "A campaign can offer a fictional stock product, a bundle, or mixed offer items.",
        "Offer details help sales users explain the campaign consistently.",
        "Related product or bundle links provide deeper context.",
      ],
      steps: [
        "Check whether the campaign offer is a product, bundle, or mixed offer.",
        "Review the offered item name and basic information.",
        "Open the related product or bundle detail if needed.",
      ],
      tips: [
        "Do not explain the offer from memory if the campaign detail provides a specific script or product context.",
      ],
      relatedData: ["campaigns", "products", "bundles"],
    },
    {
      id: "read-performance",
      title: "Read Performance",
      summary:
        "Use the performance metrics to evaluate how the campaign is doing.",
      body: [
        "Calls show outreach volume.",
        "Pickups show successful call connections.",
        "Conversions show campaign outcomes that moved forward.",
        "Rates help compare performance across campaigns.",
      ],
      steps: [
        "Review calls, pickups, conversions, and rates.",
        "Compare the numbers against the campaign target count.",
        "Check recent activity before drawing conclusions.",
      ],
      tips: [
        "A campaign with low calls may not have enough data for a reliable conclusion.",
      ],
      relatedData: ["campaigns", "activities", "deals"],
    },
    {
      id: "review-activity",
      title: "Recent Activity",
      summary:
        "Use recent campaign activity to understand what happened during outreach.",
      body: [
        "Campaign activity shows call outcomes and related CRM work.",
        "Recent activity helps explain why performance numbers changed.",
      ],
      steps: [
        "Review the latest campaign activities.",
        "Check call results such as completed, no answer, follow-up needed, or failed.",
        "Open activity detail if you need notes or call metadata.",
      ],
      relatedData: ["campaigns", "activities", "leads", "contacts", "users"],
    },
    {
      id: "navigate-related",
      title: "Open Related",
      summary:
        "Use related links to move from the campaign to products, bundles, or activity records.",
      body: [
        "Campaign detail gives the campaign-level view.",
        "Product, bundle, and activity records provide more specific context.",
      ],
      steps: [
        "Open the related product or bundle to understand the offer.",
        "Open activity records to inspect call outcomes.",
        "Return to campaign detail to compare the activity with overall performance.",
      ],
      relatedData: ["campaigns", "products", "bundles", "activities"],
    },
  ],
};

export const productDetailHelpContent: HelpContent = {
  pageId: "product-detail",
  pageTitle: "Product Detail",
  pageSummary:
    "The Product Detail page explains one fictional stock product and how it performs in campaigns.",
  options: [
    {
      id: "review-product-info",
      title: "Product Info",
      summary:
        "Use product information to understand the fictional stock product being offered.",
      body: [
        "The ticker identifies the product.",
        "Category describes the product type.",
        "Risk score, annual return, and market cap provide sales context.",
        "Active status shows whether the product is currently available for use.",
      ],
      steps: [
        "Review ticker, category, risk score, annual return, market cap, and active status.",
        "Read the product description.",
        "Check whether the product is active before treating it as a current offer.",
      ],
      tips: [
        "These are fictional stock products in a prototype, not real investment data.",
      ],
      relatedData: ["products"],
    },
    {
      id: "understand-risk-return",
      title: "Risk and Return",
      summary:
        "Use risk score and annual return as quick indicators of product positioning.",
      body: [
        "Risk score helps describe how risky the product appears in the prototype.",
        "Annual return gives a simplified performance figure.",
        "Market cap gives additional context about the fictional product profile.",
      ],
      steps: [
        "Compare risk score with annual return.",
        "Check the product category for context.",
        "Use the description if the numbers alone are not enough.",
      ],
      tips: [
        "Higher annual return should not be read as automatically better. Risk matters too.",
      ],
      relatedData: ["products"],
    },
    {
      id: "review-bundle-usage",
      title: "Bundle Usage",
      summary:
        "Use bundle usage to see which portfolio bundles include this product.",
      body: [
        "A product can be part of one or more bundles.",
        "Bundle context helps explain how the product is packaged with other products.",
      ],
      steps: [
        "Review the bundles that include this product.",
        "Check allocation if available from the bundle detail.",
        "Open the related bundle to understand the full portfolio.",
      ],
      relatedData: ["products", "bundles"],
    },
    {
      id: "read-product-performance",
      title: "Product Performance",
      summary:
        "Use product performance to understand how this product performs in campaign activity.",
      body: [
        "Calls made show how often the product was involved in outreach.",
        "Conversion rate shows how often outreach led to a successful outcome.",
        "Performance by campaign helps compare where the product works better.",
      ],
      steps: [
        "Review calls made and conversion rate.",
        "Check performance by campaign.",
        "Compare campaigns before assuming the product itself is the main cause.",
      ],
      tips: [
        "A weak conversion rate may come from poor targeting or low call volume, not only from the product.",
      ],
      relatedData: ["products", "campaigns", "activities", "deals"],
    },
    {
      id: "navigate-product-context",
      title: "Open Related",
      summary:
        "Use related links to move from the product to bundles and campaigns.",
      body: [
        "Product detail explains one item.",
        "Bundles show how the product is packaged.",
        "Campaigns show how the product is used in outreach.",
      ],
      steps: [
        "Open related bundles to understand portfolio usage.",
        "Open related campaigns to inspect campaign performance.",
        "Return to product detail to compare overall product context.",
      ],
      relatedData: ["products", "bundles", "campaigns"],
    },
  ],
};

export const bundleDetailHelpContent: HelpContent = {
  pageId: "bundle-detail",
  pageTitle: "Bundle Detail",
  pageSummary:
    "The Bundle Detail page explains one stock bundle, its product allocation, and its campaign performance.",
  options: [
    {
      id: "review-bundle-info",
      title: "Bundle Info",
      summary:
        "Use bundle information to understand the bundle status, size, risk, and performance snapshot.",
      body: [
        "Status shows whether the bundle is currently active.",
        "Product count shows how many products are included.",
        "Risk score summarizes the overall bundle profile.",
        "Calls made and conversion rate show how the bundle performs in outreach.",
      ],
      steps: [
        "Review status, product count, risk score, calls made, and conversion rate.",
        "Check whether the bundle is active.",
        "Use campaign data to understand how the bundle is being used.",
      ],
      tips: [
        "A bundle with high conversion rate but very few calls may still need more data before judging performance.",
      ],
      relatedData: ["bundles", "products", "campaigns", "activities", "deals"],
    },
    {
      id: "understand-allocation",
      title: "Portfolio Allocation",
      summary:
        "Use allocation details to understand how the bundle is distributed across products.",
      body: [
        "Each component product has a ticker and allocation percentage.",
        "Allocation shows how much weight each product has inside the bundle.",
        "A concentrated allocation means one product may heavily influence the bundle profile.",
      ],
      steps: [
        "Review each product ticker in the bundle.",
        "Check the allocation percentage for each product.",
        "Open component product details if more context is needed.",
      ],
      tips: [
        "Do not judge a bundle only by product count. Allocation matters more than the number of components.",
      ],
      relatedData: ["bundles", "products"],
    },
    {
      id: "review-pickup-rate",
      title: "Pickup Rate",
      summary:
        "Use pickup rate to understand how often campaign calls for this bundle reach prospects.",
      body: [
        "Pickup rate compares successful call connections against attempted calls.",
        "It helps show whether campaign outreach is reaching people.",
        "A low pickup rate may reflect timing, lead quality, or contact availability.",
      ],
      steps: [
        "Review calls made and pickups if shown.",
        "Compare pickup rate across campaigns using the bundle.",
        "Inspect related activities to understand call outcomes.",
      ],
      tips: [
        "Low pickup rate is not the same as low product interest. The prospect may simply not have answered.",
      ],
      relatedData: ["bundles", "campaigns", "activities"],
    },
    {
      id: "review-campaigns",
      title: "Related Campaigns",
      summary:
        "Use related campaigns to see where this bundle is being offered.",
      body: [
        "Campaigns show how the bundle is used in outreach.",
        "Performance may differ between campaigns depending on target audience, timing, and call volume.",
      ],
      steps: [
        "Review campaigns using this bundle.",
        "Compare calls, pickups, conversions, and rates when available.",
        "Open campaign detail for deeper performance context.",
      ],
      tips: [
        "If one campaign performs poorly, check campaign setup and activity history before blaming the bundle.",
      ],
      relatedData: ["bundles", "campaigns", "activities", "deals"],
    },
    {
      id: "navigate-products",
      title: "Open Products",
      summary:
        "Use component product links to inspect the products inside the bundle.",
      body: [
        "Bundle detail explains the portfolio as a whole.",
        "Product detail explains each component product individually.",
      ],
      steps: [
        "Select a component product from the allocation list.",
        "Open the product detail page.",
        "Review product risk, annual return, category, and campaign performance.",
      ],
      relatedData: ["bundles", "products", "campaigns"],
    },
  ],
};

export const loginHelpContent: HelpContent = {
  pageId: "login",
  pageTitle: "Login",
  pageSummary:
    "The Login page lets a demo user choose an account and role to enter the CRM prototype.",
  options: [
    {
      id: "choose-demo-account",
      title: "Choose Account",
      summary:
        "Select one of the available demo accounts to enter the prototype.",
      body: [
        "Each demo account represents a different CRM role.",
        "The selected account determines what pages and actions are available after login.",
      ],
      steps: [
        "Review the available demo accounts.",
        "Choose the account that matches the role you want to test.",
        "Continue into the main app.",
      ],
      relatedData: ["users"],
    },
    {
      id: "understand-roles",
      title: "Understand Roles",
      summary:
        "Use role information to understand what the selected demo user can do.",
      body: [
        "Admin has the widest access, including management and audit areas.",
        "Manager focuses on team oversight, assignment, campaigns, products, and bundles.",
        "Sales works with assigned leads, calls, activities, and deals.",
        "Viewer has limited read-only access.",
      ],
      tips: [
        "Choose different roles when testing access control or permission behavior.",
      ],
      relatedData: ["users"],
    },
    {
      id: "enter-main-app",
      title: "Enter App",
      summary:
        "After choosing an account, the user enters the main CRM experience.",
      body: [
        "The app opens with the permissions of the selected demo account.",
        "Some pages or actions may be hidden or blocked depending on the selected role.",
      ],
      steps: [
        "Select a seeded demo account.",
        "Enter the app.",
        "Use the navigation menu to explore pages available for that role.",
      ],
      relatedData: ["users"],
    },
    {
      id: "test-permissions",
      title: "Test Access",
      summary:
        "Use the login page to switch roles and compare access differences.",
      body: [
        "Different roles are useful for testing how the CRM behaves for different users.",
        "If a page is blocked, the selected role likely does not have permission to access it.",
      ],
      tips: [
        "Use Admin or Manager when testing management workflows.",
        "Use Sales when testing personal sales work.",
        "Use Viewer when testing read-only behavior.",
      ],
      relatedData: ["users", "roles"],
    },
  ],
};

export const teamHelpContent: HelpContent = {
  pageId: "team",
  pageTitle: "Team",
  pageSummary:
    "The Team page is used by Admin and Manager users to review team members and compare activity or deal performance.",
  options: [
    {
      id: "read-team-list",
      title: "Read Team",
      summary:
        "Use the team list to review non-viewer team members and their sales activity.",
      body: [
        "Each row represents a team member who can own sales work.",
        "The list helps managers understand who is active and how work is distributed.",
      ],
      steps: [
        "Review each team member in the list.",
        "Compare available performance indicators.",
        "Open a team member profile to inspect individual performance.",
      ],
      roleNotes: [
        "Only Admin and Manager can access the team list.",
        "Sales users cannot access the full team list.",
      ],
      relatedData: ["users", "activities", "deals"],
    },
    {
      id: "compare-performance",
      title: "Compare Performance",
      summary:
        "Use team metrics to compare activity volume, deal progress, and calling performance.",
      body: [
        "Activity count shows how much CRM work a team member has logged.",
        "Deal count shows how many opportunities are connected to the user.",
        "Won deals show successful outcomes.",
        "Pickup rate and dialer time help evaluate calling activity when shown.",
      ],
      steps: [
        "Compare activity count across team members.",
        "Review deal count and won deals.",
        "Check pickup rate or dialer time if available.",
        "Open the advisor profile before making a performance judgment.",
      ],
      tips: [
        "High activity count does not always mean high quality. Compare it with outcomes such as pickups, conversions, and won deals.",
      ],
      relatedData: ["users", "activities", "deals"],
    },
    {
      id: "open-advisor-profile",
      title: "Advisor Profile",
      summary:
        "Open an advisor profile to inspect one user's performance in detail.",
      body: [
        "The team list provides a summary only.",
        "Advisor Performance gives more detail about calls, outcomes, deals, campaigns, and recent activities.",
      ],
      steps: [
        "Find the team member in the list.",
        "Click the advisor or profile link.",
        "Review the detailed performance page.",
      ],
      relatedData: ["users", "activities", "deals", "campaigns"],
    },
    {
      id: "spot-workload-issues",
      title: "Workload Issues",
      summary:
        "Use team data to spot users who may be overloaded, inactive, or under-supported.",
      body: [
        "A user with many assigned deals but low activity may need follow-up support.",
        "A user with high dialer time but low pickup may need better lead timing or lead quality.",
        "A user with many activities but few wins may need coaching on conversion quality.",
      ],
      steps: [
        "Compare activity count with deal count.",
        "Look for gaps between effort and outcomes.",
        "Open the advisor profile for more context before taking action.",
      ],
      tips: [
        "Do not judge performance from one number. Use activity, calls, pickups, conversions, and deal outcomes together.",
      ],
      relatedData: ["users", "activities", "deals"],
    },
    {
      id: "role-access",
      title: "Role Access",
      summary:
        "The Team page is restricted to roles responsible for oversight.",
      body: [
        "Admin and Manager users can review team-level performance.",
        "Sales users are limited to their own work and cannot access the full team list.",
        "Viewer access depends on the app's read-only permission rules.",
      ],
      roleNotes: [
        "Use Advisor Performance for individual review.",
        "Use Team for comparison across users.",
      ],
      relatedData: ["users", "roles"],
    },
  ],
};

export const advisorPerformanceHelpContent: HelpContent = {
  pageId: "advisor-performance",
  pageTitle: "Advisor Performance",
  pageSummary:
    "The Advisor Performance page shows one user's sales, calling, campaign, and recent activity performance.",
  options: [
    {
      id: "read-performance-summary",
      title: "Read Summary",
      summary:
        "Use the summary metrics to understand the advisor's overall sales and calling activity.",
      body: [
        "Calls made show outreach volume.",
        "Pickups show how many calls reached prospects.",
        "Conversion rate shows how often activity led to successful movement.",
        "Dialer time shows time spent in calling work when available.",
      ],
      steps: [
        "Review calls made, pickups, conversion rate, and dialer time.",
        "Compare volume with outcomes.",
        "Use the detailed sections below before drawing conclusions.",
      ],
      tips: [
        "High call volume with low pickup may indicate lead quality or timing issues, not necessarily poor effort.",
      ],
      relatedData: ["users", "activities", "deals"],
    },
    {
      id: "review-call-outcomes",
      title: "Call Outcomes",
      summary:
        "Use the call outcome breakdown to understand what happened during calls.",
      body: [
        "Outcomes may include completed calls, no answers, follow-up needed, scheduled meetings, deal advancement, cancelled calls, or failed calls.",
        "The breakdown helps identify patterns in calling results.",
      ],
      steps: [
        "Review the distribution of call outcomes.",
        "Look for high no-answer or failed rates.",
        "Open recent activities if you need notes or call details.",
      ],
      tips: [
        "A high follow-up-needed count is not bad by itself, but it must be followed by scheduled next actions.",
      ],
      relatedData: ["activities", "users"],
    },
    {
      id: "review-deals-by-stage",
      title: "Deals by Stage",
      summary:
        "Use deal stage distribution to see where the advisor's opportunities currently sit.",
      body: [
        "Early stages show opportunities that still need qualification or proposal work.",
        "Later stages show deals closer to final outcomes.",
        "Closed stages show won or lost results.",
      ],
      steps: [
        "Review how many deals are in each stage.",
        "Check whether many deals are stuck in one stage.",
        "Open important deals for deeper context.",
      ],
      tips: [
        "Many deals in negotiation with little recent activity may indicate stalled opportunities.",
      ],
      relatedData: ["deals", "stage_history", "users"],
    },
    {
      id: "review-campaign-activity",
      title: "Campaign Activity",
      summary:
        "Use campaign breakdown to understand which campaigns the advisor has worked on.",
      body: [
        "Campaign activity shows how the advisor's work is distributed across outreach programs.",
        "It helps explain whether performance is tied to a specific campaign or offer.",
      ],
      steps: [
        "Review campaign activity breakdown.",
        "Compare campaign volume and outcomes.",
        "Open campaign detail if you need broader campaign context.",
      ],
      tips: [
        "Weak results may come from a difficult campaign, not only from the advisor's performance.",
      ],
      relatedData: ["users", "activities", "campaigns", "deals"],
    },
    {
      id: "review-recent-activities",
      title: "Recent Activities",
      summary:
        "Use recent activities to inspect the advisor's latest CRM work.",
      body: [
        "Recent activities show calls, meetings, tasks, notes, demos, emails, and follow-ups.",
        "They help validate whether the summary metrics reflect meaningful work.",
      ],
      steps: [
        "Review the most recent activities.",
        "Check result, date, and related record.",
        "Open activity detail to inspect notes or call metadata.",
      ],
      relatedData: ["activities", "users", "leads", "contacts", "deals"],
    },
    {
      id: "access-rules",
      title: "Access Rules",
      summary: "Advisor performance access depends on the user's role.",
      body: [
        "Admin and Manager can open any advisor performance profile.",
        "Sales users can open only their own performance profile.",
        "Restricted users may be redirected if they try to access a profile they are not allowed to view.",
      ],
      roleNotes: [
        "Use this page for individual review, not team-wide comparison.",
        "Use the Team page for comparing multiple advisors.",
      ],
      relatedData: ["users", "roles"],
    },
  ],
};

export const auditLogsHelpContent: HelpContent = {
  pageId: "audit-logs",
  pageTitle: "Audit Logs",
  pageSummary:
    "The Audit Logs page is used by Admin users to review system actions and user changes.",
  options: [
    {
      id: "read-audit-logs",
      title: "Read Logs",
      summary: "Use audit logs to understand who changed what and when.",
      body: [
        "Each log represents an action performed in the CRM.",
        "Logs can include create, update, delete, stage change, status change, assignment change, conversion, and archive events.",
        "Audit logs help investigate changes without relying on memory.",
      ],
      steps: [
        "Review the user, action, entity, and timestamp.",
        "Read metadata if more detail is available.",
        "Use the log to understand the sequence of changes.",
      ],
      roleNotes: ["Only Admin users can access audit logs."],
      relatedData: ["audit_logs", "users"],
    },
    {
      id: "search-logs",
      title: "Search Logs",
      summary:
        "Use search to find audit events by user, action, entity, metadata, or date.",
      body: [
        "Search helps narrow down a large log history.",
        "It is useful when investigating a specific record, user, or change.",
      ],
      steps: [
        "Enter a keyword related to the user, action, entity, or metadata.",
        "Review matching log entries.",
        "Adjust the search term if results are too broad.",
      ],
      tips: [
        "Use specific names, entity types, or action terms to reduce noise.",
      ],
      relatedData: ["audit_logs", "users"],
    },
    {
      id: "filter-logs",
      title: "Filter Logs",
      summary:
        "Use filters to focus on specific users or action types when available.",
      body: [
        "Filtering by user helps inspect one person's changes.",
        "Filtering by action helps review a specific kind of event, such as stage changes or assignments.",
      ],
      steps: [
        "Choose a user filter if investigating one person.",
        "Choose an action filter if investigating one type of change.",
        "Review the filtered log entries in time order.",
      ],
      relatedData: ["audit_logs", "users"],
    },
    {
      id: "review-change-events",
      title: "Change Events",
      summary: "Use audit events to understand important CRM changes.",
      body: [
        "Stage changes help explain deal movement.",
        "Assignment changes show when ownership moved between users.",
        "Status changes show progress updates for records such as leads or campaigns.",
        "Conversion events show when leads became contacts or deals.",
      ],
      steps: [
        "Identify the action type.",
        "Check which entity was changed.",
        "Review the user and timestamp.",
        "Use metadata for more context if available.",
      ],
      tips: [
        "Audit logs explain that a change happened, but the related record may still be needed to understand the business reason.",
      ],
      relatedData: ["audit_logs", "users"],
    },
    {
      id: "investigate-issues",
      title: "Investigate Issues",
      summary:
        "Use audit logs when a record looks incorrect or a change needs to be traced.",
      body: [
        "Audit logs can help identify who made a change and when.",
        "They are useful for tracking unexpected stage movement, ownership changes, deleted records, or conversions.",
      ],
      steps: [
        "Search for the affected entity or user.",
        "Filter by action type if needed.",
        "Review the events around the suspected time.",
        "Open the related CRM record if the page provides a link or enough context.",
      ],
      tips: [
        "Do not assume intent from the audit log alone. Use it as evidence of action, then inspect the related record.",
      ],
      relatedData: ["audit_logs", "users"],
    },
  ],
};

export const noAccessHelpContent: HelpContent = {
  pageId: "no-access",
  pageTitle: "No Access",
  pageSummary:
    "The No Access page explains that the current user role is not allowed to view the requested page.",
  options: [
    {
      id: "why-blocked",
      title: "Why Blocked",
      summary:
        "This page appears when your role does not have permission to access the requested area.",
      body: [
        "Some CRM pages are limited to specific roles.",
        "Restricted pages may include team management, audit logs, or records outside your allowed scope.",
        "The protected page data is not shown here.",
      ],
      relatedData: ["users", "roles"],
    },
    {
      id: "role-restrictions",
      title: "Role Restrictions",
      summary:
        "Access depends on the role of the account currently being used.",
      body: [
        "Admin usually has full access.",
        "Manager can access team oversight and management workflows.",
        "Sales is usually limited to sales work and allowed personal records.",
        "Viewer has limited read-only access.",
      ],
      tips: [
        "If you are testing the prototype, try logging in with a different demo role to compare access.",
      ],
      relatedData: ["users", "roles"],
    },
    {
      id: "go-back",
      title: "Go Back",
      summary: "Return to a page that your current role is allowed to access.",
      body: [
        "Use the navigation menu to open an available page.",
        "You can also go back to the previous page if it was permitted.",
        "The app should not expose protected page data from this screen.",
      ],
      steps: [
        "Go back to the previous page.",
        "Choose a permitted page from navigation.",
        "Use a different demo account only if you need to test another role.",
      ],
      relatedData: ["users", "roles"],
    },
    {
      id: "what-to-check",
      title: "What to Check",
      summary:
        "Check whether the current account is the right role for the workflow you are testing.",
      body: [
        "If you expected access, the selected demo account may not match the workflow.",
        "For example, Audit Logs require Admin access, and Team is intended for Admin or Manager users.",
        "Sales users may only access their own advisor performance profile.",
      ],
      tips: [
        "Access denial is expected behavior when testing role-based restrictions.",
      ],
      relatedData: ["users", "roles"],
    },
  ],
};

export function getHelpContent(pathname: string): HelpContent {
  if (pathname === "/login") return loginHelpContent;
  if (pathname === "/") return dashboardHelpContent;

  if (pathname === "/leads") return leadsHelpContent;
  if (pathname.startsWith("/leads/")) return leadDetailHelpContent;

  if (pathname === "/contacts") return contactsHelpContent;
  if (pathname.startsWith("/contacts/")) return contactDetailHelpContent;

  if (pathname === "/companies") return companiesHelpContent;
  if (pathname.startsWith("/companies/")) return companyDetailHelpContent;

  if (pathname === "/deals") return dealsHelpContent;
  if (pathname.startsWith("/deals/")) return dealDetailHelpContent;

  if (pathname === "/activities") return activitiesHelpContent;
  if (pathname.startsWith("/activities/")) return activityDetailHelpContent;

  if (pathname === "/calendar") return calendarHelpContent;

  if (pathname === "/campaigns") return campaignsHelpContent;
  if (pathname.startsWith("/campaigns/")) return campaignDetailHelpContent;
  if (pathname.startsWith("/products/")) return productDetailHelpContent;
  if (pathname.startsWith("/bundles/")) return bundleDetailHelpContent;

  if (pathname === "/team") return teamHelpContent;
  if (pathname.startsWith("/team/")) return advisorPerformanceHelpContent;

  if (pathname === "/audit-logs") return auditLogsHelpContent;

  return noAccessHelpContent;
}
