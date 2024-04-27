import { newMockEvent } from "matchstick-as"
import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts"
import {
  Approval,
  ApprovalForAll,
  BaseURISet,
  BaseURLSet,
  ChestOpened,
  GameDifficultySet,
  GameReset,
  MintFeeSet,
  MintKeyEvent,
  OwnershipHandoverCanceled,
  OwnershipHandoverRequested,
  OwnershipTransferred,
  ProtocolFeeDestinationSet,
  RevealedSet,
  SignerSet,
  Transfer
} from "../generated/SphereQuizGameNFT/SphereQuizGameNFT"

export function createApprovalEvent(
  owner: Address,
  approved: Address,
  tokenId: BigInt
): Approval {
  let approvalEvent = changetype<Approval>(newMockEvent())

  approvalEvent.parameters = new Array()

  approvalEvent.parameters.push(
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner))
  )
  approvalEvent.parameters.push(
    new ethereum.EventParam("approved", ethereum.Value.fromAddress(approved))
  )
  approvalEvent.parameters.push(
    new ethereum.EventParam(
      "tokenId",
      ethereum.Value.fromUnsignedBigInt(tokenId)
    )
  )

  return approvalEvent
}

export function createApprovalForAllEvent(
  owner: Address,
  operator: Address,
  approved: boolean
): ApprovalForAll {
  let approvalForAllEvent = changetype<ApprovalForAll>(newMockEvent())

  approvalForAllEvent.parameters = new Array()

  approvalForAllEvent.parameters.push(
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner))
  )
  approvalForAllEvent.parameters.push(
    new ethereum.EventParam("operator", ethereum.Value.fromAddress(operator))
  )
  approvalForAllEvent.parameters.push(
    new ethereum.EventParam("approved", ethereum.Value.fromBoolean(approved))
  )

  return approvalForAllEvent
}

export function createBaseURISetEvent(baseURI: string): BaseURISet {
  let baseUriSetEvent = changetype<BaseURISet>(newMockEvent())

  baseUriSetEvent.parameters = new Array()

  baseUriSetEvent.parameters.push(
    new ethereum.EventParam("baseURI", ethereum.Value.fromString(baseURI))
  )

  return baseUriSetEvent
}

export function createBaseURLSetEvent(baseURL: string): BaseURLSet {
  let baseUrlSetEvent = changetype<BaseURLSet>(newMockEvent())

  baseUrlSetEvent.parameters = new Array()

  baseUrlSetEvent.parameters.push(
    new ethereum.EventParam("baseURL", ethereum.Value.fromString(baseURL))
  )

  return baseUrlSetEvent
}

export function createChestOpenedEvent(
  player: Address,
  ethAmount: BigInt
): ChestOpened {
  let chestOpenedEvent = changetype<ChestOpened>(newMockEvent())

  chestOpenedEvent.parameters = new Array()

  chestOpenedEvent.parameters.push(
    new ethereum.EventParam("player", ethereum.Value.fromAddress(player))
  )
  chestOpenedEvent.parameters.push(
    new ethereum.EventParam(
      "ethAmount",
      ethereum.Value.fromUnsignedBigInt(ethAmount)
    )
  )

  return chestOpenedEvent
}

export function createGameDifficultySetEvent(
  gameDifficulty: BigInt
): GameDifficultySet {
  let gameDifficultySetEvent = changetype<GameDifficultySet>(newMockEvent())

  gameDifficultySetEvent.parameters = new Array()

  gameDifficultySetEvent.parameters.push(
    new ethereum.EventParam(
      "gameDifficulty",
      ethereum.Value.fromUnsignedBigInt(gameDifficulty)
    )
  )

  return gameDifficultySetEvent
}

export function createGameResetEvent(): GameReset {
  let gameResetEvent = changetype<GameReset>(newMockEvent())

  gameResetEvent.parameters = new Array()

  return gameResetEvent
}

export function createMintFeeSetEvent(mintFee: BigInt): MintFeeSet {
  let mintFeeSetEvent = changetype<MintFeeSet>(newMockEvent())

  mintFeeSetEvent.parameters = new Array()

  mintFeeSetEvent.parameters.push(
    new ethereum.EventParam(
      "mintFee",
      ethereum.Value.fromUnsignedBigInt(mintFee)
    )
  )

  return mintFeeSetEvent
}

export function createMintKeyEventEvent(
  to: Address,
  player: Address,
  tokenId: BigInt,
  keyId: BigInt,
  score: BigInt
): MintKeyEvent {
  let mintKeyEventEvent = changetype<MintKeyEvent>(newMockEvent())

  mintKeyEventEvent.parameters = new Array()

  mintKeyEventEvent.parameters.push(
    new ethereum.EventParam("to", ethereum.Value.fromAddress(to))
  )
  mintKeyEventEvent.parameters.push(
    new ethereum.EventParam("player", ethereum.Value.fromAddress(player))
  )
  mintKeyEventEvent.parameters.push(
    new ethereum.EventParam(
      "tokenId",
      ethereum.Value.fromUnsignedBigInt(tokenId)
    )
  )
  mintKeyEventEvent.parameters.push(
    new ethereum.EventParam("keyId", ethereum.Value.fromUnsignedBigInt(keyId))
  )
  mintKeyEventEvent.parameters.push(
    new ethereum.EventParam("score", ethereum.Value.fromUnsignedBigInt(score))
  )

  return mintKeyEventEvent
}

export function createOwnershipHandoverCanceledEvent(
  pendingOwner: Address
): OwnershipHandoverCanceled {
  let ownershipHandoverCanceledEvent = changetype<OwnershipHandoverCanceled>(
    newMockEvent()
  )

  ownershipHandoverCanceledEvent.parameters = new Array()

  ownershipHandoverCanceledEvent.parameters.push(
    new ethereum.EventParam(
      "pendingOwner",
      ethereum.Value.fromAddress(pendingOwner)
    )
  )

  return ownershipHandoverCanceledEvent
}

export function createOwnershipHandoverRequestedEvent(
  pendingOwner: Address
): OwnershipHandoverRequested {
  let ownershipHandoverRequestedEvent = changetype<OwnershipHandoverRequested>(
    newMockEvent()
  )

  ownershipHandoverRequestedEvent.parameters = new Array()

  ownershipHandoverRequestedEvent.parameters.push(
    new ethereum.EventParam(
      "pendingOwner",
      ethereum.Value.fromAddress(pendingOwner)
    )
  )

  return ownershipHandoverRequestedEvent
}

export function createOwnershipTransferredEvent(
  oldOwner: Address,
  newOwner: Address
): OwnershipTransferred {
  let ownershipTransferredEvent = changetype<OwnershipTransferred>(
    newMockEvent()
  )

  ownershipTransferredEvent.parameters = new Array()

  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam("oldOwner", ethereum.Value.fromAddress(oldOwner))
  )
  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam("newOwner", ethereum.Value.fromAddress(newOwner))
  )

  return ownershipTransferredEvent
}

export function createProtocolFeeDestinationSetEvent(
  protocolFeeDestination: Address
): ProtocolFeeDestinationSet {
  let protocolFeeDestinationSetEvent = changetype<ProtocolFeeDestinationSet>(
    newMockEvent()
  )

  protocolFeeDestinationSetEvent.parameters = new Array()

  protocolFeeDestinationSetEvent.parameters.push(
    new ethereum.EventParam(
      "protocolFeeDestination",
      ethereum.Value.fromAddress(protocolFeeDestination)
    )
  )

  return protocolFeeDestinationSetEvent
}

export function createRevealedSetEvent(revealed: boolean): RevealedSet {
  let revealedSetEvent = changetype<RevealedSet>(newMockEvent())

  revealedSetEvent.parameters = new Array()

  revealedSetEvent.parameters.push(
    new ethereum.EventParam("revealed", ethereum.Value.fromBoolean(revealed))
  )

  return revealedSetEvent
}

export function createSignerSetEvent(
  oldSigner: Address,
  newSigner: Address
): SignerSet {
  let signerSetEvent = changetype<SignerSet>(newMockEvent())

  signerSetEvent.parameters = new Array()

  signerSetEvent.parameters.push(
    new ethereum.EventParam("oldSigner", ethereum.Value.fromAddress(oldSigner))
  )
  signerSetEvent.parameters.push(
    new ethereum.EventParam("newSigner", ethereum.Value.fromAddress(newSigner))
  )

  return signerSetEvent
}

export function createTransferEvent(
  from: Address,
  to: Address,
  tokenId: BigInt
): Transfer {
  let transferEvent = changetype<Transfer>(newMockEvent())

  transferEvent.parameters = new Array()

  transferEvent.parameters.push(
    new ethereum.EventParam("from", ethereum.Value.fromAddress(from))
  )
  transferEvent.parameters.push(
    new ethereum.EventParam("to", ethereum.Value.fromAddress(to))
  )
  transferEvent.parameters.push(
    new ethereum.EventParam(
      "tokenId",
      ethereum.Value.fromUnsignedBigInt(tokenId)
    )
  )

  return transferEvent
}
