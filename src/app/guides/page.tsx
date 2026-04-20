import { permanentRedirect } from "next/navigation";

export default function GuidesIndexPage() {
  permanentRedirect("/blog?category=h1b");
}
