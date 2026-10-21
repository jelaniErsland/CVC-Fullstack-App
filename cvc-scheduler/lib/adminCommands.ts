/** Static presentation only. Destination reads/actions always authorize on the server. */
export type AdminCommand = { id: string; label: string; detail: string; href: string; key?: string; destination: string; capability?: string; keywords: string };
export function adminCommands(destinations: readonly string[], capabilities: readonly string[], calendarHref: string): AdminCommand[] {
  const navigation: AdminCommand[] = [
    { id: "overview", label: "Go to Overview", detail: "Today and next up", href: "/admin/dashboard", key: "O", destination: "overview", keywords: "home dashboard" },
    { id: "calendar", label: "Go to Calendar", detail: "Your remembered view and date", href: calendarHref, key: "C", destination: "calendar", keywords: "schedule dates" },
    { id: "volunteers", label: "Go to Volunteers", detail: "Volunteer directory", href: "/admin/volunteers", key: "V", destination: "volunteers", keywords: "people roster" },
    { id: "attention", label: "Go to Needs Attention", detail: "Operational follow-ups", href: "/admin/needs-attention", key: "A", destination: "needs-attention", keywords: "issues staffing" },
    { id: "tasks", label: "Go to Task library", detail: "Reusable tasks", href: "/admin/tasks", key: "T", destination: "tasks", keywords: "presets" },
    { id: "communications", label: "Go to Communications", detail: "Messages and delivery history", href: "/admin/announcements", key: "M", destination: "announcements", keywords: "email messages" },
    { id: "quick-view", label: "Go to Quick View", detail: "Read-only project schedule", href: "/admin/quick-view", key: "Q", destination: "quick-view", keywords: "preview" },
    { id: "guide", label: "Go to Contact Guide", detail: "Help and contact guidance", href: "/guide", key: "H", destination: "guide", keywords: "help support" },
    { id: "create", label: "Create Calendar item", detail: "Open the Calendar item form; nothing is saved", href: `${calendarHref}${calendarHref.includes("?") ? "&" : "?"}create=1`, destination: "calendar", capability: "calendar.edit", keywords: "new task event" },
    { id: "assign", label: "Assign volunteers", detail: "Open Calendar to choose an item and volunteers", href: calendarHref, destination: "calendar", capability: "assignments.edit", keywords: "volunteer staffing picker" },
    { id: "add", label: "Add volunteer", detail: "Open Volunteers, then choose Add volunteer", href: "/admin/volunteers", destination: "volunteers", capability: "volunteers.edit", keywords: "new person directory" },
    { id: "send", label: "Send schedules / Communications", detail: "Open schedule deliveries; review and send remain explicit", href: "/admin/announcements?kind=schedule", destination: "announcements", capability: "assignments.edit", keywords: "email volunteers messages" },
  ];
  return navigation.filter(command => (command.destination === "guide" || destinations.includes(command.destination)) && (!command.capability || capabilities.includes(command.capability)));
}

/** Small ordered-subsequence matcher: no index, dependency, network, or private data. */
export function matchAdminCommands(commands: readonly AdminCommand[], query: string) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return commands.filter(command => {
    const tokens = `${command.label} ${command.keywords}`.toLowerCase().split(/[^a-z0-9]+/);
    return words.every(word => tokens.some(token => {
      let position = 0;
      for (const character of word) {
        position = token.indexOf(character, position);
        if (position < 0) return false;
        position++;
      }
      return true;
    }));
  });
}

export const goSequenceTimeout = 1200;
export function blocksAdminShortcut(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, form, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="searchbox"], [role="combobox"], [role="listbox"], [role="option"], [role="spinbutton"], [role="menu"], [role="dialog"], dialog, [inert]'));
}
