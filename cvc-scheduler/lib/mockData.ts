export type AssignmentStatus = "Confirmed" | "Pending" | "Needs reply" | "Complete" | "Open";

export type Project = {
  id: string;
  name: string;
  location: string;
  phase: string;
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

export const projects: Project[] = [
  {
    id: "belgrade-remodel-2026",
    name: "Belgrade Major Remodel 2026",
    location: "Belgrade, MT",
    phase: "Interior remodel",
  },
  {
    id: "bozeman-refresh",
    name: "Bozeman Kingdom Hall Refresh",
    location: "Bozeman, MT",
    phase: "Finish work",
  },
  {
    id: "helena-roofing",
    name: "Helena Roofing Support",
    location: "Helena, MT",
    phase: "Exterior support",
  },
  {
    id: "billings-landscape",
    name: "Billings Landscape Weekend",
    location: "Billings, MT",
    phase: "Grounds",
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
