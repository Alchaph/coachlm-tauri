import type { Page } from "@playwright/test";

/**
 * Default mock responses for all Tauri IPC commands.
 * Tests can override individual commands via `setupTauriMocks(page, { overrides })`.
 */
const DEFAULT_MOCK_RESPONSES: Record<string, unknown> = {
  // App init
  is_first_run: false,
  get_strava_auth_status: { connected: false, expires_at: null },
  sync_strava_activities: null,

  // Settings
  get_settings: {
    active_llm: "ollama",
    ollama_endpoint: "http://localhost:11434",
    ollama_model: "llama3",
    custom_system_prompt: "",
    cloud_api_key: null,
    cloud_model: null,
    web_search_enabled: false,
    web_search_provider: "duckduckgo",
    web_augmentation_mode: "off",
  },
  save_settings: null,
  get_strava_credentials_available: false,
  start_strava_auth: null,
  disconnect_strava: null,
  get_ollama_models: ["llama3", "mistral", "codellama"],
  check_ollama_status: true,

  // Chat
  get_chat_sessions: [],
  get_chat_messages: [],
  create_chat_session: {
    id: "test-session-1",
    title: null,
    created_at: "2025-01-01T00:00:00Z",
  },
  delete_chat_session: null,
  rename_chat_session: null,
  send_message: "This is a mock response from the AI coach.",
  edit_and_resend: "This is an edited mock response.",
  save_pinned_insight: null,

  // Dashboard
  get_recent_activities: [],
  get_activity_stats: {
    total_activities: 0,
    total_distance_km: 0,
    earliest_date: null,
    latest_date: null,
  },

  // Activity detail
  get_activity_laps: [
    { id: 1, activity_id: "a1", lap_index: 1, distance: 1000.0, elapsed_time: 280, moving_time: 275, average_speed: 3.57, max_speed: 4.2, average_heartrate: 142.0, max_heartrate: 155.0, average_cadence: 178.0, total_elevation_gain: 5.0 },
    { id: 2, activity_id: "a1", lap_index: 2, distance: 1000.0, elapsed_time: 270, moving_time: 265, average_speed: 3.70, max_speed: 4.3, average_heartrate: 148.0, max_heartrate: 162.0, average_cadence: 182.0, total_elevation_gain: 3.0 },
    { id: 3, activity_id: "a1", lap_index: 3, distance: 1000.0, elapsed_time: 285, moving_time: 280, average_speed: 3.51, max_speed: 4.1, average_heartrate: 150.0, max_heartrate: 165.0, average_cadence: 176.0, total_elevation_gain: 8.0 },
  ],
  get_activity_zone_distribution: [
    { activity_id: "a1", zone_index: 0, zone_min: 0, zone_max: 120, time_seconds: 120 },
    { activity_id: "a1", zone_index: 1, zone_min: 120, zone_max: 148, time_seconds: 480 },
    { activity_id: "a1", zone_index: 2, zone_min: 148, zone_max: 162, time_seconds: 900 },
    { activity_id: "a1", zone_index: 3, zone_min: 162, zone_max: 174, time_seconds: 360 },
    { activity_id: "a1", zone_index: 4, zone_min: 174, zone_max: -1, time_seconds: 60 },
  ],
  get_aggregated_zone_distribution: [
    { zone_index: 0, zone_min: 0, zone_max: 120, total_time_seconds: 600, percentage: 10.0 },
    { zone_index: 1, zone_min: 120, zone_max: 148, total_time_seconds: 1800, percentage: 30.0 },
    { zone_index: 2, zone_min: 148, zone_max: 162, total_time_seconds: 2400, percentage: 40.0 },
    { zone_index: 3, zone_min: 162, zone_max: 174, total_time_seconds: 900, percentage: 15.0 },
    { zone_index: 4, zone_min: 174, zone_max: -1, total_time_seconds: 300, percentage: 5.0 },
  ],

  // Context
  get_profile_data: null,
  save_profile_data: null,
  get_pinned_insights: [],
  delete_pinned_insight: null,
  get_context_preview: "# Athlete Context\n\nNo profile data configured yet.",

  // Training Plan
  create_race: {
    id: "race-1",
    name: "Test Marathon",
    distance_km: 42.195,
    race_date: "2025-09-15",
    terrain: "road",
    elevation_m: null,
    goal_time_s: 12600,
    priority: "A",
    is_active: true,
    created_at: "2025-01-01T00:00:00Z",
  },
  update_race: null,
  delete_race: null,
  list_races: [],
  set_active_race: null,
  generate_plan_cmd: null,
  get_active_plan: null,
  list_plans: [],
  set_active_plan: null,
  delete_plan: null,
  get_plan_weeks: [],
  update_session_status: null,
};

/**
 * Inject Tauri IPC mocks into a Playwright page.
 *
 * This sets up `window.__TAURI_INTERNALS__` before the app loads,
 * intercepting all `invoke()` and `listen()` calls.
 *
 * @param page - Playwright page instance
 * @param options.overrides - Override specific command responses
 * @param options.onInvoke - Optional callback name exposed on window for invoke interception
 */
export async function setupTauriMocks(
  page: Page,
  options: {
    overrides?: Record<string, unknown>;
    onboardingMode?: boolean;
  } = {},
): Promise<void> {
  const mergedResponses = {
    ...DEFAULT_MOCK_RESPONSES,
    ...options.overrides,
  };

  if (options.onboardingMode) {
    mergedResponses.is_first_run = true;
  }

  await page.addInitScript((responses) => {
    let callbackId = 0;
    const callbacks: Record<number, (payload: unknown) => void> = {};
    const eventListeners: Record<string, number[]> = {};
    const invokeLog: Array<{ cmd: string; args: unknown }> = [];

    function transformCallback(fn: (payload: unknown) => void): number {
      const id = callbackId++;
      callbacks[id] = fn;
      return id;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__TAURI_INTERNALS__ = {
      metadata: {
        currentWindow: { label: "main" },
        currentWebview: { label: "main" },
      },
      transformCallback,
      invoke: (cmd: string, args?: Record<string, unknown>) => {
        invokeLog.push({ cmd, args: args ?? {} });

        if (cmd === "plugin:event|listen") {
          const event = (args?.event ?? "") as string;
          const handler = (args?.handler ?? 0) as number;
          if (!eventListeners[event]) {
            eventListeners[event] = [];
          }
          eventListeners[event].push(handler);
          return Promise.resolve(handler);
        }

        if (cmd === "plugin:event|unlisten") {
          const event = (args?.event ?? "") as string;
          const handler = (args?.handler ?? 0) as number;
          if (eventListeners[event]) {
            eventListeners[event] = eventListeners[event].filter(
              (id) => id !== handler,
            );
          }
          return Promise.resolve();
        }

        if (cmd === "plugin:event|emit") {
          return Promise.resolve();
        }

        if (cmd === "plugin:updater|check") {
          return Promise.resolve(null);
        }

        if (cmd === "plugin:dialog|ask") {
          return Promise.resolve(true);
        }

        if (cmd in responses) {
          const value = responses[cmd];
          if (value instanceof Error) {
            return Promise.reject(value.message);
          }
          return Promise.resolve(
            JSON.parse(JSON.stringify(value)) as unknown,
          );
        }

        console.warn(`[tauri-mock] Unhandled command: ${cmd}`, args);
        return Promise.resolve(null);
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__TAURI_MOCK__ = {
      emitEvent: (event: string, payload: unknown) => {
        const handlerIds = eventListeners[event] ?? [];
        for (const id of handlerIds) {
          const cb = callbacks[id];
          if (cb) {
            cb({ event, id, payload });
          }
        }
      },
      getInvokeLog: () => [...invokeLog],
      clearInvokeLog: () => {
        invokeLog.length = 0;
      },
      setResponse: (cmd: string, value: unknown) => {
        responses[cmd] = value;
      },
      getEventListeners: () => ({ ...eventListeners }),
    };
  }, mergedResponses);
}

/**
 * Emit a Tauri event from test code into the running app.
 */
export async function emitTauriEvent(
  page: Page,
  event: string,
  payload: unknown,
): Promise<void> {
  await page.evaluate(
    ({ event, payload }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__TAURI_MOCK__?.emitEvent(event, payload);
    },
    { event, payload },
  );
}

/**
 * Get the log of all invoke() calls made by the app.
 */
export async function getInvokeLog(
  page: Page,
): Promise<Array<{ cmd: string; args: unknown }>> {
  return page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).__TAURI_MOCK__?.getInvokeLog() ?? [];
  }) as Promise<Array<{ cmd: string; args: unknown }>>;
}

/**
 * Override a mock response mid-test.
 */
export async function setMockResponse(
  page: Page,
  cmd: string,
  value: unknown,
): Promise<void> {
  await page.evaluate(
    ({ cmd, value }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__TAURI_MOCK__?.setResponse(cmd, value);
    },
    { cmd, value },
  );
}
