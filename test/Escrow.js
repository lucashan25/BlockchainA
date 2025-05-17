const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Escrow Contract", function () {
    let Escrow, escrow, CarbonOffset, carbonOffset;
    let owner, buyer, seller;

    beforeEach(async function () {
        [owner, buyer, seller] = await ethers.getSigners(); // Get the accounts

        // Deploy CarbonOffset contract (NFT contract)
        CarbonOffset = await ethers.getContractFactory("CarbonOffset");
        carbonOffset = await CarbonOffset.deploy();
        await carbonOffset.deployed();

        // Mint an NFT for the seller
        const tokenURI = "ipfs://example_token_uri"; // This should be connected to IPFS
        await carbonOffset.mintToken(seller.address, tokenURI);

        // Deploy Escrow contract with necessary parameters
        Escrow = await ethers.getContractFactory("Escrow");
        escrow = await Escrow.deploy(
            owner.address,             // Verifier (owner)
            seller.address,            // Seller
            carbonOffset.address,      // NFT contract address
            0,                         // Token ID
            ethers.utils.parseEther("1.0") // Price in ether
        );
        await escrow.deployed();

        // Seller approves the Escrow contract to transfer the NFT
        await carbonOffset.connect(seller).approve(escrow.address, 0);
    });

    it("Should allow the verifier (owner) to approve the project", async function () {
        // Verifier approves the project
        await escrow.connect(owner).approveProject();

        // Check if the project is marked as approved
        const isApproved = await escrow.isApproved();
        expect(isApproved).to.be.true;
    });

    it("Should allow the buyer to initiate the transaction with correct payment after approval", async function () {
        // Verifier approves the project
        await escrow.connect(owner).approveProject();

        // Buyer initiates the transaction by calling purchaseProject
        const tx = await escrow.connect(buyer).purchaseProject({
            value: ethers.utils.parseEther("1.0"),
        });

        // Check the event was emitted
        await expect(tx).to.emit(escrow, "TransactionInitiated");

        // Ensure that at this point the seller is still the owner of the NFT
        const currentOwner = await carbonOffset.ownerOf(0);
        expect(currentOwner).to.equal(seller.address); // Seller still owns the NFT until the transaction is approved
    });

    it("Should complete the transaction when the seller approves", async function () {
        // Verifier approves the project
        await escrow.connect(owner).approveProject();

        // Get the seller's balance before the transaction
        const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);

        // Buyer initiates the transaction by calling purchaseProject
        await escrow.connect(buyer).purchaseProject({
            value: ethers.utils.parseEther("1.0"),
        });

        // Seller approves the transaction
        const tx = await escrow.connect(seller).approveTransaction();
        const receipt = await tx.wait();

        // Calculate gas used in the transaction
        const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);

        // Verify that the buyer now owns the NFT
        const newOwner = await carbonOffset.ownerOf(0);
        expect(newOwner).to.equal(buyer.address);

        // Verify that the seller received the correct amount of Ether minus gas fees
        const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
        expect(sellerBalanceAfter).to.equal(sellerBalanceBefore.add(ethers.utils.parseEther("1.0")).sub(gasUsed));
    });

    it("Should reject the transaction and refund the buyer if the seller rejects", async function () {
        // Verifier approves the project
        await escrow.connect(owner).approveProject();

        // Buyer initiates the transaction by calling purchaseProject
        await escrow.connect(buyer).purchaseProject({
            value: ethers.utils.parseEther("1.0"),
        });

        // Seller rejects the transaction
        await escrow.connect(seller).rejectTransaction();

        // Verify that the escrow balance is 0 (buyer was refunded)
        const escrowBalance = await ethers.provider.getBalance(escrow.address);
        expect(escrowBalance).to.equal(0);

        // Verify that the buyer received the refund
        const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
        expect(buyerBalanceAfter.gt(ethers.utils.parseEther("99.0"))).to.equal(true); // Account for gas fees
    });

    it("Should fail if the buyer sends incorrect payment", async function () {
        // Verifier approves the project
        await escrow.connect(owner).approveProject();

        // Attempt to initiate transaction with wrong amount
        await expect(
            escrow.connect(buyer).purchaseProject({
                value: ethers.utils.parseEther("0.5"), // Sending incorrect payment
            })
        ).to.be.revertedWith("Incorrect payment amount");
    });

    it("Should fail if the contract is not approved to transfer the NFT", async function () {
        // Verifier approves the project
        await escrow.connect(owner).approveProject();

        // Buyer initiates the transaction by calling purchaseProject
        await escrow.connect(buyer).purchaseProject({
            value: ethers.utils.parseEther("1.0"),
        });

        // Revoke approval so the escrow contract cannot transfer the NFT
        await carbonOffset.connect(seller).approve(ethers.constants.AddressZero, 0);

        // Attempt to approve the transaction (this should now revert due to missing approval)
        await expect(
            escrow.connect(seller).approveTransaction()
        ).to.be.revertedWith("ERC721: caller is not token owner or approved");
    });
});
