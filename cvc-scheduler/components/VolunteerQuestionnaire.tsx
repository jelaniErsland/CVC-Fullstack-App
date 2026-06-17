"use client";

import { useMemo, useState } from "react";
import { Button } from "./Button";
import { DetailExpander } from "./DetailExpander";
import { GlassCard } from "./GlassCard";
import { HelpPopover } from "./HelpPopover";

const steps = [
  "About You",
  "Emergency Contact",
  "Availability",
  "Skills & Experience",
  "Other Ways You Can Help",
  "Review & Submit",
];

const weekdayOptions = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const helpText = {
  congregation:
    "This helps coordinators group volunteers correctly and contact the right local brothers if needed.",
  dateOfBirth:
    "Used only for project safety, age-related assignment limits, and emergency planning.",
  emergency:
    "Only used if there is an urgent safety or health concern while you are volunteering.",
  twoOrMoreDays:
    "This helps the team know who may be able to fill larger schedule needs. You will still be contacted before being assigned.",
  security:
    "This refers to evening or overnight site-watch assignments outside the normal workday.",
  taskCards:
    "This helps identify volunteers who already have experience with congregation maintenance task-card work.",
  conditions:
    "Some assignments may involve heat, cold, standing, lifting, or outdoor conditions. Saying no is completely okay and helps the team assign you safely.",
  medical:
    "This helps identify volunteers with first-aid, nursing, EMT, or similar experience. It does not automatically assign anyone to provide medical care.",
  other:
    "Use this for a way you can help that is not listed above.",
  details:
    "Share anything that would help coordinators assign you kindly and safely, such as limits, tools, vehicle access, timing, or special experience.",
};

const stepIntros: Record<string, string> = {
  "About You":
    "This helps the project team contact you and match your questionnaire to the right congregation.",
  "Emergency Contact":
    "This is only used if there is an emergency while you are helping on site.",
  Availability:
    "Choose the days you are usually available. You will still be contacted before being assigned.",
  "Skills & Experience":
    "Share anything you are comfortable helping with. Construction experience is helpful, but it is not the only way to support the project.",
  "Other Ways You Can Help":
    "Many helpful assignments happen off the main work site. Select anything you may be willing to help with.",
  "Review & Submit":
    "Review your answers before submitting. The project team will use this to find a safe and useful place for you to help.",
};

type QuestionnaireState = {
  name: string;
  congregation: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelationship: string;
  weekdays: string[];
  twoOrMoreDays: boolean;
  twoOrMoreDaysDetails: string;
  security: boolean;
  securityDetails: string;
  constructionSkills: string;
  taskCards: boolean;
  taskCardDetails: string;
  taskCardAdditionalDetails: string;
  physicalConditions: boolean;
  physicalConditionsDetails: string;
  help: Record<string, boolean>;
  helpDetails: Record<string, string>;
  otherHelp: string;
  otherHelpDetails: string;
  otherDetails: string;
  otherWaysDetails: string;
};

const initialState: QuestionnaireState = {
  name: "",
  congregation: "",
  phone: "",
  email: "",
  dateOfBirth: "",
  emergencyName: "",
  emergencyPhone: "",
  emergencyRelationship: "",
  weekdays: ["Saturday"],
  twoOrMoreDays: false,
  twoOrMoreDaysDetails: "",
  security: false,
  securityDetails: "",
  constructionSkills: "",
  taskCards: false,
  taskCardDetails: "",
  taskCardAdditionalDetails: "",
  physicalConditions: false,
  physicalConditionsDetails: "",
  help: {
    housing: false,
    transportation: false,
    laundryDryCleaning: false,
    housekeeping: false,
    hairCare: false,
    medicalSupport: false,
    foodService: false,
  },
  helpDetails: {},
  otherHelp: "",
  otherHelpDetails: "",
  otherDetails: "",
  otherWaysDetails: "",
};

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  help?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
        {help ? <HelpPopover text={help} /> : null}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-[54px] w-full rounded-lg border border-white/80 bg-white/72 px-4 text-base text-slate-950 shadow-inner shadow-white/35 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white/90 focus:ring-4 focus:ring-slate-200/70"
      />
    </label>
  );
}

function CheckRow({
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
    <label className="flex min-h-14 items-center justify-between gap-4 rounded-lg border border-white/70 bg-white/54 px-4 py-3 text-base font-medium text-slate-700">
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

export function VolunteerQuestionnaire() {
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState<QuestionnaireState>(initialState);
  const [submitted, setSubmitted] = useState(false);
  const progress = useMemo(() => `${stepIndex + 1} of ${steps.length}`, [stepIndex]);

  function update<K extends keyof QuestionnaireState>(key: K, value: QuestionnaireState[K]) {
    setState((current) => ({ ...current, [key]: value }));
  }

  function toggleWeekday(day: string) {
    update(
      "weekdays",
      state.weekdays.includes(day)
        ? state.weekdays.filter((item) => item !== day)
        : [...state.weekdays, day],
    );
  }

  function toggleHelp(key: string) {
    update("help", { ...state.help, [key]: !state.help[key] });
  }

  function updateHelpDetails(key: string, value: string) {
    update("helpDetails", { ...state.helpDetails, [key]: value });
  }

  if (submitted) {
    return (
      <GlassCard className="mx-auto max-w-xl p-6 text-center sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
          Questionnaire Sent
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          Thank you.
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          Your questionnaire has been sent to the project contact.
        </p>
        <Button href="/" variant="secondary" className="mt-7">
          Back to CVC Scheduler
        </Button>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="mx-auto w-full max-w-3xl p-5 sm:p-8">
      <div className="border-b border-white/70 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Volunteer Questionnaire
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          {steps[stepIndex]}
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          {stepIntros[steps[stepIndex]]}
        </p>
        <div className="mt-5 h-2 rounded-full bg-white/60">
          <div
            className="h-2 rounded-full bg-slate-950 transition-all"
            style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
        <p className="mt-2 text-sm font-medium text-slate-500">{progress}</p>
      </div>

      <div className="mt-7">
        {stepIndex === 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Name" value={state.name} onChange={(value) => update("name", value)} />
            <TextInput
              label="Congregation"
              value={state.congregation}
              onChange={(value) => update("congregation", value)}
              help={helpText.congregation}
            />
            <TextInput label="Phone" value={state.phone} onChange={(value) => update("phone", value)} />
            <TextInput label="Email" value={state.email} onChange={(value) => update("email", value)} />
            <TextInput
              label="Date of birth"
              type="date"
              value={state.dateOfBirth}
              onChange={(value) => update("dateOfBirth", value)}
              help={helpText.dateOfBirth}
            />
          </div>
        ) : null}

        {stepIndex === 1 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label="Emergency contact name"
              value={state.emergencyName}
              onChange={(value) => update("emergencyName", value)}
              help={helpText.emergency}
            />
            <TextInput
              label="Emergency contact phone"
              value={state.emergencyPhone}
              onChange={(value) => update("emergencyPhone", value)}
              help={helpText.emergency}
            />
            <TextInput
              label="Relationship"
              value={state.emergencyRelationship}
              onChange={(value) => update("emergencyRelationship", value)}
            />
          </div>
        ) : null}

        {stepIndex === 2 ? (
          <div className="grid gap-6">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                Which days could usually work for you?
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {weekdayOptions.map((day) => (
                  <CheckRow
                    key={day}
                    label={day}
                    checked={state.weekdays.includes(day)}
                    onChange={() => toggleWeekday(day)}
                  />
                ))}
              </div>
            </div>
            <div className="grid gap-3">
              <CheckRow
                label="I can make myself available two or more days per week"
                checked={state.twoOrMoreDays}
                onChange={() => update("twoOrMoreDays", !state.twoOrMoreDays)}
                help={helpText.twoOrMoreDays}
              />
              {state.twoOrMoreDays ? (
                <DetailExpander
                  value={state.twoOrMoreDaysDetails}
                  onChange={(value) => update("twoOrMoreDaysDetails", value)}
                />
              ) : null}
              <CheckRow
                label="I am available for after-hours security"
                checked={state.security}
                onChange={() => update("security", !state.security)}
                help={helpText.security}
              />
              {state.security ? (
                <DetailExpander
                  value={state.securityDetails}
                  onChange={(value) => update("securityDetails", value)}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        {stepIndex === 3 ? (
          <div className="grid gap-5">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Construction skills / experience
              </span>
              <textarea
                value={state.constructionSkills}
                onChange={(event) => update("constructionSkills", event.target.value)}
                rows={5}
                className="w-full rounded-lg border border-white/80 bg-white/72 px-4 py-3 text-base text-slate-950 shadow-inner shadow-white/35 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white/90 focus:ring-4 focus:ring-slate-200/70"
                placeholder="Examples: painting, cleanup, framing, food service, check-in desk"
              />
            </label>
            <CheckRow
              label="I currently assist with maintenance task cards"
              checked={state.taskCards}
              onChange={() => update("taskCards", !state.taskCards)}
              help={helpText.taskCards}
            />
            {state.taskCards ? (
              <div>
                <TextInput
                  label="Which task cards?"
                  value={state.taskCardDetails}
                  onChange={(value) => update("taskCardDetails", value)}
                />
                <DetailExpander
                  value={state.taskCardAdditionalDetails}
                  onChange={(value) => update("taskCardAdditionalDetails", value)}
                />
              </div>
            ) : null}
            <CheckRow
              label="I am able to perform physical work in hot or cold conditions"
              checked={state.physicalConditions}
              onChange={() => update("physicalConditions", !state.physicalConditions)}
              help={helpText.conditions}
            />
            {state.physicalConditions ? (
              <DetailExpander
                value={state.physicalConditionsDetails}
                onChange={(value) => update("physicalConditionsDetails", value)}
              />
            ) : null}
          </div>
        ) : null}

        {stepIndex === 4 ? (
          <div className="grid gap-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["housing", "Housing"],
                ["transportation", "Transportation"],
                ["laundryDryCleaning", "Laundry / dry cleaning"],
                ["housekeeping", "Housekeeping"],
                ["hairCare", "Hair care"],
                ["medicalSupport", "Medical support"],
                ["foodService", "Food service"],
              ].map(([key, label]) => (
                <div key={key}>
                  <CheckRow
                    label={label}
                    checked={state.help[key]}
                    onChange={() => toggleHelp(key)}
                    help={key === "medicalSupport" ? helpText.medical : undefined}
                  />
                  {state.help[key] && (key === "medicalSupport" || key === "foodService") ? (
                    <DetailExpander
                      value={state.helpDetails[key] ?? ""}
                      onChange={(value) => updateHelpDetails(key, value)}
                    />
                  ) : null}
                </div>
              ))}
            </div>
            <TextInput
              label="Other"
              value={state.otherHelp}
              onChange={(value) => update("otherHelp", value)}
              help={helpText.other}
            />
            {state.otherHelp ? (
              <DetailExpander
                value={state.otherHelpDetails}
                onChange={(value) => update("otherHelpDetails", value)}
              />
            ) : null}
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Details
                <HelpPopover text={helpText.details} />
              </span>
              <textarea
                value={state.otherDetails}
                onChange={(event) => update("otherDetails", event.target.value)}
                rows={4}
                className="w-full rounded-lg border border-white/80 bg-white/72 px-4 py-3 text-base text-slate-950 shadow-inner shadow-white/35 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white/90 focus:ring-4 focus:ring-slate-200/70"
                placeholder="Share anything that would help coordinators assign you kindly and safely."
              />
            </label>
            <DetailExpander
              value={state.otherWaysDetails}
              onChange={(value) => update("otherWaysDetails", value)}
            />
          </div>
        ) : null}

        {stepIndex === 5 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Name", state.name || "Not provided"],
              ["Congregation", state.congregation || "Not provided"],
              ["Phone", state.phone || "Not provided"],
              ["Email", state.email || "Not provided"],
              ["Available days", state.weekdays.join(", ") || "Not selected"],
              ["Security", state.security ? "Available" : "Not available"],
              ["Skills", state.constructionSkills || "Not provided"],
              [
                "Other help",
                [
                  ...Object.entries(state.help)
                    .filter(([, value]) => value)
                    .map(([key]) => key),
                  state.otherHelp,
                ]
                  .filter(Boolean)
                  .join(", ") || "Not provided",
              ],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-white/50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {label}
                </p>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-800">
                  {value}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-8 flex flex-col-reverse gap-3 border-t border-white/70 pt-6 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="secondary"
          disabled={stepIndex === 0}
          onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
          className="disabled:cursor-not-allowed disabled:opacity-45"
        >
          Back
        </Button>
        {stepIndex < steps.length - 1 ? (
          <Button
            type="button"
            onClick={() => setStepIndex((current) => Math.min(steps.length - 1, current + 1))}
          >
            Continue
          </Button>
        ) : (
          <Button type="button" onClick={() => setSubmitted(true)}>
            Send Questionnaire
          </Button>
        )}
      </div>
    </GlassCard>
  );
}
