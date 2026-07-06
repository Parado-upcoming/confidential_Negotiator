// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FhevmTest} from "forge-fhevm/FhevmTest.sol";
import {ConfidentialNegotiation} from "../src/ConfidentialNegotiation.sol";
import {euint64, externalEuint64, ebool} from "encrypted-types/EncryptedTypes.sol";

contract ConfidentialNegotiationTest is FhevmTest {
    ConfidentialNegotiation negotiation;
    address negotiationAddress;

    uint256 internal constant EMPLOYER_PK = 0xE401;
    uint256 internal constant CANDIDATE_PK = 0xCA1;
    address employer;
    address candidate;

    function setUp() public override {
        super.setUp();
        negotiation = new ConfidentialNegotiation();
        negotiationAddress = address(negotiation);
        employer = vm.addr(EMPLOYER_PK);
        candidate = vm.addr(CANDIDATE_PK);
    }

    function _createSession() internal returns (uint256 sessionId) {
        vm.prank(employer);
        sessionId = negotiation.createSession(candidate);
    }

    function test_dealExists_whenCeilingAboveFloor() public {
        uint256 sessionId = _createSession();

        (externalEuint64 encCeiling, bytes memory ceilingProof) = encryptUint64(120_000, employer, negotiationAddress);
        vm.prank(employer);
        negotiation.submitCeiling(sessionId, encCeiling, ceilingProof);

        (externalEuint64 encFloor, bytes memory floorProof) = encryptUint64(100_000, candidate, negotiationAddress);
        vm.prank(candidate);
        negotiation.submitFloor(sessionId, encFloor, floorProof);

        vm.prank(employer);
        negotiation.reveal(sessionId);

        ebool dealExists = negotiation.getDealExists(sessionId);
        bytes memory sigEmployer = signUserDecrypt(EMPLOYER_PK, negotiationAddress);
        uint256 clearDealExists = userDecrypt(ebool.unwrap(dealExists), employer, negotiationAddress, sigEmployer);
        assertEq(clearDealExists, 1);

        euint64 suggested = negotiation.getSuggestedValue(sessionId);
        bytes memory sigCandidate = signUserDecrypt(CANDIDATE_PK, negotiationAddress);
        uint256 clearSuggested = userDecrypt(euint64.unwrap(suggested), candidate, negotiationAddress, sigCandidate);
        assertEq(clearSuggested, 110_000);
    }

    function test_noDeal_whenFloorAboveCeiling() public {
        uint256 sessionId = _createSession();

        (externalEuint64 encCeiling, bytes memory ceilingProof) = encryptUint64(80_000, employer, negotiationAddress);
        vm.prank(employer);
        negotiation.submitCeiling(sessionId, encCeiling, ceilingProof);

        (externalEuint64 encFloor, bytes memory floorProof) = encryptUint64(100_000, candidate, negotiationAddress);
        vm.prank(candidate);
        negotiation.submitFloor(sessionId, encFloor, floorProof);

        vm.prank(candidate);
        negotiation.reveal(sessionId);

        ebool dealExists = negotiation.getDealExists(sessionId);
        bytes memory sig = signUserDecrypt(CANDIDATE_PK, negotiationAddress);
        uint256 clearDealExists = userDecrypt(ebool.unwrap(dealExists), candidate, negotiationAddress, sig);
        assertEq(clearDealExists, 0);
    }

    function test_revert_whenNonPartySubmits() public {
        uint256 sessionId = _createSession();
        address stranger = vm.addr(0xBAD);

        (externalEuint64 encCeiling, bytes memory proof) = encryptUint64(1, stranger, negotiationAddress);
        vm.prank(stranger);
        vm.expectRevert(ConfidentialNegotiation.WrongParty.selector);
        negotiation.submitCeiling(sessionId, encCeiling, proof);
    }
}
