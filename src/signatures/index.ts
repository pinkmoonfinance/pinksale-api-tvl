import Web3 from 'web3';
/**
 * LockRemoved(id, token, owner, amount, unlockedAt)
 */
export const PinklockV1LockRemovedSignature = Web3.utils.sha3('LockRemoved(uint256,address,address,uint256,uint256)');

/**
 * LockVested(id, token, owner, amount, total, timestamp)
 */
 export const PinklockV2LockVestedSignature = Web3.utils.sha3('LockVested(uint256,address,address,uint256,uint256,uint256)');
