// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import "forge-std/Test.sol";

// Mock ERC1155 Token for testing
contract MockERC1155Token {
    mapping(uint256 => mapping(address => uint256)) private _balances;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    
    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
    event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values);
    event ApprovalForAll(address indexed account, address indexed operator, bool approved);
    
    function balanceOf(address account, uint256 id) public view returns (uint256) {
        require(account != address(0), "ERC1155: balance query for the zero address");
        return _balances[id][account];
    }
    
    function balanceOfBatch(address[] memory accounts, uint256[] memory ids)
        public
        view
        returns (uint256[] memory)
    {
        require(accounts.length == ids.length, "ERC1155: accounts and ids length mismatch");
        
        uint256[] memory batchBalances = new uint256[](accounts.length);
        
        for (uint256 i = 0; i < accounts.length; ++i) {
            batchBalances[i] = balanceOf(accounts[i], ids[i]);
        }
        
        return batchBalances;
    }
    
    function setApprovalForAll(address operator, bool approved) public {
        require(msg.sender != operator, "ERC1155: setting approval status for self");
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }
    
    function isApprovedForAll(address account, address operator) public view returns (bool) {
        return _operatorApprovals[account][operator];
    }
    
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) public {
        require(
            from == msg.sender || isApprovedForAll(from, msg.sender),
            "ERC1155: caller is not owner nor approved"
        );
        _safeTransferFrom(from, to, id, amount, data);
    }
    
    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) public {
        require(
            from == msg.sender || isApprovedForAll(from, msg.sender),
            "ERC1155: transfer caller is not owner nor approved"
        );
        _safeBatchTransferFrom(from, to, ids, amounts, data);
    }
    
    function mint(address to, uint256 id, uint256 amount, bytes memory data) public {
        require(to != address(0), "ERC1155: mint to the zero address");
        
        _balances[id][to] += amount;
        emit TransferSingle(msg.sender, address(0), to, id, amount);
    }
    
    function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data) public {
        require(to != address(0), "ERC1155: mint to the zero address");
        require(ids.length == amounts.length, "ERC1155: ids and amounts length mismatch");
        
        for (uint256 i = 0; i < ids.length; i++) {
            _balances[ids[i]][to] += amounts[i];
        }
        
        emit TransferBatch(msg.sender, address(0), to, ids, amounts);
    }
    
    function burn(address from, uint256 id, uint256 amount) public {
        require(from != address(0), "ERC1155: burn from the zero address");
        require(_balances[id][from] >= amount, "ERC1155: burn amount exceeds balance");
        
        _balances[id][from] -= amount;
        emit TransferSingle(msg.sender, from, address(0), id, amount);
    }
    
    function burnBatch(address from, uint256[] memory ids, uint256[] memory amounts) public {
        require(from != address(0), "ERC1155: burn from the zero address");
        require(ids.length == amounts.length, "ERC1155: ids and amounts length mismatch");
        
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 id = ids[i];
            uint256 amount = amounts[i];
            require(_balances[id][from] >= amount, "ERC1155: burn amount exceeds balance");
            _balances[id][from] -= amount;
        }
        
        emit TransferBatch(msg.sender, from, address(0), ids, amounts);
    }
    
    function supportsInterface(bytes4 interfaceId) public view returns (bool) {
        return
            interfaceId == 0x01ffc9a7 || // ERC165 Interface ID for ERC165
            interfaceId == 0xd9b67a26;   // ERC165 Interface ID for ERC1155
    }
    
    function _safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) internal {
        require(to != address(0), "ERC1155: transfer to the zero address");
        require(_balances[id][from] >= amount, "ERC1155: insufficient balance for transfer");
        
        _balances[id][from] -= amount;
        _balances[id][to] += amount;
        
        emit TransferSingle(msg.sender, from, to, id, amount);
    }
    
    function _safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal {
        require(ids.length == amounts.length, "ERC1155: ids and amounts length mismatch");
        require(to != address(0), "ERC1155: transfer to the zero address");
        
        for (uint256 i = 0; i < ids.length; ++i) {
            uint256 id = ids[i];
            uint256 amount = amounts[i];
            
            require(_balances[id][from] >= amount, "ERC1155: insufficient balance for transfer");
            _balances[id][from] -= amount;
            _balances[id][to] += amount;
        }
        
        emit TransferBatch(msg.sender, from, to, ids, amounts);
    }
}

contract ERC1155Test is Test {
    MockERC1155Token public token;
    address public constant ALICE = address(0x1);
    address public constant BOB = address(0x2);
    
    function setUp() public {
        token = new MockERC1155Token();
    }
    
    function testMintToken() public {
        uint256 tokenId = 1;
        uint256 amount = 100;
        
        token.mint(ALICE, tokenId, amount, "");
        
        assertEq(token.balanceOf(ALICE, tokenId), amount);
    }
    
    function testMintBatch() public {
        uint256[] memory tokenIds = new uint256[](2);
        uint256[] memory amounts = new uint256[](2);
        
        tokenIds[0] = 1;
        tokenIds[1] = 2;
        amounts[0] = 100;
        amounts[1] = 200;
        
        token.mintBatch(ALICE, tokenIds, amounts, "");
        
        assertEq(token.balanceOf(ALICE, tokenIds[0]), amounts[0]);
        assertEq(token.balanceOf(ALICE, tokenIds[1]), amounts[1]);
    }
    
    function testSafeTransferFrom() public {
        uint256 tokenId = 1;
        uint256 amount = 100;
        uint256 transferAmount = 50;
        
        // Mint tokens to Alice
        token.mint(ALICE, tokenId, amount, "");
        
        // Alice transfers to Bob
        vm.startPrank(ALICE);
        token.safeTransferFrom(ALICE, BOB, tokenId, transferAmount, "");
        vm.stopPrank();
        
        assertEq(token.balanceOf(ALICE, tokenId), amount - transferAmount);
        assertEq(token.balanceOf(BOB, tokenId), transferAmount);
    }
    
    function testSafeBatchTransferFrom() public {
        uint256[] memory tokenIds = new uint256[](2);
        uint256[] memory amounts = new uint256[](2);
        uint256[] memory transferAmounts = new uint256[](2);
        
        tokenIds[0] = 1;
        tokenIds[1] = 2;
        amounts[0] = 100;
        amounts[1] = 200;
        transferAmounts[0] = 50;
        transferAmounts[1] = 100;
        
        // Mint tokens to Alice
        token.mintBatch(ALICE, tokenIds, amounts, "");
        
        // Alice transfers to Bob
        vm.startPrank(ALICE);
        token.safeBatchTransferFrom(ALICE, BOB, tokenIds, transferAmounts, "");
        vm.stopPrank();
        
        assertEq(token.balanceOf(ALICE, tokenIds[0]), amounts[0] - transferAmounts[0]);
        assertEq(token.balanceOf(ALICE, tokenIds[1]), amounts[1] - transferAmounts[1]);
        assertEq(token.balanceOf(BOB, tokenIds[0]), transferAmounts[0]);
        assertEq(token.balanceOf(BOB, tokenIds[1]), transferAmounts[1]);
    }
    
    function testSetApprovalForAll() public {
        uint256 tokenId = 1;
        uint256 amount = 100;
        
        // Mint tokens to Alice
        token.mint(ALICE, tokenId, amount, "");
        
        // Alice approves Bob for all tokens
        vm.startPrank(ALICE);
        token.setApprovalForAll(BOB, true);
        vm.stopPrank();
        
        assertTrue(token.isApprovedForAll(ALICE, BOB));
        
        // Bob can transfer Alice's tokens
        vm.startPrank(BOB);
        token.safeTransferFrom(ALICE, BOB, tokenId, amount, "");
        vm.stopPrank();
        
        assertEq(token.balanceOf(BOB, tokenId), amount);
        assertEq(token.balanceOf(ALICE, tokenId), 0);
    }
    
    function testBurn() public {
        uint256 tokenId = 1;
        uint256 amount = 100;
        uint256 burnAmount = 50;
        
        // Mint tokens to Alice
        token.mint(ALICE, tokenId, amount, "");
        
        // Burn some tokens
        token.burn(ALICE, tokenId, burnAmount);
        
        assertEq(token.balanceOf(ALICE, tokenId), amount - burnAmount);
    }
    
    function testBurnBatch() public {
        uint256[] memory tokenIds = new uint256[](2);
        uint256[] memory amounts = new uint256[](2);
        uint256[] memory burnAmounts = new uint256[](2);
        
        tokenIds[0] = 1;
        tokenIds[1] = 2;
        amounts[0] = 100;
        amounts[1] = 200;
        burnAmounts[0] = 50;
        burnAmounts[1] = 100;
        
        // Mint tokens to Alice
        token.mintBatch(ALICE, tokenIds, amounts, "");
        
        // Burn some tokens
        token.burnBatch(ALICE, tokenIds, burnAmounts);
        
        assertEq(token.balanceOf(ALICE, tokenIds[0]), amounts[0] - burnAmounts[0]);
        assertEq(token.balanceOf(ALICE, tokenIds[1]), amounts[1] - burnAmounts[1]);
    }
    
    function testBalanceOfBatch() public {
        uint256[] memory tokenIds = new uint256[](2);
        uint256[] memory amounts = new uint256[](2);
        address[] memory accounts = new address[](2);
        
        tokenIds[0] = 1;
        tokenIds[1] = 2;
        amounts[0] = 100;
        amounts[1] = 200;
        accounts[0] = ALICE;
        accounts[1] = ALICE;
        
        // Mint tokens to Alice
        token.mintBatch(ALICE, tokenIds, amounts, "");
        
        uint256[] memory balances = token.balanceOfBatch(accounts, tokenIds);
        
        assertEq(balances[0], amounts[0]);
        assertEq(balances[1], amounts[1]);
    }
    
    function testCannotTransferInsufficientBalance() public {
        uint256 tokenId = 1;
        uint256 amount = 100;
        uint256 transferAmount = 150; // More than available
        
        token.mint(ALICE, tokenId, amount, "");
        
        vm.startPrank(ALICE);
        vm.expectRevert();
        token.safeTransferFrom(ALICE, BOB, tokenId, transferAmount, "");
        vm.stopPrank();
    }
    
    function testCannotTransferUnauthorized() public {
        uint256 tokenId = 1;
        uint256 amount = 100;
        
        token.mint(ALICE, tokenId, amount, "");
        
        // Bob tries to transfer without approval
        vm.startPrank(BOB);
        vm.expectRevert();
        token.safeTransferFrom(ALICE, BOB, tokenId, amount, "");
        vm.stopPrank();
    }
    
    function testSupportsInterface() public {
        // ERC1155 interface
        assertTrue(token.supportsInterface(0xd9b67a26));
        // ERC165 interface
        assertTrue(token.supportsInterface(0x01ffc9a7));
    }
}