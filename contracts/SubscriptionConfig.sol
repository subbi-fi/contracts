// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/ISubscriptionConfig.sol";
import "./utils/Ownable.sol";
import "./lib/ECDSA.sol";

contract SubscriptionConfig is ISubscriptionConfig, Ownable {
    address _signer;
    address _usdcAddress;
    uint256 _fee;
    mapping(address => bool) subscriptionContracts;

    constructor() {}

    modifier onlySubscriptionContract() {
        require(subscriptionContracts[msg.sender], "Not Subscription");
        _;
    }

    function signer() external view override returns (address) {
        return _signer;
    }

    function USDCAddress() external view override returns (address) {
        return _usdcAddress;
    }

    function fee() external view override returns (uint256) {
        return _fee;
    }

    function owner()
        public
        view
        override(ISubscriptionConfig, Ownable)
        returns (address)
    {
        return Ownable.owner();
    }

    function setSigner(address signer_) external onlyOwner {
        _signer = signer_;
    }

    function setUSDCAddress(address usdc) external onlyOwner {
        _usdcAddress = usdc;
    }

    function setFee(uint256 fee_) external onlyOwner {
        _fee = fee_;
    }

    function emitSubscription(address _subscriber)
        external
        override
        onlySubscriptionContract
    {
        emit Subscribed(_subscriber, msg.sender);
    }

    function emitSubscriptionPayment(address _subscriber, uint256 _amount)
        external
        override
        onlySubscriptionContract
    {
        emit SubscriptionPayment(msg.sender, _subscriber, _amount);
    }

    function emitCancelSubscription(address _subscriber)
        external
        override
        onlySubscriptionContract
    {
        emit CancelSubscription(_subscriber, msg.sender);
    }

    function deleteSubscription() external override onlySubscriptionContract {
        subscriptionContracts[msg.sender] = false;
        emit DeleteSubscription(msg.sender);
    }

    function createSubscription(address _creator, bytes memory _signedMessage)
        external
        override
    {
        address signer_ = ECDSA.recover(
            ECDSA.toEthSignedMessageHash(abi.encodePacked(_creator)),
            _signedMessage
        );
        require(_signer == signer_, "Not permitted");

        subscriptionContracts[msg.sender] = true;
        emit SubscriptionCreation(msg.sender, _creator);
    }
}
