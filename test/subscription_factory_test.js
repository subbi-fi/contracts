const SubscriptionFactory = artifacts.require("SubscriptionFactory");
const SubscriptionConfig = artifacts.require("SubscriptionConfig");
const FakeUSDC = artifacts.require("FakeUSDC");

const ethers = require('ethers');
const truffleAssert = require('truffle-assertions');

const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30;
const ONE_USDC = 1000000;
const STARTING_USDC_SUPPLY = 10000000000000;
contract("SubscriptionFactory", (accounts) => {
  let subscriptionConfigContract;
  let subscriptionFactoryContract;

  let configOwner;
  let signer;

  beforeEach(async () => {
    configOwner = accounts[9]
    signer = new ethers.Wallet.createRandom();

    const fakeUSDC = await FakeUSDC.new(STARTING_USDC_SUPPLY, { from: accounts[0] });
    subscriptionConfigContract = await SubscriptionConfig.new(30, fakeUSDC.address, signer.address, { from: configOwner });
    subscriptionFactoryContract = await SubscriptionFactory.new(subscriptionConfigContract.address, ONE_USDC, THIRTY_DAYS_IN_SECONDS, { from: configOwner });
  });

  it("Allows users to create new Subscription Contracts and stores them in a list", async () => {
    const name = "FakeSubscription"
    const signedMessage = await signer.signMessage(`${accounts[1].toLowerCase()}${name}`);

    await subscriptionFactoryContract.createSubscription(ONE_USDC * 5, name, signedMessage, { from: accounts[1] });
    await subscriptionFactoryContract.createSubscription(ONE_USDC * 5, name, signedMessage, { from: accounts[1] });
    const subscriptions = await subscriptionFactoryContract.allSubscriptions();
    assert.equal(subscriptions.length, 2, "Expect 2 subscriptions");
  });

  it("Does not allow Subscriptions Contracts to be deployed with a monthly cost of less than the minimum cost", async () => {
    const name = "FakeSubscription"
    const signedMessage = await signer.signMessage(`${accounts[1].toLowerCase()}${name}`);

    await truffleAssert.reverts(subscriptionFactoryContract.createSubscription(ONE_USDC / 2, name, signedMessage, { from: accounts[1] }), "Below Min Cost");
  });

  it("Only the owner can set a new config contract address", async () => {
    const newConfig = await SubscriptionConfig.new(5, signer.address, signer.address, { from: configOwner });

    await truffleAssert.reverts(subscriptionFactoryContract.setConfigContract(newConfig.address, { from: accounts[8] }), "Ownable: caller is not the owner");
    await subscriptionFactoryContract.setConfigContract(newConfig.address, { from: configOwner });
  });

  it("Only the owner can set a new minimum cost for created subscriptions", async () => {
    await truffleAssert.reverts(subscriptionFactoryContract.setMinCost(ONE_USDC * 5, { from: accounts[8] }), "Ownable: caller is not the owner");
    await subscriptionFactoryContract.setMinCost(ONE_USDC * 5, { from: configOwner });
  });
});