export type BlogSection = {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
  note?: string;
};

export type BlogSource = {
  title: string;
  url: string;
  publisher: string;
};

export type BlogImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string;
};

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  publishedAt: string;
  readingTime: string;
  author: string;
  seoTitle?: string;
  seoDescription?: string;
  image?: BlogImage;
  keyTakeaways: string[];
  sections: BlogSection[];
  sources?: BlogSource[];
};
