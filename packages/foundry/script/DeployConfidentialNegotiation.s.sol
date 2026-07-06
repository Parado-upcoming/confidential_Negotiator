// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {ConfidentialNegotiation} from "../src/ConfidentialNegotiation.sol";

contract DeployConfidentialNegotiation is Script {
    function run() external {
        vm.startBroadcast();

        ConfidentialNegotiation negotiation = new ConfidentialNegotiation();
        console.log("ConfidentialNegotiation deployed at:", address(negotiation));

        vm.stopBroadcast();
    }
}
