// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import { AggregatorV3Interface } from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract BossStats {
    AggregatorV3Interface internal ethPriceFeed;
    AggregatorV3Interface internal ethVolatilityFeed;
    AggregatorV3Interface internal btcEthPriceFeed;

    /**
     * Network: Sepolia
     * Aggregator: ETH/USD
     * Address: 0x694AA1769357215DE4FAC081bf1f309aDC325306
     *
     * Aggregator: ETH-USD 24hr Realized Volatility
     * Address: 0x31D04174D0e1643963b38d87f26b0675Bb7dC96e
     *
     * Aggregator: BTC/ETH
     * Address: 0x5fb1616F78dA7aFC9FF79e0371741a747D2a7F22
     */
    constructor() {
        ethPriceFeed = AggregatorV3Interface(0x694AA1769357215DE4FAC081bf1f309aDC325306);
        ethVolatilityFeed = AggregatorV3Interface(0x31D04174D0e1643963b38d87f26b0675Bb7dC96e);
        btcEthPriceFeed = AggregatorV3Interface(0x5fb1616F78dA7aFC9FF79e0371741a747D2a7F22);
    }

    /**
     * Returns the latest ETH/USD price.
     */
    function getLatestEthPrice() public view returns (int256) {
        (
            uint80 roundID,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = ethPriceFeed.latestRoundData();
        return answer;
    }

    /**
     * Returns the latest 24hr Realized Volatility for ETH/USD.
     */
    function getLatestEthVolatility() public view returns (uint256) {
        (
            uint80 roundID,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = ethVolatilityFeed.latestRoundData();
        return uint256(answer);
    }

    /**
     * Returns the latest BTC/ETH price.
     */
    function getLatestBtcEthPrice() public view returns (int256) {
        (
            uint80 roundID,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = btcEthPriceFeed.latestRoundData();
        return answer;
    }

    /**
     * Returns the adjusted volatility (between 0 and 50).
     */
    function getAdjustedVolatility() public view returns (uint256) {
        uint256 ethVolatility = getLatestEthVolatility();
        uint256 adjustedVolatility = ethVolatility / 1000; // Divide by 1000 to get a value between 0 and 50
        
        if (adjustedVolatility > 50) {
            return 50;
        } else {
            return adjustedVolatility;
        }
    }

    /**
     * Returns the base attack power from ETH price (1/100 of ETH price).
     */
    function getBaseAttackPower() public view returns (uint256) {
        int256 ethPrice = getLatestEthPrice();
        return uint256(ethPrice) / 100000000;
    }

    /**
     * Returns the overall attack parameter (between 50 and 120).
     */
    function getOverallAttackParameter() public view returns (uint256) {
        int256 btcEthPrice = getLatestBtcEthPrice();
        uint256 seed = uint256(keccak256(abi.encodePacked(btcEthPrice)));
        uint256 randomNumber = (seed % 71) + 50; // Generate a random number between 50 and 120
        return randomNumber; // Divide by 100 to get a value between 0.5 and 1.2
    }

    /**
     * Returns the base attack power, adjusted volatility, and overall attack parameter.
     */
    function getAttackParameters() public view returns (uint256 baseAttackPower, uint256 adjustedVolatility, uint256 overallAttackParameter) {
        baseAttackPower = getBaseAttackPower();
        adjustedVolatility = getAdjustedVolatility();
        overallAttackParameter = getOverallAttackParameter();
        
        return (baseAttackPower, adjustedVolatility, overallAttackParameter);
    }
}