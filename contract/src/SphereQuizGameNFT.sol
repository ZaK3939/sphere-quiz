// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import { EIP712 } from "solady/utils/EIP712.sol";
import { Ownable } from "solady/auth/Ownable.sol";
import { SignatureCheckerLib } from "solady/utils/SignatureCheckerLib.sol";
import { LibString } from "solady/utils/LibString.sol";
import { SafeTransferLib } from "solady/utils/SafeTransferLib.sol";

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";

contract SphereQuizGameNFT is Ownable, ERC1155Supply, EIP712 {
    /*//////////////////////////////////////////////////////////////
                                 USING
    //////////////////////////////////////////////////////////////*/
    using LibString for *;
    using SafeTransferLib for address;

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/
    /// @notice Token has already been claimed for this fid
    error AlreadyMinted();

    /// @notice Caller provided invalid `Mint` signature
    error InvalidSignature();

    error InvalidMintFee();
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/
    uint256 public currentTokenId = 0;
    string public baseURI;
    string public baseURL;
    address public signer;

    address protocolFeeDestination;
    /// @notice Mapping tracking fids that have minted
    mapping(address player => bool) public hasMinted;

    struct ScoreData {
        uint256 score;
        uint256 timestamp;
    }
    bool revealed;
    mapping(address player => ScoreData) public scoreData;
    uint256 public mintFee; 
    /// @notice EIP-712 typehash for `Mint` message
    bytes32 public constant MINT_TYPEHASH = keccak256("Mint(address to,uint256 score)");

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/
    event BaseTokenURISet(string tokenURI);
    event Mint(address indexed to, address indexed player, uint256 score);
    event SetSigner(address oldSigner, address newSigner);
    event BaseTokenURLSet(string tokenURL);
    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    constructor(address ownerAddress_,address signer_) ERC1155("") {
        _initializeOwner(ownerAddress_);
        signer = signer_;
        protocolFeeDestination = ownerAddress_;
        // Update this with your own NFT collection's metadata
        baseURI = "https://www.arweave.net/";
        baseURL = string.concat(baseURI, "e5ZoMobGYbQiXxO50tswTPuRC-GOeqrGg3AEZTNcpKA");
        mintFee = 0.00001 ether;
    }

    function name() public pure returns (string memory) {
        return "SphereQuiz";
    }

    /// @dev Returns the token collection symbol.
    function symbol() public pure returns (string memory) {
        return "SPHERE";
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

        hasMinted[to] = true;
        scoreData[to] = ScoreData(score, block.timestamp);
        emit Mint(to, to, score);
        ++currentTokenId;
        protocolFeeDestination.safeTransferETH(msg.value);
        _mint(to, currentTokenId, 1, "");
    }

    /*//////////////////////////////////////////////////////////////
                                  SET
    //////////////////////////////////////////////////////////////*/
    // Set the token URI for all tokens that don't have a custom tokenURI set.
    // Must be called by the owner given its global impact on the collection
    function setBaseURI(string memory _baseURI) public onlyOwner {
        baseURI = _baseURI;
        emit BaseTokenURISet(baseURI);
    }

    /// @notice Set signer address. Only callable by owner.
    /// @param _signer New signer address
    function setSigner(address _signer) external onlyOwner {
        signer = _signer;
        emit SetSigner(signer, signer = _signer);
    }

    function setProtocolFeeDestination(address _protocolFeeDestination) external onlyOwner {
        protocolFeeDestination = _protocolFeeDestination;
    }

    function setBasicURL(string memory _baseURL) external onlyOwner {
        baseURL = _baseURL;
        emit BaseTokenURLSet(baseURL);
    }

    function setRevealed(bool _revealed) external onlyOwner {
        revealed = _revealed;
    }

    function setMintFee(uint256 _mintFee) external onlyOwner {
        mintFee = _mintFee;
    }
    /*//////////////////////////////////////////////////////////////
                             EXTERNAL VIEW
    //////////////////////////////////////////////////////////////*/
    // Returns the URI for a token ID
    function uri(uint256 tokenId) public view override returns (string memory) {
        if(revealed){
            return string.concat(baseURI, tokenId.toString());
        }
        return baseURI;
    }

    /// @dev EIP-712 helper.
    function hashTypedData(bytes32 structHash) public view returns (bytes32) {
        return _hashTypedData(structHash);
    }

    function getScoreData(address player) public view returns (uint256 score, uint256 timestamp) {
        return (scoreData[player].score, scoreData[player].timestamp);
    }

    /*//////////////////////////////////////////////////////////////
                            INTERNAL UPDATE
    //////////////////////////////////////////////////////////////*/
    /// @dev EIP-712 domain name and contract version.

    function _domainNameAndVersion() internal pure override returns (string memory, string memory) {
        return ("SPHERE-QUIZ NFT MINT", "1");
    }

    /// @dev Verify EIP-712 `Mint` signature.
    function _verifySignature(
        address to,
        uint256 score,
        bytes calldata sig
    )
        internal
        view
        returns (bool)
    {
        bytes32 digest = _hashTypedData(keccak256(abi.encode(MINT_TYPEHASH, to, score)));
        return SignatureCheckerLib.isValidSignatureNowCalldata(signer, digest, sig);
    }

    receive() external payable { }
}