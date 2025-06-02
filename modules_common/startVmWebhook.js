//
// modules_common/startVmWebhook.js
//
// This file runs inside MeshCentral’s “common” (server-side) process. 
// We listen for the “startVm” event and forward a JSON POST to http://localhost:1880/mfavm.
//

module.exports = function (parent) {
  // At this point, MeshCentral has finished loading its core server objects.
  // `parent` is the top‐level “common” object. We can reach the server instance under `parent.server`.
  const server = parent.server;

  // If, for some reason, the plugin is loaded before `server.config` is ready, guard it:
  if (!server || !server.on) {
    parent.debug("startVmWebhook: WARNING—server object not ready; skipping registration");
    return;
  }

  // Register a listener for the “startVm” event.
  //
  // According to the MeshCentral code, whenever the server emits “startVm” (for example,
  // when an agent reports VM state), listeners will receive two arguments:
  //   1) The device object (with .agent and .record fields)
  //   2) An `info` object that typically looks like: { vminfo: { … } }
  //
  // We want to construct:
  //    { vmName: "<hostname>", action: "start" }
  //
  // and POST it to http://localhost:1880/mfavm.
  server.on("startVm", function (device, info) {
    try {
      // 1) Extract the hostname. In most versions of MeshCentral,
      //    `device.agent.DeviceName` is the string each agent uses as its hostname.
      let vmName = "<unknown-device>";
      if (device && device.agent && device.agent.DeviceName) {
        vmName = device.agent.DeviceName;
      } else if (device && device.name) {
        vmName = device.name;
      }

      // 2) Build the JSON body exactly as before:
      const payload = JSON.stringify({
        vmName: vmName,
        action: "start"
      });

      // 3) Configure the HTTP POST target:
      const WEBHOOK_HOST = "localhost";
      const WEBHOOK_PORT = 1880;
      const WEBHOOK_PATH = "/mfavm";

      // 4) Choose http vs https (1880 is plain HTTP)
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

      // 5) Perform the POST:
      const req = httpLib.request(requestOptions, (res) => {
        let body = "";
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => {
          parent.debug(`startVmWebhook: HTTP ${res.statusCode} → ${body}`);
        });
      });
      req.on("error", (err) => {
        parent.debug("startVmWebhook: HTTP request error: " + err.message);
      });
      req.write(payload);
      req.end();

      // 6) Nothing to return—the event handler is “fire-and-forget.”      
    } catch (e) {
      parent.debug("startVmWebhook: Exception: " + e.toString());
    }
  });

  parent.debug("startVmWebhook: Initialized and listening for ‘startVm’ events");
};
