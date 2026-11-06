# MarshalDesk

MarshalDesk lets a business put a chat widget on its website, where visitors talk to an AI agent that answers only from the business's own knowledge, or to a human from the business.

## Language

### People and tenancy

**Workspace**:
The space that holds one business's knowledge, widget, and conversations. Created when an owner completes first-run setup after signing up. Kinde calls this an organization; that word stays inside Kinde adapter code.
_Avoid_: Organization, tenant, account, company

**Member**:
A person with access to a workspace's dashboard. A workspace has many members, a person belongs to one workspace, and each member has one role.
_Avoid_: User, teammate, staff, operator

**Owner**:
The member who created the workspace. Every workspace has exactly one owner.
_Avoid_: Admin, business user

**Role**:
A named set of permissions given to a member: owner, support, or billing admin. Roles are for assigning access, never for checking it.
_Avoid_: Level, group, position

**Permission**:
A single thing a member may do, such as replying to conversations. Every server check asks for a permission, never a role.
_Avoid_: Scope, privilege, right

**Support** (role):
A role that can read and reply to conversations and use reply suggestions.
_Avoid_: Agent, staff, operator

**Billing admin** (role):
A role that can manage the plan and payment details, and nothing else.
_Avoid_: Finance, accountant

**Invitation**:
An owner's offer of a role in the workspace to an email address. It's accepted when the invited person signs in with that email.
_Avoid_: Invite link, request, signup link

**Visitor**:
An anonymous person talking to a workspace through the widget on the business's website. Never logs in.
_Avoid_: Customer, user, lead, contact

**Widget**:
The chat window a workspace embeds on its websites. Each workspace has exactly one.
_Avoid_: Chatbox, messenger, plugin

**Allowed domain**:
A website domain on which a workspace's widget is permitted to run.
_Avoid_: Whitelist, site, origin

**Visitor details**:
Anonymous context captured about a visitor, such as their approximate location and local time. Never identifies who the visitor is.
_Avoid_: Profile, identity, contact info

### Conversations

**Conversation**:
One thread of messages between a visitor and a workspace. A visitor has at most one open conversation. A message sent after it's closed starts a new conversation.
_Avoid_: Ticket, chat, thread, session

**Greeting**:
The owner-written message that opens every conversation in the widget. It isn't written by the agent and is shown even when the agent is off.
_Avoid_: Welcome message, intro

**Suggested question**:
A question generated from the knowledge base and offered to the visitor as a tappable shortcut before their first message.
_Avoid_: Chip, badge, quick reply, prompt

**Agent**:
The AI that replies to visitors on behalf of a workspace, using only that workspace's knowledge base.
_Avoid_: Bot, assistant, AI, chatbot

**Agent off**:
The condition of a workspace in which the agent doesn't reply at all, and the widget works as plain live chat. It applies when the knowledge base has no ready sources.
_Avoid_: Paused, disabled, manual mode

**Handoff**:
A transfer of control over a conversation between the agent and a member, in either direction. Agent-to-member handoffs happen automatically when the agent can't answer, or when the visitor asks for a person.
_Avoid_: Escalation, transfer

**Waiting**:
The state of a conversation that needs a member but doesn't have one yet: after a handoff to a member, or from the start while the agent is off. Nobody replies. It stays waiting until a member acts.
_Avoid_: Pending, queued, unassigned

**Attachment**:
An image sent inside a conversation message, by a visitor or a member. Never a source for the knowledge base.
_Avoid_: File, upload, media

### Messages the agent receives

**Support question**:
A visitor message about the business, its products, its policies, or the visitor's relationship with it, including pre-sales and company questions. It's still a support question when the knowledge base doesn't cover it.
_Avoid_: On-topic question, query, ticket

**Small talk**:
A greeting, thanks, or pleasantry. The agent replies briefly without consulting the knowledge base.
_Avoid_: Chit-chat, greeting

**Off-topic message**:
Any visitor message that is neither a support question nor small talk, including attempts to manipulate the agent. The agent politely declines it.
_Avoid_: Spam, irrelevant question, jailbreak

### Knowledge

**Knowledge base**:
Everything a workspace has given the agent to answer from: the sum of its sources.
_Avoid_: Docs, documents, training data, help center

**Source**:
A single item in the knowledge base: an uploaded file, or a piece of text typed directly into the dashboard.
_Avoid_: Document, file, upload, article

### Plans and usage

**Plan**:
What a workspace has bought: Free or Pro. It decides which features are available and how much of them is included.
_Avoid_: Tier, subscription, package

**Entitlement**:
What a workspace's plan allows right now, such as reply suggestions and how many AI replies are left this billing cycle.
_Avoid_: Quota, limit, feature flag

**AI reply**:
An answer the agent gives a visitor from the knowledge base. It is the metered unit: only a completed answer counts. Declines, small talk, handoffs, and failures don't. On Free there is a monthly maximum. On Pro, replies past the included amount are billed.
_Avoid_: Bot message, AI message

**Reply suggestion**:
A draft reply the AI writes for a member in an open conversation. It goes only to that member, who edits it and sends it like any reply. The visitor never sees it. It is unmetered and only on Pro.
_Avoid_: Suggested reply, AI draft

**Usage ledger**:
The app's own record of billable events, one row per visitor message the agent answers. Only AI replies that finished successfully count. It is the source for what is reported to billing.
_Avoid_: Usage log, meter, counter
