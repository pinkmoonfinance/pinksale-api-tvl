import { parseUnits } from '@ethersproject/units';

export enum Chain {
  BSC,
  MATIC,
  ETH,
  AVAX,
  KCC,
  BSC_TEST,
  CRONOS,
}

export function* supportedChains(): IterableIterator<Chain> {
  yield Chain.BSC;
  yield Chain.BSC_TEST;
  yield Chain.MATIC;
  yield Chain.ETH;
  yield Chain.AVAX;
  yield Chain.KCC;
  yield Chain.CRONOS;
}

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const ZERO = parseUnits('0', 0);

export const NATIVE_TOKEN: { [key: number]: string } = {
  56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  25: '0x5c7f8a570d578ed84e63fdfa7b1ee72deae1ae23',
  43114: '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7',
};

export const STABLE_COIN: { [key: number]: string[] } = {
  56: [
    '0x55d398326f99059ff775485246999027b3197955', // usdt
    '0xe9e7cea3dedca5984780bafc599bd69add087d56', // busd
    '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // usdc
  ],
  1: [
    '0xdac17f958d2ee523a2206206994597c13d831ec7', // usdt
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // usdc
  ],
  137: [
    '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // usdt
    '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // usdc
  ],
  321: [
    '0x0039f574ee5cc39bdd162e9a88e3eb1f111baf48', // usdt
  ],
  43114: [
    '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', // usdt
    '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', // usdc
  ],
  250: [
    '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75', // usdc
  ],
  25: [
    '0x66e428c3f67a68878562e79A0234c1F83c208770', // usdt
    '0xc21223249CA28397B4B6541dfFaEcC539BfF0c59', // usdc
  ],
};

export const BSC_RPC = [
  'https://bsc-dataseed.binance.org',
  'https://bsc-dataseed1.defibit.io',
  'https://bsc-dataseed1.ninicoin.io',
];

export const BSC_TEST_RPC = [
  'https://data-seed-prebsc-1-s1.binance.org:8545/',
  'https://data-seed-prebsc-2-s1.binance.org:8545/',
  'https://data-seed-prebsc-1-s2.binance.org:8545/',
  'https://data-seed-prebsc-2-s2.binance.org:8545/',
  'https://data-seed-prebsc-1-s3.binance.org:8545/',
  'https://data-seed-prebsc-2-s3.binance.org:8545/',
];

export const MATIC_RPC = [
  'https://polygon-rpc.com',
  'https://rpc.ankr.com/polygon',
];

export const ETH_RPC = [
  'https://rpc.ankr.com/eth',
];

export const AVAX_RPC = [
  'https://api.avax.network/ext/bc/C/rpc',
  'https://rpc.ankr.com/avalanche',
  'https://rpc.ankr.com/avalanche-c',
];

export const KCC_RPC = ['https://rpc-mainnet.kcc.network'];

export const CRONOS_RPC = [
  'https://evm.cronos.org',
  'https://evm-cronos.crypto.org',
  'https://rpc.vvs.finance',
];

type ConfigMapping = {
  [Network in Chain]: ChainConfig;
};

export interface ChainConfig {
  chainId: number;
  rpcs: string[];
  poolManager: string;
  pinkLock: string;
  pinklockCreatedBlock: number;
  pinklockV2CreatedBlock: number;
  tvlBlockBacktrack: number;
  pinkLockV2: string;
  tvlRouter: string;
}

const getNumberOfBlocks = (minutes: number, blockTime: number) =>
  (minutes * 60) / blockTime;

export const chainToChainConfig: ConfigMapping = {
  [Chain.BSC]: {
    chainId: 56,
    rpcs: BSC_RPC,
    poolManager: '0x3338CCa60f829Fa7139656bB910c63D44aFD270A',
    pinkLock: '0x7ee058420e5937496F5a2096f04caA7721cF70cc',
    pinklockCreatedBlock: 11385323,
    pinklockV2CreatedBlock: 0,
    tvlBlockBacktrack: getNumberOfBlocks(30, 3), // 600 blocks
    pinkLockV2: '',
    tvlRouter: '0x10ED43C718714eb63d5aA57B78B54704E256024E', // pancake
  },
  [Chain.BSC_TEST]: {
    chainId: 97,
    rpcs: BSC_TEST_RPC,
    poolManager: '0x301e08b681FEA29c6F04A8e1Af4a3DcA2ed91ccb',
    pinkLock: '0xA188958345E5927E0642E5F31362b4E4F5e064A2',
    pinklockCreatedBlock: 12836610,
    pinklockV2CreatedBlock: 19009232,
    tvlBlockBacktrack: getNumberOfBlocks(30, 3), // 600 blocks
    pinkLockV2: '0x47ea46E5690Fb60961A51b77646207D120e554De',
    tvlRouter: '',
  },
  [Chain.MATIC]: {
    chainId: 137,
    rpcs: MATIC_RPC,
    poolManager: '0x85e833cfbcb9747d81c7Ea43F0732ceAc05A9AE3',
    pinkLock: '0x5fb71Dbf7248a01bf96cE2AB2DA34EEAbE58c261',
    pinklockCreatedBlock: 17498421,
    pinklockV2CreatedBlock: 0,
    tvlBlockBacktrack: getNumberOfBlocks(30, 3), // 600 blocks
    pinkLockV2: '',
    tvlRouter: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff', // quickswap
  },
  [Chain.ETH]: {
    chainId: 1,
    rpcs: ETH_RPC,
    poolManager: '0xAd574c1B36cb5F03Eb471A9501c4Ccff8040dD2d',
    pinkLock: '0x33d4cC8716Beb13F814F538Ad3b2de3b036f5e2A',
    pinklockCreatedBlock: 13515162,
    pinklockV2CreatedBlock: 0,
    tvlBlockBacktrack: getNumberOfBlocks(30, 3), // 600 blocks
    pinkLockV2: '',
    tvlRouter: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // uniswap
  },
  [Chain.AVAX]: {
    chainId: 43114,
    rpcs: AVAX_RPC,
    poolManager: '0x72d44aeCf0DbF2485D2eD0dA4189bd9f77bf41B8',
    pinkLock: '0x4DffB05d1Bc222A2852799e2076e956acb589322',
    pinklockCreatedBlock: 7104996,
    pinklockV2CreatedBlock: 0,
    tvlBlockBacktrack: getNumberOfBlocks(30, 3), // 600 blocks
    pinkLockV2: '',
    tvlRouter: '0xEC3452f87CBa05c5a8c3529b6c961779EB77f257', // traderjoe
  },
  [Chain.KCC]: {
    chainId: 321,
    rpcs: KCC_RPC,
    poolManager: '0xAd574c1B36cb5F03Eb471A9501c4Ccff8040dD2d',
    pinkLock: '',
    pinklockCreatedBlock: 0,
    pinklockV2CreatedBlock: 0,
    tvlBlockBacktrack: getNumberOfBlocks(30, 3), // 600 blocks
    pinkLockV2: '',
    tvlRouter: '0xa58350d6dee8441aa42754346860e3545cc83cda', // kuswap
  },
  [Chain.CRONOS]: {
    chainId: 25,
    rpcs: CRONOS_RPC,
    poolManager: '0xBE0b139ABc90723Af76a89D3051f60Ba1B64c8d9',
    pinkLock: '0xdD6E31A046b828CbBAfb939C2a394629aff8BBdC',
    pinklockCreatedBlock: 2143579,
    pinklockV2CreatedBlock: 0,
    tvlBlockBacktrack: getNumberOfBlocks(30, 3), // 600 blocks
    pinkLockV2: '',
    tvlRouter: '0x145677FC4d9b8F19B5D56d1820c48e0443049a30', // Mad Meerkat Finance
  },
};
