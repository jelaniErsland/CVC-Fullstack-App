export type AssignmentStatus =
  | "Confirmed"
  | "Pending"
  | "Needs Reply"
  | "Declined";
export type ProjectStatus = "draft" | "active" | "archived";
export type ProjectModule =
  | "volunteers"
  | "scheduling"
  | "food"
  | "security"
  | "announcements"
  | "emails"
  | "needsAttention"
  | "conflicts";
export type AdminProjectRole =
  | "Project CVC / Owner"
  | "Primary CVC"
  | "Primary Food Contact"
  | "Primary Security Contact"
  | "Assistant CVC"
  | "Assistant Food Contact"
  | "Assistant Security Contact";
export type ProjectVolunteerStatus =
  | "Submitted"
  | "Needs Review"
  | "Approved"
  | "Needs Info"
  | "Not Approved";
export type PillStatus = AssignmentStatus | ProjectStatus | ProjectVolunteerStatus;

export type Project = {
  id: string;
  name: string;
  location: string;
  projectType: string;
  description: string;
  phase: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  dateRange: string;
  workingDays: string[];
  workdays: number;
  timezone: string;
  enabledModules: ProjectModule[];
  supportingCongregations: string[];
  ownerId: string;
  primaryCvc: string;
  primaryFoodContact?: string;
  primarySecurityContact?: string;
  assistantCvcs: string[];
  assistantFoodContacts: string[];
  assistantSecurityContacts: string[];
  lastUpdatedAt: string;
  lastUsedAt: string;
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

export type ProjectVolunteer = {
  id: string;
  projectId: string;
  name: string;
  congregation: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  status: ProjectVolunteerStatus;
  submittedAt: string;
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  availability: {
    weekdays: string[];
    twoOrMoreDays: boolean;
    twoOrMoreDaysDetails?: string;
    afterHoursSecurity: boolean;
    afterHoursSecurityDetails?: string;
  };
  skillsExperience: {
    construction: string[];
    maintenanceTaskCards: boolean;
    taskCards: string;
    taskCardAdditionalDetails?: string;
    physicalWorkConditions: boolean;
    physicalWorkConditionsDetails?: string;
  };
  otherWaysToHelp: {
    housing: boolean;
    transportation: boolean;
    laundryDryCleaning: boolean;
    housekeeping: boolean;
    hairCare: boolean;
    medicalSupport: boolean;
    medicalSupportDetails?: string;
    foodService: boolean;
    other: string;
    otherHelpDetails?: string;
    details: string;
    otherWaysDetails?: string;
  };
  notes: string[];
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
  assignedProjectRoles: Array<{
    projectId: string;
    roles: AdminProjectRole[];
  }>;
};

export type ProjectContacts = {
  projectId: string;
  owner: MockUser;
  primaryCvc: string;
  cvcAssistants: string[];
  foodContact?: string;
  foodAssistants: string[];
  securityContact?: string;
  securityAssistants: string[];
};

export const moduleLabels: Record<ProjectModule, string> = {
  volunteers: "Volunteers",
  scheduling: "Schedule",
  food: "Food",
  security: "Security",
  announcements: "Announcements",
  emails: "Emails",
  needsAttention: "Needs Attention",
  conflicts: "Conflicts",
};

export const currentMockUser: MockUser = {
  id: "mock-owner",
  name: "Jordan Miller",
  email: "jordan.miller@example.com",
  role: "Project CVC / Owner",
  assignedProjectRoles: [
    {
      projectId: "belgrade-remodel-2026",
      roles: ["Project CVC / Owner", "Primary CVC"],
    },
    {
      projectId: "bozeman-sample-draft",
      roles: ["Project CVC / Owner", "Primary CVC", "Primary Food Contact"],
    },
    {
      projectId: "helena-archived-sample",
      roles: ["Assistant CVC"],
    },
  ],
};

export const projects: Project[] = [
  {
    id: "belgrade-remodel-2026",
    name: "Belgrade Major Remodel 2026",
    location: "Belgrade, MT",
    projectType: "Major Remodel",
    description: "A full remodel workspace with volunteer, schedule, food, security, announcements, and follow-up tools enabled.",
    phase: "Interior remodel",
    status: "active",
    startDate: "2026-01-12",
    endDate: "2026-01-24",
    dateRange: "Jan 12 - Jan 24, 2026",
    workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    workdays: 8,
    timezone: "America/Denver",
    enabledModules: [
      "volunteers",
      "scheduling",
      "food",
      "security",
      "announcements",
      "emails",
      "needsAttention",
      "conflicts",
    ],
    supportingCongregations: ["Belgrade", "Bozeman", "Helena"],
    ownerId: "mock-owner",
    primaryCvc: "Jordan Miller",
    primaryFoodContact: "Priya Santos",
    primarySecurityContact: "Caleb Ross",
    assistantCvcs: ["Morgan Lee"],
    assistantFoodContacts: ["Evan Brooks"],
    assistantSecurityContacts: ["Marcus Lee"],
    lastUpdatedAt: "Jun 15, 2026",
    lastUsedAt: "Jun 16, 2026",
    stats: {
      volunteers: 108,
      assignments: 164,
      confirmedPercent: 82,
      pending: 19,
    },
  },
  {
    id: "bozeman-sample-draft",
    name: "Bozeman Sample Draft Project",
    location: "Bozeman, MT",
    projectType: "Refresh",
    description: "A small draft workspace for a local contact testing a simple volunteer and food setup.",
    phase: "Planning draft",
    status: "draft",
    startDate: "2026-02-09",
    endDate: "2026-02-14",
    dateRange: "Feb 9 - Feb 14, 2026",
    workingDays: ["Friday", "Saturday"],
    workdays: 5,
    timezone: "America/Denver",
    enabledModules: ["volunteers", "food", "announcements"],
    supportingCongregations: ["Bozeman", "Belgrade"],
    ownerId: "mock-owner",
    primaryCvc: "Jordan Miller",
    primaryFoodContact: "Jordan Miller",
    assistantCvcs: [],
    assistantFoodContacts: [],
    assistantSecurityContacts: [],
    lastUpdatedAt: "Jun 10, 2026",
    lastUsedAt: "Jun 11, 2026",
    stats: {
      volunteers: 42,
      assignments: 58,
      confirmedPercent: 61,
      pending: 14,
    },
  },
  {
    id: "helena-archived-sample",
    name: "Helena Archived Sample Project",
    location: "Helena, MT",
    projectType: "Support Project",
    description: "An archived sample workspace kept readable for prior project reference.",
    phase: "Archived support",
    status: "archived",
    startDate: "2025-10-03",
    endDate: "2025-10-05",
    dateRange: "Oct 3 - Oct 5, 2025",
    workingDays: ["Friday", "Saturday", "Sunday"],
    workdays: 3,
    timezone: "America/Denver",
    enabledModules: ["volunteers", "scheduling", "security"],
    supportingCongregations: ["Helena", "Great Falls"],
    ownerId: "helena-owner",
    primaryCvc: "Elena Ward",
    primarySecurityContact: "Caleb Ross",
    assistantCvcs: ["Jordan Miller"],
    assistantFoodContacts: [],
    assistantSecurityContacts: [],
    lastUpdatedAt: "Oct 9, 2025",
    lastUsedAt: "Nov 1, 2025",
    stats: {
      volunteers: 24,
      assignments: 31,
      confirmedPercent: 48,
      pending: 12,
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
    status: "Needs Reply",
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

export const projectVolunteers: ProjectVolunteer[] = [
  {
    id: "alex-rivera",
    projectId: "belgrade-remodel-2026",
    name: "Alex Rivera",
    congregation: "Belgrade",
    phone: "(406) 555-0138",
    email: "alex.rivera@example.com",
    dateOfBirth: "1982-04-18",
    status: "Approved",
    submittedAt: "Jan 2, 2026",
    emergencyContact: {
      name: "Rosa Rivera",
      phone: "(406) 555-0139",
      relationship: "Spouse",
    },
    availability: {
      weekdays: ["Monday", "Wednesday", "Saturday"],
      twoOrMoreDays: true,
      twoOrMoreDaysDetails: "Can usually take two full weekdays if contacted in advance.",
      afterHoursSecurity: false,
    },
    skillsExperience: {
      construction: ["Framing", "Drywall", "Basic electrical support"],
      maintenanceTaskCards: true,
      taskCards: "Electrical safety checks, ladder inspections",
      taskCardAdditionalDetails: "Comfortable assisting under direction, not leading electrical work.",
      physicalWorkConditions: true,
      physicalWorkConditionsDetails: "Can lift and stand for normal shifts with short breaks.",
    },
    otherWaysToHelp: {
      housing: false,
      transportation: true,
      laundryDryCleaning: false,
      housekeeping: false,
      hairCare: false,
      medicalSupport: false,
      foodService: false,
      other: "Tool pickup",
      details: "Can use personal truck for supply runs when assigned.",
    },
    notes: ["Good fit for interior crews and supply pickup."],
  },
  {
    id: "mia-thompson",
    projectId: "belgrade-remodel-2026",
    name: "Mia Thompson",
    congregation: "Belgrade",
    phone: "(406) 555-0194",
    email: "mia.thompson@example.com",
    dateOfBirth: "1975-11-09",
    status: "Needs Review",
    submittedAt: "Jan 3, 2026",
    emergencyContact: {
      name: "Terry Thompson",
      phone: "(406) 555-0195",
      relationship: "Brother",
    },
    availability: {
      weekdays: ["Wednesday", "Saturday"],
      twoOrMoreDays: true,
      afterHoursSecurity: false,
    },
    skillsExperience: {
      construction: ["Cleanup", "Painting"],
      maintenanceTaskCards: false,
      taskCards: "",
      physicalWorkConditions: true,
    },
    otherWaysToHelp: {
      housing: false,
      transportation: false,
      laundryDryCleaning: true,
      housekeeping: true,
      hairCare: false,
      medicalSupport: false,
      foodService: true,
      other: "",
      details: "Happy to help with lunches, laundry, and post-shift cleanup.",
    },
    notes: ["Review food service availability before assigning construction shifts."],
  },
  {
    id: "marcus-lee",
    projectId: "belgrade-remodel-2026",
    name: "Marcus Lee",
    congregation: "Bozeman",
    phone: "(406) 555-0112",
    email: "marcus.lee@example.com",
    dateOfBirth: "1969-07-22",
    status: "Approved",
    submittedAt: "Jan 1, 2026",
    emergencyContact: {
      name: "Dana Lee",
      phone: "(406) 555-0113",
      relationship: "Wife",
    },
    availability: {
      weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday"],
      twoOrMoreDays: true,
      afterHoursSecurity: true,
      afterHoursSecurityDetails: "Can help with evening site-watch on weekdays if paired with another brother.",
    },
    skillsExperience: {
      construction: ["Material staging", "Forklift", "Crew coordination"],
      maintenanceTaskCards: true,
      taskCards: "Forklift inspection, material inventory",
      physicalWorkConditions: true,
      physicalWorkConditionsDetails: "Comfortable with outdoor work and early deliveries.",
    },
    otherWaysToHelp: {
      housing: false,
      transportation: true,
      laundryDryCleaning: false,
      housekeeping: false,
      hairCare: false,
      medicalSupport: false,
      foodService: false,
      other: "Can arrive early",
      details: "Available for early deliveries and first-shift setup.",
    },
    notes: ["Strong logistics lead. Available for security if needed."],
  },
  {
    id: "priya-santos",
    projectId: "belgrade-remodel-2026",
    name: "Priya Santos",
    congregation: "Bozeman",
    phone: "(406) 555-0177",
    email: "priya.santos@example.com",
    dateOfBirth: "1988-02-13",
    status: "Approved",
    submittedAt: "Jan 2, 2026",
    emergencyContact: {
      name: "Amara Santos",
      phone: "(406) 555-0178",
      relationship: "Sister",
    },
    availability: {
      weekdays: ["Monday", "Wednesday", "Friday"],
      twoOrMoreDays: true,
      afterHoursSecurity: false,
    },
    skillsExperience: {
      construction: ["Check-in desk", "Volunteer care"],
      maintenanceTaskCards: false,
      taskCards: "",
      physicalWorkConditions: false,
    },
    otherWaysToHelp: {
      housing: false,
      transportation: false,
      laundryDryCleaning: false,
      housekeeping: false,
      hairCare: false,
      medicalSupport: false,
      foodService: true,
      medicalSupportDetails: "",
      other: "Dietary notes",
      details: "Can coordinate lunch counts and dietary restrictions.",
    },
    notes: ["Best fit for food service coordination."],
  },
  {
    id: "caleb-ross",
    projectId: "belgrade-remodel-2026",
    name: "Caleb Ross",
    congregation: "Helena",
    phone: "(406) 555-0163",
    email: "caleb.ross@example.com",
    dateOfBirth: "1979-09-30",
    status: "Needs Info",
    submittedAt: "Jan 4, 2026",
    emergencyContact: {
      name: "Noah Ross",
      phone: "(406) 555-0164",
      relationship: "Son",
    },
    availability: {
      weekdays: ["Friday", "Saturday"],
      twoOrMoreDays: false,
      afterHoursSecurity: true,
      afterHoursSecurityDetails: "Available after 6 PM, but needs exact dates before confirming.",
    },
    skillsExperience: {
      construction: ["Lockup", "Site walk-through", "Radio"],
      maintenanceTaskCards: false,
      taskCards: "",
      physicalWorkConditions: true,
    },
    otherWaysToHelp: {
      housing: false,
      transportation: false,
      laundryDryCleaning: false,
      housekeeping: false,
      hairCare: false,
      medicalSupport: false,
      foodService: false,
      other: "Night watch",
      details: "Can help after 6 PM, needs confirmation on exact nights.",
    },
    notes: ["Needs follow-up about security availability and transportation."],
  },
  {
    id: "nora-bennett",
    projectId: "belgrade-remodel-2026",
    name: "Nora Bennett",
    congregation: "Helena",
    phone: "(406) 555-0188",
    email: "nora.bennett@example.com",
    dateOfBirth: "1958-05-11",
    status: "Approved",
    submittedAt: "Jan 3, 2026",
    emergencyContact: {
      name: "Elaine Bennett",
      phone: "(406) 555-0189",
      relationship: "Daughter",
    },
    availability: {
      weekdays: ["Saturday"],
      twoOrMoreDays: false,
      afterHoursSecurity: false,
    },
    skillsExperience: {
      construction: ["Painting", "Detail cleaning", "Finish touchups"],
      maintenanceTaskCards: false,
      taskCards: "",
      physicalWorkConditions: false,
    },
    otherWaysToHelp: {
      housing: false,
      transportation: false,
      laundryDryCleaning: false,
      housekeeping: true,
      hairCare: false,
      medicalSupport: false,
      foodService: false,
      other: "",
      details: "Can help with lighter indoor work and housekeeping support.",
    },
    notes: ["Avoid strenuous outdoor assignments."],
  },
  {
    id: "evan-brooks",
    projectId: "belgrade-remodel-2026",
    name: "Evan Brooks",
    congregation: "Belgrade",
    phone: "(406) 555-0146",
    email: "evan.brooks@example.com",
    dateOfBirth: "1991-12-03",
    status: "Submitted",
    submittedAt: "Jan 5, 2026",
    emergencyContact: {
      name: "Sam Brooks",
      phone: "(406) 555-0147",
      relationship: "Father",
    },
    availability: {
      weekdays: ["Tuesday", "Wednesday", "Thursday"],
      twoOrMoreDays: true,
      afterHoursSecurity: false,
    },
    skillsExperience: {
      construction: ["Runner", "Setup", "Serving"],
      maintenanceTaskCards: false,
      taskCards: "",
      physicalWorkConditions: true,
    },
    otherWaysToHelp: {
      housing: false,
      transportation: true,
      laundryDryCleaning: false,
      housekeeping: false,
      hairCare: false,
      medicalSupport: false,
      foodService: true,
      other: "Errands",
      details: "Has a truck and can run supplies between lunch and work areas.",
    },
    notes: ["Good candidate for runner or food assistant support."],
  },
  {
    id: "leah-johnson",
    projectId: "belgrade-remodel-2026",
    name: "Leah Johnson",
    congregation: "Bozeman",
    phone: "(406) 555-0151",
    email: "leah.johnson@example.com",
    dateOfBirth: "1964-03-27",
    status: "Not Approved",
    submittedAt: "Jan 6, 2026",
    emergencyContact: {
      name: "Harper Johnson",
      phone: "(406) 555-0152",
      relationship: "Spouse",
    },
    availability: {
      weekdays: ["Monday"],
      twoOrMoreDays: false,
      afterHoursSecurity: false,
    },
    skillsExperience: {
      construction: ["Data entry", "Check-in desk"],
      maintenanceTaskCards: false,
      taskCards: "",
      physicalWorkConditions: false,
    },
    otherWaysToHelp: {
      housing: false,
      transportation: false,
      laundryDryCleaning: false,
      housekeeping: false,
      hairCare: false,
      medicalSupport: true,
      medicalSupportDetails: "Former CNA. Available for first-aid desk support only if schedule changes.",
      foodService: false,
      other: "",
      details: "Submitted for medical support, but unavailable during active dates.",
    },
    notes: ["Not available during the current project window."],
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
    status: "Declined",
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
    primaryCvc: "Jordan Miller",
    cvcAssistants: ["Morgan Lee"],
    foodContact: "Priya Santos",
    foodAssistants: ["Evan Brooks"],
    securityContact: "Caleb Ross",
    securityAssistants: ["Marcus Lee"],
  },
  {
    projectId: "bozeman-sample-draft",
    owner: currentMockUser,
    primaryCvc: "Jordan Miller",
    cvcAssistants: [],
    foodContact: "Jordan Miller",
    foodAssistants: [],
    securityAssistants: [],
  },
  {
    projectId: "helena-archived-sample",
    owner: currentMockUser,
    primaryCvc: "Elena Ward",
    cvcAssistants: ["Jordan Miller"],
    securityContact: "Caleb Ross",
    foodAssistants: [],
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

export function getProjectContacts(projectId = demoProjectId) {
  return projectContacts.find((contacts) => contacts.projectId === projectId);
}

export function getModuleLabel(module: ProjectModule) {
  return moduleLabels[module];
}

export function summarizeModules(modules: ProjectModule[], limit = 4) {
  const labels = modules.map(getModuleLabel);

  if (labels.length <= limit) {
    return labels.join(", ");
  }

  return `${labels.slice(0, limit).join(", ")} +${labels.length - limit} more`;
}

export function projectHasModule(project: Project | undefined, module: ProjectModule) {
  return Boolean(project?.enabledModules.includes(module));
}

export function getCurrentAdminProjectAssignments() {
  return currentMockUser.assignedProjectRoles
    .map((assignment) => {
      const project = getProjectById(assignment.projectId);

      return project
        ? {
            project,
            roles: assignment.roles,
          }
        : undefined;
    })
    .filter(
      (
        assignment,
      ): assignment is {
        project: Project;
        roles: AdminProjectRole[];
      } => Boolean(assignment),
    );
}

export function getCurrentAdminRolesForProject(projectId = demoProjectId) {
  return (
    currentMockUser.assignedProjectRoles.find(
      (assignment) => assignment.projectId === projectId,
    )?.roles ?? []
  );
}

export function getCongregations() {
  return Array.from(
    new Set(projectVolunteers.map((volunteer) => volunteer.congregation)),
  ).sort();
}

export function getVolunteerById(volunteerId: string) {
  return projectVolunteers.find((volunteer) => volunteer.id === volunteerId);
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
    contacts: getProjectContacts(demoProjectId),
    roles: getCurrentAdminRolesForProject(demoProjectId),
    assignments: assignments.filter((assignment) => assignment.projectId === demoProjectId),
    lunches: lunches.filter((lunch) => lunch.projectId === demoProjectId),
    announcements: announcements.filter(
      (announcement) => announcement.projectId === demoProjectId,
    ),
    projectInfo: projectInfo.find((info) => info.projectId === demoProjectId),
  };
}
