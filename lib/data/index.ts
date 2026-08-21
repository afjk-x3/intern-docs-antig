import 'server-only';

// This directory will contain all database access functions.
// By importing 'server-only' at the top of these files, we ensure that
// they can never accidentally be bundled into the client browser.
// See docs/12-backend-security-rules.md for more details.

export async function exampleDataFetch() {
  // Example of a server-only data fetch
  return { success: true };
}
