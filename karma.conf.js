// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

// Auto-detect Chrome/Chromium binary if CHROME_BIN is not set
if (!process.env.CHROME_BIN) {
  const fs = require("fs");
  const candidates = [
    "/usr/bin/chromium", // Arch, Alpine
    "/usr/bin/chromium-browser", // Fedora, Debian/Ubuntu
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
  ];
  process.env.CHROME_BIN =
    candidates.find((p) => fs.existsSync(p)) || "chromium";
}

module.exports = function (config) {
  const isCi =
    process.env.CI === "true" || process.env.KARMA_SINGLE_RUN === "true";
  const headless = isCi || process.env.CHROME_HEADLESS === "true";
  const browsers = headless ? ["ChromeHeadless"] : ["Chrome"];
  // Include 'coverage' reporter so karma-coverage emits files (html/json-summary)
  const reporters = headless
    ? ["progress", "coverage"]
    : ["progress", "kjhtml", "coverage"];

  config.set({
    basePath: "",
    frameworks: ["jasmine"],
    plugins: [
      require("karma-jasmine"),
      require("karma-chrome-launcher"),
      require("karma-jasmine-html-reporter"),
      require("karma-coverage"),
    ],
    client: {
      jasmine: {
        random: false,
      },
      clearContext: !headless, // keep reporter UI only when not headless
    },
    jasmineHtmlReporter: {
      suppressAll: true,
    },
    coverageReporter: {
      dir: require("path").join(__dirname, "./coverage/datasync"),
      subdir: ".",
      // Add json-summary so Makefile coverage-check can read coverage-summary.json
      reporters: [
        { type: "html" },
        { type: "text-summary" },
        { type: "json-summary" },
      ],
    },
    reporters,
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: !isCi,
    browsers,
    singleRun: isCi,
    restartOnFileChange: !isCi,
  });
};
