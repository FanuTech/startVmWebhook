//
// index.js
//
// MeshCentral expects `module.exports.shortName` to be a function.
// Here, shortName === "startVmWebhook", so we export an object with that key.
//
// When MeshCentral loads this plugin, it effectively does:
//
//   const pluginModule = require("…/startVmWebhookPlugin/index.js");
//   const pluginFunction = pluginModule["startVmWebhook"];
//   pluginFunction(commonContext);   // `commonContext` is the top‐level server object (“parent”)
//
// Now we hook into the “startVm” event on the server and forward a JSON POST.
//

module.exports = {
  startVmWebhook: function (commonContext) {
    // `commonContext` ≈ the MeshCentral “common” object; we can reach `commonContext.server`.
    const server = commonContext.server;
    if (!server || typeof server.on !== "function") {
      commonContext.debug("startVmWebhook: ERROR—server object not ready, skipping registration");
      return;
    }

    // Register our listener for “startVm”
    server.on("startVm", function (device /*, info */) {
      try {
        // 1) Extract hostname (vmName).
        let vmName = "<unknown-device>";
        if (device && device.agent && device.agent.DeviceName) {
          vmName = device.agent.DeviceName;
        } else if (device && device.name) {
          vmName = device.name;
        }

        // 2) Build the JSON payload as specified.
        const payload = JSON.stringify({
          vmName: vmName,
          action: "start"
        });

        // 3) Configure the HTTP POST to http://localhost:1880/mfavm
        const WEBHOOK_HOST = "localhost";
        const WEBHOOK_PORT = 1880;
        const WEBHOOK_PATH = "/mfavm";

        // 4) Use Node’s `http` (port 1880 is non‐TLS)
        const httpLib = require("http");
        const requestOptions = {
          hostname: WEBHOOK_HOST,
          port:     WEBHOOK_PORT,
          path:     WEBHOOK_PATH,
          method:   "POST",
          headers: {
            "Content-Type":   "application/json",
            "Content-Length": Buffer.byteLength(payload)
          }
        };

        // 5) Send the POST
        const req = httpLib.request(requestOptions, (res) => {
          let body = "";
          res.on("data", (chunk) => { body += chunk; });
          res.on("end", () => {
            commonContext.debug(`startVmWebhook: HTTP ${res.statusCode} → ${body}`);
          });
        });
        req.on("error", (err) => {
          commonContext.debug("startVmWebhook: HTTP request error: " + err.message);
        });
        req.write(payload);
        req.end();
      } catch (e) {
        commonContext.debug("startVmWebhook: Exception: " + e.toString());
      }
    });

    commonContext.debug("startVmWebhook: Initialized and now listening for ‘startVm’ events");
  }
};
