// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/ISubscriptionConfig.sol";
import "./utils/Ownable.sol";
import "./lib/ECDSA.sol";

contract SubscriptionConfig is ISubscriptionConfig, Ownable {
    address _signer;
    address _usdcAddress;
    uint256 _baseFee;
    mapping(address => uint256) public subscriptionContractFee;
    mapping(address => bool) public subscriptionContracts;

    constructor(
        uint256 baseFee_,
        address usdcAddress_,
        address signer_
    ) {
        _baseFee = baseFee_;
        _usdcAddress = usdcAddress_;
        _signer = signer_;
    }

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

    function fee(address _subscriptionContract)
        external
        view
        override
        returns (uint256)
    {
        if (subscriptionContractFee[_subscriptionContract] > 0) {
            return subscriptionContractFee[_subscriptionContract];
        }
        return _baseFee;
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

    function setBaseFee(uint256 fee_) external onlyOwner {
        _baseFee = fee_;
    }

    function setFeeForContract(address _subscriptionContract, uint256 _fee)
        external
        onlyOwner
    {
        subscriptionContractFee[_subscriptionContract] = _fee;
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

    function createSubscription(
        address _creator,
        string memory _name,
        bytes memory _signedMessage
    ) external override {
        address signer_ = ECDSA.recover(
            ECDSA.toEthSignedMessageHash(abi.encodePacked(_creator, _name)),
            _signedMessage
        );
        require(_signer == signer_, "Not permitted");

        subscriptionContracts[msg.sender] = true;
        emit SubscriptionCreation(msg.sender, _creator, _name);
    }
}
