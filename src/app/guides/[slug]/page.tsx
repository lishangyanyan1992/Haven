import { permanentRedirect } from "next/navigation";

import { getAllGuides } from "@/lib/guides";

type GuidePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return getAllGuides().map((guide) => ({ slug: guide.slug }));
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  permanentRedirect(`/blog/${slug}`);
}
