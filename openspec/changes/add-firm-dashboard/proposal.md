# Proposal

## Why

Haven is now invitation only and sold to immigration law firms, but a firm
can't do anything inside it. Every invite is added to the list by hand, and
the lawyer never sees what their clients shared. Firms need their own way to
bring clients in and see their intake, without Haven sending any emails for
them.

## What Changes

- **Firms and lawyer logins.** A firm has a name and one or more lawyer
  logins. In this first version the owner sets up firms and lawyers by hand,
  and there is no self-serve firm sign-up.
- **One intake link per firm.** Each firm has a single shareable link that
  lawyers copy and send any way they like. Lawyers can turn the link off, or
  replace it so the old one stops working.
- **Joining through a firm link.** The link opens a page that says the firm
  invited them. The client enters their email, and Haven emails them a
  sign-up link. Confirming that email puts them on the invite list and ties
  them to that firm. Before joining, they're told their answers and documents
  will be shared with the firm.
- **Intake = Haven's existing setup.** Clients answer the four existing setup
  steps and can upload documents. Document upload, currently limited to a
  test list, is turned on for firm clients.
- **Firm dashboard.** Lawyers see their firm's clients with name, visa,
  status (email sent / signed up / in progress / finished), document count
  and join date. Each client's page shows their setup answers and documents.
  It never shows their chats with Haven.
- **"New" alerts inside the dashboard.** A client who finishes is marked
  New until a lawyer at the firm opens them, and the dashboard shows how many
  are new. No emails to lawyers.
- **Firm isolation.** A lawyer can only ever see their own firm's clients,
  enforced both by the server and by the database itself.
- After signing in, lawyers land on the dashboard, not on client setup.

Out of scope for now: each firm's own intake questions, a one-time link per
client, email alerts, lawyers drafting replies to clients, clients belonging
to more than one firm, and a screen for the owner to manage firms.

## Capabilities

### New Capabilities

- `firm-accounts`: firms, lawyer logins, how lawyers sign in and where they
  land, and the rule that a firm only sees its own clients.
- `firm-intake`: the firm's shareable intake link, turning it off or
  replacing it, and how a client joins a firm through it, including the
  sharing notice.
- `firm-dashboard`: the lawyer's client list, statuses, "New" alerts, and
  the client page with setup answers and documents.

### Modified Capabilities

None. The project has no existing specs.

## Impact

- **Database:** new tables for firms, lawyer memberships, intake links and
  firm clients, each with row-level rules scoped to the firm. Joining
  through a link adds the client to the existing invite list.
- **Sign-up:** a new public link page plus a server action that sends the
  sign-up email. It reuses today's invite email, which already goes through
  Mailgun. Lawyer sign-in is routed to the dashboard.
- **Lawyer area:** new signed-in pages for the dashboard and each client.
  Documents open through short-lived private links checked against the firm.
- **Client side:** a sharing notice on the link page and in setup, and
  document upload enabled for firm clients.
- **Owner tooling:** a script to create a firm, add lawyers, and print the
  firm's link.
- **Checks:** an automated check that one firm can't read another firm's
  clients or documents.
