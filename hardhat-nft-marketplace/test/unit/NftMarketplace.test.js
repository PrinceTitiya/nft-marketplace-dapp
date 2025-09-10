
const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Nft Marketplace Unit Tests", function () {
          let nftMarketplace, nftMarketplaceContract, basicNft, basicNftContract
          const PRICE = ethers.utils.parseEther("0.1")
          const TOKEN_ID = 0

          beforeEach(async () => {
              accounts = await ethers.getSigners() // could also do with getNamedAccounts
              deployer = accounts[0]
              user = accounts[1]
              await deployments.fixture(["all"])
              nftMarketplaceContract = await ethers.getContract("NftMarketplace")
              nftMarketplace = nftMarketplaceContract.connect(deployer)
              basicNftContract = await ethers.getContract("BasicNft")
              basicNft = basicNftContract.connect(deployer)
              await basicNft.mintNft()
              await basicNft.approve(nftMarketplaceContract.address, TOKEN_ID)
          })
          
          describe("listItem", function () {
            it("emits an event after listing an item", async function () {
                expect(await nftMarketplace.listItem(
                    basicNft.address,
                    TOKEN_ID,
                    PRICE)
                ).to.emit("ItemListed")
            })

            it("Item already listed", async function(){
                await nftMarketplace.listItem(basicNft.address,TOKEN_ID,PRICE)
                const error = `'NftMarketplace__AlreadyListed("${basicNft.address}", ${TOKEN_ID})`
                await expect(
                    nftMarketplace.listItem(
                        basicNft.address,
                        TOKEN_ID,
                        PRICE
                    )
                ).to.be.revertedWith(error)
            })

            it("reverts if price is zero", async function(){
                await expect(
                    nftMarketplace.listItem(basicNft.address, TOKEN_ID, 0))
                    .to.be.revertedWith("NftMarketplace__PriceMustBeAboveZero()")
            })

            it("reverts if NFT is not approved", async function(){
                const newTokenId = 1          // tokenId which was not approved initially in beforeEach hook
                await basicNft.mintNft()
                await expect(
                    nftMarketplace.listItem(basicNft.address, newTokenId, PRICE)
                ).to.be.revertedWith(
                    "NftMarketplace__NotApprovedForMarketplace()"
                )
            })

            it("stores listing info correctly",async function(){
                await nftMarketplace.listItem(basicNft.address,TOKEN_ID, PRICE)
                const listing = await nftMarketplace.getListing(basicNft.address,TOKEN_ID)
                assert.equal(listing.price.toString(),PRICE.toString())
                assert.equal(listing.seller,deployer.address)
            })
        })
        
        describe("buyItem",function(){

            it("revert if item not listed", async function(){
                await expect(
                    nftMarketplace.buyItem(basicNft.address,TOKEN_ID)
                ).to.be.revertedWith(`NftMarketplace__NotListed("${basicNft.address}", ${TOKEN_ID})`)
            })

            it("reverts if price not met", async function(){
                    await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                    await expect(
                        nftMarketplace.buyItem(basicNft.address, TOKEN_ID)
                    ).to.be.revertedWith("PriceNotMet")
                })

            it("user passes the lesser price than listed", async function(){
                await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)     //ListedPrice = 0.1
                const userConnectedMarketPlace = nftMarketplace.connect(user)       

                await expect(
                    userConnectedMarketPlace.buyItem(
                        basicNft.address,
                        TOKEN_ID,
                        {value: ethers.utils.parseEther("0.04")}            //User_price = 0.01
                    )
                ).to.be.revertedWith("NftMarketplace__PriceNotMet")
            })

            it("transfers the nft to the buyer and updates internal proceeds record", async function(){
                await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                nftMarketplace = nftMarketplaceContract.connect(user)

                await expect(
                     nftMarketplace.buyItem(
                        basicNft.address,
                        TOKEN_ID,
                        { value: PRICE }
                    )
                ).to.emit(nftMarketplace,"ItemBought")
                const newOwner = await basicNft.ownerOf(TOKEN_ID)
                const deployerProceeds = await nftMarketplace.getProceeds(deployer.address)
                assert(newOwner.toString() == user.address)
                assert(deployerProceeds.toString() == PRICE.toString())
            })
        })

        describe("updateListing", function (){
            
            it("must be owner and listing", async function(){
                await expect(
                    nftMarketplace.updateListing(basicNft.address, TOKEN_ID, PRICE)
                ).to.be.revertedWith("NotListed")
                await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                nftMarketplace = nftMarketplaceContract.connect(user)
                await expect(
                    nftMarketplace.updateListing(basicNft.address, TOKEN_ID, PRICE)
                ).to.be.revertedWith("NotOwner")
            })

            it("reverts if new price is 0",async function(){
                const updatedPrice = ethers.utils.parseEther("0")
                await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                await expect(
                    nftMarketplace.updateListing(
                        basicNft.address,
                        TOKEN_ID,
                        updatedPrice)
                    ).to.be.revertedWith("PriceMustBeAboveZero")
            })

            it("updates the price of item", async function(){
                const updatedPrice = ethers.utils.parseEther("0.2")
                await nftMarketplace.listItem(basicNft.address,TOKEN_ID,PRICE)
                expect(
                    await nftMarketplace.updateListing(
                        basicNft.address, TOKEN_ID, updatedPrice)
                ).to.emit("ItemListed")

                const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                assert(listing.price.toString() == updatedPrice.toString())
            })  
        })

        describe("withdrawProceeds", function(){

            it("does't allowed 0 proceed withdrawls",async function(){
                await expect(
                    nftMarketplace.withdrawProceeds()
                ).to.be.revertedWith("NoProceeds")
            })

            it("withdraw proceeds",async function(){
                await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                nftMarketplace = nftMarketplaceContract.connect(user)
                nftMarketplace.buyItem(basicNft.address,TOKEN_ID,{value: PRICE})
                nftMarketplace = nftMarketplaceContract.connect(deployer)

                const deployerProceedsBefore = await nftMarketplace.getProceeds(deployer.address)
                const deployerBalanceBefore = await deployer.getBalance()
                const txResponse = await nftMarketplace.withdrawProceeds()
                const transactionReceipt = await txResponse.wait(1)
                const { gasUsed, effectiveGasPrice } = transactionReceipt
                const gasCost =gasUsed.mul(effectiveGasPrice)
                const deployerBalanceAfter = await deployer.getBalance()

                assert(
                    deployerBalanceAfter.add(gasCost).toString() ==
                    deployerProceedsBefore.add(deployerBalanceBefore).toString()
                )
            })
        })

        describe("cancelListing",function(){

            it("emits ItemCanceled when listing is canceled", async function(){
                await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                await expect(
                    nftMarketplace.cancelListing(basicNft.address, TOKEN_ID) // do NOT await here
                ).to.emit(nftMarketplace, "ItemCanceled") // pass contract, then event name
            })
        })
    })
 