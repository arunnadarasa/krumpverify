// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title KrumpVerifyNFT
 * @notice Shared ERC-721 collection "Krump Verify" for minting IP NFTs that can be registered on Story.
 * @author Asura aka Angel of Indian Krump
 * @custom:website https://asura.lovable.app/
 * @custom:initiative StreetKode Fam Initiative
 * @custom:credits StreetKode Fam: Asura, Hectik, Kronos, Jo
 */
contract KrumpVerifyNFT is ERC721, Ownable {
    uint256 private _nextTokenId;

    /// @dev Per-token metadata URI override (e.g. IPFS). When set, Story Explorer uses it for traits.
    mapping(uint256 => string) private _tokenURIs;

    constructor() ERC721("Krump Verify", "KVERIFY") Ownable(msg.sender) {
        _nextTokenId = 0;
    }

    /// @notice Returns the next token ID that will be minted (current supply = nextTokenId).
    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }

    /// @notice Mint one NFT to msg.sender. Use the returned token ID when registering as IP on Story.
    function mint() external returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        return tokenId;
    }

    /// @notice Set metadata URI for a token (e.g. IPFS JSON). Used so Story Explorer can show traits.
    /// @param tokenId Token ID
    /// @param uri Full URI to ERC-721 metadata JSON (e.g. https://ipfs.io/ipfs/...)
    function setTokenURI(uint256 tokenId, string calldata uri) external onlyOwner {
        _tokenURIs[tokenId] = uri;
    }

    /// @notice Returns the token URI. Uses per-token URI if set, else baseURI + tokenId.
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        _requireOwned(tokenId);
        string memory custom = _tokenURIs[tokenId];
        if (bytes(custom).length > 0) return custom;
        return string(abi.encodePacked(_baseURI(), Strings.toString(tokenId)));
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return "https://krump-verify.story.foundation/";
    }
}
