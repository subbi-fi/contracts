// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISubscriptionConfig {
    event Subscribed(address subscriber, address subscriptionContract);
    event CancelSubscription(address subscriber, address subscriptionContract);
    event SubscriptionCreation(address subscriptionContract, address owner);
    event DeleteSubscription(address subscriptionContract);
    event SubscriptionPayment(
        address subscriptionContract,
        address subscriber,
        uint256 amount
    );

    function signer() external view returns (address);

    function USDCAddress() external view returns (address);

    function fee() external view returns (uint256);

    function owner() external view returns (address);

    function emitSubscription(address _subscriber) external; // Must only be called by a subscription contract

    function emitCancelSubscription(address _subscriber) external; // Must only be called by a subscription contract

    function emitSubscriptionPayment(address _subscriber, uint256 _amount)
        external;

    function deleteSubscription() external; // Must only be called by a subscription contract

    function createSubscription(address _creator, bytes memory _signedMessage)
        external; // Must only be called by a subscription contract
}
