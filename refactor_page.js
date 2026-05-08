import fs from 'fs';

const FILE_PATH = 'src/app/page.tsx';
let content = fs.readFileSync(FILE_PATH, 'utf8');

// 1. Update imports
const newImports = `import type { Metadata } from "next";
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
import { ScrollReveal } from "@/components/ui/scroll-reveal";`;

content = content.replace(/import type \{ Metadata \}[\s\S]*?from "lucide-react";/, newImports);

// 2. Remove all preview components functions
content = content.replace(/function TimelineFeaturePreview\(\) \{[\s\S]*?(?=export default function HomePage\(\) \{)/, '');

// 3. Update Hero Section
// Match the hero grid opening
content = content.replace(
  '<div className="relative z-10 grid gap-8 px-0 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:gap-16 xl:grid-cols-[0.84fr_1.16fr] xl:gap-20 2xl:gap-24">',
  '<ScrollReveal isStaggerContainer className="relative z-10 grid gap-8 px-0 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:gap-16 xl:grid-cols-[0.84fr_1.16fr] xl:gap-20 2xl:gap-24">'
);
// Match the exact closing of the hero
const heroClosingTarget = `          </div>
        </section>`;
const heroClosingReplacement = `          </ScrollReveal>
        </section>`;
content = content.replace(heroClosingTarget, heroClosingReplacement);

// Fix pulse animation
content = content.replace(
  'className="absolute inset-x-[-4%] inset-y-4 rounded-[3rem] opacity-[0.32]"',
  'className="absolute inset-x-[-4%] inset-y-4 rounded-[3rem] opacity-[0.32] animate-pulse"'
);

// 4. Wrap other sections with ScrollReveal by targeting EXACT strings.
// There are 6 sections that use `<div className={pageSectionInnerClass}>`
const innerClassStartTarget = '<div className={pageSectionInnerClass}>';
const innerClassStartReplacement = '<ScrollReveal yOffset={30} duration={0.8} className={pageSectionInnerClass}>';

const sectionsReplaces = [
  // Why Haven block
  {
    start: `<div className={pageSectionInnerClass}>
            <div className="max-w-[62ch]">
              <p className="text-label">Why Haven</p>`,
    end: `            </div>
          </div>
        </section>` // the end of Why Haven
  },
  // How it works
  {
    start: `<div className={pageSectionInnerClass}>
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div>
                <p className="text-label">How it works</p>`,
    end: `              <HowItWorksShowcase />
            </div>
          </div>
        </section>`
  },
  // Free companion tool (optional, inside {})
  {
    start: `<div className={pageSectionInnerClass}>
              <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">`,
    end: `                  <p className="text-caption text-center lg:text-right">Takes about 10 minutes</p>
                </div>
              </div>
            </div>
          </section>`
  },
  // Community
  {
    start: `<div className={pageSectionInnerClass}>
            <div className="max-w-[62ch]">
              <p className="text-label">Community stories</p>`,
    end: `                </article>
              ))}
            </div>
          </div>
        </section>`
  },
  // Free tools
  {
    start: `<div className={pageSectionInnerClass}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[62ch]">
              <p className="text-label">Free tools</p>`,
    end: `              </Link>
            );
            })}
          </div>
          </div>
        </section>`
  },
  // Popular guides
  {
    start: `<div className={pageSectionInnerClass}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[62ch]">
              <p className="text-label">Popular guides</p>`,
    end: `            ))}
          </div>
          </div>
        </section>`
  },
  // From the blog
  {
    start: `<div className={pageSectionInnerClass}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[62ch]">
              <p className="text-label">From the blog</p>`,
    end: `            ))}
          </div>
          </div>
        </section>`
  }
];

sectionsReplaces.forEach(sec => {
  content = content.replace(sec.start, sec.start.replace('<div className={pageSectionInnerClass}>', '<ScrollReveal yOffset={30} duration={0.8} className={pageSectionInnerClass}>'));
  // The first `</div>` directly inside `</section>` must be `</ScrollReveal>`
  content = content.replace(sec.end, sec.end.replace('</div>\n        </section>', '</ScrollReveal>\n        </section>').replace('</div>\n          </section>', '</ScrollReveal>\n          </section>'));
});


// Vary CTAs
// 1. "Get Started" in Tools
content = content.replace(
  /className=\{buttonVariants\(\{ variant: "outline" \}\)\} href="\/tools">\n              Get Started/,
  'className={buttonVariants({ variant: "outline" })} href="/tools">\n              Check your dates'
);
// 2. Guides
content = content.replace(
  /className=\{buttonVariants\(\{ variant: "outline" \}\)\} href="\/guides">\n              Get Started/,
  'className={buttonVariants({ variant: "outline" })} href="/guides">\n              Browse all guides'
);
// 3. Blog
content = content.replace(
  /className=\{buttonVariants\(\{ variant: "outline" \}\)\} href="\/blog">\n              Get Started/,
  'className={buttonVariants({ variant: "outline" })} href="/blog">\n              Read the blog'
);

fs.writeFileSync(FILE_PATH, content, 'utf8');
console.log('Done refactoring page.tsx safely');
