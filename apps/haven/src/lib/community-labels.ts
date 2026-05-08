import type { ImmigrationProfile, PreferenceCategory, VisaType } from "@/types/domain";

type CommunityPostLike = {
  title: string;
  body: string;
  tags: string[];
};

type CommunityAuthorContext = Pick<
  ImmigrationProfile,
  "countryOfBirth" | "visaType" | "preferenceCategory" | "employmentStatus" | "permStage" | "i140Approved" | "i485Filed"
>;

type LabelDetector = {
  label: string;
  patterns?: RegExp[];
  tags?: string[];
};

const LABEL_PRIORITY = [
  "India",
  "China",
  "Mexico",
  "Philippines",
  "South Korea",
  "Canada",
  "Brazil",
  "Nigeria",
  "Pakistan",
  "United Kingdom",
  "United States",
  "H-1B",
  "H-4",
  "H-4 EAD",
  "F-1",
  "STEM OPT",
  "O-1",
  "L-1",
  "B-2",
  "EB-1",
  "EB-2",
  "EB-3",
  "EB-2 NIW",
  "PERM",
  "PERM certified",
  "Approved I-140",
  "I-140",
  "I-485 filed",
  "I-485",
  "AC21",
  "Layoff",
  "Grace period",
  "Job change",
  "Job search",
  "RFE",
  "B-2 bridge"
] as const;

const LABEL_DETECTORS: LabelDetector[] = [
  { label: "India", patterns: [/\bindia\b/i, /\bindian\b/i] },
  { label: "China", patterns: [/\bchina\b/i, /\bchinese\b/i] },
  { label: "Mexico", patterns: [/\bmexico\b/i, /\bmexican\b/i] },
  { label: "Philippines", patterns: [/\bphilippines\b/i, /\bfilipino\b/i, /\bphilippine\b/i] },
  { label: "South Korea", patterns: [/\bsouth korea\b/i, /\bkorea\b/i, /\bkorean\b/i] },
  { label: "Canada", patterns: [/\bcanada\b/i, /\bcanadian\b/i] },
  { label: "Brazil", patterns: [/\bbrazil\b/i, /\bbrazilian\b/i] },
  { label: "Nigeria", patterns: [/\bnigeria\b/i, /\bnigerian\b/i] },
  { label: "Pakistan", patterns: [/\bp[a]kistan\b/i, /\bpakistani\b/i] },
  { label: "United Kingdom", patterns: [/\bunited kingdom\b/i, /\buk\b/i, /\bu\.k\.\b/i, /\bbritain\b/i, /\bbritish\b/i] },
  { label: "United States", patterns: [/\bunited states\b/i, /\busa\b/i, /\bu\.s\.\b/i, /\bamerica\b/i, /\bamerican\b/i] },
  { label: "H-1B", patterns: [/\bh[\s-]?1b\b/i], tags: ["h1b", "h-1b"] },
  { label: "H-4", patterns: [/\bh[\s-]?4\b/i], tags: ["h4", "h-4"] },
  { label: "H-4 EAD", patterns: [/\bh[\s-]?4\s+ead\b/i], tags: ["h4 ead", "h-4 ead"] },
  { label: "F-1", patterns: [/\bf[\s-]?1\b/i], tags: ["f1", "f-1"] },
  { label: "STEM OPT", patterns: [/\bstem\s+opt\b/i], tags: ["stem opt"] },
  { label: "O-1", patterns: [/\bo[\s-]?1\b/i], tags: ["o-1", "o1"] },
  { label: "L-1", patterns: [/\bl[\s-]?1\b/i], tags: ["l-1", "l1"] },
  { label: "B-2", patterns: [/\bb[\s-]?2\b/i], tags: ["b2", "b-2"] },
  { label: "EB-1", patterns: [/\beb[\s-]?1\b/i], tags: ["eb-1", "eb1"] },
  { label: "EB-2", patterns: [/\beb[\s-]?2\b/i], tags: ["eb-2", "eb2"] },
  { label: "EB-3", patterns: [/\beb[\s-]?3\b/i], tags: ["eb-3", "eb3"] },
  { label: "EB-2 NIW", patterns: [/\beb[\s-]?2\s+niw\b/i, /\bniw\b/i], tags: ["eb-2 niw", "niw"] },
  { label: "PERM certified", patterns: [/\bperm certified\b/i] },
  { label: "PERM", patterns: [/\bperm\b/i], tags: ["perm"] },
  { label: "Approved I-140", patterns: [/\bapproved\s+i[\s-]?140\b/i, /\bi[\s-]?140 approved\b/i] },
  { label: "I-140", patterns: [/\bi[\s-]?140\b/i], tags: ["i140", "i-140"] },
  { label: "I-485 filed", patterns: [/\bi[\s-]?485\b.*\bfiled\b/i, /\bfiled\b.*\bi[\s-]?485\b/i] },
  { label: "I-485", patterns: [/\bi[\s-]?485\b/i], tags: ["i485", "i-485"] },
  { label: "AC21", patterns: [/\bac21\b/i], tags: ["ac21"] },
  { label: "Layoff", patterns: [/\blaid off\b/i, /\blayoff\b/i, /\blayoffs\b/i], tags: ["layoff", "layoffs"] },
  { label: "Grace period", patterns: [/\bgrace period\b/i, /\b60-day\b/i, /\b60 day\b/i], tags: ["grace_period", "60_day_window"] },
  { label: "Job change", patterns: [/\bjob change\b/i, /\btransfer\b/i], tags: ["job_change"] },
  { label: "Job search", patterns: [/\bjob search\b/i, /\bjob searching\b/i], tags: ["job_search"] },
  { label: "RFE", patterns: [/\brfe\b/i], tags: ["rfe"] },
  { label: "B-2 bridge", patterns: [/\bb[\s-]?2\b[\s\S]{0,40}\bbridge\b/i, /\bbridge\b[\s\S]{0,40}\bb[\s-]?2\b/i], tags: ["b2_bridge"] }
];

const COUNTRY_LABELS = new Set([
  "India",
  "China",
  "Mexico",
  "Philippines",
  "South Korea",
  "Canada",
  "Brazil",
  "Nigeria",
  "Pakistan",
  "United Kingdom",
  "United States"
]);

function canonicalVisaLabel(value: VisaType) {
  switch (value) {
    case "H1B":
      return "H-1B";
    case "H4":
      return "H-4";
    case "OPT":
      return "F-1";
    case "STEM OPT":
      return "STEM OPT";
    default:
      return value;
  }
}

function canonicalPreferenceLabel(value: PreferenceCategory) {
  return value === "Not sure" ? null : value;
}

function hasMatchingTag(postTags: string[], detectorTags: string[]) {
  return detectorTags.some((tag) => postTags.includes(tag));
}

function addLabel(labels: string[], label: string) {
  if (!labels.includes(label)) {
    labels.push(label);
  }
}

export function getConfirmedCommunityLabels(post: CommunityPostLike, authorContext?: Partial<CommunityAuthorContext>) {
  const labels: string[] = [];
  const normalizedTags = post.tags.map((tag) => tag.trim().toLowerCase());
  const haystack = `${post.title}\n${post.body}\n${post.tags.join(" ")}`;

  if (authorContext?.countryOfBirth && COUNTRY_LABELS.has(authorContext.countryOfBirth)) {
    addLabel(labels, authorContext.countryOfBirth);
  }

  if (authorContext?.visaType && authorContext.visaType !== "GC" && authorContext.visaType !== "Citizen") {
    addLabel(labels, canonicalVisaLabel(authorContext.visaType));
  }

  if (authorContext?.preferenceCategory) {
    const preferenceLabel = canonicalPreferenceLabel(authorContext.preferenceCategory);
    if (preferenceLabel) {
      addLabel(labels, preferenceLabel);
    }
  }

  if (authorContext?.i140Approved) {
    addLabel(labels, "Approved I-140");
  }

  if (authorContext?.permStage === "certified") {
    addLabel(labels, "PERM certified");
  } else if (authorContext?.permStage === "in_progress") {
    addLabel(labels, "PERM");
  }

  if (authorContext?.i485Filed) {
    addLabel(labels, "I-485 filed");
  }

  if (authorContext?.employmentStatus === "laid_off") {
    addLabel(labels, "Layoff");
  } else if (authorContext?.employmentStatus === "actively_searching") {
    addLabel(labels, "Job search");
  }

  for (const detector of LABEL_DETECTORS) {
    const matchesPattern = detector.patterns?.some((pattern) => pattern.test(haystack)) ?? false;
    const matchesTag = detector.tags ? hasMatchingTag(normalizedTags, detector.tags) : false;
    if (matchesPattern || matchesTag) {
      addLabel(labels, detector.label);
    }
  }

  return sortCommunityLabels(labels);
}

export function sortCommunityLabels(labels: string[]) {
  return [...labels].sort((left, right) => {
    const leftIndex = LABEL_PRIORITY.indexOf(left as (typeof LABEL_PRIORITY)[number]);
    const rightIndex = LABEL_PRIORITY.indexOf(right as (typeof LABEL_PRIORITY)[number]);

    if (leftIndex === -1 && rightIndex === -1) {
      return left.localeCompare(right);
    }

    if (leftIndex === -1) {
      return 1;
    }

    if (rightIndex === -1) {
      return -1;
    }

    return leftIndex - rightIndex;
  });
}

export function isCountryCommunityLabel(label: string) {
  return COUNTRY_LABELS.has(label);
}
