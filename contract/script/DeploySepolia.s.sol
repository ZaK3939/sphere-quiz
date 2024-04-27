// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.23 <0.9.0;

import { console2 } from "forge-std/console2.sol";

import { Upgrades } from "openzeppelin-foundry-upgrades/Upgrades.sol";
import { BossStats } from "../src/BossStats.sol";

import { BaseScript } from "./Base.s.sol";

import { LibClone } from "solady/utils/LibClone.sol";

contract Deploy is BaseScript {

    function setUp() public virtual {
        console2.log("Deploying from address: %s", broadcaster);
    }

    function run() public broadcast {

        new BossStats();
    }
}
