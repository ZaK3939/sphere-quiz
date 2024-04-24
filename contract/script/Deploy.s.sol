// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.23 <0.9.0;

import { console2 } from "forge-std/console2.sol";

import { Upgrades } from "openzeppelin-foundry-upgrades/Upgrades.sol";
import { SphereQuizGameNFT } from "../src/SphereQuizGameNFT.sol";

import { BaseScript } from "./Base.s.sol";

import { LibClone } from "solady/utils/LibClone.sol";

contract Deploy is BaseScript {
   
    address owner = 0x5037e7747fAa78fc0ECF8DFC526DcD19f73076ce;

    function setUp() public virtual {
        console2.log("Deploying from address: %s", broadcaster);
    }

    function run() public broadcast {
        
        new SphereQuizGameNFT(owner,broadcaster);
    }
}
