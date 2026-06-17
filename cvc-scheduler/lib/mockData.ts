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
export type QuestionnaireReviewQueueStatus =
  | "New"
  | "Needs Review"
  | "Incomplete"
  | "Reviewed";
export type PillStatus =
  | AssignmentStatus
  | ProjectStatus
  | ProjectVolunteerStatus
  | QuestionnaireReviewQueueStatus;

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

export type QuestionnaireStatus =
  | "notStarted"
  | "inProgress"
  | "submitted"
  | "needsReview"
  | "approved"
  | "needsFollowUp";

export type QuestionnaireSectionKey =
  | "aboutYou"
  | "availability"
  | "skillsExperience"
  | "emergencyContact"
  | "otherWaysToHelp";

export type QuestionnaireSourceType = "online" | "paper" | "manualEntry";

export type QuestionnaireStatusTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "attention";

export type VolunteerAvailabilityDetails = {
  weekdays: string[];
  preferredTimes: string[];
  canServeMultipleDays: boolean;
  canServeMultipleDaysDetails?: string;
  availableForAfterHoursSecurity: boolean;
  afterHoursSecurityDetails?: string;
  limitations?: string;
};

export type SkillExperienceResponses = {
  construction: string[];
  maintenanceTaskCards: boolean;
  taskCards?: string;
  taskCardAdditionalDetails?: string;
  comfortableWithPhysicalWork: boolean;
  physicalWorkDetails?: string;
  notes?: string;
};

export type QuestionnaireEmergencyContact = {
  name: string;
  phone: string;
  relationship: string;
};

export type OtherWaysToHelpResponses = {
  housing: boolean;
  transportation: boolean;
  laundryDryCleaning: boolean;
  housekeeping: boolean;
  hairCare: boolean;
  medicalSupport: boolean;
  medicalSupportDetails?: string;
  foodService: boolean;
  other?: string;
  details?: string;
};

export type QuestionnaireReviewNote = {
  id: string;
  author: string;
  createdAt: string;
  message: string;
};

export type QuestionnaireReviewFlag =
  | "missingEmergencyContact"
  | "paperQuestionnaire"
  | "limitedAvailability"
  | "needsFollowUp";

export type VolunteerQuestionnaireSubmission = {
  id: string;
  projectId: string;
  linkedVolunteerId?: string;
  status: QuestionnaireStatus;
  sourceType: QuestionnaireSourceType;
  startedAt: string;
  submittedAt?: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  aboutYou: {
    name: string;
    congregation: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
    preferredContactMethod?: "email" | "phone" | "text";
  };
  availability: VolunteerAvailabilityDetails;
  skillsExperience: SkillExperienceResponses;
  emergencyContact?: QuestionnaireEmergencyContact;
  otherWaysToHelp: OtherWaysToHelpResponses;
  review: {
    status: QuestionnaireStatus;
    flaggedSectionKeys: QuestionnaireSectionKey[];
    flags?: QuestionnaireReviewFlag[];
    summary?: string;
    notes: QuestionnaireReviewNote[];
  };
};

export type QuestionnaireReviewItem = {
  id: string;
  projectId: string;
  projectName: string;
  projectLocation: string;
  linkedVolunteerId?: string;
  volunteerName: string;
  congregation: string;
  email?: string;
  submittedDate: string;
  updatedDate: string;
  status: QuestionnaireReviewQueueStatus;
  rawStatus: QuestionnaireStatus;
  sourceType: QuestionnaireSourceType;
  availabilitySummary: string;
  skillsSummary: string;
  otherWaysToHelpSummary: string;
  flags: QuestionnaireReviewFlag[];
  flagLabels: string[];
  notes: string[];
};

export type VolunteerProfileReadinessStatus =
  | "Ready for volunteer profile"
  | "Needs follow-up first"
  | "Missing required info"
  | "Already linked to volunteer profile";

export type VolunteerProfilePreview = {
  sourceSubmissionId: string;
  projectId: string;
  linkedVolunteerId?: string;
  name: string;
  email?: string;
  phone?: string;
  congregation: string;
  availabilitySummary: string;
  skillsExperienceSummary: string;
  emergencyContactComplete: boolean;
  otherWaysToHelpSummary: string;
  reviewStatus: QuestionnaireReviewQueueStatus;
  readinessStatus: VolunteerProfileReadinessStatus;
  suggestedVolunteerStatus: ProjectVolunteerStatus;
  blockersBeforeScheduling: string[];
};

export type QuestionnaireWorkflowStatus =
  | "New submission"
  | "Needs review"
  | "Needs follow-up"
  | "Missing required info"
  | "Ready for volunteer profile"
  | "Already linked / reviewed";

export type QuestionnaireWorkflowAction = {
  label: string;
  description: string;
  enabled: boolean;
  href?: string;
};

export type QuestionnaireWorkflowState = {
  status: QuestionnaireWorkflowStatus;
  title: string;
  guidance: string;
  nextStepSummary: string;
  actions: QuestionnaireWorkflowAction[];
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

export const questionnaireSubmissions: VolunteerQuestionnaireSubmission[] = [
  {
    id: "questionnaire-mia-thompson-2026",
    projectId: "belgrade-remodel-2026",
    status: "needsReview",
    sourceType: "online",
    startedAt: "2025-11-18T16:25:00.000Z",
    submittedAt: "2025-11-18T17:05:00.000Z",
    updatedAt: "2025-11-18T17:05:00.000Z",
    aboutYou: {
      name: "Mia Thompson",
      congregation: "Bozeman",
      email: "mia.thompson@example.com",
      phone: "(406) 555-0174",
      dateOfBirth: "1988-04-22",
      preferredContactMethod: "text",
    },
    availability: {
      weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday"],
      preferredTimes: ["Morning", "Afternoon"],
      canServeMultipleDays: true,
      canServeMultipleDaysDetails: "Can do two or three consecutive weekdays if assigned early.",
      availableForAfterHoursSecurity: false,
      limitations: "Avoid heavy overhead work because of a shoulder injury.",
    },
    skillsExperience: {
      construction: ["Painting", "Finish work", "General cleanup"],
      maintenanceTaskCards: true,
      taskCards: "Painting and general maintenance",
      comfortableWithPhysicalWork: true,
      physicalWorkDetails: "Comfortable with ladders under 8 feet.",
    },
    emergencyContact: {
      name: "Daniel Thompson",
      phone: "(406) 555-0175",
      relationship: "Spouse",
    },
    otherWaysToHelp: {
      housing: false,
      transportation: true,
      laundryDryCleaning: false,
      housekeeping: true,
      hairCare: false,
      medicalSupport: false,
      foodService: true,
      details: "Happy to help with cleanup or food prep if the crew is full.",
    },
    review: {
      status: "needsReview",
      flaggedSectionKeys: ["availability"],
      flags: ["limitedAvailability"],
      summary: "Strong fit for weekday finish work; confirm shoulder limitation before assigning.",
      notes: [
        {
          id: "note-mia-review",
          author: "Jordan Miller",
          createdAt: "2025-11-19T15:20:00.000Z",
          message: "Looks ready for review. Ask about ladder comfort before approving.",
        },
      ],
    },
  },
  {
    id: "questionnaire-nora-bennett-draft",
    projectId: "belgrade-remodel-2026",
    status: "inProgress",
    sourceType: "online",
    startedAt: "2025-11-20T03:12:00.000Z",
    updatedAt: "2025-11-20T03:28:00.000Z",
    aboutYou: {
      name: "Nora Bennett",
      congregation: "Belgrade",
      email: "nora.bennett@example.com",
      phone: "(406) 555-0190",
      preferredContactMethod: "email",
    },
    availability: {
      weekdays: ["Saturday"],
      preferredTimes: ["Morning"],
      canServeMultipleDays: false,
      availableForAfterHoursSecurity: false,
    },
    skillsExperience: {
      construction: [],
      maintenanceTaskCards: false,
      comfortableWithPhysicalWork: false,
    },
    otherWaysToHelp: {
      housing: false,
      transportation: false,
      laundryDryCleaning: false,
      housekeeping: false,
      hairCare: false,
      medicalSupport: false,
      foodService: false,
    },
    review: {
      status: "inProgress",
      flaggedSectionKeys: [],
      flags: ["missingEmergencyContact", "limitedAvailability"],
      notes: [],
    },
  },
  {
    id: "questionnaire-jonah-price-paper",
    projectId: "belgrade-remodel-2026",
    status: "submitted",
    sourceType: "paper",
    startedAt: "2025-11-21T18:00:00.000Z",
    submittedAt: "2025-11-21T18:00:00.000Z",
    updatedAt: "2025-11-22T02:30:00.000Z",
    aboutYou: {
      name: "Jonah Price",
      congregation: "Manhattan",
      phone: "(406) 555-0161",
      preferredContactMethod: "phone",
    },
    availability: {
      weekdays: ["Friday", "Saturday"],
      preferredTimes: ["Afternoon"],
      canServeMultipleDays: true,
      canServeMultipleDaysDetails: "Can come after work Friday and most of Saturday.",
      availableForAfterHoursSecurity: true,
      afterHoursSecurityDetails: "Could help with an early evening watch if paired with someone.",
    },
    skillsExperience: {
      construction: ["Demo", "General cleanup", "Material moving"],
      maintenanceTaskCards: false,
      comfortableWithPhysicalWork: true,
      notes: "Paper form noted previous remodel cleanup experience.",
    },
    emergencyContact: {
      name: "Rebecca Price",
      phone: "(406) 555-0162",
      relationship: "Sister",
    },
    otherWaysToHelp: {
      housing: false,
      transportation: true,
      laundryDryCleaning: false,
      housekeeping: false,
      hairCare: false,
      medicalSupport: false,
      foodService: false,
      details: "Can bring a pickup for hauling small supplies.",
    },
    review: {
      status: "submitted",
      flaggedSectionKeys: ["aboutYou"],
      flags: ["paperQuestionnaire"],
      summary: "Paper form entered by hand; missing email is acceptable but phone should be confirmed.",
      notes: [
        {
          id: "note-jonah-entry",
          author: "Morgan Lee",
          createdAt: "2025-11-22T02:32:00.000Z",
          message: "Entered from a paper questionnaire after midweek meeting.",
        },
      ],
    },
  },
  {
    id: "questionnaire-alex-rivera-approved",
    projectId: "belgrade-remodel-2026",
    linkedVolunteerId: "alex-rivera",
    status: "approved",
    sourceType: "online",
    startedAt: "2025-11-15T22:18:00.000Z",
    submittedAt: "2025-11-15T22:42:00.000Z",
    updatedAt: "2025-11-16T16:10:00.000Z",
    reviewedAt: "2025-11-16T16:10:00.000Z",
    reviewedBy: "Jordan Miller",
    aboutYou: {
      name: "Alex Rivera",
      congregation: "Belgrade",
      email: "alex.rivera@example.com",
      phone: "(406) 555-0142",
      dateOfBirth: "1981-09-03",
      preferredContactMethod: "text",
    },
    availability: {
      weekdays: ["Monday", "Tuesday", "Saturday"],
      preferredTimes: ["Morning", "Afternoon"],
      canServeMultipleDays: true,
      canServeMultipleDaysDetails: "Can take two full days if needed.",
      availableForAfterHoursSecurity: false,
    },
    skillsExperience: {
      construction: ["Framing", "Demo", "Material handling"],
      maintenanceTaskCards: true,
      taskCards: "Carpentry, basic electrical assist",
      comfortableWithPhysicalWork: true,
    },
    emergencyContact: {
      name: "Elena Rivera",
      phone: "(406) 555-0143",
      relationship: "Spouse",
    },
    otherWaysToHelp: {
      housing: false,
      transportation: true,
      laundryDryCleaning: false,
      housekeeping: false,
      hairCare: false,
      medicalSupport: false,
      foodService: false,
      details: "Can bring a trailer if supplies need to move locally.",
    },
    review: {
      status: "approved",
      flaggedSectionKeys: [],
      flags: [],
      summary: "Approved and linked to the project volunteer profile.",
      notes: [
        {
          id: "note-alex-approved",
          author: "Jordan Miller",
          createdAt: "2025-11-16T16:10:00.000Z",
          message: "Approved for construction and material movement shifts.",
        },
      ],
    },
  },
  {
    id: "questionnaire-caleb-ross-follow-up",
    projectId: "belgrade-remodel-2026",
    linkedVolunteerId: "caleb-ross",
    status: "needsFollowUp",
    sourceType: "manualEntry",
    startedAt: "2025-11-17T20:00:00.000Z",
    submittedAt: "2025-11-17T20:00:00.000Z",
    updatedAt: "2025-11-18T18:45:00.000Z",
    reviewedAt: "2025-11-18T18:45:00.000Z",
    reviewedBy: "Morgan Lee",
    aboutYou: {
      name: "Caleb Ross",
      congregation: "Livingston",
      email: "caleb.ross@example.com",
      phone: "(406) 555-0182",
      preferredContactMethod: "phone",
    },
    availability: {
      weekdays: ["Thursday", "Friday"],
      preferredTimes: ["Evening"],
      canServeMultipleDays: true,
      availableForAfterHoursSecurity: true,
      afterHoursSecurityDetails: "Willing to coordinate security but needs exact building access details.",
    },
    skillsExperience: {
      construction: ["Security", "Check-in desk"],
      maintenanceTaskCards: false,
      comfortableWithPhysicalWork: true,
      notes: "Experienced with after-hours monitoring for prior RBC projects.",
    },
    emergencyContact: {
      name: "Avery Ross",
      phone: "(406) 555-0183",
      relationship: "Sibling",
    },
    otherWaysToHelp: {
      housing: false,
      transportation: false,
      laundryDryCleaning: false,
      housekeeping: false,
      hairCare: false,
      medicalSupport: false,
      foodService: false,
      details: "Can help train a second person for evening lockup.",
    },
    review: {
      status: "needsFollowUp",
      flaggedSectionKeys: ["availability", "skillsExperience"],
      flags: ["needsFollowUp"],
      summary: "Confirm security schedule, building access, and whether he should lead the team.",
      notes: [
        {
          id: "note-caleb-follow-up",
          author: "Morgan Lee",
          createdAt: "2025-11-18T18:45:00.000Z",
          message: "Needs a quick call before assigning him as primary security lead.",
        },
      ],
    },
  },
  {
    id: "questionnaire-leah-johnson-bozeman-new",
    projectId: "bozeman-sample-draft",
    linkedVolunteerId: "leah-johnson",
    status: "submitted",
    sourceType: "online",
    startedAt: "2025-12-02T19:10:00.000Z",
    submittedAt: "2025-12-02T19:34:00.000Z",
    updatedAt: "2025-12-02T19:34:00.000Z",
    aboutYou: {
      name: "Leah Johnson",
      congregation: "Bozeman",
      email: "leah.johnson@example.com",
      phone: "(406) 555-0151",
      preferredContactMethod: "email",
    },
    availability: {
      weekdays: ["Friday", "Saturday"],
      preferredTimes: ["Morning", "Afternoon"],
      canServeMultipleDays: true,
      canServeMultipleDaysDetails: "Can take a full Saturday and one setup shift if needed.",
      availableForAfterHoursSecurity: false,
      limitations: "Prefers check-in, desk, or runner work instead of ladders.",
    },
    skillsExperience: {
      construction: ["Check-in desk", "Data entry", "Announcements"],
      maintenanceTaskCards: false,
      comfortableWithPhysicalWork: false,
      physicalWorkDetails: "Can stand for short periods but should avoid ladder work.",
    },
    emergencyContact: {
      name: "Grace Johnson",
      phone: "(406) 555-0152",
      relationship: "Mother",
    },
    otherWaysToHelp: {
      housing: false,
      transportation: false,
      laundryDryCleaning: false,
      housekeeping: false,
      hairCare: false,
      medicalSupport: false,
      foodService: true,
      details: "Can help with sign-in, volunteer messages, or lunch count updates.",
    },
    review: {
      status: "submitted",
      flaggedSectionKeys: ["availability"],
      flags: ["limitedAvailability"],
      summary: "New Bozeman questionnaire; likely a good admin support fit.",
      notes: [],
    },
  },
  {
    id: "questionnaire-owen-clark-bozeman-incomplete",
    projectId: "bozeman-sample-draft",
    status: "inProgress",
    sourceType: "online",
    startedAt: "2025-12-04T02:05:00.000Z",
    updatedAt: "2025-12-04T02:18:00.000Z",
    aboutYou: {
      name: "Owen Clark",
      congregation: "Belgrade",
      email: "owen.clark@example.com",
      preferredContactMethod: "email",
    },
    availability: {
      weekdays: ["Saturday"],
      preferredTimes: ["Morning"],
      canServeMultipleDays: false,
      availableForAfterHoursSecurity: false,
    },
    skillsExperience: {
      construction: ["General cleanup"],
      maintenanceTaskCards: false,
      comfortableWithPhysicalWork: true,
    },
    otherWaysToHelp: {
      housing: false,
      transportation: false,
      laundryDryCleaning: false,
      housekeeping: false,
      hairCare: false,
      medicalSupport: false,
      foodService: false,
    },
    review: {
      status: "inProgress",
      flaggedSectionKeys: ["emergencyContact"],
      flags: ["missingEmergencyContact", "limitedAvailability"],
      summary: "Started but not complete; missing phone and emergency contact.",
      notes: [],
    },
  },
  {
    id: "questionnaire-sarah-wilson-helena-paper",
    projectId: "helena-archived-sample",
    status: "needsReview",
    sourceType: "paper",
    startedAt: "2025-09-24T18:00:00.000Z",
    submittedAt: "2025-09-24T18:00:00.000Z",
    updatedAt: "2025-09-25T01:20:00.000Z",
    aboutYou: {
      name: "Sarah Wilson",
      congregation: "Helena",
      phone: "(406) 555-0124",
      preferredContactMethod: "phone",
    },
    availability: {
      weekdays: ["Friday", "Saturday", "Sunday"],
      preferredTimes: ["Afternoon", "Evening"],
      canServeMultipleDays: true,
      canServeMultipleDaysDetails: "Available for the whole support weekend.",
      availableForAfterHoursSecurity: false,
    },
    skillsExperience: {
      construction: ["Food service", "Housekeeping", "Volunteer care"],
      maintenanceTaskCards: false,
      comfortableWithPhysicalWork: true,
      notes: "Paper form mentions prior hospitality support for assemblies.",
    },
    emergencyContact: {
      name: "Mark Wilson",
      phone: "(406) 555-0125",
      relationship: "Husband",
    },
    otherWaysToHelp: {
      housing: true,
      transportation: false,
      laundryDryCleaning: true,
      housekeeping: true,
      hairCare: false,
      medicalSupport: false,
      foodService: true,
      details: "Can host two sisters and help with lunches if needed.",
    },
    review: {
      status: "needsReview",
      flaggedSectionKeys: ["aboutYou", "otherWaysToHelp"],
      flags: ["paperQuestionnaire"],
      summary: "Paper questionnaire needs a quick contact check before archived reference is final.",
      notes: [
        {
          id: "note-sarah-paper",
          author: "Elena Ward",
          createdAt: "2025-09-25T01:22:00.000Z",
          message: "Entered from a paper questionnaire after service meeting.",
        },
      ],
    },
  },
  {
    id: "questionnaire-david-kim-helena-reviewed",
    projectId: "helena-archived-sample",
    status: "approved",
    sourceType: "online",
    startedAt: "2025-09-20T23:12:00.000Z",
    submittedAt: "2025-09-20T23:41:00.000Z",
    updatedAt: "2025-09-21T17:30:00.000Z",
    reviewedAt: "2025-09-21T17:30:00.000Z",
    reviewedBy: "Elena Ward",
    aboutYou: {
      name: "David Kim",
      congregation: "Great Falls",
      email: "david.kim@example.com",
      phone: "(406) 555-0186",
      preferredContactMethod: "text",
    },
    availability: {
      weekdays: ["Friday", "Saturday"],
      preferredTimes: ["Morning", "Afternoon"],
      canServeMultipleDays: true,
      availableForAfterHoursSecurity: true,
      afterHoursSecurityDetails: "Can help with evening lockup on Friday.",
    },
    skillsExperience: {
      construction: ["Security", "Material moving", "General cleanup"],
      maintenanceTaskCards: true,
      taskCards: "Safety checks and exterior maintenance",
      comfortableWithPhysicalWork: true,
    },
    emergencyContact: {
      name: "Hannah Kim",
      phone: "(406) 555-0187",
      relationship: "Wife",
    },
    otherWaysToHelp: {
      housing: false,
      transportation: true,
      laundryDryCleaning: false,
      housekeeping: false,
      hairCare: false,
      medicalSupport: false,
      foodService: false,
      details: "Can drive supplies between the hall and storage.",
    },
    review: {
      status: "approved",
      flaggedSectionKeys: [],
      flags: [],
      summary: "Reviewed for Helena support project and ready for reference.",
      notes: [
        {
          id: "note-david-reviewed",
          author: "Elena Ward",
          createdAt: "2025-09-21T17:30:00.000Z",
          message: "Approved for security and logistics support.",
        },
      ],
    },
  },
];

export const demoProjectId = "belgrade-remodel-2026";

export const questionnaireStatusLabels: Record<QuestionnaireStatus, string> = {
  notStarted: "Not started",
  inProgress: "In progress",
  submitted: "Submitted",
  needsReview: "Needs review",
  approved: "Approved",
  needsFollowUp: "Needs follow-up",
};

export const questionnaireReviewQueueStatuses: QuestionnaireReviewQueueStatus[] = [
  "New",
  "Needs Review",
  "Incomplete",
  "Reviewed",
];

export const questionnaireReviewFlagLabels: Record<QuestionnaireReviewFlag, string> = {
  missingEmergencyContact: "Missing emergency contact",
  paperQuestionnaire: "Paper questionnaire",
  limitedAvailability: "Limited availability",
  needsFollowUp: "Needs follow-up",
};

export const questionnaireSectionLabels: Record<QuestionnaireSectionKey, string> = {
  aboutYou: "About you",
  availability: "Availability",
  skillsExperience: "Skills and experience",
  emergencyContact: "Emergency contact",
  otherWaysToHelp: "Other ways to help",
};

export const questionnaireSectionKeys: QuestionnaireSectionKey[] = [
  "aboutYou",
  "availability",
  "skillsExperience",
  "emergencyContact",
  "otherWaysToHelp",
];

const otherWaysToHelpLabels: Array<[keyof OtherWaysToHelpResponses, string]> = [
  ["housing", "Housing"],
  ["transportation", "Transportation"],
  ["laundryDryCleaning", "Laundry / dry cleaning"],
  ["housekeeping", "Housekeeping"],
  ["hairCare", "Hair care"],
  ["medicalSupport", "Medical support"],
  ["foodService", "Food service"],
];

function formatMockDate(value?: string) {
  if (!value) {
    return "Not submitted yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getQueueStatusFromQuestionnaireStatus(
  status: QuestionnaireStatus,
): QuestionnaireReviewQueueStatus {
  if (status === "submitted") {
    return "New";
  }

  if (status === "inProgress" || status === "notStarted") {
    return "Incomplete";
  }

  if (status === "approved") {
    return "Reviewed";
  }

  return "Needs Review";
}

function summarizeQuestionnaireAvailability(submission: VolunteerQuestionnaireSubmission) {
  const days = submission.availability.weekdays.join(", ") || "No days selected";
  const times = submission.availability.preferredTimes.join(", ") || "No time preference";
  const notes = [
    submission.availability.canServeMultipleDays ? "can serve multiple days" : undefined,
    submission.availability.availableForAfterHoursSecurity
      ? "available for after-hours security"
      : undefined,
    submission.availability.limitations,
  ].filter(Boolean);

  return notes.length ? `${days}; ${times}; ${notes.join("; ")}` : `${days}; ${times}`;
}

function summarizeQuestionnaireSkills(submission: VolunteerQuestionnaireSubmission) {
  const skills =
    submission.skillsExperience.construction.join(", ") ||
    submission.skillsExperience.taskCards ||
    submission.skillsExperience.notes ||
    "No skills listed yet";
  const extras = [
    submission.skillsExperience.maintenanceTaskCards ? "maintenance task cards" : undefined,
    submission.skillsExperience.comfortableWithPhysicalWork === false
      ? "physical work limits noted"
      : undefined,
  ].filter(Boolean);

  return extras.length ? `${skills}; ${extras.join("; ")}` : skills;
}

function summarizeOtherWaysToHelp(submission: VolunteerQuestionnaireSubmission) {
  const selected = otherWaysToHelpLabels
    .filter(([key]) => Boolean(submission.otherWaysToHelp[key]))
    .map(([, label]) => label);
  const other = submission.otherWaysToHelp.other;
  const details = submission.otherWaysToHelp.details;

  return [...selected, other, details].filter(Boolean).join("; ") || "No other help listed";
}

function getGeneratedQuestionnaireReviewFlags(
  submission: VolunteerQuestionnaireSubmission,
): QuestionnaireReviewFlag[] {
  const flags = new Set<QuestionnaireReviewFlag>(submission.review.flags ?? []);

  if (!submission.emergencyContact?.name || !submission.emergencyContact.phone) {
    flags.add("missingEmergencyContact");
  }

  if (submission.sourceType === "paper") {
    flags.add("paperQuestionnaire");
  }

  if (
    submission.availability.weekdays.length <= 1 ||
    Boolean(submission.availability.limitations) ||
    !submission.availability.canServeMultipleDays
  ) {
    flags.add("limitedAvailability");
  }

  if (submission.status === "needsFollowUp") {
    flags.add("needsFollowUp");
  }

  return Array.from(flags);
}

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

export function getQuestionnaireSubmissionsForProject(projectId = demoProjectId) {
  return questionnaireSubmissions.filter((submission) => submission.projectId === projectId);
}

export function getQuestionnaireSubmissionById(submissionId: string) {
  return questionnaireSubmissions.find((submission) => submission.id === submissionId);
}

export function getQuestionnaireSubmissionsByStatus(
  projectId: string,
  status: QuestionnaireStatus,
) {
  return getQuestionnaireSubmissionsForProject(projectId).filter(
    (submission) => submission.status === status,
  );
}

export function getQuestionnaireReviewCounts(projectId = demoProjectId) {
  const counts: Record<QuestionnaireStatus, number> = {
    notStarted: 0,
    inProgress: 0,
    submitted: 0,
    needsReview: 0,
    approved: 0,
    needsFollowUp: 0,
  };

  const submissions = getQuestionnaireSubmissionsForProject(projectId);

  submissions.forEach((submission) => {
    counts[submission.status] += 1;
  });

  return {
    ...counts,
    total: submissions.length,
    readyForReview: counts.submitted + counts.needsReview,
    needsAction: counts.needsReview + counts.needsFollowUp,
  };
}

export function getQuestionnaireReviewItems(projectId?: string): QuestionnaireReviewItem[] {
  return questionnaireSubmissions
    .filter((submission) => (projectId ? submission.projectId === projectId : true))
    .map((submission) => {
      const project = projects.find((item) => item.id === submission.projectId);
      const flags = getGeneratedQuestionnaireReviewFlags(submission);

      return {
        id: submission.id,
        projectId: submission.projectId,
        projectName: project?.name ?? "Unknown project",
        projectLocation: project?.location ?? "Unknown location",
        linkedVolunteerId: submission.linkedVolunteerId,
        volunteerName: submission.aboutYou.name,
        congregation: submission.aboutYou.congregation,
        email: submission.aboutYou.email,
        submittedDate: formatMockDate(submission.submittedAt),
        updatedDate: formatMockDate(submission.updatedAt),
        status: getQueueStatusFromQuestionnaireStatus(submission.status),
        rawStatus: submission.status,
        sourceType: submission.sourceType,
        availabilitySummary: summarizeQuestionnaireAvailability(submission),
        skillsSummary: summarizeQuestionnaireSkills(submission),
        otherWaysToHelpSummary: summarizeOtherWaysToHelp(submission),
        flags,
        flagLabels: flags.map((flag) => questionnaireReviewFlagLabels[flag]),
        notes: [
          submission.review.summary,
          ...submission.review.notes.map((note) => note.message),
        ].filter((note): note is string => Boolean(note)),
      };
    })
    .sort((first, second) => {
      const firstSubmitted = questionnaireSubmissions.find(
        (submission) => submission.id === first.id,
      )?.submittedAt;
      const secondSubmitted = questionnaireSubmissions.find(
        (submission) => submission.id === second.id,
      )?.submittedAt;

      return (
        new Date(secondSubmitted ?? second.updatedDate).getTime() -
        new Date(firstSubmitted ?? first.updatedDate).getTime()
      );
    });
}

export function getQuestionnaireReviewItemById(submissionId: string) {
  return getQuestionnaireReviewItems().find((item) => item.id === submissionId);
}

export function getVolunteerProfilePreviewFromSubmission(
  submission: VolunteerQuestionnaireSubmission,
): VolunteerProfilePreview {
  const reviewItem = getQuestionnaireReviewItemById(submission.id);
  const linkedVolunteer = getLinkedVolunteerForSubmission(submission);
  const emergencyContactComplete = Boolean(
    submission.emergencyContact?.name && submission.emergencyContact.phone,
  );
  const hasContactMethod = Boolean(submission.aboutYou.email || submission.aboutYou.phone);
  const hasAvailability = Boolean(
    submission.availability.weekdays.length && submission.availability.preferredTimes.length,
  );
  const hasSkillsOrHelp = Boolean(
    submission.skillsExperience.construction.length ||
      submission.skillsExperience.taskCards ||
      submission.skillsExperience.notes ||
      summarizeOtherWaysToHelp(submission) !== "No other help listed",
  );
  const blockersBeforeScheduling: string[] = [];

  if (linkedVolunteer) {
    blockersBeforeScheduling.push("Existing volunteer profile is already linked.");
  }

  if (!hasContactMethod) {
    blockersBeforeScheduling.push("Add at least one contact method before scheduling.");
  }

  if (!emergencyContactComplete) {
    blockersBeforeScheduling.push("Complete the emergency contact.");
  }

  if (!hasAvailability) {
    blockersBeforeScheduling.push("Confirm available days and times.");
  }

  if (!hasSkillsOrHelp) {
    blockersBeforeScheduling.push("Confirm skills or another way they can help.");
  }

  if (submission.status === "inProgress" || submission.status === "notStarted") {
    blockersBeforeScheduling.push("Questionnaire has not been submitted.");
  }

  if (submission.status === "needsFollowUp") {
    blockersBeforeScheduling.push("Resolve the follow-up note before creating a profile.");
  }

  if (submission.status === "needsReview") {
    blockersBeforeScheduling.push("Review the questionnaire before creating a profile.");
  }

  const missingRequiredInfo =
    !hasContactMethod ||
    !emergencyContactComplete ||
    !hasAvailability ||
    !hasSkillsOrHelp ||
    submission.status === "inProgress" ||
    submission.status === "notStarted";

  const readinessStatus: VolunteerProfileReadinessStatus = linkedVolunteer
    ? "Already linked to volunteer profile"
    : missingRequiredInfo
      ? "Missing required info"
      : submission.status === "needsFollowUp" || submission.status === "needsReview"
        ? "Needs follow-up first"
        : "Ready for volunteer profile";

  const suggestedVolunteerStatus: ProjectVolunteerStatus =
    readinessStatus === "Ready for volunteer profile" ? "Submitted" : "Needs Review";

  return {
    sourceSubmissionId: submission.id,
    projectId: submission.projectId,
    linkedVolunteerId: linkedVolunteer?.id,
    name: submission.aboutYou.name,
    email: submission.aboutYou.email,
    phone: submission.aboutYou.phone,
    congregation: submission.aboutYou.congregation,
    availabilitySummary: summarizeQuestionnaireAvailability(submission),
    skillsExperienceSummary: summarizeQuestionnaireSkills(submission),
    emergencyContactComplete,
    otherWaysToHelpSummary: summarizeOtherWaysToHelp(submission),
    reviewStatus: reviewItem?.status ?? getQueueStatusFromQuestionnaireStatus(submission.status),
    readinessStatus,
    suggestedVolunteerStatus,
    blockersBeforeScheduling:
      blockersBeforeScheduling.length > 0
        ? blockersBeforeScheduling
        : ["No blockers in the mock preview."],
  };
}

export function getVolunteerProfilePreviewBySubmissionId(submissionId: string) {
  const submission = getQuestionnaireSubmissionById(submissionId);

  return submission ? getVolunteerProfilePreviewFromSubmission(submission) : undefined;
}

export function getQuestionnaireWorkflowStateFromSubmission(
  submission: VolunteerQuestionnaireSubmission,
): QuestionnaireWorkflowState {
  const preview = getVolunteerProfilePreviewFromSubmission(submission);
  const linkedVolunteer = getLinkedVolunteerForSubmission(submission);
  const firstBlocker = preview.blockersBeforeScheduling[0];
  const hasReviewNotes = Boolean(submission.review.summary || submission.review.notes.length);

  if (linkedVolunteer) {
    return {
      status: "Already linked / reviewed",
      title: "Already connected to a volunteer profile",
      guidance:
        "This questionnaire is already tied to an existing volunteer record. Use the volunteer profile for scheduling readiness and avoid creating a duplicate.",
      nextStepSummary: "View existing volunteer profile",
      actions: [
        {
          label: "View existing volunteer profile",
          description: "Open the linked volunteer record.",
          enabled: true,
          href: `/admin/volunteers/${linkedVolunteer.id}`,
        },
      ],
    };
  }

  if (preview.readinessStatus === "Missing required info") {
    return {
      status: "Missing required info",
      title: "Complete required information first",
      guidance: firstBlocker
        ? `${firstBlocker} Once the missing information is clear, the team can finish review.`
        : "Complete the missing questionnaire details before creating a volunteer profile.",
      nextStepSummary: "Review missing details",
      actions: [
        {
          label: "Mark needs follow-up (coming next)",
          description: "Later this will record that the project team needs to contact the volunteer.",
          enabled: false,
        },
        {
          label: "Create volunteer profile (coming next)",
          description: "Profile creation stays disabled until required information is complete.",
          enabled: false,
        },
      ],
    };
  }

  if (
    preview.readinessStatus === "Needs follow-up first" ||
    submission.status === "needsFollowUp"
  ) {
    return {
      status: "Needs follow-up",
      title: "Follow up before creating a profile",
      guidance:
        "A coordinator should resolve the review note before this questionnaire becomes a volunteer profile.",
      nextStepSummary: "Follow up with volunteer",
      actions: [
        {
          label: "Mark needs follow-up (coming next)",
          description: "Later this will save the follow-up state and notes.",
          enabled: false,
        },
        {
          label: "Mark reviewed (coming next)",
          description: "Later this will move the submission forward after the follow-up is resolved.",
          enabled: false,
        },
      ],
    };
  }

  if (preview.readinessStatus === "Ready for volunteer profile") {
    return {
      status: "Ready for volunteer profile",
      title: "Ready to create a volunteer profile",
      guidance:
        "The required intake details are present. Once real workflow actions exist, this can become a volunteer profile for scheduling review.",
      nextStepSummary: "Create volunteer profile when enabled",
      actions: [
        {
          label: "Create volunteer profile (coming next)",
          description: "Later this will create the project volunteer record.",
          enabled: false,
        },
        {
          label: "Mark needs follow-up (coming next)",
          description: "Later this will hold the submission if the team wants one more conversation.",
          enabled: false,
        },
      ],
    };
  }

  if (submission.status === "submitted" && !hasReviewNotes) {
    return {
      status: "New submission",
      title: "New questionnaire is ready for review",
      guidance:
        "Start by reading the full answers, then decide whether it can move toward a volunteer profile or needs a kind follow-up.",
      nextStepSummary: "Review questionnaire answers",
      actions: [
        {
          label: "Mark reviewed (coming next)",
          description: "Later this will record that the first review is complete.",
          enabled: false,
        },
        {
          label: "Mark needs follow-up (coming next)",
          description: "Later this will record a follow-up request.",
          enabled: false,
        },
      ],
    };
  }

  return {
    status: "Needs review",
    title: "Review before moving forward",
    guidance:
      "This questionnaire has enough shape to inspect, but the team should finish review before creating a volunteer profile.",
    nextStepSummary: "Finish questionnaire review",
    actions: [
      {
        label: "Mark reviewed (coming next)",
        description: "Later this will record review completion.",
        enabled: false,
      },
      {
        label: "Mark needs follow-up (coming next)",
        description: "Later this will record that the volunteer should be contacted.",
        enabled: false,
      },
    ],
  };
}

export function getQuestionnaireWorkflowStateBySubmissionId(submissionId: string) {
  const submission = getQuestionnaireSubmissionById(submissionId);

  return submission ? getQuestionnaireWorkflowStateFromSubmission(submission) : undefined;
}

export function getQuestionnaireStatusLabel(status: QuestionnaireStatus) {
  return questionnaireStatusLabels[status];
}

export function getQuestionnaireStatusTone(
  status: QuestionnaireStatus,
): QuestionnaireStatusTone {
  const tones: Record<QuestionnaireStatus, QuestionnaireStatusTone> = {
    notStarted: "neutral",
    inProgress: "info",
    submitted: "info",
    needsReview: "warning",
    approved: "success",
    needsFollowUp: "attention",
  };

  return tones[status];
}

export function getQuestionnaireSectionProgress(
  submission: VolunteerQuestionnaireSubmission,
) {
  const hasOtherWaysToHelp =
    submission.otherWaysToHelp.housing ||
    submission.otherWaysToHelp.transportation ||
    submission.otherWaysToHelp.laundryDryCleaning ||
    submission.otherWaysToHelp.housekeeping ||
    submission.otherWaysToHelp.hairCare ||
    submission.otherWaysToHelp.medicalSupport ||
    submission.otherWaysToHelp.foodService ||
    Boolean(submission.otherWaysToHelp.other || submission.otherWaysToHelp.details);

  const sections: Record<QuestionnaireSectionKey, boolean> = {
    aboutYou: Boolean(
      submission.aboutYou.name &&
        submission.aboutYou.congregation &&
        (submission.aboutYou.email || submission.aboutYou.phone),
    ),
    availability: Boolean(
      submission.availability.weekdays.length && submission.availability.preferredTimes.length,
    ),
    skillsExperience: Boolean(
      submission.skillsExperience.construction.length ||
        submission.skillsExperience.taskCards ||
        submission.skillsExperience.notes,
    ),
    emergencyContact: Boolean(
      submission.emergencyContact?.name && submission.emergencyContact.phone,
    ),
    otherWaysToHelp: hasOtherWaysToHelp,
  };

  const completed = questionnaireSectionKeys.filter((key) => sections[key]).length;
  const total = questionnaireSectionKeys.length;

  return {
    completed,
    total,
    percent: Math.round((completed / total) * 100),
    sections,
  };
}

export function getLinkedVolunteerForSubmission(
  submission: VolunteerQuestionnaireSubmission,
) {
  return submission.linkedVolunteerId
    ? getVolunteerById(submission.linkedVolunteerId)
    : undefined;
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
