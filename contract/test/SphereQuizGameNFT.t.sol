// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.23;

import { console2 } from "forge-std/console2.sol";

import { Test } from "forge-std/Test.sol";

import { SphereQuizGameNFT} from "../src/SphereQuizGameNFT.sol";

interface IERC1155 {
    function balanceOf(address account, uint256 id) external view returns (uint256);
}

contract SphereQuizGameNFTTest is Test {
    SphereQuizGameNFT public demo721;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal anyone = makeAddr("anyone");
    address internal signer;
    uint256 internal signerPk;

    error Unauthorized();

    function setUp() public {
        (signer, signerPk) = makeAddrAndKey("signer");
        console2.log("signer", signer);
        demo721 = new SphereQuizGameNFT(signer,signer);
    }

    function testFuzz_mint_validSig() public {
        vm.prank(signer);
        demo721.setGameDifficulty(5);
        bytes memory sig = _signMint(signerPk, alice,  10);

        vm.prank(alice);
        demo721.mint{ value: demo721.mintFee() }(alice,  10, sig);
        uint256 gameRound = demo721.gameRound();
        assertEq(demo721.gameCleared(alice, gameRound), true);
        assertEq(demo721.balanceOf(alice), 1);
        assertEq(demo721.currentTokenId(), 1);
        assertEq(demo721.bossHP(), 520);
        assertEq(demo721.accumulatedETH(), demo721.mintFee());
        (uint256 score, uint256 timestamp)= demo721.getScoreData(alice, gameRound);
        assertEq(score, 10);
        assertEq(demo721.chestKey(),2);

        // console2.log("token URI", demo721.tokenURI(1));
        console2.log(demo721.getPlayerKeys(alice)[0]);

        bytes memory sig2 = _signMint(signerPk, alice,  20);
        demo721.mint{ value: demo721.mintFee() }(alice,  20, sig2);
        assertEq(demo721.balanceOf(alice), 2);
        assertEq(demo721.currentTokenId(), 2);
        assertEq(demo721.bossHP(), 540);
        assertEq(demo721.accumulatedETH(), demo721.mintFee()*2);
        (score, timestamp)= demo721.getScoreData(alice, gameRound);
        console2.log(demo721.getPlayerKeys(alice)[1]);
        
        bytes memory sig3 = _signMint(signerPk, alice,  11);
        demo721.mint{ value: demo721.mintFee() }(alice,  11, sig3);
        assertEq(demo721.balanceOf(alice), 3);
        assertEq(demo721.currentTokenId(), 3);
        assertEq(demo721.bossHP(), 560);
        assertEq(demo721.accumulatedETH(), demo721.mintFee()*3);
        (score, timestamp)= demo721.getScoreData(alice, gameRound);
        console2.log(demo721.getPlayerKeys(alice)[2]);

        // bingo
        bytes memory sig4 = _signMint(signerPk, alice,  12);
        demo721.mint{ value: demo721.mintFee() }(alice,  12, sig4);
        assertEq(demo721.balanceOf(alice), 0);
        assertEq(demo721.currentTokenId(), 0);
        assertEq(demo721.bossHP(), 500);
        assertEq(demo721.accumulatedETH(), 0);
        (score, timestamp)= demo721.getScoreData(alice, gameRound);
        assertEq(score, 12);
        assertEq(demo721.gameCleared(alice, gameRound),  true);
        assertEq(demo721.gameCleared(alice, 2), false);
        assertEq(demo721.getPlayerKeys(alice).length, 0);
        assertEq(demo721.chestKey(),1);
        
    }

    function _signMint(
        uint256 pk,
        address to,
        uint256 score
    )
        public
        returns (bytes memory signature)
    {
        bytes32 digest =
            demo721.hashTypedData(keccak256(abi.encode(demo721.MINT_TYPEHASH(), to, score)));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        signature = abi.encodePacked(r, s, v);
        assertEq(signature.length, 65);
    }
}
