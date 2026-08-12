// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IMegapot} from "../src/interfaces/IMegapot.sol";
import {Fork} from "./helpers/Fork.sol";

interface IMintable {
    function mint(address to, uint256 amount) external;
}

contract Caller {
    function buy(IMegapot m, IERC20 t, address referrer, address recipient, uint256 value) external {
        t.approve(address(m), value);
        m.purchaseTickets(referrer, value, recipient);
    }
}

contract MegapotRulesTest is Test {
    IMegapot constant MEGAPOT = IMegapot(0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De);
    IERC20 constant MPUSDC = IERC20(0xA4253E7C13525287C56550b8708100f93E60509f);

    Caller caller;
    address player = makeAddr("player");
    address other = makeAddr("other");
    uint256 price;

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_SEPOLIA_RPC_URL", Fork.BASE_SEPOLIA));
        caller = new Caller();
        price = MEGAPOT.ticketPrice();
        IMintable(address(MPUSDC)).mint(address(caller), 100e6);
        IMintable(address(MPUSDC)).mint(player, 100e6);
    }

    function test_A_referrerIsSender_reverts() public {
        vm.expectRevert(bytes("Cannot refer yourself"));
        caller.buy(MEGAPOT, MPUSDC, address(caller), player, price);
    }

    function test_B_referrerIsThirdParty_recipientIsPlayer() public {
        caller.buy(MEGAPOT, MPUSDC, other, player, price);
        (uint256 bps,,) = MEGAPOT.usersInfo(player);
        console.log("B ok. player bps:", bps, "referrer claimable:", MEGAPOT.referralFeesClaimable(other));
    }

    function test_C_referrerIsRecipient() public {
        caller.buy(MEGAPOT, MPUSDC, player, player, price);
        console.log("C ok. claimable:", MEGAPOT.referralFeesClaimable(player));
    }

    function test_D_referrerIsSenderAndRecipientIsSender() public {
        vm.expectRevert(bytes("Cannot refer yourself"));
        caller.buy(MEGAPOT, MPUSDC, address(caller), address(caller), price);
    }

    function test_E_referrerZero() public {
        caller.buy(MEGAPOT, MPUSDC, address(0), player, price);
        console.log("E ok (zero referrer accepted)");
    }

    function test_F_playerPaysDirectly_contractIsReferrer() public {
        vm.startPrank(player);
        MPUSDC.approve(address(MEGAPOT), price);
        MEGAPOT.purchaseTickets(address(caller), price, player);
        vm.stopPrank();
        console.log("F ok. caller claimable:", MEGAPOT.referralFeesClaimable(address(caller)));
    }
}
