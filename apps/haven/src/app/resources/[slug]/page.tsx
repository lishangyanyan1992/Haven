import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { EditorialPostPage, buildEditorialPostMetadata } from "@/components/app/editorial-post-page";
import {
  getAllResourcePostsIncludingUnlisted,
  getEditorialSection,
  getPostBySlug,
  getPostHref
} from "@/lib/blog";

type ResourcePostPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getAllResourcePostsIncludingUnlisted().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: ResourcePostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return { title: "Resources | Haven" };
  }

  return buildEditorialPostMetadata(post, getEditorialSection(post));
}

export default async function ResourcePostPage({ params }: ResourcePostPageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  if (getEditorialSection(post) !== "resources") {
    permanentRedirect(getPostHref(post));
  }

  return <EditorialPostPage post={post} section="resources" />;
}
