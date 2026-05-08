import re

with open('src/app/page.tsx', 'r') as f:
    text = f.read()

# 1. Add imports
import_str = """import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Calculator, CalendarCheck, Clock, FileText, FolderOpen, Heart, Landmark, MessageCircle, Search, ShieldAlert, Sparkles, Star, Users } from "lucide-react";

import {
  CommunityFeaturePreview,
  DocumentVaultFeaturePreview,
  JobBoardFeaturePreview,
  LayoffFeaturePreview,
  MarketplaceFeaturePreview,
  TimelineFeaturePreview,
  WaitlistFeaturePreview
} from "@/components/app/marketing-feature-previews";
import { ScrollReveal } from "@/components/ui/scroll-reveal";"""

text = re.sub(r'import type \{ Metadata \}.*?from "lucide-react";', import_str, text, flags=re.DOTALL)

# 2. Remove the defined preview components
# They start at "function TimelineFeaturePreview()" and end right before "export default function HomePage"
text = re.sub(r'function TimelineFeaturePreview\(\).*?export default function HomePage', 'export default function HomePage', text, flags=re.DOTALL)

# 3. Add ScrollReveal to Hero Section
# We'll wrap the inner hero container
text = text.replace(
    '<div className="relative z-10 grid gap-8 px-0 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:gap-16 xl:grid-cols-[0.84fr_1.16fr] xl:gap-20 2xl:gap-24">',
    '<ScrollReveal isStaggerContainer className="relative z-10 grid gap-8 px-0 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:gap-16 xl:grid-cols-[0.84fr_1.16fr] xl:gap-20 2xl:gap-24">'
)
# Match its closing div
# The closing div for the hero content grid is tricky. We can just use string replace on the content block.
# the hero end:
#         </div>
#       </section>
text = text.replace(
    '</section>\n\n        <section className={cn(pageSectionClass, "bg-[var(--haven-white)]")} id="features">',
    '  </ScrollReveal>\n        </section>\n\n        <section className={cn(pageSectionClass, "bg-[var(--haven-white)]")} id="features">'
)

# 4. Wrap other sections in ScrollReveal
# We can wrap the inner content container of each section:
text = text.replace(
    '<div className={pageSectionInnerClass}>',
    '<ScrollReveal yOffset={40} className={pageSectionInnerClass}>'
)
text = text.replace(
    '</section>\n\n        <section className={cn(pageSectionClass, "bg-[var(--haven-white)]")} id="how-it-works">',
    '</ScrollReveal>\n        </section>\n\n        <section className={cn(pageSectionClass, "bg-[var(--haven-white)]")} id="how-it-works">'
)
# We will just replace all </section> correctly using simple logic:
# Actually, since we replaced all `<div className={pageSectionInnerClass}>`, we can just replace `<div className={pageSectionInnerClass}>` with `<ScrollReveal className={pageSectionInnerClass}>` and we need to turn the matching closing `</div>` into `</ScrollReveal>`. 
# Or we can just use the React component `<ScrollReveal>` directly replacing the `<section>` wrappers or `<div className={pageSectionInnerClass}>`.

pass
