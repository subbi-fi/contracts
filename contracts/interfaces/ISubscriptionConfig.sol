// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISubscriptionConfig {
    event Subscribed(address subscriber, address subscriptionContract);
    event CancelSubscription(address subscriber, address subscriptionContract);
    event SubscriptionCreation(
        address subscriptionContract,
        address owner,
        string name
    );
    event DeleteSubscription(address subscriptionContract);
    event SubscriptionPayment(
        address subscriptionContract,
        address subscriber,
        uint256 amount
    );
    event SubscriptionPaused(address subscriptionContract);
    event SubscriptionUnpaused(address subscriptionContract);

    function signer() external view returns (address);

    function USDCAddress() external view returns (address);

    function fee(address _subscriptionContract) external view returns (uint256);

    function owner() external view returns (address);

    function emitSubscription(address _subscriber) external; // Must only be called by a subscription contract

    function emitCancelSubscription(address _subscriber) external; // Must only be called by a subscription contract

    function emitSubscriptionPayment(address _subscriber, uint256 _amount)
        external;

    function emitPauseSubscription(address _subscription) external; // Must only be called by a subscription contract, specifically the one pausing

    function emitUnpauseSubscription(address _subscription) external; // Must only be called by a subscription contract, specifically the one unpausing

    function deleteSubscription() external; // Must only be called by a subscription contract

    function createSubscription(
        address _creator,
        string memory _name,
        bytes memory _signedMessage
    ) external; // Must only be called by a subscription contract
}
