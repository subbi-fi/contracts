// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/ERC20/IERC20.sol";
import "./interfaces/ISubscriptionConfig.sol";
import "./lib/ECDSA.sol";

contract Subscription {
    uint256 MAX_INT = type(uint256).max;
    ISubscriptionConfig private configContract;
    address private ownerAddress;
    uint256 public subscriptionCost;
    uint256 public billingFrequency;

    struct Subscriber {
        bool isSubscribed;
        uint256 lastPaymentDate;
    }
    mapping(address => Subscriber) private subscriberMap;

    constructor(
        address _configContract,
        address _ownerAddress,
        uint256 _subscriptionCost,
        uint256 _billingFrequency,
        bytes memory _signedMessage
    ) {
        address _signer = ECDSA.recover(
            ECDSA.toEthSignedMessageHash(abi.encodePacked(_ownerAddress)),
            _signedMessage
        );
        configContract = ISubscriptionConfig(_configContract);
        require(configContract.signer() == _signer, "Signer");

        ownerAddress = _ownerAddress;
        subscriptionCost = _subscriptionCost;
        billingFrequency = _billingFrequency;

        configContract.createSubscription(ownerAddress, _signedMessage);
    }

    modifier onlySubscriptionOwner() {
        require(msg.sender == ownerAddress, "Ownership");
        _;
    }

    function isSubscribed(address _address) external view returns (bool) {
        return subscriberMap[_address].isSubscribed;
    }

    function lastPaymentDate(address _address) external view returns (uint256) {
        return subscriberMap[_address].lastPaymentDate;
    }

    function deleteSubscriptionContract() external onlySubscriptionOwner {
        configContract.deleteSubscription();
        selfdestruct(payable(ownerAddress));
    }

    function subscribe() external {
        require(!subscriberMap[msg.sender].isSubscribed, "Subscribed");

        takePayment(msg.sender);
        subscriberMap[msg.sender] = Subscriber(true, block.timestamp);
        configContract.emitSubscription(msg.sender);
    }

    function cancelSubscription() external {
        require(subscriberMap[msg.sender].isSubscribed, "Not Subscribed");
        subscriberMap[msg.sender].isSubscribed = false;
        configContract.emitCancelSubscription(msg.sender);
    }

    function processPayment(address _subscriber) external {
        require(subscriberMap[_subscriber].isSubscribed, "Not Subscribed");
        require(
            subscriberMap[_subscriber].lastPaymentDate + billingFrequency <=
                block.timestamp,
            "No Payment Due"
        );

        if (canTakePayment(_subscriber)) {
            takePayment(_subscriber);
            subscriberMap[_subscriber].lastPaymentDate = block.timestamp;
        } else {
            subscriberMap[_subscriber].isSubscribed = false;
            configContract.emitCancelSubscription(msg.sender);
        }
    }

    function canTakePayment(address _subscriber) private view returns (bool) {
        IERC20 usdc = IERC20(configContract.USDCAddress());
        return
            usdc.allowance(_subscriber, address(this)) == MAX_INT &&
            usdc.balanceOf(_subscriber) >= subscriptionCost;
    }

    function takePayment(address _subscriber) private {
        require(canTakePayment(_subscriber), "Payment Impossible");
        IERC20 usdc = IERC20(configContract.USDCAddress());

        uint256 fee = (subscriptionCost / 100) * configContract.fee(); // do a max calculation here
        usdc.transferFrom(_subscriber, configContract.owner(), fee);
        usdc.transferFrom(_subscriber, ownerAddress, subscriptionCost - fee);
    }
}
