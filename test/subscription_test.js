const Subscription = artifacts.require("Subscription");
const SubscriptionConfig = artifacts.require("SubscriptionConfig");
const FakeUSDC = artifacts.require("FakeUSDC");

const ethers = require('ethers');
const { advanceTimeAndBlock } = require('./helpers/time');

const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30;
const MAX_UINT = 2**256 - 1;
const ONE_USDC = 1000000;
contract("Subscription", (accounts) => {
  let subscriptionConfigContract;
  let fakeUSDC;

  let configOwner;
  let signer;

  beforeEach(async () => {
    configOwner = accounts[0]
    signer = new ethers.Wallet.createRandom();

    fakeUSDC = await new FakeUSDC(100000000000000000000, { from: accounts[0] });
    subscriptionConfigContract = await new SubscriptionConfig(3, fakeUSDC.address, signer.address, { from: configOwner });
  });

  it("An owner can create an ownable subscription contract to manage subscriptions with corresponding configuration in the subscription config contract", async () => {
    const name = "TestSub";
    const signedMessage = await signer.signMessage(`${subscriptionOwner.toLowerCase()}${name}`);
    const subscriptionContract = await new Subscription(subscriptionConfigContract.address, subscriptionOwner, ONE_USDC * 5, THIRTY_DAYS_IN_SECONDS, name, signedMessage, { from: accounts[1] });

    assert.equal(await subscriptionContract.owner(), accounts[1], "Unexpected owner");
    assert.isTrue(await subscriptionConfigContract.subscriptionContracts(subscriptionContract.address), "New subscription contract should exist");
    assert.equal(await subscriptionConfigContract.fee(), 3, "Unexpected base fee");
    assert.equal(await subscriptionContract.name(), name, "Unexpected subscription name");
  });

  it("Users can subscribe to a subscription and initial payment is taken if they are not already subscribed if they have granted approval to the contract to move their USDC", async () => {
    const name = "TestSub";
    const signedMessage = await signer.signMessage(`${subscriptionOwner.toLowerCase()}${name}`);
    const subscriptionContract = await new Subscription(subscriptionConfigContract.address, subscriptionOwner, ONE_USDC * 5, THIRTY_DAYS_IN_SECONDS, name, signedMessage, { from: accounts[1] });
    
    await fakeUSDC.transfer(accounts[2], 1000000000, { from: accounts[0] });
    await fakeUSDC.approve(subscriptionContract.address, MAX_UINT, { from: accounts[2] });

    await subscriptionContract.subscribe({ from: accounts[2] });
    assert.isTrue(await subscriptionContract.isSubscribed(accounts[2]), "Account should be subscribed");
    assert.isAbove(await subscriptionContract.lastPaymentDate(accounts[2]), 0, "Should have a last payment date");

    assert.equal(await fakeUSDC.balanceOf(accounts[1], ONE_USDC * 5 * 0.97, "Subscription owner should have received their fee"));
    assert.equal(await fakeUSDC.balanceOf(accounts[0], ONE_USDC * 5 * 0.03, "SubscriptionConfig owner should have received their cut"));
  });

  it("The fee taken for processing payments for a given subscription contract can be altered", async () => {
    const name = "TestSub";
    const signedMessage = await signer.signMessage(`${subscriptionOwner.toLowerCase()}${name}`);
    const subscriptionContract = await new Subscription(subscriptionConfigContract.address, subscriptionOwner, ONE_USDC * 5, THIRTY_DAYS_IN_SECONDS, name, signedMessage, { from: accounts[1] });
    
    await fakeUSDC.transfer(accounts[2], 1000000000, { from: accounts[0] });
    await fakeUSDC.approve(subscriptionContract.address, MAX_UINT, { from: accounts[2] });
    await subscriptionConfigContract.setFeeForContract(subscriptionContract.address, 1, { from: configOwner });

    await subscriptionContract.subscribe({ from: accounts[2] });
    assert.isTrue(await subscriptionContract.isSubscribed(accounts[2]), "Account should be subscribed");
    assert.isAbove(await subscriptionContract.lastPaymentDate(accounts[2]), 0, "Should have a last payment date");

    assert.equal(await fakeUSDC.balanceOf(accounts[1], ONE_USDC * 5 * 0.99, "Subscription owner should have received their fee"));
    assert.equal(await fakeUSDC.balanceOf(accounts[0], ONE_USDC * 5 * 0.01, "SubscriptionConfig owner should have received their cut"));
  });

  it("Allows payment to be taken again from subscribers once the subscription interval period for a subscription contract has passed", async () => {
    const name = "TestSub";
    const signedMessage = await signer.signMessage(`${subscriptionOwner.toLowerCase()}${name}`);
    const subscriptionContract = await new Subscription(subscriptionConfigContract.address, subscriptionOwner, ONE_USDC * 5, THIRTY_DAYS_IN_SECONDS, name, signedMessage, { from: accounts[1] });
    
    await fakeUSDC.transfer(accounts[2], 1000000000, { from: accounts[0] });
    await fakeUSDC.approve(subscriptionContract.address, MAX_UINT, { from: accounts[2] });

    await subscriptionContract.subscribe({ from: accounts[2] });
    assert.isTrue(await subscriptionContract.isSubscribed(accounts[2]), "Account should be subscribed");
    assert.isAbove(await subscriptionContract.lastPaymentDate(accounts[2]), 0, "Should have a last payment date");

    await advanceTimeAndBlock(THIRTY_DAYS_IN_SECONDS + 1);
    await subscriptionContract.processPayment(accounts[2]);

    assert.equal(await fakeUSDC.balanceOf(accounts[2]), 1000000000 - (ONE_USDC * 10), "Unexpected balance after two payments");
  });

  it("Does not process a payment for a subscriber if the transaction is sent before their next payment time", async () => {

  });

  it("Changes the subscription status for a subscriber to false if their subscription payment fails", async () => {

  });

  it("Test to check we can somehow grab all the deployed subscription contracts and their subscribers", async () => {
    // This likely needs some contract work
  });
});
