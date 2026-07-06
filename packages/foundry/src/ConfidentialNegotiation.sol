// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title Confidential bilateral price negotiation
/// @notice Two parties each submit an encrypted number (a ceiling and a floor).
/// The contract reveals only whether ceiling >= floor and, if so, a suggested
/// midpoint value. Neither party's submitted number is ever exposed, even to
/// each other, regardless of the outcome.
contract ConfidentialNegotiation is ZamaEthereumConfig {
    struct Session {
        address partyA; // submits the ceiling (e.g. an employer's max budget)
        address partyB; // submits the floor (e.g. a candidate's min acceptable salary)
        euint64 ceiling;
        euint64 floor;
        bool ceilingSet;
        bool floorSet;
        bool revealed;
        bool cancelled;
        ebool dealExists;
        euint64 suggestedValue;
    }

    mapping(uint256 => Session) private _sessions;
    uint256 public nextSessionId;

    event SessionCreated(uint256 indexed sessionId, address indexed partyA, address indexed partyB);
    event CeilingSubmitted(uint256 indexed sessionId);
    event FloorSubmitted(uint256 indexed sessionId);
    event Revealed(uint256 indexed sessionId);
    event SessionCancelled(uint256 indexed sessionId);

    error NotAParty();
    error WrongParty();
    error AlreadySubmitted();
    error NotReadyToReveal();
    error AlreadyRevealed();
    error SessionIsCancelled();

    /// @notice Starts a new negotiation between the caller (partyA) and `partyB`.
    function createSession(address partyB) external returns (uint256 sessionId) {
        sessionId = nextSessionId++;
        Session storage s = _sessions[sessionId];
        s.partyA = msg.sender;
        s.partyB = partyB;
        emit SessionCreated(sessionId, msg.sender, partyB);
    }

    /// @notice partyA submits their encrypted ceiling (max they're willing to offer).
    function submitCeiling(uint256 sessionId, externalEuint64 value, bytes calldata inputProof) external {
        Session storage s = _sessions[sessionId];
        if (msg.sender != s.partyA) revert WrongParty();
        if (s.cancelled) revert SessionIsCancelled();
        if (s.ceilingSet) revert AlreadySubmitted();

        s.ceiling = FHE.fromExternal(value, inputProof);
        FHE.allowThis(s.ceiling);
        s.ceilingSet = true;
        emit CeilingSubmitted(sessionId);
    }

    /// @notice partyB submits their encrypted floor (min they're willing to accept).
    function submitFloor(uint256 sessionId, externalEuint64 value, bytes calldata inputProof) external {
        Session storage s = _sessions[sessionId];
        if (msg.sender != s.partyB) revert WrongParty();
        if (s.cancelled) revert SessionIsCancelled();
        if (s.floorSet) revert AlreadySubmitted();

        s.floor = FHE.fromExternal(value, inputProof);
        FHE.allowThis(s.floor);
        s.floorSet = true;
        emit FloorSubmitted(sessionId);
    }

    /// @notice Computes the outcome once both sides have submitted, and grants
    /// both parties decryption rights on the result (never on the raw inputs).
    function reveal(uint256 sessionId) external {
        Session storage s = _sessions[sessionId];
        if (msg.sender != s.partyA && msg.sender != s.partyB) revert NotAParty();
        if (s.cancelled) revert SessionIsCancelled();
        if (!s.ceilingSet || !s.floorSet) revert NotReadyToReveal();
        if (s.revealed) revert AlreadyRevealed();

        ebool dealExists = FHE.ge(s.ceiling, s.floor);
        euint64 midpoint = FHE.div(FHE.add(s.ceiling, s.floor), 2);
        // Zero out the suggested value when there's no deal so a "no deal"
        // outcome never carries any residual information about either number.
        euint64 suggestedValue = FHE.select(dealExists, midpoint, FHE.asEuint64(0));

        s.dealExists = dealExists;
        s.suggestedValue = suggestedValue;
        s.revealed = true;

        FHE.allowThis(dealExists);
        FHE.allow(dealExists, s.partyA);
        FHE.allow(dealExists, s.partyB);

        FHE.allowThis(suggestedValue);
        FHE.allow(suggestedValue, s.partyA);
        FHE.allow(suggestedValue, s.partyB);

        emit Revealed(sessionId);
    }

    /// @notice Either party can cancel a session any time before it's revealed.
    /// Cancelled sessions can no longer accept submissions or be revealed.
    function cancelSession(uint256 sessionId) external {
        Session storage s = _sessions[sessionId];
        if (msg.sender != s.partyA && msg.sender != s.partyB) revert NotAParty();
        if (s.revealed) revert AlreadyRevealed();
        if (s.cancelled) revert SessionIsCancelled();

        s.cancelled = true;
        emit SessionCancelled(sessionId);
    }

    function getSession(uint256 sessionId)
        external
        view
        returns (address partyA, address partyB, bool ceilingSet, bool floorSet, bool revealed, bool cancelled)
    {
        Session storage s = _sessions[sessionId];
        return (s.partyA, s.partyB, s.ceilingSet, s.floorSet, s.revealed, s.cancelled);
    }

    function getDealExists(uint256 sessionId) external view returns (ebool) {
        return _sessions[sessionId].dealExists;
    }

    function getSuggestedValue(uint256 sessionId) external view returns (euint64) {
        return _sessions[sessionId].suggestedValue;
    }
}
