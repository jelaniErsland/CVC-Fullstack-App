export type VolunteerPreviewResponse = "pending" | "confirmed";

export type VolunteerAssignmentPreview = {
  slug: string;
  title: string;
  date: string;
  time: string;
  location: string;
  crew: string;
  helperCoverage: string;
  response: VolunteerPreviewResponse;
  description: string;
  checkIn: string;
  preparation: string;
  lunch: string;
  contact: string;
  contactHelp: string;
};

export const volunteerPreviewContext = {
  volunteerName: "Alex Rivera",
  volunteerFirstName: "Alex",
  initials: "AR",
  projectName: "Belgrade Major Remodel 2026",
};

export const volunteerPreviewProjectInfo = {
  questionnaire: {
    status: "Ready to review or finish",
    href: "/questionnaire/belgrade-remodel-2026",
  },
  lunch: {
    label: "Next lunch · Wednesday",
    detail: "Soup and salad is available from 11:45 AM in the break area.",
  },
  update: {
    label: "Latest update · Jan 13",
    title: "Gloves and closed-toe shoes",
    detail: "Please bring work gloves for staging or interior work. Closed-toe shoes are required in work areas.",
  },
  help: {
    contact: "Jordan M.",
    detail: "Ask for Jordan or the volunteer check-in contact if you need help when you arrive.",
  },
};

export const volunteerPreviewAssignments: VolunteerAssignmentPreview[] = [
  {
    slug: "material-staging",
    title: "Material staging",
    date: "Wednesday, Jan 14",
    time: "8:00 AM - 2:00 PM",
    location: "West entrance",
    crew: "Logistics team",
    helperCoverage: "1 of 2 helpers confirmed",
    response: "pending",
    description:
      "Help the logistics team receive, sort, and place materials so the next crew can start safely and on time.",
    checkIn: "Use the front desk before entering the work area.",
    preparation: "Bring work gloves and wear closed-toe shoes.",
    lunch: "Soup and salad begins at 11:45 AM in the break area.",
    contact: "Jordan M.",
    contactHelp: "Ask at volunteer check-in if you need help.",
  },
  {
    slug: "drywall-crew",
    title: "Drywall crew",
    date: "Thursday, Jan 15",
    time: "7:30 AM - 3:30 PM",
    location: "Main hall, south wing",
    crew: "Interior crew with Marcus L.",
    helperCoverage: "3 of 4 helpers confirmed",
    response: "confirmed",
    description:
      "Support the interior crew with moving sheets, keeping the work area clear, and preparing materials for installation.",
    checkIn: "Meet the interior crew lead at the main hall check-in table.",
    preparation: "Wear work clothes, closed-toe shoes, and bring gloves if you have them.",
    lunch: "Lunch is available at noon in the fellowship area.",
    contact: "Jordan M.",
    contactHelp: "The crew lead can adjust the work if lifting is not a good fit.",
  },
  {
    slug: "lunch-support",
    title: "Lunch support",
    date: "Friday, Jan 16",
    time: "10:30 AM - 1:30 PM",
    location: "Fellowship area",
    crew: "Food support team",
    helperCoverage: "2 of 3 helpers confirmed",
    response: "confirmed",
    description:
      "Help set out lunch, keep serving areas supplied, and make the break area welcoming for the project crews.",
    checkIn: "Go directly to the fellowship area and ask for the food contact.",
    preparation: "Wear comfortable shoes and bring an apron if you prefer to use your own.",
    lunch: "You are welcome to eat with the volunteer crews after setup.",
    contact: "Priya S.",
    contactHelp: "Ask the food contact about dietary or serving questions.",
  },
  {
    slug: "site-cleanup",
    title: "Site cleanup",
    date: "Saturday, Jan 17",
    time: "9:00 AM - 1:00 PM",
    location: "Main hall and fellowship area",
    crew: "Family volunteer group",
    helperCoverage: "2 of 5 helpers confirmed",
    response: "pending",
    description:
      "Help sweep work areas, collect light trash, and return shared supplies so the site is ready for the next project day.",
    checkIn: "Start at the front desk for an area assignment and supply location.",
    preparation: "Wear work clothes and closed-toe shoes; cleanup gloves are provided.",
    lunch: "A light lunch will be available after cleanup.",
    contact: "Morgan L.",
    contactHelp: "Ask for a lighter cleanup area if you need one.",
  },
];

export function getVolunteerPreviewAssignment(slug: string) {
  return volunteerPreviewAssignments.find((assignment) => assignment.slug === slug);
}

export function getAssignmentDetailHref(slug: string) {
  return `/v/demo/assignments/${slug}`;
}

export function getReminderAssignmentHref(slug: string) {
  return `/v/demo/reminder/${slug}`;
}
