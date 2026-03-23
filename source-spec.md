# Source Spec: Haven

## Source of truth

This spec is derived from the PRD in `/Users/shangyanyanli/Downloads/Haven — Product Requirements Document.docx`.

The product is an immigration planning platform for H1B, OPT, and adjacent visa holders. It is not a legal case-management product.

## Core product pillars

1. Personalized onboarding
2. Timeline engine
3. Layoff scenario planner
4. Community cohorts and layoff war room
5. Passive data enrichment through manual email forwarding

## Primary user segments

- H1B holders with green card in progress
- OPT holders transitioning to H1B
- Users on spousal or alternative immigration paths

## Canonical data model

### Profile

- visa status
- country of birth
- visa expiry date
- H1B start date
- PERM stage
- PERM filing date
- I-140 approval status and date
- priority date
- preference category
- I-485 filing status
- employer name, size, industry
- job title
- employment status
- spouse visa status
- primary goal
- top concerns

### Derived fields

- H1B 6-year cap date
- days until visa expiry
- visa bulletin position
- estimated green card date range
- AC21 portability status
- layoff readiness score

### Community

- cohort memberships
- war room participation
- outcome shares
- anonymized milestone posts

### Email ingestion

- unique inbound alias
- processed email log
- extracted fields
- confirmation state

## MVP routes

- `/`
- `/login`
- `/register`
- `/onboarding`
- `/dashboard`
- `/timeline`
- `/planner`
- `/community`
- `/community/war-room`
- `/inbox`
- `/settings`

## PRD alignment

### Must match

- value-forward onboarding with progressive personalization
- timeline widget with computed milestones and alert windows
- layoff planner with ranked options and 60-day checklist
- community cohorts and dedicated layoff war room entry point
- passive email ingestion explained as manual forwarding, not inbox access
- clear inline legal disclaimer on recommendations

### Can simplify

- cohort chat can ship as feed-style discussion cards instead of live chat
- visa bulletin data can start as mocked monthly updates
- employer risk framing can be static copy until live data sources are added

### Defer from MVP

- attorney marketplace
- employer tools
- full document vault
- non-layoff scenario planners
- native mobile app
