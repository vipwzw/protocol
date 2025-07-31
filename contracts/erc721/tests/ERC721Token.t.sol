// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import "forge-std/Test.sol";

// Mock ERC721 Token for testing
contract MockERC721Token {
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    
    string private _name;
    string private _symbol;
    
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    
    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }
    
    function name() public view returns (string memory) {
        return _name;
    }
    
    function symbol() public view returns (string memory) {
        return _symbol;
    }
    
    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "ERC721: owner query for nonexistent token");
        return owner;
    }
    
    function balanceOf(address owner) public view returns (uint256) {
        require(owner != address(0), "ERC721: balance query for the zero address");
        return _balances[owner];
    }
    
    function getApproved(uint256 tokenId) public view returns (address) {
        require(_exists(tokenId), "ERC721: approved query for nonexistent token");
        return _tokenApprovals[tokenId];
    }
    
    function isApprovedForAll(address owner, address operator) public view returns (bool) {
        return _operatorApprovals[owner][operator];
    }
    
    function mint(address to, uint256 tokenId) public {
        require(to != address(0), "ERC721: mint to the zero address");
        require(!_exists(tokenId), "ERC721: token already minted");
        
        _balances[to] += 1;
        _owners[tokenId] = to;
        
        emit Transfer(address(0), to, tokenId);
    }
    
    function burn(uint256 tokenId) public {
        address owner = ownerOf(tokenId);
        
        // Clear approvals
        _approve(address(0), tokenId);
        
        _balances[owner] -= 1;
        delete _owners[tokenId];
        
        emit Transfer(owner, address(0), tokenId);
    }
    
    function approve(address to, uint256 tokenId) public {
        address owner = ownerOf(tokenId);
        require(to != owner, "ERC721: approval to current owner");
        require(
            msg.sender == owner || isApprovedForAll(owner, msg.sender),
            "ERC721: approve caller is not owner nor approved for all"
        );
        
        _approve(to, tokenId);
    }
    
    function setApprovalForAll(address operator, bool approved) public {
        require(operator != msg.sender, "ERC721: approve to caller");
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }
    
    function transferFrom(address from, address to, uint256 tokenId) public {
        require(_isApprovedOrOwner(msg.sender, tokenId), "ERC721: transfer caller is not owner nor approved");
        _transfer(from, to, tokenId);
    }
    
    function _exists(uint256 tokenId) internal view returns (bool) {
        return _owners[tokenId] != address(0);
    }
    
    function _approve(address to, uint256 tokenId) internal {
        _tokenApprovals[tokenId] = to;
        emit Approval(ownerOf(tokenId), to, tokenId);
    }
    
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        require(_exists(tokenId), "ERC721: operator query for nonexistent token");
        address owner = ownerOf(tokenId);
        return (spender == owner || getApproved(tokenId) == spender || isApprovedForAll(owner, spender));
    }
    
    function _transfer(address from, address to, uint256 tokenId) internal {
        require(ownerOf(tokenId) == from, "ERC721: transfer from incorrect owner");
        require(to != address(0), "ERC721: transfer to the zero address");
        
        // Clear approvals from the previous owner
        _approve(address(0), tokenId);
        
        _balances[from] -= 1;
        _balances[to] += 1;
        _owners[tokenId] = to;
        
        emit Transfer(from, to, tokenId);
    }
}

contract ERC721TokenTest is Test {
    MockERC721Token public nftToken;
    address public constant ALICE = address(0x1);
    address public constant BOB = address(0x2);
    
    function setUp() public {
        nftToken = new MockERC721Token("Test NFT", "TNFT");
    }
    
    function testTokenMetadata() public {
        assertEq(nftToken.name(), "Test NFT");
        assertEq(nftToken.symbol(), "TNFT");
    }
    
    function testMintToken() public {
        uint256 tokenId = 1;
        
        nftToken.mint(ALICE, tokenId);
        
        assertEq(nftToken.ownerOf(tokenId), ALICE);
        assertEq(nftToken.balanceOf(ALICE), 1);
    }
    
    function testTransferToken() public {
        uint256 tokenId = 1;
        
        // Mint token to Alice
        nftToken.mint(ALICE, tokenId);
        
        // Alice transfers to Bob
        vm.startPrank(ALICE);
        nftToken.transferFrom(ALICE, BOB, tokenId);
        vm.stopPrank();
        
        assertEq(nftToken.ownerOf(tokenId), BOB);
        assertEq(nftToken.balanceOf(ALICE), 0);
        assertEq(nftToken.balanceOf(BOB), 1);
    }
    
    function testApproveAndTransfer() public {
        uint256 tokenId = 1;
        
        // Mint token to Alice
        nftToken.mint(ALICE, tokenId);
        
        // Alice approves Bob
        vm.startPrank(ALICE);
        nftToken.approve(BOB, tokenId);
        vm.stopPrank();
        
        assertEq(nftToken.getApproved(tokenId), BOB);
        
        // Bob transfers the token to himself
        vm.startPrank(BOB);
        nftToken.transferFrom(ALICE, BOB, tokenId);
        vm.stopPrank();
        
        assertEq(nftToken.ownerOf(tokenId), BOB);
    }
    
    function testSetApprovalForAll() public {
        uint256 tokenId1 = 1;
        uint256 tokenId2 = 2;
        
        // Mint tokens to Alice
        nftToken.mint(ALICE, tokenId1);
        nftToken.mint(ALICE, tokenId2);
        
        // Alice approves Bob for all tokens
        vm.startPrank(ALICE);
        nftToken.setApprovalForAll(BOB, true);
        vm.stopPrank();
        
        assertTrue(nftToken.isApprovedForAll(ALICE, BOB));
        
        // Bob can transfer both tokens
        vm.startPrank(BOB);
        nftToken.transferFrom(ALICE, BOB, tokenId1);
        nftToken.transferFrom(ALICE, BOB, tokenId2);
        vm.stopPrank();
        
        assertEq(nftToken.ownerOf(tokenId1), BOB);
        assertEq(nftToken.ownerOf(tokenId2), BOB);
        assertEq(nftToken.balanceOf(BOB), 2);
    }
    
    function testBurn() public {
        uint256 tokenId = 1;
        
        // Mint token to Alice
        nftToken.mint(ALICE, tokenId);
        assertEq(nftToken.balanceOf(ALICE), 1);
        
        // Burn the token
        nftToken.burn(tokenId);
        
        assertEq(nftToken.balanceOf(ALICE), 0);
        
        // Should revert when querying burned token
        vm.expectRevert();
        nftToken.ownerOf(tokenId);
    }
    
    function testCannotTransferNonExistentToken() public {
        uint256 tokenId = 999;
        
        vm.expectRevert();
        nftToken.transferFrom(ALICE, BOB, tokenId);
    }
    
    function testCannotTransferUnauthorized() public {
        uint256 tokenId = 1;
        
        // Mint token to Alice
        nftToken.mint(ALICE, tokenId);
        
        // Bob tries to transfer without approval
        vm.startPrank(BOB);
        vm.expectRevert();
        nftToken.transferFrom(ALICE, BOB, tokenId);
        vm.stopPrank();
    }
    
    function testCannotMintToZeroAddress() public {
        uint256 tokenId = 1;
        
        vm.expectRevert();
        nftToken.mint(address(0), tokenId);
    }
    
    function testCannotMintSameTokenTwice() public {
        uint256 tokenId = 1;
        
        nftToken.mint(ALICE, tokenId);
        
        vm.expectRevert();
        nftToken.mint(BOB, tokenId);
    }
    
    function testTransferEvent() public {
        uint256 tokenId = 1;
        
        vm.expectEmit(true, true, true, true, address(nftToken));
        emit MockERC721Token.Transfer(address(0), ALICE, tokenId);
        
        nftToken.mint(ALICE, tokenId);
    }
    
    function testApprovalEvent() public {
        uint256 tokenId = 1;
        
        nftToken.mint(ALICE, tokenId);
        
        vm.expectEmit(true, true, true, true, address(nftToken));
        emit MockERC721Token.Approval(ALICE, BOB, tokenId);
        
        vm.startPrank(ALICE);
        nftToken.approve(BOB, tokenId);
        vm.stopPrank();
    }
}