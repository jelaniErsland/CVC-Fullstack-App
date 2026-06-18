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
export type ScheduleAssignmentCategory =
  | "Construction"
  | "Food"
  | "Security"
  | "Cleaning"
  | "Other";
export type ScheduleAssignmentStatus =
  | "Draft"
  | "Open"
  | "Assigned"
  | "Confirmed"
  | "Denied"
  | "Needs Attention";
export type PillStatus =
  | AssignmentStatus
  | ProjectStatus
  | ProjectVolunteerStatus
  | QuestionnaireReviewQueueStatus
  | ScheduleAssignmentStatus;

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

export type ScheduleAssignment = {
  id: string;
  projectId: string;
  date: string;
  startTime?: string;
  endTime?: string;
  shiftLabel: string;
  category: ScheduleAssignmentCategory;
  title: string;
  assignedVolunteerIds: string[];
  congregation?: string;
  status: ScheduleAssignmentStatus;
  location?: string;
  notes?: string;
  statusExplanation?: string;
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

export type ScheduleAssignmentWithVolunteers = ScheduleAssignment & {
  volunteers: ProjectVolunteer[];
};

export type ScheduleDayGroup = {
  date: string;
  dayLabel: string;
  isToday: boolean;
  isThisWeek: boolean;
  assignments: ScheduleAssignmentWithVolunteers[];
};

export type ScheduleAssignmentCounts = {
  total: number;
  draft: number;
  open: number;
  assigned: number;
  confirmed: number;
  denied: number;
  needsAttention: number;
};

export type RoleHomeKind =
  | "Primary CVC"
  | "Assistant CVC"
  | "Primary Food Contact"
  | "Primary Security Contact"
  | "On-site Contact";

export type RoleHomeSummaryMetric = {
  label: string;
  value: string | number;
  helper: string;
};

export type RoleHomeUpdate = {
  id: string;
  label: string;
  detail: string;
  href?: string;
};

export type RoleHomeFocus = {
  label: string;
  title: string;
  detail: string;
  href?: string;
};

export type RoleHomeData = {
  role: RoleHomeKind;
  projectId: string;
  congregationScope?: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  nextBestAction: RoleHomeFocus;
  metrics: RoleHomeSummaryMetric[];
  weekSnapshot: RoleHomeUpdate[];
  focusItems: RoleHomeFocus[];
  recentUpdates: RoleHomeUpdate[];
  previewOnly?: boolean;
};

export type NeedsAttentionArea =
  | "Questionnaires"
  | "Schedule"
  | "Volunteers"
  | "Food"
  | "Security"
  | "Setup";

export type NeedsAttentionPriority = "low" | "normal" | "important";
export type NeedsAttentionStatus = "open" | "inReview" | "resolved";

export type NeedsAttentionItem = {
  id: string;
  projectId: string;
  area: NeedsAttentionArea;
  title: string;
  summary: string;
  suggestedNextStep: string;
  priority: NeedsAttentionPriority;
  status: NeedsAttentionStatus;
  relatedRoute?: string;
  relatedDate?: string;
  detail?: string;
};

export type NeedsAttentionGroup = {
  area: NeedsAttentionArea;
  items: NeedsAttentionItem[];
};

export type NeedsAttentionCounts = {
  total: number;
  open: number;
  important: number;
  inReview: number;
  resolved: number;
};

export type ConflictCoverageIssueType =
  | "coverageGap"
  | "needsDecision"
  | "followUp"
  | "missingInfo"
  | "possibleOverlap";

export type ConflictCoverageAction = {
  label: string;
  description: string;
};

export type ConflictCoverageDetail = {
  id: string;
  itemId: string;
  issueType: ConflictCoverageIssueType;
  title: string;
  explanation: string;
  affectedDate?: string;
  affectedTime?: string;
  module: NeedsAttentionArea;
  relatedAssignmentIds: string[];
  relatedVolunteerIds: string[];
  suggestedNextStep: string;
  placeholderActions: ConflictCoverageAction[];
  relatedRoutes: Array<{
    label: string;
    href: string;
  }>;
};

export type ConflictCoverageContext = {
  item?: NeedsAttentionItem;
  detail?: ConflictCoverageDetail;
  assignments: ScheduleAssignmentWithVolunteers[];
  volunteers: ProjectVolunteer[];
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

export type FoodServiceType =
  | "lunch"
  | "snackSupport"
  | "waterCoffee"
  | "cleanup";

export type FoodCoverageStatus =
  | "covered"
  | "needsHelpers"
  | "needsHeadcount"
  | "draftMock"
  | "reviewedMock";

export type FoodStatusTone =
  | "neutral"
  | "success"
  | "warning"
  | "info";

export type FoodCoordinationItem = {
  id: string;
  projectId: string;
  date: string;
  dayLabel: string;
  serviceType: FoodServiceType;
  title: string;
  congregation?: string;
  responsibleContact?: string;
  estimatedHeadcount?: number;
  assignedHelpers: string[];
  status: FoodCoverageStatus;
  mealNotes?: string;
  helperNotes?: string;
  headcountNotes?: string;
  relatedScheduleId?: string;
  relatedAnnouncementId?: string;
  relatedNeedsAttentionId?: string;
};

export type FoodCoordinationGroup = {
  date: string;
  dayLabel: string;
  items: FoodCoordinationItem[];
};

export type FoodCoordinationCounts = {
  total: number;
  upcoming: number;
  covered: number;
  needsReview: number;
  needsHelpers: number;
};

export type RecommendedFoodAction = {
  title: string;
  detail: string;
  href: string;
};

export type SecurityServiceType =
  | "nightWatch"
  | "eveningSiteCheck"
  | "morningUnlock"
  | "accessNote";

export type SecurityCoverageStatus =
  | "covered"
  | "needsHelper"
  | "needsReview"
  | "draftMock"
  | "reviewedMock";

export type SecurityStatusTone =
  | "neutral"
  | "success"
  | "warning"
  | "info";

export type SecurityCoordinationItem = {
  id: string;
  projectId: string;
  date: string;
  dayLabel: string;
  serviceType: SecurityServiceType;
  title: string;
  status: SecurityCoverageStatus;
  assignedContact?: string;
  assignedHelpers: string[];
  congregation?: string;
  timeWindow?: string;
  siteNotes?: string;
  coverageNotes?: string;
  helperNotes?: string;
  relatedScheduleId?: string;
  relatedAnnouncementId?: string;
  relatedNeedsAttentionId?: string;
};

export type SecurityCoordinationGroup = {
  date: string;
  dayLabel: string;
  items: SecurityCoordinationItem[];
};

export type SecurityCoordinationCounts = {
  total: number;
  upcoming: number;
  covered: number;
  needsReview: number;
  needsHelpers: number;
};

export type RecommendedSecurityAction = {
  title: string;
  detail: string;
  href: string;
};

export type CommunicationMessageType =
  | "announcement"
  | "reminder"
  | "update"
  | "scheduleChange"
  | "foodNote"
  | "securityNote";

export type CommunicationAudience =
  | "allVolunteers"
  | "assignedVolunteers"
  | "congregationContacts"
  | "foodContacts"
  | "securityContacts"
  | "specificCongregation";

export type CommunicationStatus =
  | "draft"
  | "ready"
  | "scheduledMock"
  | "sentMock";

export type CommunicationStatusTone =
  | "neutral"
  | "success"
  | "info";

export type ReminderTemplateCategory =
  | "scheduleReminder"
  | "pendingConfirmation"
  | "questionnaireFollowUp"
  | "foodService"
  | "securityNightWatch"
  | "projectUpdate"
  | "planChange"
  | "thankYou";

export type ReminderTemplateAudience =
  | "allVolunteers"
  | "assignedVolunteers"
  | "pendingVolunteers"
  | "congregationContacts"
  | "foodContacts"
  | "securityContacts";

export type ReminderTemplateModule =
  | "schedule"
  | "questionnaire"
  | "food"
  | "security"
  | "general";

export type Communication = {
  id: string;
  projectId: string;
  title: string;
  messageType: CommunicationMessageType;
  audience: CommunicationAudience;
  status: CommunicationStatus;
  author: string;
  authorRole: AdminProjectRole;
  createdAt: string;
  updatedAt: string;
  scheduledAt?: string;
  bodyPreview: string;
  recipientExplanation: string;
  relatedRoute?: string;
};

export type Announcement = Communication;

export type CommunicationCounts = {
  total: number;
  drafts: number;
  ready: number;
  scheduledMock: number;
  sentMock: number;
};

export type RecommendedCommunicationAction = {
  title: string;
  detail: string;
  href: string;
};

export type ReminderTemplate = {
  id: string;
  title: string;
  category: ReminderTemplateCategory;
  suggestedAudience: ReminderTemplateAudience;
  suggestedTiming: string;
  description: string;
  subjectSuggestion: string;
  bodyPreview: string;
  variables?: string[];
  suggestedModule: ReminderTemplateModule;
};

export type RecommendedTemplateAction = {
  title: string;
  detail: string;
  href: string;
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

export const scheduleReferenceDate = "2026-01-12";

export const scheduleAssignments: ScheduleAssignment[] = [
  {
    id: "schedule-demo-prep-jan-12",
    projectId: "belgrade-remodel-2026",
    date: "2026-01-12",
    startTime: "7:30 AM",
    endTime: "11:30 AM",
    shiftLabel: "Morning",
    category: "Construction",
    title: "Demo prep and interior protection",
    assignedVolunteerIds: ["alex-rivera", "marcus-lee"],
    congregation: "Belgrade",
    status: "Confirmed",
    location: "Main hall, north wing",
    notes: "Keep dust barriers in place before the second crew arrives.",
    statusExplanation: "Both assigned volunteers are approved and have confirmed this shift.",
  },
  {
    id: "schedule-lunch-jan-12",
    projectId: "belgrade-remodel-2026",
    date: "2026-01-12",
    startTime: "10:30 AM",
    endTime: "1:30 PM",
    shiftLabel: "Lunch",
    category: "Food",
    title: "Lunch setup and service",
    assignedVolunteerIds: ["mia-thompson", "priya-santos"],
    congregation: "Bozeman",
    status: "Assigned",
    location: "Fellowship area",
    notes: "Confirm final headcount by Sunday evening.",
    statusExplanation: "Volunteers are assigned, but the shift is waiting on confirmation.",
  },
  {
    id: "schedule-cleanup-jan-12",
    projectId: "belgrade-remodel-2026",
    date: "2026-01-12",
    startTime: "3:00 PM",
    endTime: "5:00 PM",
    shiftLabel: "End of day",
    category: "Cleaning",
    title: "Sweep, trash, and tool reset",
    assignedVolunteerIds: [],
    congregation: "Belgrade",
    status: "Open",
    location: "Main hall and west entrance",
    notes: "Good fit for newer volunteers or family groups.",
    statusExplanation: "This shift is ready to fill once volunteer profile creation is enabled.",
  },
  {
    id: "schedule-security-jan-12",
    projectId: "belgrade-remodel-2026",
    date: "2026-01-12",
    startTime: "6:00 PM",
    endTime: "10:00 PM",
    shiftLabel: "Evening",
    category: "Security",
    title: "Evening site check",
    assignedVolunteerIds: ["caleb-ross"],
    congregation: "Helena",
    status: "Needs Attention",
    location: "Exterior doors and tool storage",
    notes: "Pair with one additional approved brother before confirming.",
    statusExplanation: "One person is assigned, but the shift needs a second approved volunteer.",
  },
  {
    id: "schedule-framing-jan-13",
    projectId: "belgrade-remodel-2026",
    date: "2026-01-13",
    startTime: "8:00 AM",
    endTime: "2:00 PM",
    shiftLabel: "Day shift",
    category: "Construction",
    title: "Interior framing support",
    assignedVolunteerIds: ["alex-rivera", "marcus-lee", "evan-brooks"],
    congregation: "Belgrade",
    status: "Assigned",
    location: "North classroom wall",
    notes: "Crew lead should review material staging before work starts.",
    statusExplanation: "The crew is selected; confirmation is the next workflow step.",
  },
  {
    id: "schedule-materials-jan-14",
    projectId: "belgrade-remodel-2026",
    date: "2026-01-14",
    startTime: "8:00 AM",
    endTime: "12:00 PM",
    shiftLabel: "Morning",
    category: "Construction",
    title: "Material staging",
    assignedVolunteerIds: ["marcus-lee"],
    congregation: "Bozeman",
    status: "Confirmed",
    location: "West entrance",
    notes: "Leave a clear path for lunch delivery.",
    statusExplanation: "Assigned volunteer is confirmed and qualified for staging work.",
  },
  {
    id: "schedule-lunch-jan-14",
    projectId: "belgrade-remodel-2026",
    date: "2026-01-14",
    startTime: "11:00 AM",
    endTime: "1:30 PM",
    shiftLabel: "Lunch",
    category: "Food",
    title: "Simple lunch coverage",
    assignedVolunteerIds: [],
    congregation: "Bozeman",
    status: "Open",
    location: "Fellowship area",
    notes: "Need two food volunteers and one cleanup helper.",
    statusExplanation: "This shift has not been assigned yet.",
  },
  {
    id: "schedule-security-lockup-jan-14",
    projectId: "belgrade-remodel-2026",
    date: "2026-01-14",
    startTime: "10:00 AM",
    endTime: "12:00 PM",
    shiftLabel: "Late morning",
    category: "Security",
    title: "Tool-room lockup handoff",
    assignedVolunteerIds: ["marcus-lee"],
    congregation: "Bozeman",
    status: "Assigned",
    location: "Tool storage",
    notes: "Mock overlap pattern: Marcus is also assigned to material staging during this window.",
    statusExplanation: "This needs a coordinator decision before confirmations are treated as final.",
  },
  {
    id: "schedule-security-jan-16",
    projectId: "belgrade-remodel-2026",
    date: "2026-01-16",
    startTime: "6:00 PM",
    endTime: "10:00 PM",
    shiftLabel: "Evening",
    category: "Security",
    title: "Friday site security",
    assignedVolunteerIds: ["marcus-lee", "caleb-ross"],
    congregation: "Belgrade",
    status: "Assigned",
    location: "Exterior doors and parking lot",
    notes: "Confirm that both volunteers can stay through lockup.",
    statusExplanation: "Coverage looks right; confirmations are not recorded yet.",
  },
  {
    id: "schedule-paint-touchup-jan-17",
    projectId: "belgrade-remodel-2026",
    date: "2026-01-17",
    startTime: "8:30 AM",
    endTime: "11:30 AM",
    shiftLabel: "Morning",
    category: "Construction",
    title: "Paint touch-up draft",
    assignedVolunteerIds: [],
    congregation: "Helena",
    status: "Draft",
    location: "Classrooms",
    notes: "Hold until the construction lead confirms whether this work is needed.",
    statusExplanation: "This is a planning placeholder and is not ready for volunteers.",
  },
  {
    id: "schedule-cleanup-jan-17",
    projectId: "belgrade-remodel-2026",
    date: "2026-01-17",
    startTime: "9:00 AM",
    endTime: "1:00 PM",
    shiftLabel: "Saturday",
    category: "Cleaning",
    title: "Final cleanup",
    assignedVolunteerIds: ["mia-thompson", "leah-johnson"],
    congregation: "Belgrade",
    status: "Confirmed",
    location: "Fellowship area",
    notes: "Bring extra trash bags and label any remaining supplies.",
    statusExplanation: "Coverage is confirmed for the cleanup shift.",
  },
  {
    id: "schedule-supply-run-jan-17",
    projectId: "belgrade-remodel-2026",
    date: "2026-01-17",
    startTime: "1:00 PM",
    endTime: "2:30 PM",
    shiftLabel: "Afternoon",
    category: "Other",
    title: "Return borrowed supplies",
    assignedVolunteerIds: ["nora-bennett"],
    congregation: "Helena",
    status: "Denied",
    location: "Supply closet and hardware store",
    notes: "Nora declined this window; choose another approved volunteer later.",
    statusExplanation: "The latest assigned volunteer response was denied.",
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

export const foodCoordinationItems: FoodCoordinationItem[] = [
  {
    id: "food-belgrade-lunch-jan-12",
    projectId: "belgrade-remodel-2026",
    date: "2026-01-12",
    dayLabel: "Monday, Jan 12",
    serviceType: "lunch",
    title: "Lunch support",
    congregation: "Bozeman",
    responsibleContact: "Priya Santos",
    estimatedHeadcount: 28,
    assignedHelpers: ["Mia Thompson", "Priya Santos"],
    status: "covered",
    mealNotes: "Sandwich bar at noon in the break area. Keep a small vegetarian tray aside.",
    helperNotes: "Mia can help with setup and Priya will handle serving notes.",
    headcountNotes: "Headcount is based on confirmed Monday assignments plus a small buffer.",
    relatedScheduleId: "schedule-lunch-jan-12",
    relatedAnnouncementId: "comm-belgrade-food-headcount",
  },
  {
    id: "food-belgrade-coffee-jan-12",
    projectId: "belgrade-remodel-2026",
    date: "2026-01-12",
    dayLabel: "Monday, Jan 12",
    serviceType: "waterCoffee",
    title: "Water and coffee station",
    congregation: "Belgrade",
    responsibleContact: "Evan Brooks",
    estimatedHeadcount: 34,
    assignedHelpers: ["Evan Brooks"],
    status: "reviewedMock",
    mealNotes: "Coffee and water available near the fellowship area before the morning crew starts.",
    helperNotes: "One helper can refresh cups and water after lunch.",
    headcountNotes: "Use the full day count because several volunteers overlap shifts.",
  },
  {
    id: "food-belgrade-lunch-jan-14",
    projectId: "belgrade-remodel-2026",
    date: "2026-01-14",
    dayLabel: "Wednesday, Jan 14",
    serviceType: "lunch",
    title: "Lunch setup and service",
    congregation: "Bozeman",
    responsibleContact: "Priya Santos",
    estimatedHeadcount: 36,
    assignedHelpers: [],
    status: "needsHelpers",
    mealNotes: "Soup and salad from 11:45 AM to 12:30 PM.",
    helperNotes: "Needs two food helpers and one cleanup helper before the project week.",
    headcountNotes: "Final count depends on pending confirmations for staging and security support.",
    relatedScheduleId: "schedule-lunch-jan-14",
    relatedAnnouncementId: "comm-belgrade-food-headcount",
    relatedNeedsAttentionId: "needs-lunch-jan-14-details",
  },
  {
    id: "food-belgrade-snack-jan-16",
    projectId: "belgrade-remodel-2026",
    date: "2026-01-16",
    dayLabel: "Friday, Jan 16",
    serviceType: "snackSupport",
    title: "Afternoon snack support",
    congregation: "Helena",
    responsibleContact: "Evan Brooks",
    estimatedHeadcount: 22,
    assignedHelpers: ["Nora Bennett"],
    status: "needsHeadcount",
    mealNotes: "Simple packaged snacks and water for the late-afternoon crew.",
    helperNotes: "Nora can drop off snacks if the final count stays small.",
    headcountNotes: "Review Friday assignments before confirming how much to bring.",
  },
  {
    id: "food-belgrade-cleanup-jan-17",
    projectId: "belgrade-remodel-2026",
    date: "2026-01-17",
    dayLabel: "Saturday, Jan 17",
    serviceType: "cleanup",
    title: "Lunch cleanup",
    congregation: "Belgrade",
    responsibleContact: "Priya Santos",
    estimatedHeadcount: 42,
    assignedHelpers: ["Mia Thompson"],
    status: "draftMock",
    mealNotes: "Light lunch after cleanup for all volunteers.",
    helperNotes: "Draft note: add one more helper if Saturday cleanup stays near forty volunteers.",
    headcountNotes: "Saturday count is still a planning estimate.",
    relatedScheduleId: "schedule-cleanup-jan-17",
  },
];

export const securityCoordinationItems: SecurityCoordinationItem[] = [
  {
    id: "security-belgrade-evening-jan-12",
    projectId: "belgrade-remodel-2026",
    date: "2026-01-12",
    dayLabel: "Monday, Jan 12",
    serviceType: "eveningSiteCheck",
    title: "Evening site check",
    status: "needsHelper",
    assignedContact: "Caleb Ross",
    assignedHelpers: ["Marcus Lee"],
    congregation: "Belgrade",
    timeWindow: "6:30 PM - 8:00 PM",
    siteNotes:
      "Check exterior doors, tool storage, and the fellowship area after the day crew leaves.",
    coverageNotes:
      "One helper is listed. Add a second approved helper before treating this as covered.",
    helperNotes: "Marcus can pair with Caleb if his work shift ends on time.",
    relatedScheduleId: "schedule-security-jan-12",
    relatedAnnouncementId: "comm-belgrade-security-pairing",
    relatedNeedsAttentionId: "needs-security-evening-pair",
  },
  {
    id: "security-belgrade-access-jan-14",
    projectId: "belgrade-remodel-2026",
    date: "2026-01-14",
    dayLabel: "Wednesday, Jan 14",
    serviceType: "accessNote",
    title: "Building access note",
    status: "needsReview",
    assignedContact: "Caleb Ross",
    assignedHelpers: [],
    congregation: "Bozeman",
    timeWindow: "Before lunch setup",
    siteNotes:
      "Confirm who will have the side-entry key before lunch support and staging overlap.",
    coverageNotes:
      "Access details should be reviewed with the project CVC before the midweek crew arrives.",
    helperNotes: "No helper is needed yet; this is a contact-review note.",
    relatedScheduleId: "schedule-security-lockup-jan-14",
  },
  {
    id: "security-belgrade-night-jan-16",
    projectId: "belgrade-remodel-2026",
    date: "2026-01-16",
    dayLabel: "Friday, Jan 16",
    serviceType: "nightWatch",
    title: "Night watch coverage",
    status: "covered",
    assignedContact: "Caleb Ross",
    assignedHelpers: ["Jonah Price", "Marcus Lee"],
    congregation: "Belgrade",
    timeWindow: "7:00 PM - 10:00 PM",
    siteNotes:
      "Keep the site check simple: exterior doors, tool storage, and hallway lights.",
    coverageNotes: "Two approved helpers are listed for the Friday evening check.",
    helperNotes: "Jonah and Marcus are both comfortable with a paired evening check.",
    relatedScheduleId: "schedule-security-jan-16",
  },
  {
    id: "security-belgrade-unlock-jan-17",
    projectId: "belgrade-remodel-2026",
    date: "2026-01-17",
    dayLabel: "Saturday, Jan 17",
    serviceType: "morningUnlock",
    title: "Morning unlock and check-in",
    status: "reviewedMock",
    assignedContact: "Caleb Ross",
    assignedHelpers: ["Nora Bennett"],
    congregation: "Belgrade",
    timeWindow: "7:15 AM - 8:00 AM",
    siteNotes:
      "Open the main entrance, confirm the check-in area is ready, and note any access questions for the project CVC.",
    coverageNotes: "Reviewed as a mock planning item for the Saturday crew start.",
    helperNotes: "Nora can help with check-in table setup after doors are opened.",
  },
  {
    id: "security-belgrade-draft-jan-18",
    projectId: "belgrade-remodel-2026",
    date: "2026-01-18",
    dayLabel: "Sunday, Jan 18",
    serviceType: "accessNote",
    title: "Wrap-up access note",
    status: "draftMock",
    assignedContact: "Caleb Ross",
    assignedHelpers: [],
    congregation: "Belgrade",
    timeWindow: "After final cleanup",
    siteNotes:
      "Draft note to confirm who returns keys and checks that remaining rooms are closed.",
    coverageNotes:
      "Keep this as a calm review note until final cleanup timing is clearer.",
    helperNotes: "No helper is assigned in mock data yet.",
  },
];

export const announcements: Announcement[] = [
  {
    id: "comm-belgrade-parking-draft",
    projectId: "belgrade-remodel-2026",
    title: "Weekday parking note",
    messageType: "announcement",
    audience: "allVolunteers",
    status: "draft",
    author: "Jordan Miller",
    authorRole: "Primary CVC",
    createdAt: "2026-06-12",
    updatedAt: "2026-06-15",
    bodyPreview:
      "Parking has moved to the east lot for weekday crews. Please leave the west entrance open for deliveries and check in at the front desk before going to the work area.",
    recipientExplanation:
      "Intended for all approved volunteers attached to the Belgrade workspace once real recipient lists exist.",
    relatedRoute: "/admin/schedule",
  },
  {
    id: "comm-belgrade-ppe-ready",
    projectId: "belgrade-remodel-2026",
    title: "Gloves and closed-toe shoes reminder",
    messageType: "reminder",
    audience: "assignedVolunteers",
    status: "ready",
    author: "Morgan Lee",
    authorRole: "Assistant CVC",
    createdAt: "2026-06-13",
    updatedAt: "2026-06-16",
    bodyPreview:
      "For staging and demo prep shifts, please bring work gloves and closed-toe shoes. If you have questions about what to bring, contact the project CVC before your shift.",
    recipientExplanation:
      "Prepared for volunteers assigned to construction and staging shifts, but recipient resolution is still mock-only.",
    relatedRoute: "/admin/schedule",
  },
  {
    id: "comm-belgrade-check-in-scheduled",
    projectId: "belgrade-remodel-2026",
    title: "Monday check-in reminder",
    messageType: "reminder",
    audience: "allVolunteers",
    status: "scheduledMock",
    author: "Jordan Miller",
    authorRole: "Primary CVC",
    createdAt: "2026-06-10",
    updatedAt: "2026-06-14",
    scheduledAt: "2026-01-11 6:00 PM",
    bodyPreview:
      "Thank you for helping this week. Please check in with the front desk before entering work areas so the on-site contact knows who has arrived.",
    recipientExplanation:
      "Mock reminder plan for the first project evening. No background job or scheduled email exists yet.",
    relatedRoute: "/admin/dashboard",
  },
  {
    id: "comm-belgrade-food-headcount",
    projectId: "belgrade-remodel-2026",
    title: "Lunch headcount check",
    messageType: "foodNote",
    audience: "foodContacts",
    status: "draft",
    author: "Priya Santos",
    authorRole: "Primary Food Contact",
    createdAt: "2026-06-14",
    updatedAt: "2026-06-14",
    bodyPreview:
      "Please review the Monday and Wednesday lunch counts before we prepare the final food plan. The current schedule still has a few assigned volunteers waiting on confirmation.",
    recipientExplanation:
      "Prepared for food contacts and assistants when the food module has real recipient lists.",
    relatedRoute: "/admin/schedule",
  },
  {
    id: "comm-belgrade-security-pairing",
    projectId: "belgrade-remodel-2026",
    title: "Evening site check pairing",
    messageType: "securityNote",
    audience: "securityContacts",
    status: "ready",
    author: "Caleb Ross",
    authorRole: "Primary Security Contact",
    createdAt: "2026-06-11",
    updatedAt: "2026-06-16",
    bodyPreview:
      "Monday evening site check still needs one additional approved helper before it is ready to confirm. Please review the coverage note and suggest a paired volunteer.",
    recipientExplanation:
      "Prepared for security contacts only. This does not notify anyone while sending is inactive.",
    relatedRoute: "/admin/needs-attention/needs-security-evening-pair",
  },
  {
    id: "comm-belgrade-bozeman-update",
    projectId: "belgrade-remodel-2026",
    title: "Bozeman congregation schedule update",
    messageType: "scheduleChange",
    audience: "specificCongregation",
    status: "sentMock",
    author: "Jordan Miller",
    authorRole: "Primary CVC",
    createdAt: "2026-06-08",
    updatedAt: "2026-06-09",
    bodyPreview:
      "A few Bozeman assignments moved from Monday afternoon to Wednesday morning. Please review the schedule preview before final confirmations are prepared.",
    recipientExplanation:
      "Historical mock row showing how a sent item might appear later. No email was sent from this app.",
    relatedRoute: "/admin/schedule",
  },
  {
    id: "comm-bozeman-draft-welcome",
    projectId: "bozeman-sample-draft",
    title: "Welcome note draft",
    messageType: "announcement",
    audience: "congregationContacts",
    status: "draft",
    author: "Jordan Miller",
    authorRole: "Primary CVC",
    createdAt: "2026-06-10",
    updatedAt: "2026-06-10",
    bodyPreview:
      "Thank you for helping us prepare the Bozeman sample project workspace. This note is a placeholder for future congregation contact announcements.",
    recipientExplanation:
      "Would be intended for congregation contacts after real contact management exists.",
  },
];

export const reminderTemplates: ReminderTemplate[] = [
  {
    id: "template-schedule-reminder",
    title: "Schedule reminder",
    category: "scheduleReminder",
    suggestedAudience: "assignedVolunteers",
    suggestedTiming: "One or two days before an assigned shift",
    description:
      "A simple reminder for volunteers who already have an assignment on the project schedule.",
    subjectSuggestion: "{projectName}: reminder for your {assignmentDate} shift",
    bodyPreview:
      "Hi {volunteerName}, thank you for helping with {projectName}. This is a quick reminder that you are scheduled for {assignmentDate} from {shiftTime}. Please check in with the project contact when you arrive.",
    variables: ["volunteerName", "projectName", "assignmentDate", "shiftTime"],
    suggestedModule: "schedule",
  },
  {
    id: "template-pending-confirmation",
    title: "Pending confirmation reminder",
    category: "pendingConfirmation",
    suggestedAudience: "pendingVolunteers",
    suggestedTiming: "After an assignment has been waiting for a reply",
    description:
      "A gentle follow-up for volunteers who have not confirmed or declined an assignment yet.",
    subjectSuggestion: "Can you confirm your {assignmentDate} assignment?",
    bodyPreview:
      "Hi {volunteerName}, we are checking whether you are still available for {assignmentDate} at {shiftTime}. A quick reply helps the CVC team keep the schedule steady.",
    variables: ["volunteerName", "assignmentDate", "shiftTime"],
    suggestedModule: "schedule",
  },
  {
    id: "template-questionnaire-follow-up",
    title: "Questionnaire follow-up",
    category: "questionnaireFollowUp",
    suggestedAudience: "congregationContacts",
    suggestedTiming: "When volunteer intake details are incomplete",
    description:
      "A calm note for gathering missing questionnaire details before scheduling a volunteer.",
    subjectSuggestion: "A quick follow-up for {volunteerName}",
    bodyPreview:
      "Hi {congregation}, we are almost ready to use {volunteerName}'s volunteer information. Could you help confirm the missing details so the project team can plan safely?",
    variables: ["congregation", "volunteerName"],
    suggestedModule: "questionnaire",
  },
  {
    id: "template-food-service-note",
    title: "Food service note",
    category: "foodService",
    suggestedAudience: "foodContacts",
    suggestedTiming: "Before lunch counts or meal helpers need review",
    description:
      "A practical starting point for food contacts coordinating counts, helpers, or serving notes.",
    subjectSuggestion: "{projectName}: food service note for {assignmentDate}",
    bodyPreview:
      "Hi food team, please review the meal plan for {assignmentDate}. Current notes: {foodNote}. Thank you for helping keep lunch simple and ready for the volunteers.",
    variables: ["projectName", "assignmentDate", "foodNote"],
    suggestedModule: "food",
  },
  {
    id: "template-security-night-watch",
    title: "Security / night watch reminder",
    category: "securityNightWatch",
    suggestedAudience: "securityContacts",
    suggestedTiming: "Before an evening or night watch assignment",
    description:
      "A focused reminder for security contacts without making the communication feel urgent or alarming.",
    subjectSuggestion: "{projectName}: site check reminder for {assignmentDate}",
    bodyPreview:
      "Hi security team, this is a reminder for the site check on {assignmentDate} at {shiftTime}. Please review the paired coverage plan and contact the project CVC if anything has changed.",
    variables: ["projectName", "assignmentDate", "shiftTime"],
    suggestedModule: "security",
  },
  {
    id: "template-project-update",
    title: "Project update",
    category: "projectUpdate",
    suggestedAudience: "allVolunteers",
    suggestedTiming: "When the project team has a general update",
    description:
      "A short update pattern for sharing practical project notes with volunteers and contacts.",
    subjectSuggestion: "{projectName}: project update",
    bodyPreview:
      "Thank you for supporting {projectName}. Here is the latest project update: {projectUpdate}. Please review your schedule before arriving and reach out if you have a question.",
    variables: ["projectName", "projectUpdate"],
    suggestedModule: "general",
  },
  {
    id: "template-weather-plan-change",
    title: "Weather or plan-change update",
    category: "planChange",
    suggestedAudience: "allVolunteers",
    suggestedTiming: "When weather, parking, or site plans change",
    description:
      "A steady pattern for sharing a plan change without making it feel like an emergency alert.",
    subjectSuggestion: "{projectName}: plan update for {assignmentDate}",
    bodyPreview:
      "Hi everyone, there is a project plan update for {assignmentDate}: {planChange}. Please use the updated instructions when you arrive. Thank you for staying flexible.",
    variables: ["projectName", "assignmentDate", "planChange"],
    suggestedModule: "general",
  },
  {
    id: "template-thank-you-wrap-up",
    title: "Thank-you / project wrap-up note",
    category: "thankYou",
    suggestedAudience: "allVolunteers",
    suggestedTiming: "After a project day or at project wrap-up",
    description:
      "A warm closing note for thanking volunteers and sharing any final wrap-up information.",
    subjectSuggestion: "Thank you for helping with {projectName}",
    bodyPreview:
      "Thank you for giving your time to {projectName}. Your help made a real difference. The project team will share any final notes or follow-up needs as they are ready.",
    variables: ["projectName"],
    suggestedModule: "general",
  },
];

export const needsAttentionAreaOrder: NeedsAttentionArea[] = [
  "Questionnaires",
  "Schedule",
  "Security",
  "Food",
  "Volunteers",
  "Setup",
];

export const needsAttentionItems: NeedsAttentionItem[] = [
  {
    id: "needs-jonah-emergency-contact",
    projectId: "belgrade-remodel-2026",
    area: "Questionnaires",
    title: "Emergency contact missing",
    summary: "Jonah Price's paper questionnaire is nearly usable, but the emergency contact is blank.",
    suggestedNextStep: "Call or text Jonah before moving this toward scheduling.",
    priority: "important",
    status: "open",
    relatedRoute: "/admin/questionnaires/questionnaire-jonah-price-paper",
    relatedDate: "Jan 5, 2026",
    detail:
      "This is a paper intake item, so the follow-up can stay simple: confirm the contact name, phone, and relationship.",
  },
  {
    id: "needs-caleb-site-access",
    projectId: "belgrade-remodel-2026",
    area: "Questionnaires",
    title: "Follow up on site access details",
    summary: "Caleb Ross can help with security, but the questionnaire notes ask for clearer building access details.",
    suggestedNextStep: "Review the note and decide whether Caleb needs one more conversation.",
    priority: "normal",
    status: "inReview",
    relatedRoute: "/admin/questionnaires/questionnaire-caleb-ross-follow-up",
    relatedDate: "Jan 6, 2026",
  },
  {
    id: "needs-cleanup-open-jan-12",
    projectId: "belgrade-remodel-2026",
    area: "Schedule",
    title: "Monday cleanup is still open",
    summary: "The end-of-day cleanup shift has not been assigned yet.",
    suggestedNextStep: "Choose a small cleanup group or leave it open until volunteer profile conversion is ready.",
    priority: "normal",
    status: "open",
    relatedRoute: "/admin/schedule",
    relatedDate: "Jan 12, 2026",
    detail: "This is a good fit for newer volunteers, family groups, or helpers with lighter availability.",
  },
  {
    id: "needs-supply-run-denied",
    projectId: "belgrade-remodel-2026",
    area: "Schedule",
    title: "Supply return needs another helper",
    summary: "The latest assigned volunteer response was denied for the Saturday supply run.",
    suggestedNextStep: "Pick another approved volunteer when real assignment editing exists.",
    priority: "normal",
    status: "open",
    relatedRoute: "/admin/schedule",
    relatedDate: "Jan 17, 2026",
  },
  {
    id: "needs-lunch-jan-14-details",
    projectId: "belgrade-remodel-2026",
    area: "Food",
    title: "Wednesday lunch helper details",
    summary: "The lunch shift has an open coverage note and needs two food volunteers.",
    suggestedNextStep: "Ask the food contact to confirm helpers and final headcount.",
    priority: "normal",
    status: "open",
    relatedRoute: "/admin/schedule",
    relatedDate: "Jan 14, 2026",
    detail:
      "Food module workflows are not built yet, so this stays as a calm coordination note for now.",
  },
  {
    id: "needs-marcus-overlap-jan-14",
    projectId: "belgrade-remodel-2026",
    area: "Schedule",
    title: "Marcus may have overlapping assignments",
    summary: "Marcus Lee is listed for material staging and a lockup handoff during the same window.",
    suggestedNextStep: "Decide whether to move the handoff or assign a different approved helper.",
    priority: "important",
    status: "open",
    relatedRoute: "/admin/schedule",
    relatedDate: "Jan 14, 2026",
    detail:
      "This is a mock overlap pattern for the future conflict engine. It does not block or change assignments yet.",
  },
  {
    id: "needs-security-evening-pair",
    projectId: "belgrade-remodel-2026",
    area: "Security",
    title: "Evening site check needs a pair",
    summary: "Monday night watch has one assigned volunteer and should be paired before confirmation.",
    suggestedNextStep: "Find one more approved helper for the evening check.",
    priority: "important",
    status: "open",
    relatedRoute: "/admin/schedule",
    relatedDate: "Jan 12, 2026",
    detail:
      "Keep this as a coverage note until conflict detection and security-specific workflow exist.",
  },
  {
    id: "needs-nora-questionnaire-incomplete",
    projectId: "belgrade-remodel-2026",
    area: "Volunteers",
    title: "Incomplete volunteer readiness",
    summary: "Nora Bennett has useful help listed, but the questionnaire is still incomplete.",
    suggestedNextStep: "Review the questionnaire before treating the volunteer profile as schedule-ready.",
    priority: "low",
    status: "open",
    relatedRoute: "/admin/questionnaires/questionnaire-nora-bennett-draft",
    relatedDate: "Jan 4, 2026",
  },
  {
    id: "needs-bozeman-draft-setup",
    projectId: "bozeman-sample-draft",
    area: "Setup",
    title: "Draft workspace can be reviewed later",
    summary: "The Bozeman sample workspace has not been used recently.",
    suggestedNextStep: "Review setup details before using it as a live project template.",
    priority: "low",
    status: "open",
    relatedRoute: "/admin/projects/bozeman-sample-draft",
    relatedDate: "Feb 9, 2026",
  },
  {
    id: "needs-parking-note-resolved",
    projectId: "belgrade-remodel-2026",
    area: "Setup",
    title: "Parking note reviewed",
    summary: "The weekday parking note is already reflected in the announcement list.",
    suggestedNextStep: "No action needed in the mock flow.",
    priority: "low",
    status: "resolved",
    relatedRoute: "/admin/dashboard",
    relatedDate: "Jan 12, 2026",
  },
];

export const conflictCoverageDetails: ConflictCoverageDetail[] = [
  {
    id: "detail-jonah-emergency-contact",
    itemId: "needs-jonah-emergency-contact",
    issueType: "missingInfo",
    title: "Emergency contact needed before scheduling",
    explanation:
      "The questionnaire has enough detail to review, but the emergency contact is missing. Scheduling should wait until that practical safety detail is filled in.",
    affectedDate: "Jan 5, 2026",
    module: "Questionnaires",
    relatedAssignmentIds: [],
    relatedVolunteerIds: [],
    suggestedNextStep: "Contact Jonah and add the emergency contact before treating this intake as schedule-ready.",
    placeholderActions: [
      {
        label: "Contact volunteer (coming next)",
        description: "Later this can start a follow-up note or message.",
      },
      {
        label: "Mark reviewed (coming next)",
        description: "Later this can record that the missing detail was handled.",
      },
    ],
    relatedRoutes: [
      {
        label: "Open questionnaire",
        href: "/admin/questionnaires/questionnaire-jonah-price-paper",
      },
    ],
  },
  {
    id: "detail-cleanup-open-jan-12",
    itemId: "needs-cleanup-open-jan-12",
    issueType: "coverageGap",
    title: "Coverage gap for Monday cleanup",
    explanation:
      "The cleanup row is open. It can stay open for now, but a coordinator should know it has no assigned volunteer yet.",
    affectedDate: "Jan 12, 2026",
    affectedTime: "3:00 PM - 5:00 PM",
    module: "Schedule",
    relatedAssignmentIds: ["schedule-cleanup-jan-12"],
    relatedVolunteerIds: [],
    suggestedNextStep: "Choose a small cleanup group or leave this visible until volunteer profile conversion is enabled.",
    placeholderActions: [
      {
        label: "Find helper (coming next)",
        description: "Later this can open a filtered volunteer list.",
      },
      {
        label: "Mark reviewed (coming next)",
        description: "Later this can keep the item from appearing first.",
      },
    ],
    relatedRoutes: [
      {
        label: "Open schedule",
        href: "/admin/schedule",
      },
    ],
  },
  {
    id: "detail-supply-run-denied",
    itemId: "needs-supply-run-denied",
    issueType: "needsDecision",
    title: "Replacement needed for supply return",
    explanation:
      "The latest volunteer response for the supply return was denied. The item needs a replacement decision, not an urgent escalation.",
    affectedDate: "Jan 17, 2026",
    affectedTime: "1:00 PM - 2:30 PM",
    module: "Schedule",
    relatedAssignmentIds: ["schedule-supply-run-jan-17"],
    relatedVolunteerIds: ["nora-bennett"],
    suggestedNextStep: "Pick another approved volunteer when assignment editing is available.",
    placeholderActions: [
      {
        label: "Find replacement (coming next)",
        description: "Later this can suggest volunteers who match the timing and task.",
      },
      {
        label: "Contact volunteer (coming next)",
        description: "Later this can record a follow-up conversation.",
      },
    ],
    relatedRoutes: [
      {
        label: "Open schedule",
        href: "/admin/schedule",
      },
      {
        label: "Open volunteer",
        href: "/admin/volunteers/nora-bennett",
      },
    ],
  },
  {
    id: "detail-lunch-jan-14",
    itemId: "needs-lunch-jan-14-details",
    issueType: "coverageGap",
    title: "Food coverage details needed",
    explanation:
      "The Wednesday lunch row has no assigned helpers yet and the food contact still needs a final headcount.",
    affectedDate: "Jan 14, 2026",
    affectedTime: "11:00 AM - 1:30 PM",
    module: "Food",
    relatedAssignmentIds: ["schedule-lunch-jan-14"],
    relatedVolunteerIds: [],
    suggestedNextStep: "Ask the food contact to confirm helpers and headcount before the project week.",
    placeholderActions: [
      {
        label: "Ask food contact (coming next)",
        description: "Later this can create a food-module follow-up.",
      },
      {
        label: "Add helper (coming next)",
        description: "Later this can assign approved food volunteers.",
      },
    ],
    relatedRoutes: [
      {
        label: "Open schedule",
        href: "/admin/schedule",
      },
    ],
  },
  {
    id: "detail-marcus-overlap-jan-14",
    itemId: "needs-marcus-overlap-jan-14",
    issueType: "possibleOverlap",
    title: "Possible overlap for Marcus Lee",
    explanation:
      "Marcus is listed for material staging and a tool-room handoff during the same late-morning window. A coordinator should choose which assignment needs him most.",
    affectedDate: "Jan 14, 2026",
    affectedTime: "10:00 AM - 12:00 PM",
    module: "Schedule",
    relatedAssignmentIds: ["schedule-materials-jan-14", "schedule-security-lockup-jan-14"],
    relatedVolunteerIds: ["marcus-lee"],
    suggestedNextStep: "Move the handoff or assign a different helper before confirmations are treated as final.",
    placeholderActions: [
      {
        label: "Move assignment (coming next)",
        description: "Later this can open assignment editing.",
      },
      {
        label: "Find alternate helper (coming next)",
        description: "Later this can suggest approved helpers for the handoff.",
      },
    ],
    relatedRoutes: [
      {
        label: "Open schedule",
        href: "/admin/schedule",
      },
      {
        label: "Open volunteer",
        href: "/admin/volunteers/marcus-lee",
      },
    ],
  },
  {
    id: "detail-security-evening-pair",
    itemId: "needs-security-evening-pair",
    issueType: "coverageGap",
    title: "Night watch should be paired",
    explanation:
      "The Monday evening site check has one assigned volunteer. The future security workflow should keep this visible until a second approved helper is added.",
    affectedDate: "Jan 12, 2026",
    affectedTime: "6:00 PM - 10:00 PM",
    module: "Security",
    relatedAssignmentIds: ["schedule-security-jan-12"],
    relatedVolunteerIds: ["caleb-ross"],
    suggestedNextStep: "Find one more approved helper for the evening site check.",
    placeholderActions: [
      {
        label: "Find second helper (coming next)",
        description: "Later this can filter for security-ready volunteers.",
      },
      {
        label: "Contact security lead (coming next)",
        description: "Later this can record a security contact follow-up.",
      },
    ],
    relatedRoutes: [
      {
        label: "Open schedule",
        href: "/admin/schedule",
      },
      {
        label: "Open volunteer",
        href: "/admin/volunteers/caleb-ross",
      },
    ],
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

const communicationStatusOrder: CommunicationStatus[] = [
  "draft",
  "ready",
  "scheduledMock",
  "sentMock",
];

const communicationTypeOrder: CommunicationMessageType[] = [
  "announcement",
  "reminder",
  "update",
  "scheduleChange",
  "foodNote",
  "securityNote",
];

const reminderTemplateModuleOrder: ReminderTemplateModule[] = [
  "schedule",
  "questionnaire",
  "food",
  "security",
  "general",
];

export const communicationTypeLabels: Record<CommunicationMessageType, string> = {
  announcement: "Announcement",
  reminder: "Reminder",
  update: "Update",
  scheduleChange: "Schedule change",
  foodNote: "Food note",
  securityNote: "Security note",
};

export const communicationAudienceLabels: Record<CommunicationAudience, string> = {
  allVolunteers: "All volunteers",
  assignedVolunteers: "Assigned volunteers",
  congregationContacts: "Congregation contacts",
  foodContacts: "Food contacts",
  securityContacts: "Security contacts",
  specificCongregation: "Specific congregation",
};

export const communicationStatusLabels: Record<CommunicationStatus, string> = {
  draft: "Draft",
  ready: "Ready to send later",
  scheduledMock: "Scheduled/mock",
  sentMock: "Sent/mock",
};

export const communicationStatusTones: Record<
  CommunicationStatus,
  CommunicationStatusTone
> = {
  draft: "neutral",
  ready: "success",
  scheduledMock: "info",
  sentMock: "neutral",
};

export const reminderTemplateCategoryLabels: Record<
  ReminderTemplateCategory,
  string
> = {
  scheduleReminder: "Schedule reminder",
  pendingConfirmation: "Pending confirmation",
  questionnaireFollowUp: "Questionnaire follow-up",
  foodService: "Food service note",
  securityNightWatch: "Security / night watch",
  projectUpdate: "Project update",
  planChange: "Weather or plan-change",
  thankYou: "Thank-you / wrap-up",
};

export const reminderTemplateAudienceLabels: Record<
  ReminderTemplateAudience,
  string
> = {
  allVolunteers: "All volunteers",
  assignedVolunteers: "Assigned volunteers",
  pendingVolunteers: "Pending volunteers",
  congregationContacts: "Congregation contacts",
  foodContacts: "Food contacts",
  securityContacts: "Security contacts",
};

export const reminderTemplateModuleLabels: Record<ReminderTemplateModule, string> = {
  schedule: "Schedule",
  questionnaire: "Questionnaire",
  food: "Food",
  security: "Security",
  general: "General",
};

function compareCommunicationDates(first: Communication, second: Communication) {
  return new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime();
}

export function getCommunicationsForProject(projectId = demoProjectId) {
  return announcements
    .filter((announcement) => announcement.projectId === projectId)
    .sort(compareCommunicationDates);
}

export function getCommunicationsForActiveWorkspace() {
  return getCommunicationsForProject(demoProjectId);
}

export function getCommunicationById(communicationId: string) {
  return announcements.find((announcement) => announcement.id === communicationId);
}

export function getCommunicationStatusTone(status: CommunicationStatus) {
  return communicationStatusTones[status];
}

export function getCommunicationAudienceExplanation(communication: Communication) {
  return communication.recipientExplanation;
}

export function getCommunicationPreviewHref(communication: Communication) {
  return `/admin/announcements/${communication.id}`;
}

export function getCommunicationNotFoundHref() {
  return "/admin/announcements";
}

export function groupCommunicationsByStatus(
  items = getCommunicationsForActiveWorkspace(),
) {
  return communicationStatusOrder
    .map((status) => ({
      status,
      label: communicationStatusLabels[status],
      items: items.filter((item) => item.status === status),
    }))
    .filter((group) => group.items.length > 0);
}

export function groupCommunicationsByType(
  items = getCommunicationsForActiveWorkspace(),
) {
  return communicationTypeOrder
    .map((type) => ({
      type,
      label: communicationTypeLabels[type],
      items: items.filter((item) => item.messageType === type),
    }))
    .filter((group) => group.items.length > 0);
}

export function getCommunicationCounts(projectId = demoProjectId): CommunicationCounts {
  return getCommunicationsForProject(projectId).reduce<CommunicationCounts>(
    (counts, item) => {
      counts.total += 1;

      if (item.status === "draft") {
        counts.drafts += 1;
      }

      if (item.status === "ready") {
        counts.ready += 1;
      }

      if (item.status === "scheduledMock") {
        counts.scheduledMock += 1;
      }

      if (item.status === "sentMock") {
        counts.sentMock += 1;
      }

      return counts;
    },
    {
      total: 0,
      drafts: 0,
      ready: 0,
      scheduledMock: 0,
      sentMock: 0,
    },
  );
}

export function getRecentCommunications(projectId = demoProjectId, limit = 4) {
  return getCommunicationsForProject(projectId).slice(0, limit);
}

export function getRecommendedCommunicationAction(
  projectId = demoProjectId,
): RecommendedCommunicationAction {
  const items = getCommunicationsForProject(projectId);
  const readyItem = items.find((item) => item.status === "ready");
  const draftItem = items.find((item) => item.status === "draft");
  const scheduledItem = items.find((item) => item.status === "scheduledMock");

  if (readyItem) {
    return {
      title: `Preview "${readyItem.title}"`,
      detail:
        "This announcement is ready to send later. Preview the wording and recipients before real sending is added.",
      href: "/admin/announcements",
    };
  }

  if (draftItem) {
    return {
      title: `Finish "${draftItem.title}"`,
      detail:
        "A draft is started. Keep the next step simple: review the preview and recipient plan.",
      href: "/admin/announcements",
    };
  }

  if (scheduledItem) {
    return {
      title: "Review the reminder plan",
      detail:
        "A mock scheduled reminder exists for planning only. No background sending is active.",
      href: "/admin/announcements",
    };
  }

  return {
    title: "Start a project announcement",
    detail:
      "Create a calm draft for the next volunteer update when announcement editing is available.",
    href: "/admin/announcements",
  };
}

export function getRecommendedCommunicationActionForItem(
  communication: Communication,
): RecommendedCommunicationAction {
  const href = getCommunicationPreviewHref(communication);

  if (communication.status === "draft") {
    return {
      title: "Review the draft",
      detail:
        "Check the message and recipients before this becomes ready to send later.",
      href,
    };
  }

  if (communication.status === "ready") {
    return {
      title: "Preview before preparing send",
      detail:
        "This is ready to send later, but sending is not active yet. Review the wording and audience first.",
      href,
    };
  }

  if (communication.status === "scheduledMock") {
    return {
      title: "Review the reminder plan",
      detail:
        "This mock reminder has a planned time, but no background job or email delivery is active.",
      href,
    };
  }

  return {
    title: "Review the mock sent record",
    detail:
      "This is labeled sent/mock for preview history only. No email was sent from this app.",
    href,
  };
}

function workspaceSupportsTemplateModule(
  project: Project | undefined,
  module: ReminderTemplateModule,
) {
  if (module === "general") {
    return true;
  }

  if (module === "questionnaire") {
    return projectHasModule(project, "volunteers");
  }

  if (module === "schedule") {
    return projectHasModule(project, "scheduling");
  }

  return projectHasModule(project, module);
}

export function getReminderTemplatesForProject(projectId = demoProjectId) {
  const project = getProjectById(projectId);

  return reminderTemplates.filter((template) =>
    workspaceSupportsTemplateModule(project, template.suggestedModule),
  );
}

export function getReminderTemplatesForActiveWorkspace() {
  return getReminderTemplatesForProject(demoProjectId);
}

export function getReminderTemplateById(templateId: string) {
  return reminderTemplates.find((template) => template.id === templateId);
}

export function groupReminderTemplatesByModule(
  templates = getReminderTemplatesForActiveWorkspace(),
) {
  return reminderTemplateModuleOrder
    .map((module) => ({
      module,
      label: reminderTemplateModuleLabels[module],
      templates: templates.filter((template) => template.suggestedModule === module),
    }))
    .filter((group) => group.templates.length > 0);
}

export function groupReminderTemplatesByCategory(
  templates = getReminderTemplatesForActiveWorkspace(),
) {
  return Object.entries(reminderTemplateCategoryLabels)
    .map(([category, label]) => ({
      category: category as ReminderTemplateCategory,
      label,
      templates: templates.filter((template) => template.category === category),
    }))
    .filter((group) => group.templates.length > 0);
}

export function getReminderTemplateAudienceLabel(template: ReminderTemplate) {
  return reminderTemplateAudienceLabels[template.suggestedAudience];
}

export function getReminderTemplateTimingLabel(template: ReminderTemplate) {
  return template.suggestedTiming;
}

export function getRecommendedReminderTemplateAction(
  projectId = demoProjectId,
): RecommendedTemplateAction {
  const templates = getReminderTemplatesForProject(projectId);
  const scheduleTemplate = templates.find(
    (template) => template.category === "scheduleReminder",
  );
  const firstTemplate = scheduleTemplate ?? templates[0];

  if (!firstTemplate) {
    return {
      title: "No reminder templates available",
      detail:
        "This workspace does not have reminder template starting points for the enabled modules yet.",
      href: "/admin/announcements/templates",
    };
  }

  return {
    title: `Start with "${firstTemplate.title}" later`,
    detail:
      "Templates are starting points only. Preview the wording and adjust it when real draft creation exists.",
    href: "/admin/announcements/templates",
  };
}

export const foodServiceTypeLabels: Record<FoodServiceType, string> = {
  lunch: "Lunch support",
  snackSupport: "Snack support",
  waterCoffee: "Water / coffee",
  cleanup: "Cleanup",
};

export const foodCoverageStatusLabels: Record<FoodCoverageStatus, string> = {
  covered: "Covered",
  needsHelpers: "Needs helpers",
  needsHeadcount: "Needs headcount",
  draftMock: "Draft/mock",
  reviewedMock: "Reviewed/mock",
};

export const foodCoverageStatusTones: Record<
  FoodCoverageStatus,
  FoodStatusTone
> = {
  covered: "success",
  needsHelpers: "warning",
  needsHeadcount: "warning",
  draftMock: "neutral",
  reviewedMock: "info",
};

function compareFoodDates(first: FoodCoordinationItem, second: FoodCoordinationItem) {
  return new Date(first.date).getTime() - new Date(second.date).getTime();
}

export function getFoodItemsForProject(projectId = demoProjectId) {
  return foodCoordinationItems
    .filter((item) => item.projectId === projectId)
    .sort(compareFoodDates);
}

export function getFoodItemsForActiveWorkspace() {
  return getFoodItemsForProject(demoProjectId);
}

export function getFoodItemById(itemId: string) {
  return foodCoordinationItems.find((item) => item.id === itemId);
}

export function getFoodItemsByDate(date: string, projectId = demoProjectId) {
  return getFoodItemsForProject(projectId).filter((item) => item.date === date);
}

export function getRelatedFoodItemsForSameDay(item: FoodCoordinationItem) {
  return getFoodItemsByDate(item.date, item.projectId).filter(
    (relatedItem) => relatedItem.id !== item.id,
  );
}

export function getFoodDetailHref(item: FoodCoordinationItem) {
  return `/admin/food/${item.id}`;
}

export function getFoodNotFoundHref() {
  return "/admin/food";
}

export function groupFoodItemsByDate(
  items = getFoodItemsForActiveWorkspace(),
): FoodCoordinationGroup[] {
  return items.reduce<FoodCoordinationGroup[]>((groups, item) => {
    const existingGroup = groups.find((group) => group.date === item.date);

    if (existingGroup) {
      existingGroup.items.push(item);
      return groups;
    }

    groups.push({
      date: item.date,
      dayLabel: item.dayLabel,
      items: [item],
    });

    return groups;
  }, []);
}

export function groupFoodItemsByStatus(items = getFoodItemsForActiveWorkspace()) {
  return Object.entries(foodCoverageStatusLabels)
    .map(([status, label]) => ({
      status: status as FoodCoverageStatus,
      label,
      items: items.filter((item) => item.status === status),
    }))
    .filter((group) => group.items.length > 0);
}

export function getFoodCoordinationCounts(
  projectId = demoProjectId,
): FoodCoordinationCounts {
  return getFoodItemsForProject(projectId).reduce<FoodCoordinationCounts>(
    (counts, item) => {
      counts.total += 1;
      counts.upcoming += 1;

      if (item.status === "covered" || item.status === "reviewedMock") {
        counts.covered += 1;
      }

      if (
        item.status === "needsHelpers" ||
        item.status === "needsHeadcount" ||
        item.status === "draftMock"
      ) {
        counts.needsReview += 1;
      }

      if (item.status === "needsHelpers") {
        counts.needsHelpers += 1;
      }

      return counts;
    },
    {
      total: 0,
      upcoming: 0,
      covered: 0,
      needsReview: 0,
      needsHelpers: 0,
    },
  );
}

export function getFoodCoverageStatusLabel(status: FoodCoverageStatus) {
  return foodCoverageStatusLabels[status];
}

export function getFoodCoverageStatusTone(status: FoodCoverageStatus) {
  return foodCoverageStatusTones[status];
}

export function getNextFoodAction(projectId = demoProjectId): RecommendedFoodAction {
  const items = getFoodItemsForProject(projectId);
  const needsHelpers = items.find((item) => item.status === "needsHelpers");
  const needsHeadcount = items.find((item) => item.status === "needsHeadcount");
  const draftItem = items.find((item) => item.status === "draftMock");

  if (needsHelpers) {
    return {
      title: `Find helpers for ${needsHelpers.title}`,
      detail:
        needsHelpers.helperNotes ??
        "Review which food helpers are available before the project week.",
      href: needsHelpers.relatedNeedsAttentionId
        ? `/admin/needs-attention/${needsHelpers.relatedNeedsAttentionId}`
        : "/admin/food",
    };
  }

  if (needsHeadcount) {
    return {
      title: `Review headcount for ${needsHeadcount.title}`,
      detail:
        needsHeadcount.headcountNotes ??
        "Check the schedule before confirming how much food support is needed.",
      href: "/admin/food",
    };
  }

  if (draftItem) {
    return {
      title: `Review ${draftItem.title}`,
      detail: "A draft food note is ready for a calm review before it becomes useful.",
      href: "/admin/food",
    };
  }

  return {
    title: "Review upcoming lunch support",
    detail: "Food support looks steady in the current mock data.",
    href: "/admin/food",
  };
}

export function getNextFoodActionForItem(
  item: FoodCoordinationItem,
): RecommendedFoodAction {
  const href = getFoodDetailHref(item);

  if (item.status === "needsHelpers") {
    return {
      title: "Add helper later",
      detail:
        item.helperNotes ??
        "This food support item needs a calm helper review before the project week.",
      href,
    };
  }

  if (item.status === "needsHeadcount") {
    return {
      title: "Review headcount",
      detail:
        item.headcountNotes ??
        "Check the related schedule before confirming the food support count.",
      href,
    };
  }

  if (item.status === "draftMock") {
    return {
      title: "Review draft food notes",
      detail:
        "This is a draft/mock food support item. Review the notes before using them as a planning reference.",
      href,
    };
  }

  if (item.status === "covered") {
    return {
      title: "Keep this marked covered",
      detail:
        "This food support item has helpers and headcount notes in the mock plan.",
      href,
    };
  }

  return {
    title: "Review food support notes",
    detail:
      "This item has been reviewed in mock data. Check the meal notes and helper notes if anything changes.",
    href,
  };
}

export const securityServiceTypeLabels: Record<SecurityServiceType, string> = {
  nightWatch: "Night watch",
  eveningSiteCheck: "Evening site check",
  morningUnlock: "Morning unlock/check-in",
  accessNote: "Access note",
};

export const securityCoverageStatusLabels: Record<SecurityCoverageStatus, string> = {
  covered: "Covered",
  needsHelper: "Needs helper",
  needsReview: "Needs review",
  draftMock: "Draft/mock",
  reviewedMock: "Reviewed/mock",
};

export const securityCoverageStatusTones: Record<
  SecurityCoverageStatus,
  SecurityStatusTone
> = {
  covered: "success",
  needsHelper: "warning",
  needsReview: "warning",
  draftMock: "neutral",
  reviewedMock: "info",
};

function compareSecurityDates(
  first: SecurityCoordinationItem,
  second: SecurityCoordinationItem,
) {
  return new Date(first.date).getTime() - new Date(second.date).getTime();
}

export function getSecurityItemsForProject(projectId = demoProjectId) {
  return securityCoordinationItems
    .filter((item) => item.projectId === projectId)
    .sort(compareSecurityDates);
}

export function getSecurityItemsForActiveWorkspace() {
  return getSecurityItemsForProject(demoProjectId);
}

export function getSecurityItemById(itemId: string) {
  return securityCoordinationItems.find((item) => item.id === itemId);
}

export function groupSecurityItemsByDate(
  items = getSecurityItemsForActiveWorkspace(),
): SecurityCoordinationGroup[] {
  return items.reduce<SecurityCoordinationGroup[]>((groups, item) => {
    const existingGroup = groups.find((group) => group.date === item.date);

    if (existingGroup) {
      existingGroup.items.push(item);
      return groups;
    }

    groups.push({
      date: item.date,
      dayLabel: item.dayLabel,
      items: [item],
    });

    return groups;
  }, []);
}

export function groupSecurityItemsByStatus(
  items = getSecurityItemsForActiveWorkspace(),
) {
  return Object.entries(securityCoverageStatusLabels)
    .map(([status, label]) => ({
      status: status as SecurityCoverageStatus,
      label,
      items: items.filter((item) => item.status === status),
    }))
    .filter((group) => group.items.length > 0);
}

export function getSecurityCoordinationCounts(
  projectId = demoProjectId,
): SecurityCoordinationCounts {
  return getSecurityItemsForProject(projectId).reduce<SecurityCoordinationCounts>(
    (counts, item) => {
      counts.total += 1;
      counts.upcoming += 1;

      if (item.status === "covered" || item.status === "reviewedMock") {
        counts.covered += 1;
      }

      if (
        item.status === "needsHelper" ||
        item.status === "needsReview" ||
        item.status === "draftMock"
      ) {
        counts.needsReview += 1;
      }

      if (item.status === "needsHelper") {
        counts.needsHelpers += 1;
      }

      return counts;
    },
    {
      total: 0,
      upcoming: 0,
      covered: 0,
      needsReview: 0,
      needsHelpers: 0,
    },
  );
}

export function getSecurityCoverageStatusLabel(status: SecurityCoverageStatus) {
  return securityCoverageStatusLabels[status];
}

export function getSecurityCoverageStatusTone(status: SecurityCoverageStatus) {
  return securityCoverageStatusTones[status];
}

export function getSecurityServiceTypeLabel(type: SecurityServiceType) {
  return securityServiceTypeLabels[type];
}

export function getNextSecurityAction(
  projectId = demoProjectId,
): RecommendedSecurityAction {
  const items = getSecurityItemsForProject(projectId);
  const needsHelper = items.find((item) => item.status === "needsHelper");
  const needsReview = items.find((item) => item.status === "needsReview");
  const draftItem = items.find((item) => item.status === "draftMock");

  if (needsHelper) {
    return {
      title: `Review coverage for ${needsHelper.title}`,
      detail:
        needsHelper.coverageNotes ??
        "A security item needs a calm helper review before the project week.",
      href: needsHelper.relatedNeedsAttentionId
        ? `/admin/needs-attention/${needsHelper.relatedNeedsAttentionId}`
        : "/admin/security",
    };
  }

  if (needsReview) {
    return {
      title: `Review ${needsReview.title}`,
      detail:
        needsReview.coverageNotes ??
        "Check the site/access notes with the security contact before treating this as covered.",
      href: "/admin/security",
    };
  }

  if (draftItem) {
    return {
      title: `Review draft note for ${draftItem.title}`,
      detail: "A draft/mock security note is ready for review when timing is clearer.",
      href: "/admin/security",
    };
  }

  return {
    title: "Review upcoming security coverage",
    detail: "Security coverage looks steady in the current mock data.",
    href: "/admin/security",
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

function parseScheduleDate(date: string) {
  return new Date(`${date}T12:00:00`);
}

function getScheduleWeekStart(referenceDate = scheduleReferenceDate) {
  const date = parseScheduleDate(referenceDate);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

export function isScheduleDateToday(
  date: string,
  referenceDate = scheduleReferenceDate,
) {
  return date === referenceDate;
}

export function isScheduleDateInReferenceWeek(
  date: string,
  referenceDate = scheduleReferenceDate,
) {
  const start = getScheduleWeekStart(referenceDate);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const target = parseScheduleDate(date);

  return target >= start && target <= end;
}

export function getScheduleAssignmentsForProject(projectId = demoProjectId) {
  return scheduleAssignments
    .filter((assignment) => assignment.projectId === projectId)
    .sort((first, second) => {
      const dateDiff =
        parseScheduleDate(first.date).getTime() - parseScheduleDate(second.date).getTime();

      if (dateDiff !== 0) {
        return dateDiff;
      }

      return (first.startTime ?? first.shiftLabel).localeCompare(
        second.startTime ?? second.shiftLabel,
      );
    });
}

export function getScheduleAssignmentVolunteers(assignment: ScheduleAssignment) {
  return assignment.assignedVolunteerIds
    .map((volunteerId) => getVolunteerById(volunteerId))
    .filter((volunteer): volunteer is ProjectVolunteer => Boolean(volunteer));
}

export function getScheduleAssignmentsWithVolunteers(projectId = demoProjectId) {
  return getScheduleAssignmentsForProject(projectId).map((assignment) => ({
    ...assignment,
    volunteers: getScheduleAssignmentVolunteers(assignment),
  }));
}

export function getScheduleDayGroups(projectId = demoProjectId): ScheduleDayGroup[] {
  const groups = getScheduleAssignmentsWithVolunteers(projectId).reduce<
    Record<string, ScheduleAssignmentWithVolunteers[]>
  >((grouped, assignment) => {
    grouped[assignment.date] = [...(grouped[assignment.date] ?? []), assignment];
    return grouped;
  }, {});

  return Object.entries(groups)
    .sort(([firstDate], [secondDate]) =>
      parseScheduleDate(firstDate).getTime() - parseScheduleDate(secondDate).getTime(),
    )
    .map(([date, dayAssignments]) => ({
      date,
      dayLabel: new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(parseScheduleDate(date)),
      isToday: isScheduleDateToday(date),
      isThisWeek: isScheduleDateInReferenceWeek(date),
      assignments: dayAssignments,
    }));
}

export function getScheduleAssignmentCounts(
  projectId = demoProjectId,
): ScheduleAssignmentCounts {
  return getScheduleAssignmentsForProject(projectId).reduce<ScheduleAssignmentCounts>(
    (counts, assignment) => {
      counts.total += 1;

      if (assignment.status === "Draft") {
        counts.draft += 1;
      }

      if (assignment.status === "Open") {
        counts.open += 1;
      }

      if (assignment.status === "Assigned") {
        counts.assigned += 1;
      }

      if (assignment.status === "Confirmed") {
        counts.confirmed += 1;
      }

      if (assignment.status === "Denied") {
        counts.denied += 1;
      }

      if (assignment.status === "Needs Attention") {
        counts.needsAttention += 1;
      }

      return counts;
    },
    {
      total: 0,
      draft: 0,
      open: 0,
      assigned: 0,
      confirmed: 0,
      denied: 0,
      needsAttention: 0,
    },
  );
}

function getNeedsAttentionPriorityRank(priority: NeedsAttentionPriority) {
  const ranks: Record<NeedsAttentionPriority, number> = {
    important: 0,
    normal: 1,
    low: 2,
  };

  return ranks[priority];
}

function getNeedsAttentionStatusRank(status: NeedsAttentionStatus) {
  const ranks: Record<NeedsAttentionStatus, number> = {
    open: 0,
    inReview: 1,
    resolved: 2,
  };

  return ranks[status];
}

export function getNeedsAttentionItemsForProject(projectId = demoProjectId) {
  return needsAttentionItems
    .filter((item) => item.projectId === projectId)
    .sort((first, second) => {
      const statusDiff =
        getNeedsAttentionStatusRank(first.status) -
        getNeedsAttentionStatusRank(second.status);

      if (statusDiff !== 0) {
        return statusDiff;
      }

      const priorityDiff =
        getNeedsAttentionPriorityRank(first.priority) -
        getNeedsAttentionPriorityRank(second.priority);

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return needsAttentionAreaOrder.indexOf(first.area) -
        needsAttentionAreaOrder.indexOf(second.area);
    });
}

export function getActiveWorkspaceNeedsAttentionItems() {
  return getNeedsAttentionItemsForProject(demoProjectId);
}

export function getNeedsAttentionItemById(itemId: string) {
  return needsAttentionItems.find((item) => item.id === itemId);
}

export function groupNeedsAttentionItemsByArea(
  items = getActiveWorkspaceNeedsAttentionItems(),
): NeedsAttentionGroup[] {
  return needsAttentionAreaOrder
    .map((area) => ({
      area,
      items: items.filter((item) => item.area === area),
    }))
    .filter((group) => group.items.length > 0);
}

export function getNeedsAttentionCounts(projectId = demoProjectId): NeedsAttentionCounts {
  return getNeedsAttentionItemsForProject(projectId).reduce<NeedsAttentionCounts>(
    (counts, item) => {
      counts.total += 1;

      if (item.status === "open") {
        counts.open += 1;
      }

      if (item.status === "inReview") {
        counts.inReview += 1;
      }

      if (item.status === "resolved") {
        counts.resolved += 1;
      }

      if (item.priority === "important" && item.status !== "resolved") {
        counts.important += 1;
      }

      return counts;
    },
    {
      total: 0,
      open: 0,
      important: 0,
      inReview: 0,
      resolved: 0,
    },
  );
}

export function getOpenNeedsAttentionCount(projectId = demoProjectId) {
  return getNeedsAttentionCounts(projectId).open;
}

export function getImportantNeedsAttentionCount(projectId = demoProjectId) {
  return getNeedsAttentionCounts(projectId).important;
}

export function getTopNeedsAttentionAction(projectId = demoProjectId) {
  return getNeedsAttentionItemsForProject(projectId).find(
    (item) => item.status !== "resolved",
  );
}

export function getConflictCoverageDetailById(itemId: string) {
  return conflictCoverageDetails.find(
    (detail) => detail.itemId === itemId || detail.id === itemId,
  );
}

export function getConflictCoverageIssueTypeLabel(type: ConflictCoverageIssueType) {
  const labels: Record<ConflictCoverageIssueType, string> = {
    coverageGap: "Coverage gap",
    needsDecision: "Needs a decision",
    followUp: "Follow up",
    missingInfo: "Missing information",
    possibleOverlap: "Possible overlap",
  };

  return labels[type];
}

export function getConflictCoverageContextById(
  itemId: string,
): ConflictCoverageContext {
  const item = getNeedsAttentionItemById(itemId);
  const detail = getConflictCoverageDetailById(itemId);
  const assignments = detail
    ? detail.relatedAssignmentIds
        .map((assignmentId) =>
          getScheduleAssignmentsWithVolunteers(item?.projectId ?? demoProjectId).find(
            (assignment) => assignment.id === assignmentId,
          ),
        )
        .filter(
          (
            assignment,
          ): assignment is ScheduleAssignmentWithVolunteers => Boolean(assignment),
        )
    : [];
  const volunteerIds = new Set<string>([
    ...(detail?.relatedVolunteerIds ?? []),
    ...assignments.flatMap((assignment) => assignment.assignedVolunteerIds),
  ]);
  const volunteers = Array.from(volunteerIds)
    .map((volunteerId) => getVolunteerById(volunteerId))
    .filter((volunteer): volunteer is ProjectVolunteer => Boolean(volunteer));

  return {
    item,
    detail,
    assignments,
    volunteers,
  };
}

export function getNeedsAttentionRelatedHref(item: NeedsAttentionItem) {
  if (item.relatedRoute) {
    return item.relatedRoute;
  }

  const fallbackRoutes: Record<NeedsAttentionArea, string> = {
    Questionnaires: "/admin/questionnaires",
    Schedule: "/admin/schedule",
    Volunteers: "/admin/volunteers",
    Food: "/admin/dashboard#food",
    Security: "/admin/dashboard#security",
    Setup: "/admin/settings",
  };

  return fallbackRoutes[item.area];
}

export function getNeedsAttentionReviewHref(item: NeedsAttentionItem) {
  return getConflictCoverageDetailById(item.id)
    ? `/admin/needs-attention/${item.id}`
    : getNeedsAttentionRelatedHref(item);
}

function getPrimaryCvcRoleHome(project: Project): RoleHomeData {
  const counts = getScheduleAssignmentCounts(project.id);
  const questionnaireSummary = getQuestionnaireReviewCounts(project.id);
  const needsAttentionCounts = getNeedsAttentionCounts(project.id);
  const topNeedsAttentionAction = getTopNeedsAttentionAction(project.id);
  const weekGroups = getScheduleDayGroups(project.id);
  const attentionAssignments = getScheduleAssignmentsForProject(project.id).filter(
    (assignment) =>
      assignment.status === "Open" || assignment.status === "Needs Attention",
  );

  return {
    role: "Primary CVC",
    projectId: project.id,
    eyebrow: "Primary CVC home",
    title: project.name,
    subtitle: "Start with the project week, then review the few items that need a coordinator.",
    nextBestAction: {
      label: "Next best action",
      title: topNeedsAttentionAction?.title ?? "Review open coverage for this week",
      detail:
        topNeedsAttentionAction?.suggestedNextStep ??
        `${counts.open + counts.needsAttention} schedule items need a coordinator look before they are ready.`,
      href: topNeedsAttentionAction
        ? getNeedsAttentionReviewHref(topNeedsAttentionAction)
        : "/admin/schedule",
    },
    metrics: [
      {
        label: "Needs",
        value: needsAttentionCounts.open,
        helper: "Open follow-ups",
      },
      {
        label: "Open",
        value: counts.open,
        helper: "Schedule spots ready to fill",
      },
      {
        label: "Assigned",
        value: counts.assigned,
        helper: "Waiting on confirmations",
      },
      {
        label: "Review",
        value: questionnaireSummary.readyForReview,
        helper: "Questionnaires to read",
      },
      {
        label: "Confirmed",
        value: counts.confirmed,
        helper: "Covered shifts",
      },
    ],
    weekSnapshot: weekGroups.slice(0, 4).map((group) => ({
      id: group.date,
      label: group.dayLabel,
      detail: `${group.assignments.length} assignments - ${
        group.assignments.filter((assignment) => assignment.status === "Open").length
      } open`,
      href: "/admin/schedule",
    })),
    focusItems: [
      {
        label: "Needs attention",
        title: `${needsAttentionCounts.open} open follow-ups`,
        detail: `${needsAttentionCounts.important} important items need a coordinator look.`,
        href: "/admin/needs-attention",
      },
      {
        label: "Schedule gaps",
        title: `${attentionAssignments.length} assignments need attention`,
        detail: "Open or partial coverage appears here before deeper conflict tools exist.",
        href: "/admin/schedule",
      },
      {
        label: "Volunteers",
        title: `${project.stats.volunteers} volunteer records`,
        detail: "Use the volunteer directory for profile details and schedule readiness.",
        href: "/admin/volunteers",
      },
    ],
    recentUpdates: [
      {
        id: "primary-update-framing",
        label: "Confirmed",
        detail: "Alex Rivera and Marcus Lee are confirmed for Monday demo prep.",
        href: "/admin/schedule",
      },
      {
        id: "primary-update-intake",
        label: "Intake",
        detail: "Jonah Price's paper questionnaire still needs emergency contact details.",
        href: "/admin/questionnaires/questionnaire-jonah-price-paper",
      },
      {
        id: "primary-update-security",
        label: "Security",
        detail: "Monday evening site check needs one more approved helper.",
        href: "/admin/schedule",
      },
    ],
  };
}

function getAssistantCvcRoleHome(project: Project): RoleHomeData {
  const congregationScope = "Belgrade";
  const volunteersInScope = projectVolunteers.filter(
    (volunteer) =>
      volunteer.projectId === project.id && volunteer.congregation === congregationScope,
  );
  const incompleteQuestionnaires = getQuestionnaireSubmissionsForProject(project.id).filter(
    (submission) =>
      submission.aboutYou.congregation === congregationScope &&
      (submission.status === "inProgress" || submission.status === "needsReview"),
  );
  const scopedAssignments = getScheduleAssignmentsWithVolunteers(project.id).filter(
    (assignment) =>
      assignment.congregation === congregationScope ||
      assignment.volunteers.some(
        (volunteer) => volunteer.congregation === congregationScope,
      ),
  );

  return {
    role: "Assistant CVC",
    projectId: project.id,
    congregationScope,
    eyebrow: "Assistant CVC preview",
    title: `${congregationScope} congregation check-in`,
    subtitle:
      "A lighter home for helping one congregation keep volunteer details and reminders current.",
    nextBestAction: {
      label: "Next best action",
      title: "Check incomplete questionnaires",
      detail: `${incompleteQuestionnaires.length} ${congregationScope} intake items need a quick look.`,
      href: "/admin/questionnaires",
    },
    metrics: [
      {
        label: "Volunteers",
        value: volunteersInScope.length,
        helper: "In this congregation",
      },
      {
        label: "This week",
        value: scopedAssignments.length,
        helper: "Related assignments",
      },
      {
        label: "Incomplete",
        value: incompleteQuestionnaires.length,
        helper: "Questionnaires",
      },
    ],
    weekSnapshot: scopedAssignments.slice(0, 4).map((assignment) => ({
      id: assignment.id,
      label: assignment.date,
      detail: `${assignment.title} - ${assignment.status}`,
      href: "/admin/schedule",
    })),
    focusItems: [
      {
        label: "Reminder",
        title: "Share parking and check-in notes",
        detail: "Use announcements later; for now this is a mock reminder pattern.",
      },
      {
        label: "Questionnaires",
        title: "Review missing details kindly",
        detail: "Assistant CVC views can later be scoped by congregation.",
        href: "/admin/questionnaires",
      },
    ],
    recentUpdates: [
      {
        id: "assistant-update-mia",
        label: "Volunteer",
        detail: "Mia Thompson is assigned to lunch and final cleanup.",
        href: "/admin/volunteers/mia-thompson",
      },
      {
        id: "assistant-update-cleanup",
        label: "Open",
        detail: "Monday cleanup can use newer volunteers or a family group.",
        href: "/admin/schedule",
      },
    ],
    previewOnly: true,
  };
}

function getFoodRoleHome(project: Project): RoleHomeData {
  const foodAssignments = getScheduleAssignmentsWithVolunteers(project.id).filter(
    (assignment) => assignment.category === "Food",
  );
  const projectLunches = lunches.filter((lunch) => lunch.projectId === project.id);

  return {
    role: "Primary Food Contact",
    projectId: project.id,
    eyebrow: "Food contact preview",
    title: "Food coverage",
    subtitle: "A compact pattern for meals, helpers, and counts once the food module is built.",
    nextBestAction: {
      label: "Next best action",
      title: "Confirm Wednesday lunch helpers",
      detail: "One lunch shift is still open in the mock schedule.",
      href: "/admin/schedule",
    },
    metrics: [
      {
        label: "Meals",
        value: projectLunches.length,
        helper: "Planned lunches",
      },
      {
        label: "Coverage",
        value: foodAssignments.length,
        helper: "Food assignments",
      },
      {
        label: "Open",
        value: foodAssignments.filter((assignment) => assignment.status === "Open").length,
        helper: "Need helpers",
      },
    ],
    weekSnapshot: projectLunches.map((lunch) => ({
      id: lunch.id,
      label: lunch.day,
      detail: lunch.details,
    })),
    focusItems: [
      {
        label: "Needs details",
        title: "Final headcount not stored yet",
        detail: "Food counts will become a real workflow in a later module pass.",
      },
      {
        label: "Upcoming coverage",
        title: "Lunch setup and service",
        detail: "Assigned volunteers can be reviewed in the schedule preview.",
        href: "/admin/schedule",
      },
    ],
    recentUpdates: [
      {
        id: "food-update-soup",
        label: "Lunch",
        detail: "Wednesday lunch is soup and salad from 11:45 AM to 12:30 PM.",
      },
      {
        id: "food-update-supplies",
        label: "Note",
        detail: "Keep food service notes calm and short for future helpers.",
      },
    ],
    previewOnly: true,
  };
}

function getSecurityRoleHome(project: Project): RoleHomeData {
  const securityAssignments = getScheduleAssignmentsWithVolunteers(project.id).filter(
    (assignment) => assignment.category === "Security",
  );

  return {
    role: "Primary Security Contact",
    projectId: project.id,
    eyebrow: "Security contact preview",
    title: "Security coverage",
    subtitle: "A focused pattern for after-hours checks without turning the page into alarms.",
    nextBestAction: {
      label: "Next best action",
      title: "Pair Monday evening site check",
      detail: "One additional approved helper is needed before confirmation.",
      href: "/admin/schedule",
    },
    metrics: [
      {
        label: "This week",
        value: securityAssignments.length,
        helper: "Security shifts",
      },
      {
        label: "Needs detail",
        value: securityAssignments.filter(
          (assignment) => assignment.status === "Needs Attention",
        ).length,
        helper: "Quiet follow-up",
      },
      {
        label: "Assigned",
        value: securityAssignments.filter(
          (assignment) => assignment.status === "Assigned",
        ).length,
        helper: "Awaiting confirmation",
      },
    ],
    weekSnapshot: securityAssignments.map((assignment) => ({
      id: assignment.id,
      label: assignment.date,
      detail: `${assignment.title} - ${assignment.status}`,
      href: "/admin/schedule",
    })),
    focusItems: [
      {
        label: "Coverage",
        title: "Evening checks should be paired",
        detail: "The future workflow can enforce pairing rules without showing every rule here.",
      },
      {
        label: "Contacts",
        title: "Security contact: Caleb Ross",
        detail: "Assistant security contact: Marcus Lee.",
        href: "/admin/settings",
      },
    ],
    recentUpdates: [
      {
        id: "security-update-friday",
        label: "Friday",
        detail: "Friday site security has two assigned volunteers, pending confirmation.",
        href: "/admin/schedule",
      },
      {
        id: "security-update-monday",
        label: "Monday",
        detail: "Monday evening needs one more approved volunteer.",
        href: "/admin/schedule",
      },
    ],
    previewOnly: true,
  };
}

function getOnSiteRoleHome(project: Project): RoleHomeData {
  const todayAssignments = getScheduleAssignmentsWithVolunteers(project.id).filter(
    (assignment) => isScheduleDateToday(assignment.date),
  );

  return {
    role: "On-site Contact",
    projectId: project.id,
    eyebrow: "On-site preview",
    title: "Today on site",
    subtitle: "A future lightweight home for the person helping volunteers find the next step.",
    nextBestAction: {
      label: "Next best action",
      title: "Check the morning crew in",
      detail: "Use the schedule preview as the source of truth until on-site tools exist.",
      href: "/admin/schedule",
    },
    metrics: [
      {
        label: "Today",
        value: todayAssignments.length,
        helper: "Assignments",
      },
      {
        label: "Open",
        value: todayAssignments.filter((assignment) => assignment.status === "Open").length,
        helper: "Needs coverage",
      },
      {
        label: "Attention",
        value: todayAssignments.filter(
          (assignment) => assignment.status === "Needs Attention",
        ).length,
        helper: "Coordinator look",
      },
    ],
    weekSnapshot: todayAssignments.map((assignment) => ({
      id: assignment.id,
      label: assignment.shiftLabel,
      detail: `${assignment.title} - ${assignment.location ?? "Location to confirm"}`,
      href: "/admin/schedule",
    })),
    focusItems: [
      {
        label: "Check-in",
        title: "Keep instructions short",
        detail: "Future on-site views should show only what helpers need next.",
      },
    ],
    recentUpdates: [
      {
        id: "onsite-update-parking",
        label: "Note",
        detail: "Parking has moved to the east lot for weekday crews.",
      },
    ],
    previewOnly: true,
  };
}

export function getRoleHomeOptions(projectId = demoProjectId): RoleHomeData[] {
  const project = getProjectById(projectId);

  if (!project) {
    return [];
  }

  return [
    getPrimaryCvcRoleHome(project),
    getAssistantCvcRoleHome(project),
    getFoodRoleHome(project),
    getSecurityRoleHome(project),
    getOnSiteRoleHome(project),
  ];
}

export function getCurrentAdminRoleHome(projectId = demoProjectId) {
  const roles = getCurrentAdminRolesForProject(projectId);
  const homes = getRoleHomeOptions(projectId);

  return (
    homes.find((home) => roles.includes(home.role as AdminProjectRole)) ??
    homes.find((home) => home.role === "Primary CVC")
  );
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
