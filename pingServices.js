const axios = require("axios");

function startPing(pingUrl, interval = 12 * 60 * 1000) {
  let count = 0;
  // Initial ping on startup
  axios
    .get(pingUrl)
    .then((response) => console.log("Initial ping successful:", response.data))
    .catch((error) => console.error("Initial ping error:", error));

  // Set up interval ping
  setInterval(() => {
    axios
      .get(pingUrl)
      .then((response) => {
        console.log("Ping successful:", response.data);
        count++;
        console.log("Ping count:", count);
      })
      .catch((error) => console.error("Ping error:", error));
  }, interval);
}

module.exports = { startPing };
