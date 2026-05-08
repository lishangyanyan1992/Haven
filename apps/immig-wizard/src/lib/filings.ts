export type FilingFaq = {
  question: string;
  answer: string;
  sourceLabel: string;
  sourceUrl: string;
};

export type FilingService = {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  status: string;
  available: boolean;
  landingForms: readonly string[];
  landingHighlights: readonly string[];
  detailEyebrow: string;
  detailIntro: string;
  detailSummary: string;
  completedFormsHeading: string;
  completedFormsNote: string;
  completedForms: readonly string[];
  faqs: readonly FilingFaq[];
  serviceIncludes: readonly string[];
  wizardHref: string | null;
};

function createShellService(config: {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  landingForms: readonly string[];
  landingHighlights: readonly string[];
}): FilingService {
  return {
    slug: config.slug,
    title: config.title,
    subtitle: config.subtitle,
    description: config.description,
    status: 'Coming soon',
    available: false,
    landingForms: config.landingForms,
    landingHighlights: config.landingHighlights,
    detailEyebrow: 'Service shell',
    detailIntro:
      'This service page is ready as a shell so you can add the legal path, customer positioning, intake requirements, and filing details later.',
    detailSummary:
      'The route, CTA placement, form package section, and summary blocks are already in place. You only need to replace the placeholder content when this filing is ready.',
    completedFormsHeading: 'Forms package for this service',
    completedFormsNote:
      'Use this section to list the forms and supporting documents your team handles for this filing type.',
    completedForms: config.landingForms,
    faqs: [],
    serviceIncludes: [
      'A dedicated service overview page for this filing type',
      'A placeholder forms package section you can expand later',
      'A reserved application CTA area for when the workflow is ready',
    ],
    wizardHref: null,
  };
}

export const filingServices: readonly FilingService[] = [
  {
    slug: 'marriage-green-card-adjustment-of-status',
    title: 'Marriage Green Card via Adjustment of Status',
    subtitle: 'For spouses applying while the beneficiary is already in the United States',
    description:
      'A guided workflow for concurrent family-based filings, supporting documents, and final package prep.',
    status: 'Available now',
    available: true,
    landingForms: ['G-1145', 'I-130', 'I-130A', 'G-1450', 'I-485', 'I-864', 'I-765', 'I-131', 'I-693'],
    landingHighlights: [
      'Eligibility screening before you begin',
      'Plain-English question flow for both spouses',
      'Personalized checklist and filing summary',
    ],
    detailEyebrow: 'Marriage-based filing service',
    detailIntro:
      'This service is designed for couples pursuing Adjustment of Status after marriage when the beneficiary is already in the United States.',
    detailSummary:
      'We guide the couple through the intake, organize the filing set, and prepare the core USCIS forms and supporting checklist before the applicant moves into final review and submission.',
    completedFormsHeading: 'Marriage Green Card Forms we complete for you',
    completedFormsNote:
      'For Marriage Green Card via Adjustment of Status, the documents we handle include the following filing package items.',
    completedForms: [
      'G-1145, E-Notification of Application/Petition Acceptance',
      'I-130, Petition for Alien Relative',
      'I-130A Supplemental Information for Spouse Beneficiary',
      'G-1450, Authorization for Credit Card Transactions',
      'I-485, Application for Adjustment of Status',
      'I-864, Affidavit of Support for Sponsoring Spouse',
      'I-765, Application for Employment Authorization',
      'I-131, Application for Travel Document',
      'I-693, Report of Medical Examination and Vaccination Record',
    ],
    faqs: [
      {
        question: 'What is an Adjustment of Status application?',
        answer:
          'It is the process of applying for lawful permanent residence from inside the United States instead of completing immigrant visa processing abroad.',
        sourceLabel: 'USCIS: Green Card Processes and Procedures',
        sourceUrl: 'https://www.uscis.gov/green-card/green-card-processes-and-procedures',
      },
      {
        question: 'Can I file Form I-130 and Form I-485 together?',
        answer:
          'Usually yes for the spouse of a U.S. citizen. USCIS allows concurrent filing for immediate relatives because immigrant visas in that category are always available.',
        sourceLabel: 'USCIS: Concurrent Filing of Form I-485',
        sourceUrl: 'https://www.uscis.gov/green-card/green-card-processes-and-procedures/concurrent-filing-of-form-i-485',
      },
      {
        question: 'Can I include my children on my application?',
        answer:
          'Not as derivative beneficiaries on an immediate-relative spouse case. USCIS says each child must independently qualify for a Green Card and file a separate application.',
        sourceLabel: 'USCIS: Green Card for Immediate Relatives of U.S. Citizen',
        sourceUrl: 'https://www.uscis.gov/green-card/green-card-eligibility/green-card-for-immediate-relatives-of-us-citizen',
      },
      {
        question: 'Do I usually need lawful admission or parole to adjust status?',
        answer:
          'Generally yes. USCIS says immediate relatives applying inside the United States usually must have been inspected and admitted or inspected and paroled, with limited exceptions.',
        sourceLabel: 'USCIS: Green Card for Immediate Relatives of U.S. Citizen',
        sourceUrl: 'https://www.uscis.gov/green-card/green-card-eligibility/green-card-for-immediate-relatives-of-us-citizen',
      },
    ],
    serviceIncludes: [
      'An eligibility intake before the couple starts the full filing flow',
      'A guided questionnaire for petitioner, beneficiary, and relationship history',
      'A filing-specific checklist for identity, marriage, immigration, and financial evidence',
      'A summary page with next filing steps after the intake is complete',
    ],
    wizardHref: '/wizard/1',
  },
  {
    slug: 'marriage-green-card-immigrant-spouse',
    title: 'Marriage Green Card: Spouse lives abroad',
    subtitle: 'For marriage-based green card cases where the spouse is outside the United States',
    description:
      'A service shell for consular-processing marriage green card cases when the spouse lives abroad.',
    status: 'Coming soon',
    available: false,
    landingForms: ['I-130', 'I-130A'],
    landingHighlights: [
      'Consular-processing service overview shell',
      'Marriage-based petition package listed up front',
      'Ready for later eligibility and NVC-stage details',
    ],
    detailEyebrow: 'Service shell',
    detailIntro:
      'This service page is set up for marriage green card cases where the spouse lives abroad and the case will follow the immigrant spouse path.',
    detailSummary:
      'You can add the consular-processing explanation, supporting-document guidance, and next-step flow later. The shell already includes the page structure and forms section.',
    completedFormsHeading: 'Marriage Green Card: Spouse lives abroad forms we handle',
    completedFormsNote:
      'For Marriage Green Card: Spouse lives abroad, the documents we handle currently include the following forms.',
    completedForms: [
      'I-130, Petition for Alien Relative',
      'I-130A, Supplemental Information for Spouse Beneficiary',
    ],
    faqs: [
      {
        question: 'If my spouse lives abroad, do we use adjustment of status?',
        answer:
          'Usually no. USCIS says that when the spouse is outside the United States, the case generally moves through consular processing rather than adjustment of status.',
        sourceLabel: 'USCIS: Consular Processing',
        sourceUrl: 'https://www.uscis.gov/green-card/green-card-processes-and-procedures/consular-processing',
      },
      {
        question: 'What starts a marriage green card case for a spouse abroad?',
        answer:
          'USCIS says the process starts with Form I-130, Petition for Alien Relative. After approval, the case is sent forward for consular processing.',
        sourceLabel: 'USCIS: Bringing Spouses to Live in the United States as Permanent Residents',
        sourceUrl: 'https://www.uscis.gov/family/bring-spouse-to-live-in-US',
      },
      {
        question: 'Can a green card holder sponsor a spouse abroad?',
        answer:
          'Yes. USCIS says lawful permanent residents may petition for a spouse by filing Form I-130, although visa availability and timing differ from U.S. citizen cases.',
        sourceLabel: 'USCIS: Family of Green Card Holders (Permanent Residents)',
        sourceUrl: 'https://www.uscis.gov/family/family-of-green-card-holders-permanent-residents',
      },
    ],
    serviceIncludes: [
      'A dedicated service overview for marriage green card cases with the spouse abroad',
      'A forms package section listing the petition documents handled by your team',
      'A reserved application CTA area for when the workflow is ready',
    ],
    wizardHref: null,
  },
  {
    slug: 'k1-fiance-visa',
    title: 'K-1 Fiance Visa',
    subtitle: 'For couples planning marriage after entry to the United States',
    description:
      'A service shell for the K-1 fiance visa path, including the petition, visa application, and support forms.',
    status: 'Coming soon',
    available: false,
    landingForms: ['I-129F', 'I-129F Supplement', 'DS-160', 'I-134', 'G-1145'],
    landingHighlights: [
      'Petition and visa forms listed clearly up front',
      'Reserved evidence and interview-preparation sections',
      'Ready for later workflow and intake details',
    ],
    detailEyebrow: 'Service shell',
    detailIntro:
      'This service page is prepared for the K-1 fiance visa flow and can be expanded later with qualification rules, evidence guidance, and interview prep.',
    detailSummary:
      'The service shell already shows the forms package and CTA structure so you can add more detailed customer-facing guidance when this filing is ready.',
    completedFormsHeading: 'K-1 Fiance Visa forms we handle',
    completedFormsNote:
      'For K-1 Fiance Visa, the documents we handle currently include the following filing package items.',
    completedForms: [
      'Form I-129F, Petition For Alien Fiance(e)',
      'I-129F, Supplement',
      'Form DS-160, Online Nonimmigrant Visa Application',
      'Form I-134, Affidavit of Support',
      'G-1145, e-Notification of Application/Petition Acceptance',
    ],
    faqs: [
      {
        question: 'What is a K-1 visa?',
        answer:
          'The K-1 visa is for the foreign-citizen fiance(e) of a U.S. citizen. It allows entry to the United States to marry that U.S. citizen within 90 days of arrival.',
        sourceLabel: 'U.S. Department of State: Nonimmigrant Visa for a Fiancé(e) (K-1)',
        sourceUrl: 'https://travel.state.gov/content/travel/en/us-visas/immigrate/family-immigration/nonimmigrant-visa-for-a-fiance-k-1.html',
      },
      {
        question: 'Can my children come on the K-1 case?',
        answer:
          'Usually yes if they qualify for K-2 status and are listed on the I-129F. After the marriage, USCIS requires them to file separately for adjustment of status.',
        sourceLabel: 'U.S. Department of State: Nonimmigrant Visa for a Fiancé(e) (K-1)',
        sourceUrl: 'https://travel.state.gov/content/travel/en/us-visas/immigrate/family-immigration/nonimmigrant-visa-for-a-fiance-k-1.html',
      },
      {
        question: 'Is Form DS-160 required for a K-1 visa interview?',
        answer:
          'Yes. The State Department says each K visa applicant must complete the DS-160 and bring the confirmation page to the interview.',
        sourceLabel: 'U.S. Department of State: Nonimmigrant Visa for a Fiancé(e) (K-1)',
        sourceUrl: 'https://travel.state.gov/content/travel/en/us-visas/immigrate/family-immigration/nonimmigrant-visa-for-a-fiance-k-1.html',
      },
    ],
    serviceIncludes: [
      'A dedicated service overview for the K-1 fiance visa path',
      'A forms package section listing the petition and visa documents handled by your team',
      'A reserved application CTA area for when the workflow is ready',
    ],
    wizardHref: null,
  },
  {
    slug: 'removal-of-conditions',
    title: 'Remove Conditions on Your Green Card',
    subtitle: 'For conditional residents preparing the I-751 filing package',
    description:
      'A service shell for removing conditions on residence, including the core filing and payment forms.',
    status: 'Coming soon',
    available: false,
    landingForms: ['G-1145', 'G-1450', 'I-751'],
    landingHighlights: [
      'Core filing and payment forms listed up front',
      'Reserved evidence and timing-guidance sections',
      'Ready for later intake and checklist details',
    ],
    detailEyebrow: 'Service shell',
    detailIntro:
      'This service page is prepared for removal-of-conditions filings and can be expanded later with timing guidance, evidence strategy, and filing instructions.',
    detailSummary:
      'The page shell already includes the forms package section and service overview layout so you can add the rest of the customer-facing content later.',
    completedFormsHeading: 'Remove Conditions on Your Green Card forms we handle',
    completedFormsNote:
      'For Remove Conditions on Your Green Card, the documents we handle currently include the following filing package items.',
    completedForms: [
      'G-1145, E-Notification of Application/Petition Acceptance',
      'G-1450, Authorization for Credit Card Transactions',
      'Form I-751, Petition to Remove Conditions on Residence',
    ],
    faqs: [
      {
        question: 'When do I file Form I-751?',
        answer:
          'If you are filing jointly with your spouse, USCIS says you must file during the 90-day period immediately before your conditional green card expires.',
        sourceLabel: 'USCIS: Removing Conditions on Permanent Residence Based on Marriage',
        sourceUrl: 'https://www.uscis.gov/green-card/after-we-grant-your-green-card/conditional-permanent-residence/removing-conditions-on-permanent-residence-based-on-marriage',
      },
      {
        question: 'Can I file without my spouse?',
        answer:
          'In some cases yes. USCIS lists waiver-based situations including divorce after a good-faith marriage, battery or extreme cruelty, death of the spouse, or extreme hardship.',
        sourceLabel: 'USCIS: Removing Conditions on Permanent Residence Based on Marriage',
        sourceUrl: 'https://www.uscis.gov/green-card/after-we-grant-your-green-card/conditional-permanent-residence/removing-conditions-on-permanent-residence-based-on-marriage',
      },
      {
        question: 'Can I include my conditional resident children on the petition?',
        answer:
          'Often yes. USCIS says you may include children who obtained conditional resident status at the same time as you, or within 90 days of you.',
        sourceLabel: 'USCIS: Removing Conditions on Permanent Residence Based on Marriage',
        sourceUrl: 'https://www.uscis.gov/green-card/after-we-grant-your-green-card/conditional-permanent-residence/removing-conditions-on-permanent-residence-based-on-marriage',
      },
    ],
    serviceIncludes: [
      'A dedicated service overview for removal-of-conditions filings',
      'A forms package section listing the filing and payment documents handled by your team',
      'A reserved application CTA area for when the workflow is ready',
    ],
    wizardHref: null,
  },
  {
    slug: 'b1-b2-tourism-visas',
    title: 'B-1/B-2 Travel Visa',
    subtitle: 'For short-term visitor travel, tourism, and other temporary trips',
    description:
      'A service shell for B-1/B-2 travel visa guidance, intake, and supporting-document preparation.',
    status: 'Coming soon',
    available: false,
    landingForms: ['DS-160'],
    landingHighlights: [
      'Travel-visa service shell',
      'Reserved supporting-document section',
      'Ready for future interview and intake content',
    ],
    detailEyebrow: 'Service shell',
    detailIntro:
      'This service page is set up for a B-1/B-2 travel visa offering and is intentionally marked coming soon.',
    detailSummary:
      'You can add the trip-purpose guidance, supporting-document checklist, and appointment workflow later. The shell and CTA placement are already in place.',
    completedFormsHeading: 'Forms package for this service',
    completedFormsNote:
      'This B-1/B-2 travel visa service is coming soon. Add the final forms and service details when you are ready.',
    completedForms: ['DS-160'],
    faqs: [
      {
        question: 'What is a B-1/B-2 travel visa used for?',
        answer:
          'The State Department says visitor visas are for temporary business travel (B-1), tourism (B-2), or a combination of both purposes.',
        sourceLabel: 'U.S. Department of State: Visitor Visa',
        sourceUrl: 'https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html',
      },
      {
        question: 'Can I work in the United States on a B-1/B-2 visa?',
        answer:
          'No. The State Department says a person on a visitor visa is not permitted to accept employment or work in the United States.',
        sourceLabel: 'U.S. Department of State: Visitor Visa',
        sourceUrl: 'https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html',
      },
    ],
    serviceIncludes: [
      'A dedicated service overview page for the B-1/B-2 travel visa',
      'A placeholder forms package section you can expand later',
      'A reserved application CTA area for when the workflow is ready',
    ],
    wizardHref: null,
  },
  {
    slug: 'eb1a',
    title: 'EB-1A Visa for Individuals with Extraordinary Ability',
    subtitle: 'For extraordinary ability self-petition green card cases',
    description:
      'A service shell for EB-1A filings, including the immigrant petition and related adjustment documents where applicable.',
    status: 'Coming soon',
    available: false,
    landingForms: ['I-140', 'I-485', 'I-765', 'I-131'],
    landingHighlights: [
      'Immigrant petition and adjustment forms listed up front',
      'Reserved evidence and extraordinary-ability sections',
      'Ready for later qualification and intake details',
    ],
    detailEyebrow: 'Service shell',
    detailIntro:
      'This service page is prepared for EB-1A filings for individuals with extraordinary ability and can be expanded later with evidence strategy and qualification guidance.',
    detailSummary:
      'The shell already includes the forms package area and service overview structure so you can add the rest of the customer-facing content when this filing is ready.',
    completedFormsHeading: 'EB-1A Visa forms we handle',
    completedFormsNote:
      'For EB-1A Visa for Individuals with Extraordinary Ability, the documents we handle currently include the following filing package items.',
    completedForms: [
      'Form I-140, Immigrant Petition for Alien Worker',
      'Form I-485, Application to Register Permanent Residence or Adjust Status',
      'Form I-765, Application for Employment Authorization (if applicable)',
      'Form I-131, Application for Travel Document (if applicable)',
    ],
    faqs: [
      {
        question: 'Do I need a job offer or labor certification for EB-1A?',
        answer:
          'No. USCIS says the extraordinary-ability EB-1 category does not require a job offer or labor certification.',
        sourceLabel: 'USCIS: Employment-Based Immigration: First Preference EB-1',
        sourceUrl: 'https://www.uscis.gov/working-in-the-united-states/permanent-workers/employment-based-immigration-first-preference-eb-1',
      },
      {
        question: 'What standard does USCIS use for EB-1A extraordinary ability?',
        answer:
          'USCIS says you must show sustained national or international acclaim and either meet at least 3 of the listed criteria or show a one-time major achievement.',
        sourceLabel: 'USCIS: Employment-Based Immigration: First Preference EB-1',
        sourceUrl: 'https://www.uscis.gov/working-in-the-united-states/permanent-workers/employment-based-immigration-first-preference-eb-1',
      },
      {
        question: 'What kinds of fields can qualify for EB-1A?',
        answer:
          'USCIS places extraordinary-ability cases in fields such as the sciences, arts, education, business, and athletics.',
        sourceLabel: 'USCIS: Employment-Based Immigration: First Preference EB-1',
        sourceUrl: 'https://www.uscis.gov/working-in-the-united-states/permanent-workers/employment-based-immigration-first-preference-eb-1',
      },
    ],
    serviceIncludes: [
      'A dedicated service overview for EB-1A filings',
      'A forms package section listing the petition and adjustment documents handled by your team',
      'A reserved application CTA area for when the workflow is ready',
    ],
    wizardHref: null,
  },
  {
    slug: 'e2-treaty-investor-visa',
    title: 'E-2 Investor Visa for Entrepreneurs',
    subtitle: 'For treaty investors building or operating a qualifying US business',
    description:
      'A service shell for E-2 investor visa filings, including petition, visa application, and status-change forms.',
    status: 'Coming soon',
    available: false,
    landingForms: ['I-129', 'DS-160', 'DS-156E', 'I-539'],
    landingHighlights: [
      'Investor visa forms listed clearly up front',
      'Reserved business and investment-document sections',
      'Ready for later service detail and intake content',
    ],
    detailEyebrow: 'Service shell',
    detailIntro:
      'This service page is prepared for E-2 investor visa cases for entrepreneurs and can be expanded later with investment requirements, business evidence, and status guidance.',
    detailSummary:
      'The shell already includes the forms package and service overview structure so you can add more detailed customer-facing guidance when this filing is ready.',
    completedFormsHeading: 'E-2 Investor Visa forms we handle',
    completedFormsNote:
      'For E-2 Investor Visa for Entrepreneurs, the documents we handle currently include the following filing package items.',
    completedForms: [
      'Form I-129, Petition for Nonimmigrant Worker',
      'DS-160, Online Nonimmigrant Visa Application',
      'DS-156E, Nonimmigrant Treaty Trader/Investor Application',
      'Form I-539, Application to Extend/Change Nonimmigrant Status',
    ],
    faqs: [
      {
        question: 'Who qualifies for E-2 treaty investor classification?',
        answer:
          'USCIS says the investor generally must be a national of a treaty country, have invested or be actively investing a substantial amount of capital in a bona fide U.S. business, and be coming to develop and direct that enterprise.',
        sourceLabel: 'USCIS: E-2 Treaty Investors',
        sourceUrl: 'https://www.uscis.gov/working-in-the-united-states/temporary-workers/e-2-treaty-investors',
      },
      {
        question: 'Can I use Form I-129 to request E-2 classification from outside the United States?',
        answer:
          'No. USCIS says a request for E-2 classification cannot be made on Form I-129 if the person is physically outside the United States; that path goes through the Department of State.',
        sourceLabel: 'USCIS: E-2 Treaty Investors',
        sourceUrl: 'https://www.uscis.gov/working-in-the-united-states/temporary-workers/e-2-treaty-investors',
      },
      {
        question: 'Can my spouse and children come with me in E-2 status?',
        answer:
          'Usually yes. USCIS says spouses and unmarried children under 21 may seek E-2 dependent classification, and family members already in the United States may use Form I-539 for change or extension of status.',
        sourceLabel: 'USCIS: E-2 Treaty Investors',
        sourceUrl: 'https://www.uscis.gov/working-in-the-united-states/temporary-workers/e-2-treaty-investors',
      },
    ],
    serviceIncludes: [
      'A dedicated service overview for E-2 investor visa filings',
      'A forms package section listing the investor and status documents handled by your team',
      'A reserved application CTA area for when the workflow is ready',
    ],
    wizardHref: null,
  },
  {
    slug: 'o1-extraordinary-individuals',
    title: 'The O-1 Visa for Extraordinary Individuals',
    subtitle: 'For applicants demonstrating extraordinary ability in their field',
    description:
      'A shell for the O-1 service, covering evidence organization and future petition support.',
    status: 'Coming soon',
    available: false,
    landingForms: ['I-129', 'O Supplement'],
    landingHighlights: [
      'Coming-soon service shell',
      'Reserved accomplishments and evidence section',
      'Ready for later intake logic',
    ],
    detailEyebrow: 'Service shell',
    detailIntro:
      'This service page is set up for O-1 filings and is intentionally marked coming soon while the broader workflow is still being defined.',
    detailSummary:
      'The shell already includes a forms package area, FAQ section, and CTA placement so you can add the full evidence and eligibility details later.',
    completedFormsHeading: 'Forms package for this service',
    completedFormsNote:
      'This O-1 service is coming soon. Add the final forms, evidence strategy, and workflow details when you are ready.',
    completedForms: ['I-129', 'O Supplement'],
    faqs: [
      {
        question: 'What is the O-1 visa?',
        answer:
          'USCIS says the O-1 nonimmigrant visa is for people with extraordinary ability in sciences, arts, education, business, or athletics, or extraordinary achievement in motion picture or television work.',
        sourceLabel: 'USCIS: O-1 Visa: Individuals with Extraordinary Ability or Achievement',
        sourceUrl: 'https://www.uscis.gov/working-in-the-united-states/temporary-workers/o-1-visa-individuals-with-extraordinary-ability-or-achievement',
      },
      {
        question: 'How long can the initial O-1 stay last?',
        answer:
          'USCIS says the initial period of stay can be up to three years, and extensions are generally granted in increments of up to one year to complete the same event or activity.',
        sourceLabel: 'USCIS: O-1 Visa: Individuals with Extraordinary Ability or Achievement',
        sourceUrl: 'https://www.uscis.gov/working-in-the-united-states/temporary-workers/o-1-visa-individuals-with-extraordinary-ability-or-achievement',
      },
      {
        question: 'Can my spouse and children come with me in O status?',
        answer:
          'Usually yes. USCIS says a spouse and unmarried children under 21 may be eligible for O-3 classification with the same period of admission limits as the principal applicant.',
        sourceLabel: 'USCIS: O-1 Visa: Individuals with Extraordinary Ability or Achievement',
        sourceUrl: 'https://www.uscis.gov/working-in-the-united-states/temporary-workers/o-1-visa-individuals-with-extraordinary-ability-or-achievement',
      },
    ],
    serviceIncludes: [
      'A dedicated service overview page for O-1 filings',
      'A placeholder forms package and FAQ section you can expand later',
      'A reserved application CTA area for when the workflow is ready',
    ],
    wizardHref: null,
  },
  {
    slug: 'b1-b2-business-trip-visa',
    title: 'B-1/B-2 Travel Visa for Business',
    subtitle: 'For temporary business travel and short-duration professional visits',
    description:
      'A shell for business-visit visa positioning, intake, and supporting-document guidance.',
    status: 'Coming soon',
    available: false,
    landingForms: ['DS-160'],
    landingHighlights: [
      'Coming-soon business-travel shell',
      'Reserved employer and travel-support section',
      'Ready for later service details and intake logic',
    ],
    detailEyebrow: 'Service shell',
    detailIntro:
      'This service page is set up for a B-1/B-2 business-travel offering and is intentionally marked coming soon.',
    detailSummary:
      'The page shell already includes the forms package area and FAQ section so you can add a fuller business-travel workflow later.',
    completedFormsHeading: 'Forms package for this service',
    completedFormsNote:
      'This business-travel visa service is coming soon. Add the final forms and service details when you are ready.',
    completedForms: ['DS-160'],
    faqs: [
      {
        question: 'What kinds of activities are allowed on the business side of a B-1/B-2 visa?',
        answer:
          'The State Department lists activities such as consulting with business associates, attending business or professional conferences, settling an estate, and negotiating contracts.',
        sourceLabel: 'U.S. Department of State: Visitor Visa',
        sourceUrl: 'https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html',
      },
      {
        question: 'Can I work for pay in the United States on a visitor visa?',
        answer:
          'No. The State Department lists employment among the activities that are not permitted on a visitor visa.',
        sourceLabel: 'U.S. Department of State: Visitor Visa',
        sourceUrl: 'https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html',
      },
      {
        question: 'If my plans change while I am in the United States, do I always need a new visa first?',
        answer:
          'Not always. The State Department says some people may be able to request a change of nonimmigrant status through USCIS while in the United States, but once they leave they must apply for a new visa in the proper category.',
        sourceLabel: 'U.S. Department of State: Visitor Visa',
        sourceUrl: 'https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html',
      },
    ],
    serviceIncludes: [
      'A dedicated service overview page for business-travel visa cases',
      'A placeholder forms package and FAQ section you can expand later',
      'A reserved application CTA area for when the workflow is ready',
    ],
    wizardHref: null,
  },
] as const;

export function getFilingService(slug: string): FilingService | undefined {
  return filingServices.find((service) => service.slug === slug);
}
