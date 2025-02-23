const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const config = require(path.join(__dirname, "../config/config.json"));

class Utils {
  static getPrivateKey() {
    const keyPath = path.join(__dirname, "../private.key");
    return fs.readFileSync(keyPath, "utf8").trim();
  }

  static getRandomAmount() {
    const { min, max } = config.cycles.amounts;
    const amount = Math.random() * (max - min) + min;
    return ethers.parseEther(amount.toFixed(4));
  }

  static getRandomDelay() {
    const { min, max } = config.cycles.delays;
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  static delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static logTransaction(hash) {
    return `${config.network.explorer}${hash}`;
  }
}

module.exports = Utils;
