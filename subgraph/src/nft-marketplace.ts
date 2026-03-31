import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
    ItemBought as ItemBoughtEvent,
    ItemCanceled as ItemCanceledEvent,
    ItemListed as ItemListedEvent
} from "../generated/NftMarketplace/NftMarketplace"
import { ItemListed, ItemCanceled, ActiveItem, ItemBought } from "../generated/schema";
import { store } from "@graphprotocol/graph-ts"

export function handleItemListed(event: ItemListedEvent): void {
    let id = getIdFromEventParams(
        event.params.tokenId,
        event.params.nftAddress
    )
    // Save event history
    let itemListed = new ItemListed(
        event.transaction.hash.concatI32(event.logIndex.toI32())
    )
    itemListed.seller = event.params.seller
    itemListed.nftAddress = event.params.nftAddress
    itemListed.tokenId = event.params.tokenId
    itemListed.price = event.params.price
    itemListed.save()

    // Save current state
    let activeItem = new ActiveItem(id)
    activeItem.seller = event.params.seller
    activeItem.nftAddress = event.params.nftAddress
    activeItem.tokenId = event.params.tokenId
    activeItem.price = event.params.price
    activeItem.save()
}

export function handleItemBought(event: ItemBoughtEvent): void {
    let id = getIdFromEventParams(
        event.params.tokenId,
        event.params.nftAddress
    )
    // Save event history
    let itemBought = new ItemBought(
        event.transaction.hash.concatI32(event.logIndex.toI32())
    )

    itemBought.buyer = event.params.buyer
    itemBought.nftAddress = event.params.nftAddress
    itemBought.tokenId = event.params.tokenId
    itemBought.price = event.params.price
    itemBought.save()

    // remove from the active items
    store.remove("ActiveItem", id)
}

export function handleItemCanceled(event: ItemCanceledEvent): void {
    let id = getIdFromEventParams(
        event.params.tokenId,
        event.params.nftAddress
    )

    // save event history
    let itemCanceled = new ItemCanceled(
        event.transaction.hash.concatI32(event.logIndex.toI32())
    )

    itemCanceled.seller = event.params.seller
    itemCanceled.nftAddress = event.params.nftAddress
    itemCanceled.tokenId = event.params.tokenId
    itemCanceled.save()

    // remove from the active items
    store.remove("ActiveItem", id)
}

function getIdFromEventParams(tokenId: BigInt, nftAddress: Address): string {
    return nftAddress.toHexString().concat("-").concat(tokenId.toString())
}