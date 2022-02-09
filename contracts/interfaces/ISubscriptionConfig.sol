// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISubscriptionConfig {
    event Subscribed(address subscriber, address subscriptionContract);
    event CancelSubscription(address subscriber, address subscriptionContract);
    event SubscriptionCreation(address subscriptionContract, address owner);

    function signer() external view returns (address);

    function USDCAddress() external view returns (address);

    function fee() external view returns (uint256);

    function owner() external view returns (address);

    function emitSubscription(address _subscriber) external;

    function emitCancelSubscription(address _subscriber) external;

    function subscriptionCreation(address _owner, bytes memory _signedMessage)
        external;
}
