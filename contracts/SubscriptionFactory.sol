// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Subscription.sol";
import "./utils/Ownable.sol";

contract SubscriptionFactory is Ownable {
    Subscription[] private subscriptions;
    address private configContract;
    uint256 private minCost;
    uint256 private billingFrequency;

    constructor(
        address _configContract,
        uint256 _minCost,
        uint256 _billingFrequency
    ) {
        configContract = _configContract;
        minCost = _minCost;
        billingFrequency = _billingFrequency;
    }

    function setMinCost(uint256 _newMinCost) external onlyOwner {
        minCost = _newMinCost;
    }

    function setConfigContract(address _newConfigContract) external onlyOwner {
        configContract = _newConfigContract;
    }

    function createSubscription(
        uint256 _subscriptionCost,
        string memory _subscriptionName,
        bytes memory _signedMessage
    ) public {
        require(_subscriptionCost >= minCost, "Below Min Cost");
        Subscription newSubscription = new Subscription(
            configContract,
            msg.sender,
            _subscriptionCost,
            billingFrequency,
            _subscriptionName,
            _signedMessage
        );

        subscriptions.push(newSubscription);
    }

    function allSubscriptions()
        public
        view
        returns (Subscription[] memory subs)
    {
        return subscriptions;
    }
}
