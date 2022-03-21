const SubscriptionFactory = artifacts.require("SubscriptionFactory");
const SubscriptionConfig = artifacts.require("SubscriptionConfig");

const dotenv = require('dotenv');
dotenv.config();

const usdcAddress = process.env.USDC_ADDRESS;
const signer = process.env.SIGNER_ADDRESS;
const ONE_USDC = 1000000;
const ONE_DAY_IN_SECONDS = 60 * 60 * 24;
const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30;

module.exports = (deployer, network) => {
  if (network === "development") return;
  deployer.then(async () => {
    await deployer.deploy(SubscriptionConfig, 30, usdcAddress, signer);
    const configInstance = await SubscriptionConfig.deployed();

    const billingInterval = network === "polygontestnet" ? ONE_DAY_IN_SECONDS : THIRTY_DAYS_IN_SECONDS;
    await deployer.deploy(SubscriptionFactory, configInstance.address, ONE_USDC, billingInterval);
  })
};