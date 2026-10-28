# Spec Delta

## Purpose

Defines how the client dashboard and client-facing pages display multiple lawyer engagement timelines, per-firm milestones and document checklists, and multi-firm data sharing indicators when a client is connected to one or more law firms.

## ADDED Requirements

### Requirement: Client dashboard displays an engagement timeline for each connected law firm
When a client has granted access to one or more law firms, the client dashboard (`/dashboard`) SHALL display a lawyer engagement timeline for every connected law firm rather than only a single firm.

#### Scenario: Client connected to multiple law firms views the dashboard
- **WHEN** a client who has joined both Firm A and Firm B loads `/dashboard`
- **THEN** the dashboard renders an engagement timeline for Firm A and an engagement timeline for Firm B, each showing that firm's name, current stage, milestone progress, client-visible lawyer notes, and consultation booking action

#### Scenario: Client not yet connected to any law firm views the dashboard
- **WHEN** a client with zero joined law firms loads `/dashboard`
- **THEN** the dashboard renders the sample preview engagement timeline explaining how law firm tracking works once connected

### Requirement: Per-firm document checklist and milestone independence on the client dashboard
Each law firm engagement timeline on the client dashboard SHALL compute its document checklist progress and intake completion status against that specific firm's required documents and engagement state.

#### Scenario: Two connected firms require different document sets
- **WHEN** Firm A requires `passport` and `i94` while Firm B requires `passport`, `i94`, and `resume_cv`, and the client has uploaded `passport` and `i94`
- **THEN** Firm A's engagement timeline shows all required documents uploaded, while Firm B's engagement timeline shows `resume_cv` as still needed

### Requirement: Multi-firm sharing transparency across onboarding and document vault
When a client is connected to multiple law firms, the onboarding flows (`/onboarding`, `/onboarding/deadlines`) and document vault (`/documents`) SHALL indicate all connected law firms that receive shared access and union their required document and intake question prompts.

#### Scenario: Client connected to two firms views the document vault or onboarding
- **WHEN** a client connected to Firm A and Firm B visits `/documents` or `/onboarding`
- **THEN** the sharing notice names the connected firms and surfaces the combined set of required documents and custom intake questions across both firms
