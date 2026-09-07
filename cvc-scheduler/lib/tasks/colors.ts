export const taskPresetColorKeys = [
  "blue", "sky", "cyan", "teal", "emerald", "green", "lime", "yellow",
  "gold", "orange", "coral", "red", "rose", "pink", "magenta", "violet",
  "purple", "indigo", "navy", "slate", "graphite", "sand",
] as const;

export type TaskPresetColorKey = (typeof taskPresetColorKeys)[number];

type TaskPresetColor = Readonly<{
  label: string;
  background: string;
  border: string;
  text: string;
  focus: string;
}>;

export const taskPresetColors: Record<TaskPresetColorKey, TaskPresetColor> = {
  blue: { label: "Blue", background: "#dbeafe", border: "#60a5fa", text: "#172554", focus: "#2563eb" },
  sky: { label: "Sky", background: "#dff5ff", border: "#38bdf8", text: "#0c4a6e", focus: "#0284c7" },
  cyan: { label: "Cyan", background: "#cffafe", border: "#22d3ee", text: "#164e63", focus: "#0891b2" },
  teal: { label: "Teal", background: "#ccfbf1", border: "#2dd4bf", text: "#134e4a", focus: "#0f766e" },
  emerald: { label: "Emerald", background: "#d1fae5", border: "#34d399", text: "#064e3b", focus: "#059669" },
  green: { label: "Green", background: "#dcfce7", border: "#4ade80", text: "#14532d", focus: "#16a34a" },
  lime: { label: "Lime", background: "#ecfccb", border: "#a3e635", text: "#365314", focus: "#65a30d" },
  yellow: { label: "Yellow", background: "#fef9c3", border: "#facc15", text: "#713f12", focus: "#ca8a04" },
  gold: { label: "Gold", background: "#fef3c7", border: "#fbbf24", text: "#78350f", focus: "#d97706" },
  orange: { label: "Orange", background: "#ffedd5", border: "#fb923c", text: "#7c2d12", focus: "#ea580c" },
  coral: { label: "Coral", background: "#ffe4e0", border: "#fb7185", text: "#7f1d1d", focus: "#e11d48" },
  red: { label: "Red", background: "#fee2e2", border: "#f87171", text: "#7f1d1d", focus: "#dc2626" },
  rose: { label: "Rose", background: "#ffe4e6", border: "#fb7185", text: "#881337", focus: "#e11d48" },
  pink: { label: "Pink", background: "#fce7f3", border: "#f472b6", text: "#831843", focus: "#db2777" },
  magenta: { label: "Magenta", background: "#fae8ff", border: "#e879f9", text: "#701a75", focus: "#c026d3" },
  violet: { label: "Violet", background: "#ede9fe", border: "#a78bfa", text: "#4c1d95", focus: "#7c3aed" },
  purple: { label: "Purple", background: "#f3e8ff", border: "#c084fc", text: "#581c87", focus: "#9333ea" },
  indigo: { label: "Indigo", background: "#e0e7ff", border: "#818cf8", text: "#312e81", focus: "#4f46e5" },
  navy: { label: "Navy", background: "#dbe4f5", border: "#64748b", text: "#172554", focus: "#1e3a8a" },
  slate: { label: "Slate", background: "#e2e8f0", border: "#94a3b8", text: "#1e293b", focus: "#475569" },
  graphite: { label: "Graphite", background: "#e5e7eb", border: "#6b7280", text: "#1f2937", focus: "#374151" },
  sand: { label: "Sand", background: "#f5ead7", border: "#c9a66b", text: "#5f3b16", focus: "#9a6a27" },
};

export const defaultTaskPresetColorKey: TaskPresetColorKey = "blue";
export const customCalendarColorKey: TaskPresetColorKey = "slate";

export function isTaskPresetColorKey(value: unknown): value is TaskPresetColorKey {
  return typeof value === "string" && taskPresetColorKeys.includes(value as TaskPresetColorKey);
}

export function taskPresetColor(key: string | null | undefined): TaskPresetColor {
  return taskPresetColors[isTaskPresetColorKey(key) ? key : customCalendarColorKey];
}
