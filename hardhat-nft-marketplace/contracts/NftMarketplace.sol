//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// Create a decentralized NFT marketplace
// 1. `ListItem` : list NFT on market place  ✅
// 2. `buyItem` : Buy the NFTs
// 3. `cancelItem` : cancel a listing
// 4. `updateListing` : update Price
// 5. `withdrawProceeds` : withdraw payment for my bought NFTs

error NftMarketplace__PriceMustBeAboveZero();
error NftMarketplace__NotApprovedForMarketplace();
error NftMarketplace__AlreadyListed(address nftAddress, uint256 tokenId);
error NftMarketplace__NotOwner();
error NftMarketplace__NotListed(address nftAddress, uint256 tokenId);
error NftMarketplace__PriceNotMet(address nftAddress, uint256 tokenId, uint256 price);
error NftMarketplace__NoProceeds();
error NftMarketplace__TransferFailed();

contract NftMarketplace is ReentrancyGuard{

    struct Listing{   //approve
        uint256 price;
        address seller;
    }

    //////////////
    //  Events  //
    //////////////
    event ItemListed(address indexed seller, address indexed nftAddress, uint256 indexed tokenId, uint256 price);
    event ItemBought(address indexed buyer,address indexed nftAddress,uint256 tokenId, uint256 price);
    event ItemCanceled(address indexed seller,address indexed nftAddress,uint256 tokenId);

    // NFT contract address -> NFT TokenId -> Listing
    // (keeps track of which NFTs are listed for sale)
    mapping(address=>mapping(uint256 => Listing)) private s_listings;

    //seller address -> amount earned
    mapping(address=>uint256) private s_proceeds;


    /////////////////
    //  modifiers //
    ///////////////

    //making sure we don't relist the NFT which are already listed
    modifier notListed(address nftAddress,uint256 tokenId, address owner){
        Listing memory listing = s_listings[nftAddress][tokenId];
        if(listing.price > 0){
            revert NftMarketplace__AlreadyListed(nftAddress, tokenId);
        }
        _;
    }

    // NFT that being listed is owned by the msg.sender(owner)
    //owners of the NFT can be listed only
    modifier isOwner(address nftAddress, uint256 tokenId, address spender){
        IERC721 nft = IERC721(nftAddress);
        address owner = nft.ownerOf(tokenId);
        if (spender != owner){
            revert NftMarketplace__NotOwner();
        }
        _;
    }

    modifier isListed(address nftAddress, uint256 tokenId){
        //going to mapping and check the price
        Listing memory listing = s_listings[nftAddress][tokenId];
        if (listing.price <= 0){
            revert NftMarketplace__NotListed(nftAddress,tokenId);
        }
        _;
    }
    
      ////////////////////
     // Main Functions //
    ////////////////////
    
    /*
    * @notice Method for listing your NFT on the marketplace
    * @param nftAddress: Address for the nft
    * @param tokenId: Address of the NFT
    * @param price: sale price of the listed token
    * @dev technically, we could have contract be the escrow for the NFTs
    * but this way people can still hold their NFTs when listed
    */ 

    function listItem(
        address nftAddress,
        uint256 tokenId,
        uint256 price
        //Challenge: Have this contract accept payment in a subset of tokens as well
        //Hint: Use chainlink Pricefeed to convert the price of the tokens between each other
    )
        external
        notListed(nftAddress, tokenId, msg.sender) 
        isOwner(nftAddress, tokenId, msg.sender)
    {
            if (price<=0){
                revert NftMarketplace__PriceMustBeAboveZero();
        }
        // 1. send the NFT to the contract, Transfer -> contract hold the NFT
        // 2. owners can still hod the NFT, and give marketplace apporval 
        // to sell NFT for them
        IERC721 nft = IERC721(nftAddress);
        if (nft.getApproved(tokenId) != address(this)){
            revert NftMarketplace__NotApprovedForMarketplace();
        }
        s_listings[nftAddress][tokenId] = Listing(price, msg.sender);
        emit ItemListed(msg.sender,nftAddress,tokenId,price);
    }

    function buyItem(address nftAddress, uint256 tokenId) external payable nonReentrant
    isListed(nftAddress,tokenId){
        Listing memory listedItem = s_listings[nftAddress][tokenId];
        if(msg.value < listedItem.price) {
            revert NftMarketplace__PriceNotMet(nftAddress,tokenId, listedItem.price);
        }
        s_proceeds[listedItem.seller] = s_proceeds[listedItem.seller] + msg.value;
        delete (s_listings[nftAddress][tokenId]);
        IERC721(nftAddress).safeTransferFrom(listedItem.seller, msg.sender, tokenId);
        emit ItemBought(msg.sender, nftAddress, tokenId, listedItem.price);
        }
        
        function cancelListing(address nftAddress, uint256 tokenId) external 
        isOwner(nftAddress, tokenId, msg.sender)
        isListed(nftAddress, tokenId){
            delete (s_listings[nftAddress][tokenId]);
            emit ItemCanceled(msg.sender,nftAddress,tokenId);
        }

        function updateListing(
            address nftAddress,
            uint256 tokenId,
            uint256 newPrice
        ) external
        isListed(nftAddress, tokenId) 
        isOwner(nftAddress, tokenId, msg.sender){
            if (newPrice == 0){
                revert NftMarketplace__PriceMustBeAboveZero();
            }
            s_listings[nftAddress][tokenId].price = newPrice;
            emit ItemListed(msg.sender, nftAddress, tokenId, newPrice);
        } 

        function withdrawProceeds() external{
            uint256 proceeds = s_proceeds[msg.sender];
            if (proceeds <= 0){
                revert NftMarketplace__NoProceeds();
            }
            s_proceeds[msg.sender] = 0;
            (bool success,) = payable(msg.sender).call{value: proceeds}("");
            if(!success){
                revert NftMarketplace__TransferFailed();
            }
        }

    ///////////////////////
    // Getter Functions //
    //////////////////////

    function getListing(address nftAddress,uint256 tokenId) external view returns(Listing memory){
        return s_listings[nftAddress][tokenId];
    }

    function getProceeds(address seller) external view returns(uint256){
        return s_proceeds[seller]; 
    }
}
