import { permanentRedirect } from "next/navigation";

export default function GuidesIndexPage() {
  permanentRedirect("/resources?category=h1b");
}
