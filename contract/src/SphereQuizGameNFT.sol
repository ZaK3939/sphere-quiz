// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { EIP712 } from "solady/utils/EIP712.sol";
import { Ownable } from "solady/auth/Ownable.sol";
import { SignatureCheckerLib } from "solady/utils/SignatureCheckerLib.sol";
import { LibString } from "solady/utils/LibString.sol";
import { SafeTransferLib } from "solady/utils/SafeTransferLib.sol";
import { Base64 } from "solady/utils/Base64.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract SphereQuizGameNFT is Ownable, ERC721, EIP712 {
    /*//////////////////////////////////////////////////////////////
                                 USING
    //////////////////////////////////////////////////////////////*/
    using LibString for *;
    using SafeTransferLib for address;

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/
    error AlreadyMinted();
    error InvalidSignature();
    error InvalidMintFee();
    error TokenDoesNotExist();

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/
    uint256 public currentTokenId;
    address public signer;
    address public protocolFeeDestination;
    address public chestOwner;

    mapping(address => mapping(uint256 gameRound =>bool)) public cleared;
    mapping(address => mapping(uint256 gameRound => ScoreData)) public scoreData;
    mapping(address => uint256[] keys) public playerKeys;
    mapping(uint256 => uint256) public tokenIdtoKey;
    mapping(bytes => mapping(uint256 =>bool)) private usedSignatures;

    uint256 public mintFee;
    uint256 public bossHP;
    uint256 public accumulatedETH;
    uint256 public chestKey;
    uint256 public randomId;
    uint256 public gameRound;
    uint256 public gameDifficulty;

    struct ScoreData {
        uint256 score;
        uint256 timestamp;
    }

    uint256 public constant INITIAL_BOSS_HP = 500;
    uint256 public constant HP_INCREMENT_PER_MINT = 20;

    bytes32 public constant MINT_TYPEHASH = keccak256("Mint(address to,uint256 score)");

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/
    event BaseURISet(string baseURI);
    event BaseURLSet(string baseURL);
    event MintKeyEvent(address indexed to, address indexed player, uint256 tokenId,  uint256 keyId, uint256 score);
    event SignerSet(address oldSigner, address newSigner);
    event ProtocolFeeDestinationSet(address protocolFeeDestination);
    event MintFeeSet(uint256 mintFee);
    event RevealedSet(bool revealed);
    event GameDifficultySet(uint256 gameDifficulty);
    event ChestOpened(address indexed player, uint256 ethAmount);
    event GameReset();
    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    constructor(address ownerAddress_, address signer_) ERC721("SphereQuiz", "SPHERE") {
        _initializeOwner(ownerAddress_);
        signer = signer_;
        protocolFeeDestination = ownerAddress_;
        mintFee = 0.00001 ether;
        randomId = 0; // seed num
        gameRound = 1;
        gameDifficulty = 20;
        bossHP = INITIAL_BOSS_HP;
        chestKey = _generateKey();
    }

    /*//////////////////////////////////////////////////////////////
                            EXTERNAL UPDATE
    //////////////////////////////////////////////////////////////*/
    function mint(address to,  uint256 score, bytes calldata sig) external payable {
        if (!_verifySignature(to, score, sig)) {
            revert InvalidSignature();
        }
        if (msg.value < mintFee) {
            revert InvalidMintFee();
        }

        if (usedSignatures[sig][gameRound]) {
            revert InvalidSignature();
        }

        cleared[to][gameRound] = true;
        scoreData[to][gameRound] = ScoreData(score, block.timestamp);
        
        bossHP += HP_INCREMENT_PER_MINT;
        chestOwner = to;

        accumulatedETH += msg.value;

        uint256 keyId = _mintKey(to);
        playerKeys[to].push(keyId);
        tokenIdtoKey[currentTokenId] = keyId;

        emit MintKeyEvent(to, to, currentTokenId,keyId, score);
        usedSignatures[sig][gameRound] = true;

        openChest(to);
        
    }

    
    function openChest(address player) internal {
        if (canOpenChest(player)) {
            uint256 protocolFeeDestinationAmount = accumulatedETH / 10;
            uint256 ethAmount = accumulatedETH - protocolFeeDestinationAmount;
            protocolFeeDestination.safeTransferETH(protocolFeeDestinationAmount);
            player.safeTransferETH(ethAmount);

            emit ChestOpened(player, ethAmount);

            resetGame();
        } else {
            ++currentTokenId;
        }
    }

    /*//////////////////////////////////////////////////////////////
                                  SET
    //////////////////////////////////////////////////////////////*/
    function setSigner(address _signer) external onlyOwner {
        address oldSigner = signer;
        signer = _signer;
        emit SignerSet(oldSigner, _signer);
    }

    function setProtocolFeeDestination(address _protocolFeeDestination) external onlyOwner {
        protocolFeeDestination = _protocolFeeDestination;
        emit ProtocolFeeDestinationSet(_protocolFeeDestination);
    }

    function setMintFee(uint256 _mintFee) external onlyOwner {
        mintFee = _mintFee;
        emit MintFeeSet(_mintFee);
    }

    function setGameDifficulty(uint256 _gameDifficulty) external onlyOwner {
        gameDifficulty = _gameDifficulty;
        chestKey = _generateKey();
        emit GameDifficultySet(_gameDifficulty);

    }
    /*//////////////////////////////////////////////////////////////
                         EXTERNAL VIEW
    //////////////////////////////////////////////////////////////*/
    function tokenURI(uint256 tokenId) public view override returns (string memory) {

        string memory keyNumber = tokenIdtoKey[tokenId].toString();
        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMinYMin meet" viewBox="0 0 350 350">',
            '<style>.base { fill: white; font-family: serif; font-size: 24px; }</style>',
            '<rect width="100%" height="100%" fill="black" />',
            '<text x="50%" y="50%" class="base" dominant-baseline="middle" text-anchor="middle">',
            'Key #',
            keyNumber,
            '</text>',
            '</svg>'
        ));

        string memory json = string(abi.encodePacked(
            '{"name": "Key #',
            keyNumber,
            '", "description": "A simple key with a number.", "image": "data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '"}'
        ));

        return string(abi.encodePacked(
            'data:application/json;base64,',
            Base64.encode(bytes(json))
        ));
    }

    function hashTypedData(bytes32 structHash) public view returns (bytes32) {
        return _hashTypedData(structHash);
    }

    function getScoreData(address player,uint256 _gameRound) public view returns (uint256 score, uint256 timestamp) {
        return (scoreData[player][_gameRound].score, scoreData[player][gameRound].timestamp);
    }

    function gameCleared(address player, uint256 _gameRound) public view returns (bool) {
        return cleared[player][_gameRound];
    }

    function getPlayerKeys(address player) public view returns (uint256[] memory) {
        return playerKeys[player];
    }   

    /*//////////////////////////////////////////////////////////////
                            INTERNAL UPDATE
    //////////////////////////////////////////////////////////////*/
    function canOpenChest(address player) internal view returns (bool) {
        uint256[] memory keys = playerKeys[player];
        for (uint256 i = 0; i < keys.length; i++) {
            if (keys[i] == chestKey) return true;
        }
        return false;
    }

    function resetGame() internal {
        bossHP = INITIAL_BOSS_HP;
        
        for (uint256 i = 0; i <= currentTokenId; i++) {
            
            address player = ownerOf(i);
            _burn(i);
            delete playerKeys[player];
        }

        for (uint256 i = 0; i <= currentTokenId; i++) {
            delete tokenIdtoKey[i];
        }

        chestKey = _generateKey();
        accumulatedETH = 0;
        currentTokenId = 0;
        gameRound++;
        emit GameReset();
    }

    function _generateKey() internal returns (uint256) {
        randomId++;
        return (uint256(keccak256(abi.encodePacked(randomId, block.prevrandao, block.timestamp, tx.origin))) % gameDifficulty) + 1;
    }

    function _mintKey(address to) internal returns (uint256) {
        _safeMint(to, currentTokenId);
        return _generateKey();
    }

    /*//////////////////////////////////////////////////////////////
                            INTERNAL VIEW
    //////////////////////////////////////////////////////////////*/
    function _domainNameAndVersion() internal pure override returns (string memory, string memory) {
        return ("SPHERE-QUIZ NFT MINT", "1");
    }

    function _verifySignature(
        address to,
        uint256 score,
        bytes calldata sig
    ) internal view returns (bool) {
        bytes32 digest = _hashTypedData(keccak256(abi.encode(MINT_TYPEHASH, to, score)));
        return SignatureCheckerLib.isValidSignatureNowCalldata(signer, digest, sig);
    }

    /*//////////////////////////////////////////////////////////////
                            RECEIVE ETH
    //////////////////////////////////////////////////////////////*/
    receive() external payable {}
}