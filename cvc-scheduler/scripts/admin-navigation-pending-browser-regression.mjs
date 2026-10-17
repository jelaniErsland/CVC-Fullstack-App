// Use the authenticated local Overview fixture for the current admin route.
process.env.VERIFY_ADMIN_PENDING_NAVIGATION = "1";
await import("./overview-browser-regression.mjs");
