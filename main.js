const path = require("path");
const { ethers } = require("ethers");
const Dashboard = require("./ui/Dashboard");
const SwapService = require("./services/SwapService");
const StakingService = require("./services/StakingService");
const TokenService = require("./services/TokenService");
const config = require(path.join(__dirname, "./config/config.json"));
const Utils = require("./lib/utils");

class Application {
  constructor() {
    this.initializeDashboard();
    this.services = {};
    this.transactionHistory = [];
    this.cycleCount = 0;
    this.tokenService = new TokenService();
  }

  async checkNFTAccess(address) {
    const nftBalance = await this.tokenService.getNFTBalance(address);
    if (nftBalance === 0) {
      throw new Error(
        "Access denied: You need to hold the required NFT to use this bot"
      );
    }
    return true;
  }

  initializeDashboard() {
    try {
      this.dashboard = new Dashboard();
      this.dashboard.screen.render();
    } catch (error) {
      console.error("Failed to initialize dashboard:", error);
      process.exit(1);
    }
  }

  async initialize() {
    try {
      this.dashboard.updateTable([
        ["Initializing...", "Pending", new Date().toLocaleTimeString()],
      ]);

      this.dashboard.updateLog("Initializing services...");
      this.dashboard.updateStatus("Initializing");

      const provider = new ethers.JsonRpcProvider(config.network.rpc);
      const wallet = new ethers.Wallet(Utils.getPrivateKey(), provider);

      await this.checkNFTAccess(wallet.address);
      this.dashboard.updateLog("NFT access verified successfully");

      const tokens = await this.tokenService.getTokenBalances(wallet.address);
      this.dashboard.updateTokens(tokens);

      const balance = await provider.getBalance(wallet.address);
      const formattedBalance = parseFloat(ethers.formatEther(balance)).toFixed(
        4
      );
      const network = await provider.getNetwork();

      this.dashboard.updateBalance(formattedBalance);
      this.dashboard.updateNetwork(`Monad ${network.name}`);
      this.dashboard.setCycles(0, config.cycles.default);

      const services = {
        rubicSwap: { name: "Rubic Swap", service: SwapService },
        izumiSwap: { name: "Izumi Swap", service: SwapService },
        magmaStaking: {
          name: "Magma Staking",
          service: StakingService,
          address: config.contracts.magma,
        },
      };

      for (const [key, info] of Object.entries(services)) {
        this.dashboard.updateLog(`Initializing ${info.name}...`);

        try {
          this.services[key] = info.address
            ? new info.service(info.address)
            : new info.service();

          await this.services[key].initialize();
          this.dashboard.updateLog(`${info.name} initialized successfully`);
        } catch (error) {
          this.dashboard.updateLog(
            `Failed to initialize ${info.name}: ${error.message}`
          );
          this.dashboard.updateStatus("Error");
          throw error;
        }

        await Utils.delay(1000);
      }

      this.dashboard.updateLineChart([
        { time: new Date().toLocaleTimeString(), amount: 0 },
      ]);
      this.dashboard.updateStatus("Active");

      return true;
    } catch (error) {
      this.dashboard.updateLog(`Initialization error: ${error.message}`);
      this.dashboard.updateStatus("Error");
      return false;
    }
  }

  async start() {
    try {
      this.dashboard.updateLog("Starting Monad Bot...");

      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error("Failed to initialize services");
      }

      this.dashboard.updateLog("All services initialized. Starting cycles...");

      while (true) {
        for (let i = 0; i < config.cycles.default; i++) {
          this.cycleCount++;
          await this.runCycle();

          const progress = ((i + 1) / config.cycles.default) * 100;
          this.dashboard.updateStats(progress);

          if (i < config.cycles.default - 1) {
            const delay = Utils.getRandomDelay();
            this.dashboard.updateLog(
              `Waiting ${delay / 1000} seconds before next cycle...`
            );
            await Utils.delay(delay);
          }
        }

        this.dashboard.updateLog("Starting cooldown period of 12 hours...");
        this.dashboard.updateStatus("Cooling Down");
        await Utils.delay(config.cycles.cooldownTime);
        this.cycleCount = 0;
        this.dashboard.updateStats(0);
        this.dashboard.updateStatus("Active");
      }
    } catch (error) {
      this.dashboard.updateLog(`Fatal error: ${error.message}`);
      this.dashboard.updateStatus("Error");
      await new Promise(() => {});
    }
  }

  async runCycle() {
    try {
      const amount = Utils.getRandomAmount();
      this.dashboard.setCycles(this.cycleCount, config.cycles.default);

      const formattedAmount = parseFloat(ethers.formatEther(amount));
      this.dashboard.updateLog(
        `Starting cycle ${this.cycleCount} with ${formattedAmount} MON`
      );

      this.transactionHistory.push({
        time: new Date().toLocaleTimeString(),
        amount: formattedAmount,
      });

      if (this.transactionHistory.length > 10) {
        this.transactionHistory.shift();
      }

      this.dashboard.updateLineChart(this.transactionHistory);

      const serviceStatus = [];

      for (const [name, service] of Object.entries(this.services)) {
        try {
          if (service instanceof SwapService) {
            serviceStatus.push([
              name,
              "Running",
              new Date().toLocaleTimeString(),
            ]);
            this.dashboard.updateTable(serviceStatus);

            const wrapResult = await service.wrapMON(amount);
            this.dashboard.updateLog(
              `${name}: Wrapped MON - ${wrapResult.status}`
            );

            await Utils.delay(Utils.getRandomDelay());

            const unwrapResult = await service.unwrapMON(amount);
            this.dashboard.updateLog(
              `${name}: Unwrapped MON - ${unwrapResult.status}`
            );

            serviceStatus.pop();
            serviceStatus.push([
              name,
              "Active",
              new Date().toLocaleTimeString(),
            ]);
          } else {
            serviceStatus.push([
              name,
              "Running",
              new Date().toLocaleTimeString(),
            ]);
            this.dashboard.updateTable(serviceStatus);

            const stakeResult = await service.stake(amount);
            this.dashboard.updateLog(
              `${name}: Staked MON - ${stakeResult.status}`
            );

            await Utils.delay(Utils.getRandomDelay());

            const unstakeResult = await service.unstake(amount);
            this.dashboard.updateLog(
              `${name}: Unstaked MON - ${unstakeResult.status}`
            );

            serviceStatus.pop();
            serviceStatus.push([
              name,
              "Active",
              new Date().toLocaleTimeString(),
            ]);
          }
        } catch (error) {
          this.dashboard.updateLog(`${name}: Error - ${error.message}`);
          serviceStatus.push([name, "Error", new Date().toLocaleTimeString()]);
        }
      }

      this.dashboard.updateTable(serviceStatus);

      const provider = new ethers.JsonRpcProvider(config.network.rpc);
      const wallet = new ethers.Wallet(Utils.getPrivateKey(), provider);

      const tokens = await this.tokenService.getTokenBalances(wallet.address);
      this.dashboard.updateTokens(tokens);

      const balance = await provider.getBalance(wallet.address);
      const formattedBalance = parseFloat(ethers.formatEther(balance)).toFixed(
        4
      );
      this.dashboard.updateBalance(formattedBalance);
    } catch (error) {
      this.dashboard.updateStatus("Error");
      this.dashboard.updateLog(`Cycle error: ${error.message}`);
      throw error;
    }
  }
}

if (require.main === module) {
  process.on("unhandledRejection", (error) => {
    console.error("Unhandled rejection:", error);
  });

  const app = new Application();
  app.start().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

module.exports = Application;
