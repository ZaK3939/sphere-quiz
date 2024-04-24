// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.23;

import { console2 } from "forge-std/console2.sol";

import { Test } from "forge-std/Test.sol";

import { SphereQuizGameNFT} from "../src/SphereQuizGameNFT.sol";

interface IERC1155 {
    function balanceOf(address account, uint256 id) external view returns (uint256);
}

contract SphereQuizGameNFTTest is Test {
    SphereQuizGameNFT public demo1155;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal anyone = makeAddr("anyone");
    address internal signer;
    uint256 internal signerPk;

    error Unauthorized();

    function setUp() public {
        (signer, signerPk) = makeAddrAndKey("signer");
        console2.log("signer", signer);
        demo1155 = new SphereQuizGameNFT(signer);
    }

    function testFuzz_mint_validSig() public {
        bytes memory sig = _signMint(signerPk, alice,  10);

        vm.prank(alice);
        demo1155.mint{ value: demo1155.mintFee() }(alice,  10, sig);

        assertEq(demo1155.hasMinted(alice), true);
        assertEq(demo1155.balanceOf(alice, 1), 1);
        assertEq(demo1155.totalSupply(), 1);
        (uint256 score, uint256 timestamp)= demo1155.getScoreData(alice);
        assertEq(score, 10);
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
            demo1155.hashTypedData(keccak256(abi.encode(demo1155.MINT_TYPEHASH(), to, score)));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        signature = abi.encodePacked(r, s, v);
        assertEq(signature.length, 65);
    }
}
