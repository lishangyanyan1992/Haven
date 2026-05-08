export type GuideSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type GuideFaq = {
  question: string;
  answer: string;
};

export type Guide = {
  slug: string;
  title: string;
  excerpt: string;
  description: string;
  category: string;
  readingTime: string;
  updatedAt: string;
  author: string;
  summaryPoints: string[];
  sections: GuideSection[];
  faqs: GuideFaq[];
  relatedSlugs: string[];
};
