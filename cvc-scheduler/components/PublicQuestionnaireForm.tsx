"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { GlassCard } from "@/components/GlassCard";
import { HelpPopover } from "@/components/HelpPopover";
import type { Project, QuestionnaireSectionKey } from "@/lib/mockData";

type FormStepKey = "welcome" | QuestionnaireSectionKey | "review";

type FormStep = {
  key: FormStepKey;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
};

type PublicQuestionnaireState = {
  name: string;
  email: string;
  phone: string;
  congregation: string;
  preferredContactMethod: "Text" | "Phone" | "Email";
  weekdays: string[];
  preferredTimes: string[];
  availabilityNotes: string;
  skillCategories: string[];
  skillsDetails: string;
  maintenanceTaskCards: boolean;
  physicalWorkNotes: string;
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
  otherWays: Record<OtherWayKey, boolean>;
  otherHelp: string;
  otherNotes: string;
};

type OtherWayKey =
  | "housing"
  | "transportation"
  | "laundryDryCleaning"
  | "housekeeping"
  | "hairCare"
  | "medicalSupport"
  | "foodService";

const steps: FormStep[] = [
  {
    key: "welcome",
    label: "Welcome",
    eyebrow: "Volunteer questionnaire",
    title: "Thanks for wanting to help.",
    description:
      "This short questionnaire helps the project team find a kind, safe, and useful place for you to serve.",
  },
  {
    key: "aboutYou",
    label: "About You",
    eyebrow: "Step 1",
    title: "How can the team reach you?",
    description:
      "Share the basics so the coordinators can contact you and match you with your congregation.",
  },
  {
    key: "availability",
    label: "Availability",
    eyebrow: "Step 2",
    title: "When could you usually work?",
    description:
      "Pick the days and times that are generally possible. You will still be contacted before any assignment.",
  },
  {
    key: "skillsExperience",
    label: "Skills",
    eyebrow: "Step 3",
    title: "What are you comfortable helping with?",
    description:
      "Construction experience is helpful, but many project needs happen away from the main work area too.",
  },
  {
    key: "emergencyContact",
    label: "Emergency",
    eyebrow: "Step 4",
    title: "Who should be contacted in an emergency?",
    description:
      "This is only used if there is an urgent safety or health concern while you are volunteering.",
  },
  {
    key: "otherWaysToHelp",
    label: "Other Help",
    eyebrow: "Step 5",
    title: "Are there other ways you may be able to help?",
    description:
      "Select anything you might be willing to help with. Saying yes here does not automatically assign you.",
  },
  {
    key: "review",
    label: "Review",
    eyebrow: "Review",
    title: "Review your answers.",
    description:
      "This preview will only show a confirmation. In the real app, your answers would go to the project team.",
  },
];

const weekdayOptions = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const timeOptions = ["Morning", "Afternoon", "Evening"];
const skillOptions = [
  "Painting",
  "Demo",
  "Framing",
  "Finish work",
  "Electrical assist",
  "Plumbing assist",
  "General cleanup",
  "Check-in desk",
  "Food service",
  "Security",
];
const otherWayOptions: Array<{ key: OtherWayKey; label: string }> = [
  { key: "housing", label: "Housing" },
  { key: "transportation", label: "Transportation" },
  { key: "laundryDryCleaning", label: "Laundry / dry cleaning" },
  { key: "housekeeping", label: "Housekeeping" },
  { key: "hairCare", label: "Hair care" },
  { key: "medicalSupport", label: "Medical support" },
  { key: "foodService", label: "Food service" },
];

const initialState: PublicQuestionnaireState = {
  name: "",
  email: "",
  phone: "",
  congregation: "",
  preferredContactMethod: "Text",
  weekdays: [],
  preferredTimes: [],
  availabilityNotes: "",
  skillCategories: [],
  skillsDetails: "",
  maintenanceTaskCards: false,
  physicalWorkNotes: "",
  emergencyName: "",
  emergencyRelationship: "",
  emergencyPhone: "",
  otherWays: {
    housing: false,
    transportation: false,
    laundryDryCleaning: false,
    housekeeping: false,
    hairCare: false,
    medicalSupport: false,
    foodService: false,
  },
  otherHelp: "",
  otherNotes: "",
};

function TextField({
  label,
  value,
  onChange,
  type = "text",
  hint,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="font-normal text-slate-400"> Required</span> : null}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-14 w-full rounded-lg border border-white/80 bg-white/76 px-4 text-base text-slate-950 shadow-inner shadow-white/35 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-200/70"
      />
      {hint ? <span className="mt-2 block text-sm leading-6 text-slate-500">{hint}</span> : null}
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/80 bg-white/76 px-4 py-3 text-base leading-7 text-slate-950 shadow-inner shadow-white/35 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-200/70"
      />
      {hint ? <span className="mt-2 block text-sm leading-6 text-slate-500">{hint}</span> : null}
    </label>
  );
}

function ChoiceTile({
  label,
  checked,
  onChange,
  help,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  help?: string;
}) {
  return (
    <label className="flex min-h-14 items-center justify-between gap-4 rounded-lg border border-white/75 bg-white/58 px-4 py-3 text-base font-medium text-slate-700 shadow-sm transition hover:bg-white/78">
      <span>
        {label}
        {help ? <HelpPopover text={help} /> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-5 accent-slate-950"
      />
    </label>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/70 bg-white/58 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-800">{value}</p>
    </div>
  );
}

export function PublicQuestionnaireForm({ project }: { project: Project }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState<PublicQuestionnaireState>(initialState);
  const [submitted, setSubmitted] = useState(false);
  const step = steps[stepIndex];
  const progressPercent = Math.round(((stepIndex + 1) / steps.length) * 100);

  const selectedOtherWays = useMemo(
    () =>
      otherWayOptions
        .filter((option) => state.otherWays[option.key])
        .map((option) => option.label),
    [state.otherWays],
  );

  function update<K extends keyof PublicQuestionnaireState>(
    key: K,
    value: PublicQuestionnaireState[K],
  ) {
    setState((current) => ({ ...current, [key]: value }));
  }

  function toggleArray(key: "weekdays" | "preferredTimes" | "skillCategories", value: string) {
    update(
      key,
      state[key].includes(value)
        ? state[key].filter((item) => item !== value)
        : [...state[key], value],
    );
  }

  function toggleOtherWay(key: OtherWayKey) {
    update("otherWays", { ...state.otherWays, [key]: !state.otherWays[key] });
  }

  if (submitted) {
    return (
      <GlassCard className="mx-auto w-full max-w-2xl p-6 text-center sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
          Questionnaire preview received
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          Thank you for offering to help.
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          In the real app, this would be sent to the project team for review. For now,
          this preview does not save your answers.
        </p>
        <div className="mt-7 flex justify-center">
          <Button type="button" variant="secondary" onClick={() => setSubmitted(false)}>
            Back to review
          </Button>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="py-6 sm:py-9">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {project.name}
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          Volunteer Questionnaire
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
          Tell us when and how you may be able to help. This does not create an account
          or assign you automatically.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <GlassCard className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  Step {stepIndex + 1} of {steps.length}
                </p>
                <p className="mt-1 text-sm text-slate-500">{progressPercent}% complete</p>
              </div>
              <div className="flex size-12 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                {stepIndex + 1}
              </div>
            </div>
            <div className="mt-4 h-2 rounded-full bg-white/70">
              <div
                className="h-2 rounded-full bg-slate-950 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <ol className="mt-5 grid gap-2">
              {steps.map((item, index) => {
                const isCurrent = index === stepIndex;
                const isComplete = index < stepIndex;

                return (
                  <li
                    key={item.key}
                    className={[
                      "rounded-lg px-3 py-2 text-sm font-medium",
                      isCurrent
                        ? "bg-slate-950 text-white"
                        : isComplete
                          ? "bg-emerald-50 text-emerald-800"
                          : "text-slate-500",
                    ].join(" ")}
                  >
                    {item.label}
                  </li>
                );
              })}
            </ol>
          </GlassCard>
        </aside>

        <GlassCard className="p-5 sm:p-7">
          <div className="border-b border-white/70 pb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {step.eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              {step.title}
            </h2>
            <p className="mt-3 text-base leading-7 text-slate-600">{step.description}</p>
          </div>

          <div className="mt-7">
            {step.key === "welcome" ? (
              <div className="grid gap-4">
                <div className="rounded-lg border border-white/70 bg-white/58 p-4">
                  <p className="text-sm font-semibold text-slate-950">Before you start</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    It is okay if you are not sure exactly where you fit. Choose what seems
                    reasonable, add notes where helpful, and the project team can follow up kindly.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <ReviewItem label="Location" value={project.location} />
                  <ReviewItem label="Date range" value={project.dateRange} />
                  <ReviewItem label="Time zone" value={project.timezone} />
                </div>
              </div>
            ) : null}

            {step.key === "aboutYou" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Full name"
                  value={state.name}
                  onChange={(value) => update("name", value)}
                  required
                />
                <TextField
                  label="Congregation"
                  value={state.congregation}
                  onChange={(value) => update("congregation", value)}
                  required
                  hint="This helps the team coordinate with the right local contacts."
                />
                <TextField
                  label="Phone"
                  value={state.phone}
                  onChange={(value) => update("phone", value)}
                  type="tel"
                  required
                />
                <TextField
                  label="Email"
                  value={state.email}
                  onChange={(value) => update("email", value)}
                  type="email"
                />
                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Preferred contact method
                  </span>
                  <select
                    value={state.preferredContactMethod}
                    onChange={(event) =>
                      update(
                        "preferredContactMethod",
                        event.target.value as PublicQuestionnaireState["preferredContactMethod"],
                      )
                    }
                    className="h-14 w-full rounded-lg border border-white/80 bg-white/76 px-4 text-base text-slate-950 shadow-inner shadow-white/35 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-200/70"
                  >
                    <option>Text</option>
                    <option>Phone</option>
                    <option>Email</option>
                  </select>
                </label>
              </div>
            ) : null}

            {step.key === "availability" ? (
              <div className="grid gap-6">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-slate-950">
                    Days that could usually work
                  </h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {weekdayOptions.map((day) => (
                      <ChoiceTile
                        key={day}
                        label={day}
                        checked={state.weekdays.includes(day)}
                        onChange={() => toggleArray("weekdays", day)}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-slate-950">
                    Times of day
                  </h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {timeOptions.map((time) => (
                      <ChoiceTile
                        key={time}
                        label={time}
                        checked={state.preferredTimes.includes(time)}
                        onChange={() => toggleArray("preferredTimes", time)}
                      />
                    ))}
                  </div>
                </div>
                <TextAreaField
                  label="Availability notes"
                  value={state.availabilityNotes}
                  onChange={(value) => update("availabilityNotes", value)}
                  placeholder="Example: I can usually help Saturdays, or two weekdays if I know in advance."
                  hint="Limits are welcome. Clear notes help the team assign people kindly."
                />
              </div>
            ) : null}

            {step.key === "skillsExperience" ? (
              <div className="grid gap-6">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-slate-950">
                    Helpful skills or experience
                  </h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {skillOptions.map((skill) => (
                      <ChoiceTile
                        key={skill}
                        label={skill}
                        checked={state.skillCategories.includes(skill)}
                        onChange={() => toggleArray("skillCategories", skill)}
                      />
                    ))}
                  </div>
                </div>
                <ChoiceTile
                  label="I currently assist with maintenance task cards"
                  checked={state.maintenanceTaskCards}
                  onChange={() => update("maintenanceTaskCards", !state.maintenanceTaskCards)}
                  help="This helps identify volunteers who already have congregation maintenance experience."
                />
                <TextAreaField
                  label="Details"
                  value={state.skillsDetails}
                  onChange={(value) => update("skillsDetails", value)}
                  placeholder="Tools, task-card experience, construction background, or work you prefer to avoid."
                />
                <TextAreaField
                  label="Physical work notes"
                  value={state.physicalWorkNotes}
                  onChange={(value) => update("physicalWorkNotes", value)}
                  placeholder="Example: I can lift light materials, but should avoid ladders."
                  hint="Saying you have a limit is completely okay. It helps the team keep you safe."
                />
              </div>
            ) : null}

            {step.key === "emergencyContact" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Emergency contact name"
                  value={state.emergencyName}
                  onChange={(value) => update("emergencyName", value)}
                  required
                />
                <TextField
                  label="Relationship"
                  value={state.emergencyRelationship}
                  onChange={(value) => update("emergencyRelationship", value)}
                />
                <TextField
                  label="Emergency contact phone"
                  value={state.emergencyPhone}
                  onChange={(value) => update("emergencyPhone", value)}
                  type="tel"
                  required
                />
              </div>
            ) : null}

            {step.key === "otherWaysToHelp" ? (
              <div className="grid gap-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  {otherWayOptions.map((option) => (
                    <ChoiceTile
                      key={option.key}
                      label={option.label}
                      checked={state.otherWays[option.key]}
                      onChange={() => toggleOtherWay(option.key)}
                      help={
                        option.key === "medicalSupport"
                          ? "This may include first aid, nursing, EMT, or similar experience."
                          : undefined
                      }
                    />
                  ))}
                </div>
                <TextField
                  label="Other"
                  value={state.otherHelp}
                  onChange={(value) => update("otherHelp", value)}
                  hint="Use this for a way you can help that is not listed above."
                />
                <TextAreaField
                  label="Additional notes"
                  value={state.otherNotes}
                  onChange={(value) => update("otherNotes", value)}
                  placeholder="Share anything else that would help the team place you well."
                />
              </div>
            ) : null}

            {step.key === "review" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <ReviewItem label="Name" value={state.name || "Not provided"} />
                <ReviewItem label="Congregation" value={state.congregation || "Not provided"} />
                <ReviewItem label="Phone" value={state.phone || "Not provided"} />
                <ReviewItem label="Email" value={state.email || "Not provided"} />
                <ReviewItem
                  label="Available days"
                  value={state.weekdays.join(", ") || "Not selected"}
                />
                <ReviewItem
                  label="Times"
                  value={state.preferredTimes.join(", ") || "Not selected"}
                />
                <ReviewItem
                  label="Skills"
                  value={state.skillCategories.join(", ") || state.skillsDetails || "Not provided"}
                />
                <ReviewItem
                  label="Other help"
                  value={
                    [...selectedOtherWays, state.otherHelp].filter(Boolean).join(", ") ||
                    "Not provided"
                  }
                />
              </div>
            ) : null}
          </div>

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-white/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="secondary"
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
              className="disabled:cursor-not-allowed disabled:opacity-45"
            >
              Back
            </Button>
            <p className="text-center text-sm leading-6 text-slate-500 sm:max-w-sm sm:text-left">
              You can move ahead and come back. The team can follow up if anything is unclear.
            </p>
            {stepIndex < steps.length - 1 ? (
              <Button
                type="button"
                onClick={() => setStepIndex((current) => Math.min(steps.length - 1, current + 1))}
              >
                Next
              </Button>
            ) : (
              <Button type="button" onClick={() => setSubmitted(true)}>
                Submit questionnaire preview
              </Button>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
