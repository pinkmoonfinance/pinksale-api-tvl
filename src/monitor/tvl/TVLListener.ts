import { formatEther, parseEther, parseUnits } from '@ethersproject/units';
import { BaseMonitor } from '..';
import SettingService from '../../services/SettingService';
import TVLService from '../../services/TVLService';
import { PinklockV1LockRemovedSignature, PinklockV2LockVestedSignature } from '../../signatures';
import { sleep } from '../../utils';
import {
  Chain,
  chainToChainConfig,
  NATIVE_TOKEN,
  STABLE_COIN,
  ZERO,
  ZERO_ADDRESS,
} from '../../utils/Chain';
import RpcLoadBalancer from '../../utils/RpcLoadBalancer';

const PinklockRemovedInput = require('../../../abi/PinklockRemovedInput.json');
const PinklockVestedInput = require('../../../abi/PinklockVestedInput.json');
const UniswapV2RouterAbi = require('../../../abi/UniswapV2Router.json');
const UniswapV2FactoryAbi = require('../../../abi/UniswapV2Factory.json');
const PairAbi = require('../../../abi/Pair.json');
const ERC20Abi = require('../../../abi/ERC20.json');

type TContructorParams = {
  chain: Chain;
};

type TLockRemoved = {
  id: string;
  token: string;
  owner: string;
  amount: string;
  unlockedAt: string;
};

type TLockVested = {
  id: string;
  token: string;
  owner: string;
  amount: string;
  remaining: string;
  timestamp: string;
};

class TVLListener extends BaseMonitor {
  rpcLoadBalancer: RpcLoadBalancer;
  genesisBlock: number;
  genesisBlockV2: number;
  backtrackBlocks: number;
  pinklock: string;
  pinklockV2: string;
  nativeTokenAddress: string;
  stableCoins: string[];
  routerContract: any;

  constructor({ chain }: TContructorParams) {
    const chainConfig = chainToChainConfig[chain];
    super(chainConfig.chainId);
    this.rpcLoadBalancer = new RpcLoadBalancer(chainConfig);
    this.routerContract = this.rpcLoadBalancer.createContract(
      UniswapV2RouterAbi,
      chainConfig.tvlRouter
    );
    this.genesisBlock = chainConfig.pinklockCreatedBlock;
    this.genesisBlockV2 = chainConfig.pinklockV2CreatedBlock;
    this.backtrackBlocks = chainConfig.tvlBlockBacktrack;
    this.pinklock = chainConfig.pinkLock;
    this.pinklockV2 = chainConfig.pinkLockV2;
    this.nativeTokenAddress =
      NATIVE_TOKEN[chainConfig.chainId] || NATIVE_TOKEN[56];
    this.stableCoins = STABLE_COIN[chainConfig.chainId] || STABLE_COIN[56];
  }

  async startMonitoring() {
    this.monitorV1();
  }

  async getBlockRange(version = 1) {
    const storedBlock = await SettingService.getNumberValue(
      `tvl_listener_v${version}_${this.chainId}`
    );
    const blockHeight = await this.rpcLoadBalancer.getCurrentBlock();
    const deserveStartBlock = storedBlock || (version === 2 ? this.genesisBlockV2 : this.genesisBlock);
    const startBlock =
      deserveStartBlock + this.backtrackBlocks >= blockHeight
        ? blockHeight - this.backtrackBlocks
        : deserveStartBlock;
    const endBlock =
      deserveStartBlock + this.backtrackBlocks >= blockHeight
        ? blockHeight
        : deserveStartBlock + this.backtrackBlocks;
    return {
      startBlock,
      endBlock,
    };
  }

  async monitorV1() {
    try {
      const { startBlock, endBlock } = await this.getBlockRange();
      const removedLogs = await this.getLockRemovedEvents(
        startBlock,
        endBlock,
      );
      if (removedLogs.length > 0) {
        for (const log of removedLogs) {
          await this.updateV1LockRecord(log.id, log.token, log.amount);
        }
      }
      await SettingService.updateIfAlreadyExists(
        `tvl_listener_v1_${this.chainId}`,
        endBlock.toString()
      );
      await sleep(30000);
      this.monitorV1();
    } catch (e) {
      //
    }
  }

  async monitorV2() {
    try {
      const { startBlock, endBlock } = await this.getBlockRange(2);
      const logs = await this.getV2LockVestedEvents(
        startBlock,
        endBlock,
      );
      if (logs.length > 0) {
        console.log(logs);
        for (const log of logs) {
          await this.updateV2LockRecord(log.id, log.remaining);
        }
      }
      await SettingService.updateIfAlreadyExists(
        `tvl_listener_v2_${this.chainId}`,
        endBlock.toString()
      );
      await sleep(1000);
      this.monitorV2();
    } catch (e) {
      //
    }
  }

  async getLockRemovedEvents(
    fromBlock: number,
    toBlock: number,
  ) {
    try {
      this.log(`Get LockRemoved event from #${fromBlock} to #${toBlock}`);
      const logs = await this.rpcLoadBalancer
        .getWeb3Instance()
        .eth.getPastLogs({
          fromBlock: fromBlock,
          toBlock: toBlock,
          address: this.pinklock,
          topics: [PinklockV1LockRemovedSignature],
        });
      this.log(`Found ${logs.length} LockRemoved events`);
      const lockRemoved: TLockRemoved[] = [];
      for (const log of logs) {
        if (log.topics[0] === PinklockV1LockRemovedSignature) {
          const data = log.data;
          const topics = [...log.topics];
          topics.shift();
          const result = this.rpcLoadBalancer
            .getWeb3Instance()
            .eth.abi.decodeLog(PinklockRemovedInput, data, topics);
          lockRemoved.push(<TLockRemoved>{
            id: result.id,
            token: result.token,
            owner: result.owner,
            amount: result.amount,
            unlockedAt: result.unlockedAt,
          });
        }
      }
      return lockRemoved;
    } catch (e) {
      this.logError(e);
      return [];
    }
  }

  async getV2LockVestedEvents(
    fromBlock: number,
    toBlock: number,
  ) {
    try {
      this.log(`Get LockVested event from #${fromBlock} to #${toBlock}`);
      const logs = await this.rpcLoadBalancer
        .getWeb3Instance()
        .eth.getPastLogs({
          fromBlock: fromBlock,
          toBlock: toBlock,
          address: this.pinklockV2,
          topics: [PinklockV2LockVestedSignature],
        });
      this.log(`Found ${logs.length} LockVested events`);
      const lockVested: TLockVested[] = [];
      for (const log of logs) {
        if (log.topics[0] === PinklockV2LockVestedSignature) {
          const data = log.data;
          const topics = [...log.topics];
          topics.shift();
          const result = this.rpcLoadBalancer
            .getWeb3Instance()
            .eth.abi.decodeLog(PinklockVestedInput, data, topics);
          lockVested.push(<TLockVested>{
            id: result.id,
            token: result.token,
            owner: result.owner,
            amount: result.amount,
            remaining: result.remaining,
            timestamp: result.timestamp,
          });
        }
      }
      return lockVested;
    } catch (e) {
      this.logError(e);
      return [];
    }
  }

  getTVL(amount: string, nativeReserve: string, tokenReserve: string) {
    if (amount === '0') return 0;
    const price = parseUnits(nativeReserve, 0)
      .mul(parseEther('1'))
      .div(parseUnits(tokenReserve, 0));
    const amountPrice = price.mul(parseUnits(amount, 0)).div(parseEther('1'));
    const priceInBNB = amountPrice.lte(parseUnits('1', 14))
      ? ZERO
      : amountPrice;
    const result = priceInBNB.gt(parseUnits(nativeReserve, 0))
      ? parseUnits(nativeReserve, 0)
      : priceInBNB;
    return parseFloat(formatEther(result));
  }

  async getLiquidityTVL(pair: string, amount: string) {
    try {
      if (pair === ZERO_ADDRESS || amount === '0') return null;
      const pairContract = this.rpcLoadBalancer.createContract(PairAbi, pair);
      const erc20Contract = this.rpcLoadBalancer.createContract(ERC20Abi, pair);
      const [reserves, token0, token1, lpAmount] = await Promise.all([
        pairContract.methods.getReserves().call(),
        pairContract.methods.token0().call(),
        pairContract.methods.token1().call(),
        erc20Contract.methods.totalSupply().call(),
      ]);
      const { _reserve0, _reserve1 } = reserves;
      const isNativePair =
        token0 === this.nativeTokenAddress ||
        token1 === this.nativeTokenAddress;
      if (isNativePair) {
        const nativeReserve =
          token0 === this.nativeTokenAddress ? _reserve0 : _reserve1;
        if (nativeReserve === '0') return null;
        const tvlInPair = parseUnits(nativeReserve, 0)
          .mul(parseUnits('2', 0))
          .mul(parseEther('1'));
        const tvl = tvlInPair
          .div(parseUnits(lpAmount.toString(), 0))
          .mul(parseUnits(amount, 0))
          .div(parseEther('1'));
        return parseFloat(formatEther(tvl));
      }
      const stableCoinReserve = this.stableCoins
        .map((token) => token.toLowerCase())
        .includes(token0.toLowerCase())
        ? _reserve0
        : this.stableCoins
            .map((token) => token.toLowerCase())
            .includes(token1.toLowerCase())
        ? _reserve1
        : '0';
      if (stableCoinReserve === '0') return null;
      const tvlInPair = parseUnits(stableCoinReserve, 0)
        .mul(parseUnits('2', 0))
        .mul(parseEther('1'));
      const tvl = tvlInPair
        .div(parseUnits(lpAmount.toString(), 0))
        .mul(parseUnits(amount, 0))
        .div(parseEther('1'));
      return parseFloat(formatEther(tvl));
    } catch (e) {
      return null;
    }
  }

  async isLpToken(address: string) {
    try {
      const contract = this.rpcLoadBalancer.createContract(PairAbi, address);
      await Promise.all([
        contract.methods.token0().call(),
        contract.methods.factory().call(),
      ]);
      return true;
    } catch (e) {
      return false;
    }
  }

  async getReserves(token: string) {
    try {
      const nativeTokenAddress = await this.routerContract.methods
        .WETH()
        .call();
      const factoryAddress = await this.routerContract.methods.factory().call();
      const factoryContract = this.rpcLoadBalancer.createContract(
        UniswapV2FactoryAbi,
        factoryAddress
      );
      const pairAdddress = await factoryContract.methods
        .getPair(token, nativeTokenAddress)
        .call();
      if (pairAdddress === ZERO_ADDRESS) {
        return null;
      }
      const pairContract = this.rpcLoadBalancer.createContract(
        PairAbi,
        pairAdddress,
        false
      );
      const [token0, reserves] = await Promise.all([
        pairContract.methods.token0().call(),
        pairContract.methods.getReserves().call(),
      ]);
      const { _reserve0, _reserve1 } = reserves;
      const nativeReserve = token0 === token ? _reserve1 : _reserve0;
      const tokenReserve = token0 === token ? _reserve0 : _reserve1;
      if (nativeReserve === '0' && tokenReserve === '0') return null;
      return {
        nativeReserve,
        tokenReserve,
      };
    } catch (e) {
      this.logError(e);
      return null;
    }
  }

  async updateV1LockRecord(id: string, address: string, amount: string) {
    try {
      await TVLService.deleteTVLRecord(id, this.chainId);
      this.log(`Deleted record ${id}`);
      const isLp = await this.isLpToken(address);
      const tvlLocked = await TVLService.findByAddress(address, this.chainId);
      if (tvlLocked === null) {
        this.log(`Can not find record with address ${address}. Dont need to update.`)
        return;
      }
      let tvl: number | null = 0;
      if (isLp) {
        tvl = await this.getLiquidityTVL(address, amount);
      } else {
        const reserves = await this.getReserves(address);
        if (reserves === null) return;
        tvl = await this.getTVL(amount, reserves.nativeReserve, reserves.tokenReserve);
      }
      if (!tvl) return;
      const newTVL = tvlLocked.tvl - (tvl || 0);
      await TVLService.updateByChain(address, this.chainId, {
        tvl: newTVL <= 0 ? 0 : newTVL,
      });
    } catch (e) {
      this.logError(e);
    }
  }

  async updateV2LockRecord(id: string, amount: string) {
    try {
      const tvlLocked = await TVLService.findTVLRecordById(id, this.chainId);
      if (tvlLocked) {
        await TVLService.updateTVLRecord(id, this.chainId, {
          amount,
        });
        this.log(`Update record ${id}. Amount: ${tvlLocked.amount} to ${amount}`);
      }
    } catch (e) {
      this.logError(e);
    }
  }
}

export default TVLListener;
