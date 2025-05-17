// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Escrow is Ownable, ReentrancyGuard {
    address public verifier;
    address public seller;
    IERC721 public nftContract;
    uint256 public tokenId;
    uint256 public price;
    address public buyer;
    bool public isTransactionSuccessful;
    bool public isApproved;

    event TransactionInitiated(
        address indexed buyer,
        address indexed seller,
        uint256 nftId,
        uint256 price
    );

    event TransactionCompleted(
        address indexed buyer,
        address indexed seller,
        uint256 nftId,
        uint256 price,
        uint256 timestamp
    );

    event TransactionRejected(
        address indexed buyer,
        address indexed seller,
        uint256 nftId
    );

    constructor(
        address _verifier,
        address _seller,
        address _nftContract,
        uint256 _tokenId,
        uint256 _price
    ) {
        verifier = _verifier;
        seller = _seller;
        nftContract = IERC721(_nftContract);
        tokenId = _tokenId;
        price = _price;
        isTransactionSuccessful = false;
        isApproved = false;
    }

    modifier onlyVerifier() {
        require(msg.sender == verifier, "Only verifier can approve the project");
        _;
    }

    function approveProject() public onlyVerifier {
        isApproved = true;
    }

    function purchaseProject() public payable nonReentrant {
        require(isApproved, "Project is not approved for sale");
        require(msg.value == price, "Incorrect payment amount");

        // Emit the TransactionInitiated event
        emit TransactionInitiated(msg.sender, seller, tokenId, price);

        // Check approval
        require(nftContract.getApproved(tokenId) == address(this), "Escrow contract not approved to transfer NFT");

        // Record the buyer address
        buyer = msg.sender;

        // Mark transaction as successful, but do not transfer NFT or funds yet
        isTransactionSuccessful = true;
    }

    function approveTransaction() public nonReentrant {
        require(isTransactionSuccessful, "Transaction has not been initiated");
        require(msg.sender == seller, "Only seller can approve");

        // Transfer NFT to buyer and funds to seller
        nftContract.safeTransferFrom(seller, buyer, tokenId);
        payable(seller).transfer(price);

        // Emit transaction completed event
        emit TransactionCompleted(buyer, seller, tokenId, price, block.timestamp);
    }

    function rejectTransaction() public nonReentrant {
        require(isTransactionSuccessful, "No transaction to reject");
        require(msg.sender == seller, "Only seller can reject");

        // Refund the buyer
        payable(buyer).transfer(price);

        // Emit transaction rejected event
        emit TransactionRejected(buyer, seller, tokenId);
    }
}
