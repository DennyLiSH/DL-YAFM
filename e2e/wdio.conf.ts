import type { Options } from "@wdio/types";

export const config: Options.Testrunner = {
  //
  // ====================
  // Runner Configuration
  // ====================
  runner: "local",
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      transpileOnly: true,
      project: "./tsconfig.json",
    },
  },

  //
  // ==================
  // Specify Test Files
  // ==================
  specs: ["./e2e/specs/**/*.spec.ts"],
  exclude: [],

  //
  // ============
  // Capabilities
  // ============
  maxInstances: 1,

  capabilities: [
    {
      maxInstances: 1,
      browserName: "chrome",
      "goog:chromeOptions": {
        args: ["--headless", "--disable-gpu", "--window-size=1280,800"],
      },
    },
  ],

  //
  // ===================
  // Test Configurations
  // ===================
  logLevel: "info",
  bail: 0,
  baseUrl: "http://localhost:1420",
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  services: [],

  framework: "mocha",
  reporters: ["spec"],

  mochaOpts: {
    ui: "bdd",
    timeout: 60000,
  },

  //
  // =====
  // Hooks
  // =====
  onPrepare: function () {
    // Can be used to start the Tauri app before tests
    console.log("E2E tests starting...");
  },

  onComplete: function () {
    console.log("E2E tests completed.");
  },
};
