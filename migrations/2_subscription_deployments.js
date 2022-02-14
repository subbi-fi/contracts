const SubscriptionFactory = artifacts.require("SubscriptionFactory");
const SubscriptionConfig = artifacts.require("SubscriptionConfig");

const dotenv = require('dotenv');
dotenv.config();

const usdcAddress = process.env.USDC_ADDRESS;
const signer = process.env.SIGNER;
const ONE_USDC = 1000000;
const ONE_DAY_IN_SECONDS = 60 * 60 * 24 * 1;

module.exports = (deployer, network) => {
  if (network === "development") return;
  deployer.then(async () => {
    await deployer.deploy(SubscriptionConfig, 3, usdcAddress, signer);
    await deployer.deploy(SubscriptionFactory, SubscriptionConfig.address, ONE_USDC, ONE_DAY_IN_SECONDS);
  })
};