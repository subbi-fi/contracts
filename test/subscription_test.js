const Subscription = artifacts.require("Subscription");
const SubscriptionConfig = artifacts.require("SubscriptionConfig");
const FakeUSDC = artifacts.require("FakeUSDC");

const ethers = require('ethers');
const truffleAssert = require('truffle-assertions');
const { advanceTimeAndBlock } = require('./helpers/time');

const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30;
const MAX_UINT = new web3.utils.BN("2").pow(new web3.utils.BN("256").sub(new web3.utils.BN("1")));
const ONE_USDC = 1000000;
const STARTING_USDC_SUPPLY = 10000000000000;
contract("Subscription", (accounts) => {
  let subscriptionConfigContract;
  let fakeUSDC;

  let configOwner;
  let signer;

  beforeEach(async () => {
    configOwner = accounts[9]
    signer = new ethers.Wallet.createRandom();

    fakeUSDC = await FakeUSDC.new(STARTING_USDC_SUPPLY, { from: accounts[0] });
    subscriptionConfigContract = await SubscriptionConfig.new(3, fakeUSDC.address, signer.address, { from: configOwner });
  });

  it("An owner can create an ownable subscription contract to manage subscriptions with corresponding configuration in the subscription config contract", async () => {
    const name = "TestSub";
    const signedMessage = await signer.signMessage(`${accounts[1].toLowerCase()}${name}`);
    const subscriptionContract = await Subscription.new(subscriptionConfigContract.address, accounts[1], ONE_USDC * 5, THIRTY_DAYS_IN_SECONDS, name, signedMessage, { from: accounts[1] });

    assert.equal(await subscriptionContract.owner(), accounts[1], "Unexpected owner");
    assert.isTrue(await subscriptionConfigContract.subscriptionContracts(subscriptionContract.address), "New subscription contract should exist");
    assert.equal(await subscriptionConfigContract.fee(subscriptionContract.address), 3, "Unexpected base fee");
    assert.equal(await subscriptionContract.name(), name, "Unexpected subscription name");
  });

  it("Users can subscribe to a subscription and initial payment is taken if they are not already subscribed if they have granted approval to the contract to move their USDC", async () => {
    const name = "TestSub";
    const signedMessage = await signer.signMessage(`${accounts[1].toLowerCase()}${name}`);
    const subscriptionContract = await Subscription.new(subscriptionConfigContract.address, accounts[1], ONE_USDC * 5, THIRTY_DAYS_IN_SECONDS, name, signedMessage, { from: accounts[1] });
    
    await fakeUSDC.transfer(accounts[2], 1000000000, { from: accounts[0] });
    await fakeUSDC.approve(subscriptionContract.address, MAX_UINT, { from: accounts[2] });

    await subscriptionContract.subscribe({ from: accounts[2] });
    assert.isTrue(await subscriptionContract.isSubscribed(accounts[2]), "Account should be subscribed");
    assert.isAbove((await subscriptionContract.lastPaymentDate(accounts[2])).toNumber(), 0, "Should have a last payment date");

    assert.equal((await fakeUSDC.balanceOf(accounts[1])).toString(), `${ONE_USDC * 5 * 0.97}`, "Subscription owner should have received their fee");
    assert.equal((await fakeUSDC.balanceOf(configOwner)).toString(), `${ONE_USDC * 5 * 0.03}`, "SubscriptionConfig owner should have received their cut");
  });

  it("The fee taken for processing payments for a given subscription contract can be altered", async () => {
    const name = "TestSub";
    const signedMessage = await signer.signMessage(`${accounts[1].toLowerCase()}${name}`);
    const subscriptionContract = await Subscription.new(subscriptionConfigContract.address, accounts[1], ONE_USDC * 5, THIRTY_DAYS_IN_SECONDS, name, signedMessage, { from: accounts[1] });
    
    await fakeUSDC.transfer(accounts[2], 1000000000, { from: accounts[0] });
    await fakeUSDC.approve(subscriptionContract.address, MAX_UINT, { from: accounts[2] });
    await subscriptionConfigContract.setFeeForContract(subscriptionContract.address, 1, { from: configOwner });

    await subscriptionContract.subscribe({ from: accounts[2] });
    assert.isTrue(await subscriptionContract.isSubscribed(accounts[2]), "Account should be subscribed");
    assert.isAbove((await subscriptionContract.lastPaymentDate(accounts[2])).toNumber(), 0, "Should have a last payment date");

    assert.equal((await fakeUSDC.balanceOf(accounts[1])).toString(), `${ONE_USDC * 5 * 0.99}`, "Subscription owner should have received their fee");
    assert.equal((await fakeUSDC.balanceOf(configOwner)).toString(), `${ONE_USDC * 5 * 0.01}`, "SubscriptionConfig owner should have received their cut");
  });

  it("Allows payment to be taken again from subscribers once the subscription interval period for a subscription contract has passed", async () => {
    const name = "TestSub";
    const signedMessage = await signer.signMessage(`${accounts[1].toLowerCase()}${name}`);
    const subscriptionContract = await Subscription.new(subscriptionConfigContract.address, accounts[1], ONE_USDC * 5, THIRTY_DAYS_IN_SECONDS, name, signedMessage, { from: accounts[1] });
    
    await fakeUSDC.transfer(accounts[2], 1000000000, { from: accounts[0] });
    await fakeUSDC.approve(subscriptionContract.address, MAX_UINT, { from: accounts[2] });

    await subscriptionContract.subscribe({ from: accounts[2] });
    assert.isTrue(await subscriptionContract.isSubscribed(accounts[2]), "Account should be subscribed");
    assert.isAbove((await subscriptionContract.lastPaymentDate(accounts[2])).toNumber(), 0, "Should have a last payment date");

    await advanceTimeAndBlock(THIRTY_DAYS_IN_SECONDS + 1);
    await subscriptionContract.processPayment(accounts[2]);

    assert.equal((await fakeUSDC.balanceOf(accounts[2])).toString(), `${1000000000 - (ONE_USDC * 10)}`, "Unexpected balance after two payments");
    assert.equal((await fakeUSDC.balanceOf(accounts[1])).toString(), `${ONE_USDC * 10 * 0.97}`, "Subscription owner should have received their fee");
    assert.equal((await fakeUSDC.balanceOf(configOwner)).toString(), `${ONE_USDC * 10 * 0.03}`, "SubscriptionConfig owner should have received their cut twice")
  });

  it("Does not process a payment for a subscriber if the transaction is sent before their next payment time but they remain subscribed", async () => {
    const name = "TestSub";
    const signedMessage = await signer.signMessage(`${accounts[1].toLowerCase()}${name}`);
    const subscriptionContract = await Subscription.new(subscriptionConfigContract.address, accounts[1], ONE_USDC * 5, THIRTY_DAYS_IN_SECONDS, name, signedMessage, { from: accounts[1] });
    
    await fakeUSDC.transfer(accounts[2], 1000000000, { from: accounts[0] });
    await fakeUSDC.approve(subscriptionContract.address, MAX_UINT, { from: accounts[2] });

    await subscriptionContract.subscribe({ from: accounts[2] });
    assert.isTrue(await subscriptionContract.isSubscribed(accounts[2]), "Account should be subscribed");
    assert.isAbove((await subscriptionContract.lastPaymentDate(accounts[2])).toNumber(), 0, "Should have a last payment date");

    await advanceTimeAndBlock(THIRTY_DAYS_IN_SECONDS / 10);
    await truffleAssert.reverts(subscriptionContract.processPayment(accounts[2]), "No Payment Due");
    assert.isTrue(await subscriptionContract.isSubscribed(accounts[2]), "Account should be subscribed");
  });

  it("Does not process a payment if an address is not subscribed", async () => {
    const name = "TestSub";
    const signedMessage = await signer.signMessage(`${accounts[1].toLowerCase()}${name}`);
    const subscriptionContract = await Subscription.new(subscriptionConfigContract.address, accounts[1], ONE_USDC * 5, THIRTY_DAYS_IN_SECONDS, name, signedMessage, { from: accounts[1] });
    
    await fakeUSDC.transfer(accounts[2], 1000000000, { from: accounts[0] });
    await fakeUSDC.approve(subscriptionContract.address, MAX_UINT, { from: accounts[2] });

    await truffleAssert.reverts(subscriptionContract.processPayment(accounts[2]), "Not Subscribed");
  });

  it("Changes the subscription status for a subscriber to false if their subscription payment fails for approval reasons", async () => {
    const name = "TestSub";
    const signedMessage = await signer.signMessage(`${accounts[1].toLowerCase()}${name}`);
    const subscriptionContract = await Subscription.new(subscriptionConfigContract.address, accounts[1], ONE_USDC * 5, THIRTY_DAYS_IN_SECONDS, name, signedMessage, { from: accounts[1] });
    
    await fakeUSDC.transfer(accounts[2], 1000000000, { from: accounts[0] });
    await fakeUSDC.approve(subscriptionContract.address, MAX_UINT, { from: accounts[2] });

    await subscriptionContract.subscribe({ from: accounts[2] });
    assert.isTrue(await subscriptionContract.isSubscribed(accounts[2]), "Account should be subscribed");
    assert.isAbove((await subscriptionContract.lastPaymentDate(accounts[2])).toNumber(), 0, "Should have a last payment date");

    const remainingAllowance = await fakeUSDC.allowance(accounts[2], subscriptionContract.address);
    await fakeUSDC.decreaseAllowance(subscriptionContract.address, remainingAllowance, { from: accounts[2] } );
    await advanceTimeAndBlock(THIRTY_DAYS_IN_SECONDS + 1);

    await subscriptionContract.processPayment(accounts[2]);
    assert.isFalse(await subscriptionContract.isSubscribed(accounts[2]), "Account should not be subscribed");
  });

  it("Changes the subscription status for a subscriber to false if their subscription payments fails for balance reasons", async () => {
    const name = "TestSub";
    const signedMessage = await signer.signMessage(`${accounts[1].toLowerCase()}${name}`);
    const subscriptionContract = await Subscription.new(subscriptionConfigContract.address, accounts[1], ONE_USDC * 5, THIRTY_DAYS_IN_SECONDS, name, signedMessage, { from: accounts[1] });
    
    await fakeUSDC.transfer(accounts[2], 1000000000, { from: accounts[0] });
    await fakeUSDC.approve(subscriptionContract.address, MAX_UINT, { from: accounts[2] });

    await subscriptionContract.subscribe({ from: accounts[2] });
    assert.isTrue(await subscriptionContract.isSubscribed(accounts[2]), "Account should be subscribed");
    assert.isAbove((await subscriptionContract.lastPaymentDate(accounts[2])).toNumber(), 0, "Should have a last payment date");

    const remainingBalance = await fakeUSDC.balanceOf(accounts[2]);
    await fakeUSDC.transfer(accounts[0], remainingBalance, { from: accounts[2] });
    await advanceTimeAndBlock(THIRTY_DAYS_IN_SECONDS + 1);

    await subscriptionContract.processPayment(accounts[2]);
    assert.isFalse(await subscriptionContract.isSubscribed(accounts[2]), "Account should not be subscribed");
  });

  it("A user can cancel their subscription and they will no longer be subscribed", async () => {
    const name = "TestSub";
    const signedMessage = await signer.signMessage(`${accounts[1].toLowerCase()}${name}`);
    const subscriptionContract = await Subscription.new(subscriptionConfigContract.address, accounts[1], ONE_USDC * 5, THIRTY_DAYS_IN_SECONDS, name, signedMessage, { from: accounts[1] });
    
    await fakeUSDC.transfer(accounts[2], 1000000000, { from: accounts[0] });
    await fakeUSDC.approve(subscriptionContract.address, MAX_UINT, { from: accounts[2] });

    await subscriptionContract.subscribe({ from: accounts[2] });
    assert.isTrue(await subscriptionContract.isSubscribed(accounts[2]), "Account should be subscribed");
    assert.isAbove((await subscriptionContract.lastPaymentDate(accounts[2])).toNumber(), 0, "Should have a last payment date");

    await advanceTimeAndBlock(THIRTY_DAYS_IN_SECONDS + 1);
    await subscriptionContract.processPayment(accounts[2]);

    assert.equal((await fakeUSDC.balanceOf(accounts[2])).toString(), `${1000000000 - (ONE_USDC * 10)}`, "Unexpected balance after two payments");
    assert.equal((await fakeUSDC.balanceOf(accounts[1])).toString(), `${ONE_USDC * 10 * 0.97}`, "Subscription owner should have received their fee");
    assert.equal((await fakeUSDC.balanceOf(configOwner)).toString(), `${ONE_USDC * 10 * 0.03}`, "SubscriptionConfig owner should have received their cut twice")

    await subscriptionContract.cancelSubscription({ from: accounts[2] });
    assert.isFalse(await subscriptionContract.isSubscribed(accounts[2]), "Account should not be subscribed");
  });

  it("If a subscription owner pauses a subscription contract then no new users can subscribe but existing subscribers can still have their payments processed", async () => {
    const name = "TestSub";
    const signedMessage = await signer.signMessage(`${accounts[1].toLowerCase()}${name}`);
    const subscriptionContract = await Subscription.new(subscriptionConfigContract.address, accounts[1], ONE_USDC * 5, THIRTY_DAYS_IN_SECONDS, name, signedMessage, { from: accounts[1] });
    
    await fakeUSDC.transfer(accounts[2], 1000000000, { from: accounts[0] });
    await fakeUSDC.approve(subscriptionContract.address, MAX_UINT, { from: accounts[2] });

    await subscriptionContract.subscribe({ from: accounts[2] });
    assert.isTrue(await subscriptionContract.isSubscribed(accounts[2]), "Account should be subscribed");
    assert.isAbove((await subscriptionContract.lastPaymentDate(accounts[2])).toNumber(), 0, "Should have a last payment date");

    await subscriptionContract.pause({ from: accounts[1] });
    await truffleAssert.reverts(subscriptionContract.subscribe({ from: accounts[3] }), "Paused");

    await advanceTimeAndBlock(THIRTY_DAYS_IN_SECONDS + 1);
    await subscriptionContract.processPayment(accounts[2]);

    assert.equal((await fakeUSDC.balanceOf(accounts[2])).toString(), `${1000000000 - (ONE_USDC * 10)}`, "Unexpected balance after two payments");
    assert.equal((await fakeUSDC.balanceOf(accounts[1])).toString(), `${ONE_USDC * 10 * 0.97}`, "Subscription owner should have received their fee");
    assert.equal((await fakeUSDC.balanceOf(configOwner)).toString(), `${ONE_USDC * 10 * 0.03}`, "SubscriptionConfig owner should have received their cut twice")
  });

  it("A subscription owner can delete a subscription contract removing its code from the blockchain", async () => {
    const name = "TestSub";
    const signedMessage = await signer.signMessage(`${accounts[1].toLowerCase()}${name}`);
    const subscriptionContract = await Subscription.new(subscriptionConfigContract.address, accounts[1], ONE_USDC * 5, THIRTY_DAYS_IN_SECONDS, name, signedMessage, { from: accounts[1] });
    
    await fakeUSDC.transfer(accounts[2], 1000000000, { from: accounts[0] });
    await fakeUSDC.approve(subscriptionContract.address, MAX_UINT, { from: accounts[2] });

    await subscriptionContract.subscribe({ from: accounts[2] });
    assert.isTrue(await subscriptionContract.isSubscribed(accounts[2]), "Account should be subscribed");
    assert.isAbove((await subscriptionContract.lastPaymentDate(accounts[2])).toNumber(), 0, "Should have a last payment date");

    await truffleAssert.reverts(subscriptionContract.deleteSubscriptionContract({ from: accounts[0] }), "Ownership");
    await subscriptionContract.deleteSubscriptionContract({ from: accounts[1] })

    await advanceTimeAndBlock(THIRTY_DAYS_IN_SECONDS + 1);
    await truffleAssert.fails(subscriptionContract.owner());
  });

  it("Does not allow a Subscription contract to be deployed if the signed message does not match the arguments used to create it", async () => {
    const name = "TestSub";
    const signedMessage = await signer.signMessage(`${accounts[1].toLowerCase()}${name}`);
    await truffleAssert.fails(Subscription.new(subscriptionConfigContract.address, accounts[3], ONE_USDC * 5, THIRTY_DAYS_IN_SECONDS, name, signedMessage, { from: accounts[1] }), "Signer");
  });
});
