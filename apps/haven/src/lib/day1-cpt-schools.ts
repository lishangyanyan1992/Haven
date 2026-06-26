export type Day1CptSchoolSource = {
  label: string;
  url: string;
};

export type Day1CptSchool = {
  id: string;
  name: string;
  location: string;
  website: string;
  logoDomain: string;
  verification: string;
  cptTiming: string;
  nextCohort: string;
  tuition: string;
  degrees: string[];
  requirements: string[];
  caveats: string[];
  sources: Day1CptSchoolSource[];
};

export const day1CptSchools: Day1CptSchool[] = [
  {
    id: "bay-atlantic-university",
    name: "Bay Atlantic University",
    location: "Washington, DC",
    website: "https://bau.edu/",
    logoDomain: "bau.edu",
    verification:
      "Official BAU Day-1 CPT page says eligible F-1 graduate students may use integrated CPT from the first semester when practical training is integral to the program.",
    cptTiming: "First semester / first day of program for eligible integrated-CPT students; DSO authorization required before work.",
    nextCohort: "Fall 2026 first day of class: August 19, 2026. Fall registration opens August 5, 2026.",
    tuition:
      "Use BAU's official tuition estimator for current net cost. BAU's public tuition-assistance page lists agreement-based master's assistance amounts, so final cost is student-specific.",
    degrees: [
      "MS Artificial Intelligence Engineering",
      "MS Software Engineering",
      "MS Cloud Computing Engineering",
      "MS Cyber Security",
      "MS Big Data Analytics",
      "MBA / dual MBA + Big Data Analytics tracks may require DSO confirmation"
    ],
    requirements: [
      "Training must be directly related to the major and authorized by the university.",
      "CPT is authorized per semester/session.",
      "Maintain valid F-1 status, full-time enrollment, and SEVIS compliance.",
      "Confirm whether your selected professional hybrid path uses immediate CPT or the standard CPT-after-two-semesters policy."
    ],
    caveats: [
      "BAU has separate pages with different CPT wording for different program paths.",
      "Do not rely on a generic program page; ask the DSO about your exact degree, intake, and CPT course."
    ],
    sources: [
      { label: "Day-1 CPT page", url: "https://bau.edu/day-1-cpt/" },
      { label: "Academic calendar", url: "https://bau.edu/academic-calendar/" },
      { label: "Professional master's path", url: "https://bau.edu/program/professional-masters-program/" },
      { label: "Master's programs", url: "https://bau.edu/masters-programs/" },
      { label: "Tuition & fees", url: "https://bau.edu/admissions/tuition-fees/" }
    ]
  },
  {
    id: "harrisburg-university",
    name: "Harrisburg University",
    location: "Harrisburg, PA",
    website: "https://www.harrisburgu.edu/",
    logoDomain: "harrisburgu.edu",
    verification:
      "Official international admissions/FAQ pages say the earliest possible CPT start date for eligible students is the start of the first semester.",
    cptTiming: "Start of the first semester for eligible students; CPT must be on the I-20 before employment starts.",
    nextCohort: "Fall 2026 executive graduate classes begin August 29, 2026.",
    tuition: "International graduate program tuition is listed as $5,730 per semester for six credits, including a $500 program fee.",
    degrees: [
      "MS Analytics",
      "MS Information Systems Engineering and Management",
      "MS Project Management",
      "MS Learning Technologies and Media Systems",
      "Other HU graduate programs require program-specific CPT confirmation"
    ],
    requirements: [
      "Submit the CPT request through HU with the correct CPT start and end dates.",
      "CPT authorization is entered in SEVIS for up to 12 months at a time.",
      "Keep CPT tied to the academic program and workplace learning requirement."
    ],
    caveats: [
      "The school uses 'eligible students' language; CPT is not automatic.",
      "Confirm whether the job, employer, and location match the degree plan before enrolling."
    ],
    sources: [
      { label: "International admissions CPT FAQ", url: "https://www.harrisburgu.edu/international/admissions/" },
      {
        label: "International graduate tuition",
        url: "https://www.harrisburgu.edu/tuition-financial-aid/tuition/graduate-level-curricular-practical-training/"
      },
      {
        label: "2026-27 executive calendar",
        url: "https://www.harrisburgu.edu/wp-content/uploads/2026-2027-Master-Doctorate-Executive-Academic-Calendar.pdf"
      }
    ]
  },
  {
    id: "westcliff-university",
    name: "Westcliff University",
    location: "Irvine, CA",
    website: "https://www.westcliff.edu/",
    logoDomain: "westcliff.edu",
    verification:
      "Official CPT guidance says a new student's earliest CPT start date is the session/semester start date if the application is processed in SEVIS before that date.",
    cptTiming:
      "New students: session/semester start date if processed on time. Current students may request around 28-30 days before the next session.",
    nextCohort: "Summer 2026 Session 6 starts June 29, 2026; Fall 2026 Session 1 starts August 31, 2026.",
    tuition:
      "2026-27 international F-1 master's tuition is $835/credit; professional master's is $875/credit. A 36-credit master's totals tuition before fees.",
    degrees: [
      "MBA and professional MBA tracks",
      "MS Computer Science / IT / Engineering Management style graduate tracks require confirmation",
      "DBA and professional doctorate tracks require confirmation"
    ],
    requirements: [
      "CPT must be processed in SEVIS before the requested start date; no backdating.",
      "Submit complete employer and supporting documents.",
      "Maintain F-1 status and follow session/semester renewal deadlines."
    ],
    caveats: [
      "The next closest start date is very close to the current June 26, 2026 snapshot; late applicants should confirm feasibility.",
      "Program-specific CPT availability and professional tuition category should be verified before deposit."
    ],
    sources: [
      { label: "CPT FAQ", url: "https://services.westcliff.edu/TDClient/48/Portal/KB/ArticleDet?ID=837" },
      { label: "Academic calendar", url: "https://www.westcliff.edu/financial-aid/important-dates/" },
      { label: "International tuition", url: "https://www.westcliff.edu/admissions/international-students/" }
    ]
  },
  {
    id: "international-american-university",
    name: "International American University",
    location: "Los Angeles, CA",
    website: "https://iaula.edu/",
    logoDomain: "iaula.edu",
    verification:
      "Official CPT page says master's and doctoral students are eligible for Day 1 CPT and required by the curriculum to participate in an internship immediately.",
    cptTiming: "Immediate internship participation for eligible master's and doctoral students after DSO authorization.",
    nextCohort: "Summer Session 2 classes begin June 29, 2026; IAU also lists Fall/Spring/Summer session structure.",
    tuition:
      "IAU San Diego tuition page lists master's tuition at $350/unit for 36 units, with a displayed total of $12,600; IAU announced a Fall 2026 increase.",
    degrees: [
      "MBA",
      "Doctor of Business Administration",
      "Doctor of Management",
      "Other graduate programs require IAU confirmation"
    ],
    requirements: [
      "Enroll in the corresponding internship course, BUS 440/640, worth one unit per session.",
      "Undergraduate students must complete one academic year first; Day 1 CPT language applies to graduate students.",
      "Keep employment directly related to the major and authorized on the I-20."
    ],
    caveats: [
      "Tuition is changing effective Fall 2026, so verify the current rate before applying.",
      "The official CPT page states graduate eligibility, but the exact degree and campus should be confirmed."
    ],
    sources: [
      { label: "CPT page", url: "https://iaula.edu/cpt/" },
      { label: "Academic calendar", url: "https://iaula.edu/calendar/" },
      { label: "Tuition fees", url: "https://sd.iaula.edu/tuition-fees/" },
      { label: "IAU news", url: "https://iaula.edu/" }
    ]
  },
  {
    id: "trine-university",
    name: "Trine University",
    location: "Angola, IN / hybrid centers",
    website: "https://www.trine.edu/",
    logoDomain: "trine.edu",
    verification:
      "Official graduate CPT guidance says the CPT start date can be on or after the program start date, subject to prerequisites.",
    cptTiming: "On or after program start date; students can submit CPT applications up to 30 days before desired start.",
    nextCohort: "Fall I 2026 immigration check-in/program start: July 27, 2026; class/session start: August 24, 2026.",
    tuition:
      "Hybrid master's tuition is $575/credit, with a $500 one-time international enrollment fee and health insurance charges listed separately.",
    degrees: [
      "MBA",
      "MS Business Analytics",
      "MS Engineering Management",
      "MS Information Studies",
      "Doctor of Information Technology"
    ],
    requirements: [
      "Students need an SSN or unpaid work to start CPT immediately.",
      "Maintain cumulative GPA of 3.0.",
      "Take and pass BA 6000Z Graduate Internship every semester authorized to work.",
      "Be fully enrolled and have no account holds."
    ],
    caveats: [
      "Trine explicitly says it will not expedite CPT applications.",
      "Initial CPT review can take up to 14 business days, longer if materials are incomplete."
    ],
    sources: [
      { label: "CPT information", url: "https://www.trine.edu/international/graduate/cpt-information.aspx" },
      { label: "Orientation dates", url: "https://www.trine.edu/international/graduate/international-orientation.aspx" },
      { label: "International tuition", url: "https://www.trine.edu/international/graduate/international-tuition.aspx" }
    ]
  },
  {
    id: "mcdaniel-college",
    name: "McDaniel College",
    location: "Westminster, MD",
    website: "https://www.mcdaniel.edu/",
    logoDomain: "mcdaniel.edu",
    verification:
      "Official M.S. Data Analytics page says the STEM-designated program offers Day-1 CPT for F-1 international students.",
    cptTiming: "Day-1 CPT for the M.S. Data Analytics program; confirm I-20 start and authorization date with the DSO.",
    nextCohort:
      "Official graduate admissions page lists Summer 2026 Session II dates through August 16, 2026; third-party intake pages list Fall 2026 program start around August 2026, so confirm with McDaniel.",
    tuition:
      "M.S. Data Analytics tuition is $700/credit, plus listed residency and practicum fees. Program page lists 30-36 credits total.",
    degrees: ["M.S. Data Analytics"],
    requirements: [
      "Complete experiential practica in Data Analytics.",
      "Use the hybrid low-residency format if F-1 status requires in-person attendance.",
      "Confirm residency, practicum, and CPT paperwork deadlines before transferring SEVIS."
    ],
    caveats: [
      "The official page confirms Day-1 CPT but does not expose every intake date in the public card text.",
      "Use McDaniel admissions/DSO for the actual nearest F-1 transfer deadline."
    ],
    sources: [
      {
        label: "M.S. Data Analytics",
        url: "https://www.mcdaniel.edu/academics/graduate-professional-studies/data-analytics-ms-stem-designated-day-1-cpt"
      },
      { label: "Graduate admissions dates", url: "https://www.mcdaniel.edu/admissions-cost/graduate-admissions" },
      { label: "Graduate tuition", url: "https://www.mcdaniel.edu/admissions-cost/cost-financial-aid/graduate-tuition-fees" }
    ]
  },
  {
    id: "goldey-beacom-college",
    name: "Goldey-Beacom College",
    location: "Wilmington, DE",
    website: "https://www.gbc.edu/",
    logoDomain: "gbc.edu",
    verification:
      "Official international admissions page says eligible graduate students can begin CPT from their first day of studies.",
    cptTiming: "First day of studies for eligible graduate students; DSO approval required.",
    nextCohort: "2026-27 calendar points to Fall Session I classes beginning in late August 2026; confirm exact graduate start date.",
    tuition: "2026-27 graduate master-level tuition is $725/credit for domestic and international students.",
    degrees: [
      "Graduate master's programs, including MBA tracks",
      "STEM/analytics-aligned options require program-specific confirmation"
    ],
    requirements: [
      "Graduate students must be eligible under GBC's F-1 CPT rules.",
      "Confirm Graduate F-1 Students and CPT requirements before relying on first-day authorization.",
      "Maintain full-time F-1 enrollment and school authorization."
    ],
    caveats: [
      "The admissions page confirms first-day CPT eligibility but does not identify every eligible degree in the visible text.",
      "Ask whether your prior F-1 history affects immediate CPT eligibility."
    ],
    sources: [
      { label: "International admissions", url: "https://www.gbc.edu/admissions-aid/international-admissions/" },
      { label: "Graduate admissions", url: "https://www.gbc.edu/admissions-aid/graduate-admissions/" },
      { label: "Tuition and fees", url: "https://www.gbc.edu/admissions-aid/tuition-fees/" },
      { label: "Academic calendar", url: "https://www.gbc.edu/academics/academic-resources/academic-calendar/" }
    ]
  },
  {
    id: "faulkner-university",
    name: "Faulkner University",
    location: "Montgomery, AL",
    website: "https://www.faulkner.edu/",
    logoDomain: "faulkner.edu",
    verification:
      "Official international graduate page says graduate students can request CPT in their first semester and that CPT is integral to graduate studies.",
    cptTiming: "First semester request for graduate students; not necessarily before the degree starts.",
    nextCohort: "Fall 2026 full-term traditional and graduate term runs August 17, 2026 to December 10, 2026.",
    tuition:
      "M.S. Management is listed at $555/semester hour for one-year and $500/semester hour for two-year tracks; other graduate tuition varies by program.",
    degrees: [
      "M.S. Management",
      "Other graduate degrees require CPT office confirmation"
    ],
    requirements: [
      "CPT must be directly tied to the program of study.",
      "Track full-time CPT carefully; 12 months or more of full-time CPT removes OPT eligibility.",
      "Part-time CPT has no month limit listed on the official page."
    ],
    caveats: [
      "The official page says students can request CPT; it does not say approval is automatic.",
      "Confirm whether your exact program has an in-person or hybrid requirement compatible with F-1."
    ],
    sources: [
      { label: "International graduate CPT", url: "https://www.faulkner.edu/graduate/international-students/" },
      {
        label: "Tuition and fees",
        url: "https://www.faulkner.edu/student-resources/student-accounts/student-accounts-tuition-and-fees/"
      },
      {
        label: "2026-27 academic calendar",
        url: "https://www.faulkner.edu/wp-content/uploads/Academic-Calendar-FL26-SU27-1.pdf"
      }
    ]
  },
  {
    id: "st-cloud-state-university",
    name: "St. Cloud State University",
    location: "St. Cloud / Brooklyn Park, MN",
    website: "https://www.stcloudstate.edu/",
    logoDomain: "stcloudstate.edu",
    verification:
      "Official Engineering Management pages describe part-time Day-1 CPT availability for eligible EMEM international students.",
    cptTiming: "Part-time Day-1 CPT for EMEM; full-time CPT has additional credit/course requirements.",
    nextCohort: "Fall 2026 semester begins August 24, 2026.",
    tuition:
      "EMEM page says tuition is the same for on-campus, online, out-of-state, and international students and refers students to SCSU tuition/fees for current rates.",
    degrees: [
      "Executive Master of Engineering Management",
      "Master of Engineering Management has CPT after completing required credits, not Day-1 CPT"
    ],
    requirements: [
      "For part-time Day-1 CPT, upload a transcript showing required enrollment.",
      "Full-time CPT requires completion of 30 EMEM credits and enrollment in EM 699/696.",
      "Maintain program admission requirements and full-time F-1 status where required."
    ],
    caveats: [
      "Do not confuse EMEM part-time Day-1 CPT with MEM CPT after 30/24 credits.",
      "Verify tuition in the current SCSU tuition table because the EMEM page points out rates may change."
    ],
    sources: [
      { label: "Engineering Management overview", url: "https://www.stcloudstate.edu/engineeringmanagement/" },
      { label: "EMEM course schedule", url: "https://www.stcloudstate.edu/engineeringmanagement/emem/courses.aspx" },
      { label: "EMEM CPT", url: "https://www.stcloudstate.edu/engineeringmanagement/emem/cpt.aspx" },
      { label: "Academic calendar", url: "https://www.stcloudstate.edu/events/academic/academic-fy27.aspx" }
    ]
  },
  {
    id: "florida-southern-college",
    name: "Florida Southern College",
    location: "Lakeland, FL",
    website: "https://www.flsouthern.edu/",
    logoDomain: "flsouthern.edu",
    verification:
      "Official international graduate page says all students are eligible for Day 1 CPT, and individual program pages repeat Day 1 CPT language.",
    cptTiming: "Day 1 CPT for eligible international graduate students, after school authorization.",
    nextCohort: "Nearest listed program start after June 26, 2026 is August 25, 2026 for several graduate programs.",
    tuition: "2026-27 estimated tuition and fee range: $10,600 for MSA to $12,520 for MBA.",
    degrees: [
      "M.S. Analytics",
      "MBA Business Analytics",
      "M.S. Industrial and Organizational Psychology"
    ],
    requirements: [
      "Use CPT to apply classroom knowledge immediately while maintaining F-1 status.",
      "Confirm the specific program is available to international graduate students.",
      "Maintain program enrollment and DSO-authorized CPT."
    ],
    caveats: [
      "The international graduate page says all students are eligible, but the program page should still be checked.",
      "Tuition varies by graduate program."
    ],
    sources: [
      {
        label: "International graduate students",
        url: "https://flsouthern.edu/admissions/adult-graduate/international-graduate-students"
      },
      {
        label: "M.S. Analytics",
        url: "https://www.flsouthern.edu/academic-life/all-academic-programs/adult/graduate/master-of-science-in-analytics"
      },
      {
        label: "MBA Business Analytics",
        url: "https://www.flsouthern.edu/academic-life/all-academic-programs/adult/graduate/master-of-business-administration-business-analytics"
      },
      {
        label: "M.S. I/O Psychology",
        url: "https://www.flsouthern.edu/academic-life/all-academic-programs/adult/graduate/master-of-science-in-industrial-and-organizational"
      }
    ]
  },
  {
    id: "oklahoma-christian-university",
    name: "Oklahoma Christian University",
    location: "Oklahoma City, OK",
    website: "https://www.oc.edu/",
    logoDomain: "oc.edu",
    verification:
      "Official international graduate degrees page says students in a master's program are eligible for Day 1 CPT.",
    cptTiming: "Day 1 CPT for eligible master's students; job offer and approved internship course are part of OC CPT process.",
    nextCohort: "Fall 2026 Term 1 starts August 24, 2026; international transfer deadline listed as August 10, 2026 for MSCS.",
    tuition: "MSCS tuition is listed as $625/credit plus a $25/credit international student fee.",
    degrees: [
      "M.S. Computer Science for F-1 on-campus study",
      "Online business and systems programs are not eligible for F-1 study in the U.S."
    ],
    requirements: [
      "Have a job offer.",
      "Enroll in an approved internship course.",
      "Work with academic advisor/registrar and complete the CPT application."
    ],
    caveats: [
      "OC's online graduate business and systems programs are not F-1 eligible for U.S. study.",
      "Use the engineering/computer science deadline page for MSCS, not the business-school deadline page."
    ],
    sources: [
      { label: "International graduate degrees", url: "https://www.oc.edu/academics/international-graduate-degrees" },
      {
        label: "MSCS deadlines",
        url: "https://www.oc.edu/academics/college-of-engineering-computer-science/graduate-school-of-engineering-computer-science/application-deadlines"
      },
      {
        label: "Current international resources",
        url: "https://www.oc.edu/admissions/international-admissions/resources-for-current-international-students"
      }
    ]
  },
  {
    id: "ottawa-university",
    name: "Ottawa University",
    location: "Overland Park, KS / Phoenix, AZ / Brookfield, WI",
    website: "https://www.ottawa.edu/",
    logoDomain: "ottawa.edu",
    verification:
      "Official EMBA pages say F-1 students in the EMBA must have CPT for the workplace practicum requirement.",
    cptTiming:
      "CPT is required during the EMBA and may be part-time or full-time; confirm first eligible authorization date with International Programs.",
    nextCohort:
      "Ottawa inquiry forms list six yearly start-term options: January, March, May, July, August, and October. Next likely intake after June 26, 2026 is July 2026; confirm exact EMBA date.",
    tuition: "2026-27 MBA tuition is listed at $659/credit, with standard application and conferral fees listed separately.",
    degrees: ["Executive Master in Business Administration (EMBA w/ CPT)"],
    requirements: [
      "Maintain eligible CPT employment for the duration of study.",
      "Work no less than five hours per week under the degree terms.",
      "CPT is requested/approved by the Executive Practicum instructor and authorized by International Programs."
    ],
    caveats: [
      "Official pages confirm CPT is required but do not expose a specific Day-1 authorization date in the visible page copy.",
      "Students should confirm whether July or August 2026 is the next open EMBA CPT cohort before relying on timing."
    ],
    sources: [
      { label: "International EMBA CPT page", url: "https://www.ottawa.edu/professional-and-online/academics/international-students/emba" },
      { label: "EMBA program page", url: "https://www.ottawa.edu/academics/school-of-business/degree-programs/graduate/executive-mba" },
      { label: "Tuition and fees", url: "https://www.ottawa.edu/professional-and-online/tuition-and-financial-aid/tuition-and-fees" },
      { label: "Start-term inquiry form", url: "https://www.ottawa.edu/degreesppc/overland-park.asp" }
    ]
  }
];

