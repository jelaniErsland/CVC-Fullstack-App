export type AssignmentStatus =
  | "Confirmed"
  | "Pending"
  | "Denied"
  | "Needs reply"
  | "Complete"
  | "Open";
export type ProjectStatus = "open" | "upcoming" | "archived";
export type PillStatus = AssignmentStatus | ProjectStatus;

export type Project = {
  id: string;
  name: string;
  location: string;
  phase: string;
  status: ProjectStatus;
  dateRange: string;
  workdays: number;
  timezone: string;
  stats: {
    volunteers: number;
    assignments: number;
    confirmedPercent: number;
    pending: number;
  };
};

export type Assignment = {
  id: string;
  projectId: string;
  date: string;
  time: string;
  role: string;
  crew: string;
  location: string;
  status: AssignmentStatus;
};

export type VolunteerAssignment = {
  id: string;
  volunteerId: string;
  projectId: string;
  date: string;
  time: string;
  role: string;
  crew: string;
  location: string;
  status: AssignmentStatus;
  period: "upcoming" | "past";
};

export type Volunteer = {
  id: string;
  name: string;
  congregation: string;
  email: string;
  phone: string;
  roles: string[];
  skills: string[];
  tags: string[];
  assignmentCounts: {
    confirmed: number;
    pending: number;
    denied: number;
  };
};

export type LunchItem = {
  id: string;
  projectId: string;
  day: string;
  details: string;
};

export type Announcement = {
  id: string;
  projectId: string;
  message: string;
};

export type ProjectInfo = {
  projectId: string;
  coordinator: string;
  address: string;
  emergencyContact: string;
};

export type MockUser = {
  id: string;
  name: string;
  email: string;
  role: "Project CVC / Owner";
};

export type ProjectContacts = {
  projectId: string;
  owner: MockUser;
  cvcAssistants: string[];
  foodContact?: string;
  foodAssistants: string[];
  securityContact?: string;
  securityAssistants: string[];
};

export const currentMockUser: MockUser = {
  id: "mock-owner",
  name: "Jordan Miller",
  email: "jordan.miller@example.com",
  role: "Project CVC / Owner",
};

export const projects: Project[] = [
  {
    id: "belgrade-remodel-2026",
    name: "Belgrade Major Remodel 2026",
    location: "Belgrade, MT",
    phase: "Interior remodel",
    status: "open",
    dateRange: "Jan 12 - Jan 24, 2026",
    workdays: 8,
    timezone: "America/Denver",
    stats: {
      volunteers: 108,
      assignments: 164,
      confirmedPercent: 82,
      pending: 19,
    },
  },
  {
    id: "bozeman-refresh",
    name: "Bozeman Kingdom Hall Refresh",
    location: "Bozeman, MT",
    phase: "Finish work",
    status: "upcoming",
    dateRange: "Feb 9 - Feb 14, 2026",
    workdays: 5,
    timezone: "America/Denver",
    stats: {
      volunteers: 42,
      assignments: 58,
      confirmedPercent: 61,
      pending: 14,
    },
  },
  {
    id: "helena-roofing",
    name: "Helena Roofing Support",
    location: "Helena, MT",
    phase: "Exterior support",
    status: "upcoming",
    dateRange: "Mar 6 - Mar 8, 2026",
    workdays: 3,
    timezone: "America/Denver",
    stats: {
      volunteers: 24,
      assignments: 31,
      confirmedPercent: 48,
      pending: 12,
    },
  },
  {
    id: "billings-landscape",
    name: "Billings Landscape Weekend",
    location: "Billings, MT",
    phase: "Grounds",
    status: "archived",
    dateRange: "Sep 19 - Sep 21, 2025",
    workdays: 3,
    timezone: "America/Denver",
    stats: {
      volunteers: 36,
      assignments: 44,
      confirmedPercent: 100,
      pending: 0,
    },
  },
];

export const assignments: Assignment[] = [
  {
    id: "frame-jan-12",
    projectId: "belgrade-remodel-2026",
    date: "Monday, Jan 12",
    time: "7:30 AM - 3:30 PM",
    role: "Interior framing support",
    crew: "Crew B with Marcus L.",
    location: "Main hall, north wing",
    status: "Confirmed",
  },
  {
    id: "stage-jan-14",
    projectId: "belgrade-remodel-2026",
    date: "Wednesday, Jan 14",
    time: "8:00 AM - 2:00 PM",
    role: "Material staging",
    crew: "Logistics team",
    location: "West entrance",
    status: "Pending",
  },
  {
    id: "cleanup-jan-17",
    projectId: "belgrade-remodel-2026",
    date: "Saturday, Jan 17",
    time: "9:00 AM - 1:00 PM",
    role: "Final cleanup",
    crew: "Family volunteer group",
    location: "Fellowship area",
    status: "Needs reply",
  },
];

export const volunteers: Volunteer[] = [
  {
    id: "alex-rivera",
    name: "Alex Rivera",
    congregation: "Belgrade",
    email: "alex.rivera@example.com",
    phone: "(406) 555-0138",
    roles: ["Crew Lead", "Interior"],
    skills: ["Framing", "Drywall", "Safety check-in"],
    tags: ["Weekdays", "Lift certified"],
    assignmentCounts: {
      confirmed: 4,
      pending: 1,
      denied: 0,
    },
  },
  {
    id: "mia-thompson",
    name: "Mia Thompson",
    congregation: "Belgrade",
    email: "mia.thompson@example.com",
    phone: "(406) 555-0194",
    roles: ["Volunteer", "Food"],
    skills: ["Meal service", "Hospitality", "Cleanup"],
    tags: ["Saturday", "Can bring supplies"],
    assignmentCounts: {
      confirmed: 2,
      pending: 2,
      denied: 1,
    },
  },
  {
    id: "marcus-lee",
    name: "Marcus Lee",
    congregation: "Bozeman",
    email: "marcus.lee@example.com",
    phone: "(406) 555-0112",
    roles: ["Crew Lead", "Logistics"],
    skills: ["Material staging", "Inventory", "Forklift"],
    tags: ["Weekdays", "Early arrival"],
    assignmentCounts: {
      confirmed: 5,
      pending: 0,
      denied: 0,
    },
  },
  {
    id: "priya-santos",
    name: "Priya Santos",
    congregation: "Bozeman",
    email: "priya.santos@example.com",
    phone: "(406) 555-0177",
    roles: ["Food Contact"],
    skills: ["Lunch planning", "Dietary notes", "Volunteer care"],
    tags: ["Coordinator", "Text preferred"],
    assignmentCounts: {
      confirmed: 3,
      pending: 1,
      denied: 0,
    },
  },
  {
    id: "caleb-ross",
    name: "Caleb Ross",
    congregation: "Helena",
    email: "caleb.ross@example.com",
    phone: "(406) 555-0163",
    roles: ["Security", "Night Watch"],
    skills: ["Site walk-through", "Lockup", "Radio"],
    tags: ["Evenings", "Background checked"],
    assignmentCounts: {
      confirmed: 2,
      pending: 1,
      denied: 1,
    },
  },
  {
    id: "nora-bennett",
    name: "Nora Bennett",
    congregation: "Helena",
    email: "nora.bennett@example.com",
    phone: "(406) 555-0188",
    roles: ["Volunteer"],
    skills: ["Painting", "Detail finish", "Cleanup"],
    tags: ["Family crew", "Saturday"],
    assignmentCounts: {
      confirmed: 1,
      pending: 0,
      denied: 0,
    },
  },
  {
    id: "evan-brooks",
    name: "Evan Brooks",
    congregation: "Belgrade",
    email: "evan.brooks@example.com",
    phone: "(406) 555-0146",
    roles: ["Food Assistant", "Runner"],
    skills: ["Errands", "Setup", "Serving"],
    tags: ["Flexible", "Truck available"],
    assignmentCounts: {
      confirmed: 2,
      pending: 1,
      denied: 0,
    },
  },
  {
    id: "leah-johnson",
    name: "Leah Johnson",
    congregation: "Bozeman",
    email: "leah.johnson@example.com",
    phone: "(406) 555-0151",
    roles: ["Volunteer"],
    skills: ["Check-in desk", "Data entry", "Announcements"],
    tags: ["Admin support", "No ladders"],
    assignmentCounts: {
      confirmed: 0,
      pending: 0,
      denied: 0,
    },
  },
];

export const volunteerAssignments: VolunteerAssignment[] = [
  {
    id: "alex-frame-jan-12",
    volunteerId: "alex-rivera",
    projectId: "belgrade-remodel-2026",
    date: "Monday, Jan 12",
    time: "7:30 AM - 3:30 PM",
    role: "Interior framing support",
    crew: "Crew B",
    location: "Main hall, north wing",
    status: "Confirmed",
    period: "upcoming",
  },
  {
    id: "alex-drywall-jan-15",
    volunteerId: "alex-rivera",
    projectId: "belgrade-remodel-2026",
    date: "Thursday, Jan 15",
    time: "8:00 AM - 2:00 PM",
    role: "Drywall prep",
    crew: "Interior crew",
    location: "Classroom hallway",
    status: "Pending",
    period: "upcoming",
  },
  {
    id: "mia-lunch-jan-14",
    volunteerId: "mia-thompson",
    projectId: "belgrade-remodel-2026",
    date: "Wednesday, Jan 14",
    time: "10:30 AM - 1:30 PM",
    role: "Lunch service",
    crew: "Food team",
    location: "Break area",
    status: "Confirmed",
    period: "upcoming",
  },
  {
    id: "mia-cleanup-denied",
    volunteerId: "mia-thompson",
    projectId: "belgrade-remodel-2026",
    date: "Saturday, Jan 17",
    time: "9:00 AM - 1:00 PM",
    role: "Final cleanup",
    crew: "Family volunteer group",
    location: "Fellowship area",
    status: "Denied",
    period: "past",
  },
  {
    id: "marcus-staging-jan-14",
    volunteerId: "marcus-lee",
    projectId: "belgrade-remodel-2026",
    date: "Wednesday, Jan 14",
    time: "8:00 AM - 2:00 PM",
    role: "Material staging lead",
    crew: "Logistics team",
    location: "West entrance",
    status: "Confirmed",
    period: "upcoming",
  },
  {
    id: "priya-food-jan-12",
    volunteerId: "priya-santos",
    projectId: "belgrade-remodel-2026",
    date: "Monday, Jan 12",
    time: "9:30 AM - 1:30 PM",
    role: "Lunch coordinator",
    crew: "Food team",
    location: "Break area",
    status: "Confirmed",
    period: "upcoming",
  },
  {
    id: "caleb-security-jan-16",
    volunteerId: "caleb-ross",
    projectId: "belgrade-remodel-2026",
    date: "Friday, Jan 16",
    time: "6:00 PM - 10:00 PM",
    role: "Security walk-through",
    crew: "Night Watch",
    location: "Full site",
    status: "Pending",
    period: "upcoming",
  },
  {
    id: "nora-paint-jan-17",
    volunteerId: "nora-bennett",
    projectId: "belgrade-remodel-2026",
    date: "Saturday, Jan 17",
    time: "8:30 AM - 12:30 PM",
    role: "Finish paint touchups",
    crew: "Finish team",
    location: "Entry corridor",
    status: "Confirmed",
    period: "upcoming",
  },
  {
    id: "evan-runner-jan-14",
    volunteerId: "evan-brooks",
    projectId: "belgrade-remodel-2026",
    date: "Wednesday, Jan 14",
    time: "10:00 AM - 2:00 PM",
    role: "Food runner",
    crew: "Food team",
    location: "Kitchen and supply drop",
    status: "Pending",
    period: "upcoming",
  },
];

export const lunches: LunchItem[] = [
  {
    id: "lunch-jan-12",
    projectId: "belgrade-remodel-2026",
    day: "Monday",
    details: "Sandwich bar at 12:00 PM in the break area.",
  },
  {
    id: "lunch-jan-14",
    projectId: "belgrade-remodel-2026",
    day: "Wednesday",
    details: "Soup and salad from 11:45 AM to 12:30 PM.",
  },
  {
    id: "lunch-jan-17",
    projectId: "belgrade-remodel-2026",
    day: "Saturday",
    details: "Light lunch after cleanup for all volunteers.",
  },
];

export const announcements: Announcement[] = [
  {
    id: "parking",
    projectId: "belgrade-remodel-2026",
    message: "Parking has moved to the east lot for weekday crews.",
  },
  {
    id: "ppe",
    projectId: "belgrade-remodel-2026",
    message: "Please bring gloves and closed-toe shoes for staging shifts.",
  },
  {
    id: "check-in",
    projectId: "belgrade-remodel-2026",
    message: "Check in with the front desk before entering work areas.",
  },
];

export const projectInfo: ProjectInfo[] = [
  {
    projectId: "belgrade-remodel-2026",
    coordinator: "Jordan M.",
    address: "1290 Frontage Road, Belgrade, MT",
    emergencyContact: "Posted at the volunteer check-in desk.",
  },
];

export const projectContacts: ProjectContacts[] = [
  {
    projectId: "belgrade-remodel-2026",
    owner: currentMockUser,
    cvcAssistants: ["Morgan Lee"],
    foodContact: "Priya Santos",
    foodAssistants: ["Evan Brooks"],
    securityContact: "Caleb Ross",
    securityAssistants: [],
  },
];

export const demoProjectId = "belgrade-remodel-2026";

export function getVolunteerSchedule(projectId = demoProjectId) {
  return {
    project: projects.find((project) => project.id === projectId),
    assignments: assignments.filter((assignment) => assignment.projectId === projectId),
    lunches: lunches.filter((lunch) => lunch.projectId === projectId),
    announcements: announcements.filter(
      (announcement) => announcement.projectId === projectId,
    ),
    projectInfo: projectInfo.find((info) => info.projectId === projectId),
  };
}

export function getProjectById(projectId: string) {
  return projects.find((project) => project.id === projectId);
}

export function getCongregations() {
  return Array.from(new Set(volunteers.map((volunteer) => volunteer.congregation))).sort();
}

export function getVolunteerById(volunteerId: string) {
  return volunteers.find((volunteer) => volunteer.id === volunteerId);
}

export function getVolunteerAssignments(volunteerId: string) {
  return volunteerAssignments.filter(
    (assignment) => assignment.volunteerId === volunteerId,
  );
}

export function getUpcomingVolunteerAssignments(volunteerId: string) {
  return getVolunteerAssignments(volunteerId).filter(
    (assignment) => assignment.period === "upcoming",
  );
}

export function getPastVolunteerAssignments(volunteerId: string) {
  return getVolunteerAssignments(volunteerId).filter(
    (assignment) => assignment.period === "past",
  );
}

export function getAssignedProjectWorkspace() {
  const project = getProjectById(demoProjectId);

  return {
    project,
    contacts: projectContacts.find((contacts) => contacts.projectId === demoProjectId),
    assignments: assignments.filter((assignment) => assignment.projectId === demoProjectId),
    lunches: lunches.filter((lunch) => lunch.projectId === demoProjectId),
    announcements: announcements.filter(
      (announcement) => announcement.projectId === demoProjectId,
    ),
    projectInfo: projectInfo.find((info) => info.projectId === demoProjectId),
  };
}
