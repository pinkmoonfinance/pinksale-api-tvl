import { formatEther, parseEther, parseUnits } from '@ethersproject/units';
import chunk from 'lodash/chunk';
import TVLService from '../../services/TVLService';
import SettingService from '../../services/SettingService';
import { sleep } from '../../utils';
import { BaseMonitor } from '..';
import { Chain, chainToChainConfig, ZERO, ZERO_ADDRESS, NATIVE_TOKEN, STABLE_COIN } from '../../utils/Chain';
import RpcLoadBalancer from '../../utils/RpcLoadBalancer';

const PinkLockAbi = require('../../../abi/PinkLock.json');
const PinkLockV2Abi = require('../../../abi/PinklockV2.json');
const UniswapV2RouterAbi = require('../../../abi/UniswapV2Router.json');
const UniswapV2FactoryAbi = require('../../../abi/UniswapV2Factory.json');
const PairAbi = require('../../../abi/Pair.json');
const ERC20Abi = require('../../../abi/ERC20.json');
const PoolManagerAbi = require('../../../abi/PoolManagerAbi.json');
const PoolAbi = require('../../../abi/PoolAbi.json');

interface TokenLockRecord {
  token: string;
  amount: string;
  factory: string;
}

interface MonitorData {
  chain: Chain;
}

export default class TVLMonitor extends BaseMonitor {
  rpcLoadBalancer: RpcLoadBalancer;
  contract: any;
  contractV2: any;
  routerContract: any;
  poolManagerContract: any;
  nativeTokenAddress: string;
  stableCoins: string[];

  constructor({ chain }: MonitorData) {
    const chainConfig = chainToChainConfig[chain];
    super(chainConfig.chainId);
    this.rpcLoadBalancer = new RpcLoadBalancer(chainConfig);
    this.contract = this.rpcLoadBalancer.createContract(
      PinkLockAbi,
      chainConfig.pinkLock
    );
    this.contractV2 = this.rpcLoadBalancer.createContract(
      PinkLockV2Abi,
      chainConfig.pinkLockV2
    );
    this.routerContract = this.rpcLoadBalancer.createContract(
      UniswapV2RouterAbi,
      chainConfig.tvlRouter
    );
    this.poolManagerContract = this.rpcLoadBalancer.createContract(
      PoolManagerAbi,
      chainConfig.poolManager
    );
    this.nativeTokenAddress =
      NATIVE_TOKEN[chainConfig.chainId] || NATIVE_TOKEN[56];
    this.stableCoins = STABLE_COIN[chainConfig.chainId] || STABLE_COIN[56];
  }

  async startMonitoring() {
    if (!this.nativeTokenAddress) {
      this.log(`[${this.chainId}] No WETH address provide.`);
      return;
    }
    this.calculateTVL(this.contract);
    // this.calculatePoolTVL(); temporaty disable because only pool from 0 to 891 have locked token in pool. It already exists in db
    await sleep(10000);
    this.calculateTVL(this.contractV2, `token_lock_list_${this.chainId}_chunk_v2`, `liquidity_lock_list_${this.chainId}_chunk_v2`);
  }

  async calculatePoolTVL() {
    this.log(`Calculating pool TVL...`);
    const pools = await this.canCalculateTVLPools();
    await this.calcTVLPool(pools);
    this.log(`Calculating pool TVL DONE`);
    await sleep(60000);
    this.calculatePoolTVL();
  }

  async canCalculateTVLPools() {
    try {
      const all: string[] = await this.poolManagerContract.methods
        .getAllPools()
        .call();

      // for (let i = 0; i < all.length; i++) {
      //   const index = await this.findValidPoolVersion(all[i], i);
      //   if (index) {
      //     break;
      //   }
      // }

      // const promises = all.map((pool) => this.findValidPoolVersion(pool));
      // const results = await Promise.all(promises);
      // const filtered = results.filter(Boolean);
      // console.log(filtered, filtered.length);
      // console.log("done");
      // found: 885, 891 (only fairlaunch)
      return all.slice(0, 891);
    } catch (e) {
      return [];
    }
  }

  async findValidPoolVersion(address: string): Promise<any> {
    try {
      const poolContract = this.rpcLoadBalancer.createContract(
        PoolAbi,
        address
      );
      const version = await poolContract.methods.version().call();
      if ((version >= 21 && version <= 24) || version < 7) {
        this.log(`Pool ${address} version: ${version}`);
        return address;
      }
      // if (version > 24) {
      //   console.log(version, index);
      //   return index;
      // }
      return null;
    } catch (e: any) {
      this.logError('findValidPoolVersion', e.message);
      return null;
    }
  }

  async getPoolInfoWithTVL(poolAddress: string): Promise<any> {
    let retries = 0;
    while (true) {
      try {
        const valid = await this.poolManagerContract.methods
          .isPoolGenerated(poolAddress)
          .call();
        if (!valid) {
          return null;
        }
        const poolContract = this.rpcLoadBalancer.createContract(
          PoolAbi,
          poolAddress
        );
        const state = await poolContract.methods.poolState().call();
        if (Number(state) === 2) {
          return null; // pool was cancelled
        }
        const token = await poolContract.methods.token().call();
        if (token !== ZERO_ADDRESS) {
          const nativeTokenAddress = await this.routerContract.methods
            .WETH()
            .call();
          const factoryAddress = await this.routerContract.methods
            .factory()
            .call();
          const factoryContract = this.rpcLoadBalancer.createContract(
            UniswapV2FactoryAbi,
            factoryAddress,
            false
          );
          const pairAdddress = await factoryContract.methods
            .getPair(token, nativeTokenAddress)
            .call();
          if (pairAdddress !== ZERO_ADDRESS) {
            const tokenContract = this.rpcLoadBalancer.createContract(
              ERC20Abi,
              pairAdddress,
              false
            );
            const amount = await tokenContract.methods
              .balanceOf(poolAddress)
              .call();
            this.log(
              'getPoolInfoWithTVL',
              pairAdddress,
              amount,
              token,
              poolAddress
            );
            if (pairAdddress !== ZERO_ADDRESS && amount && amount !== '0') {
              await this.getLiquidityTVL(pairAdddress, amount, poolAddress, 1);
            }
          }
        }
        return null;
      } catch (e: any) {
        this.logError(`getPoolInfoWithTVL address: ${poolAddress}`, e.message);
        if (
          e.message.includes('execution reverted') ||
          e.message.includes('invalid address')
        ) {
          return null;
        }

        retries++;

        if (retries === 5) {
          return null;
        }

        await sleep(retries * 500);
      }
    }
  }

  async calculateTVL(contract: any, tokenLockListKey?: string, liquidityLockListKey?: string) {
    const tokenCount = await this.tokenCount(contract);
    const liquidityCount = await this.liquidityCount(contract);
    this.log(`Calc TVL for token: ${tokenCount}, liquidity token: ${liquidityCount}`);
    await Promise.all([
      this.getTokenLockList(Number(tokenCount), contract, tokenLockListKey),
      this.getLiquidityLockList(Number(liquidityCount), contract, liquidityLockListKey),
    ]);
    this.log('calculateTVL DONE');
    await sleep(60000);
    this.calculateTVL(contract, tokenLockListKey, liquidityLockListKey);
  }

  async tokenCount(contract: any) {
    return await contract.methods.allNormalTokenLockedCount().call();
  }

  async liquidityCount(contract: any) {
    return await contract.methods.allLpTokenLockedCount().call();
  }

  async getReserves(token: string, amount: string) {
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
        token,
        nativeReserve,
        tokenReserve,
        amount,
        pair: pairAdddress,
      };
    } catch (e) {
      console.log(e);
      return null;
    }
  }

  getTVL(amount: string, nativeReserve: string, tokenReserve: string) {
    if (amount === '0') return ZERO;
    const price = parseUnits(nativeReserve, 0)
      .mul(parseEther('1'))
      .div(parseUnits(tokenReserve, 0));
    const amountPrice = price.mul(parseUnits(amount, 0)).div(parseEther('1'));
    const priceInBNB = amountPrice.lte(parseUnits('1', 14))
      ? ZERO
      : amountPrice;
    return priceInBNB.gt(parseUnits(nativeReserve, 0))
      ? parseUnits(nativeReserve, 0)
      : priceInBNB;
  }

  async getLiquidityTVL(pair: string, amount: string, pool = '', version: number) {
    try {
      if (pair === ZERO_ADDRESS || amount === '0') return null;
      const pairContract = this.rpcLoadBalancer.createContract(PairAbi, pair);
      const erc20Contract = this.rpcLoadBalancer.createContract(
        ERC20Abi,
        pair,
        false
      );
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
        if (nativeReserve === '0') return;
        const tvlInPair = parseUnits(nativeReserve, 0)
          .mul(parseUnits('2', 0))
          .mul(parseEther('1'));
        const tvl = tvlInPair
          .div(parseUnits(lpAmount.toString(), 0))
          .mul(parseUnits(amount, 0))
          .div(parseEther('1'));
        if (version === 2) {
          await TVLService.createV2(
            pair,
            parseFloat(formatEther(tvl)),
            this.chainId,
            true,
            false,
            pool,
          );
        } else {
          await TVLService.create(
            pair,
            parseFloat(formatEther(tvl)),
            this.chainId,
            true,
            false,
            pool,
          );
        }
      } else {
        const stableCoinReserve = this.stableCoins
          .map((token) => token.toLowerCase())
          .includes(token0.toLowerCase())
          ? _reserve0
          : this.stableCoins
              .map((token) => token.toLowerCase())
              .includes(token1.toLowerCase())
          ? _reserve1
          : '0';
        if (stableCoinReserve === '0') return;
        const tvlInPair = parseUnits(stableCoinReserve, 0)
          .mul(parseUnits('2', 0))
          .mul(parseEther('1'));
        const tvl = tvlInPair
          .div(parseUnits(lpAmount.toString(), 0))
          .mul(parseUnits(amount, 0))
          .div(parseEther('1'));
        if (version === 2) {
          await TVLService.createV2(
            pair,
            parseFloat(formatEther(tvl)),
            this.chainId,
            true,
            true,
            pool,
          );
        } else {
          await TVLService.create(
            pair,
            parseFloat(formatEther(tvl)),
            this.chainId,
            true,
            true,
            pool,
          );
        }
      }
    } catch (e) {
      console.log(e);
    }
  }

  async liquidityLockRecordsTVL(start: number, end: number, contract: any, isV2 = false) {
    try {
      const tokenLockedRecords = await contract.methods
        .getCumulativeLpTokenLockInfo(start, end)
        .call();
      const records: TokenLockRecord[] =
        tokenLockedRecords?.map(
          ({ token, amount, factory }: TokenLockRecord) => ({
            token,
            factory,
            amount: amount.toString(),
          })
        ) ?? [];
      const promises = records.map((item) =>
        this.getLiquidityTVL(item.token, item.amount, undefined, isV2 ? 2 : 1)
      );
      await Promise.all(promises);
      console.log('Saved liquidity TVL: ', start, end);
    } catch (e) {
      console.log(e);
    }
  }

  async tokenLockRecordsTVL(start: number, end: number, contract: any, version: number) {
    try {
      const tokenLockedRecords = await contract.methods
        .getCumulativeNormalTokenLockInfo(start, end)
        .call();
      const records: TokenLockRecord[] =
        tokenLockedRecords?.map(
          ({ token, amount, factory }: TokenLockRecord) => ({
            token,
            factory,
            amount: amount.toString(),
          })
        ) ?? [];
      const promises = records.map((item) =>
        this.getReserves(item.token, item.amount)
      );
      const reserves = await Promise.all(promises);
      const results = reserves
        .filter(Boolean)
        .filter((item) => !!item?.token)
        .map((item) => ({
          ...item,
          tvl: this.getTVL(
            item?.amount || '0',
            item?.nativeReserve,
            item?.tokenReserve
          ),
        }));
      await Promise.all(
        results.map((item) =>
          version === 2 ? TVLService.createV2(
            item.token!,
            parseFloat(formatEther(item.tvl)),
            this.chainId,
            undefined,
            undefined,
            undefined,
          ) : TVLService.create(
            item.token!,
            parseFloat(formatEther(item.tvl)),
            this.chainId,
            undefined,
            undefined,
            undefined,
          )
        )
      );
      console.log('TVL saved', start, end);
    } catch (e) {
      console.log(e);
    }
  }

  async poolRecordsTVL(list: string[]) {
    try {
      const promises = list.map((pool) => this.getPoolInfoWithTVL(pool)) ?? [];
      await Promise.all(promises);
      console.log('pool TVL saved');
    } catch (e) {
      console.log(e);
    }
  }

  async calcTVLPool(list: string[]) {
    const storedChunkNum = await SettingService.getNumberValue(
      `pool_tvl_${this.chainId}_chunk`
    );
    // step = 50
    const indexes = chunk(list, 50);
    const selectedIndex = storedChunkNum
      ? storedChunkNum >= indexes.length - 1
        ? indexes.length - 1
        : storedChunkNum
      : 0;
    const pools = indexes[selectedIndex];
    console.log('Get pools tvl for ', pools);
    await this.poolRecordsTVL(pools || []);
    await SettingService.updateIfAlreadyExists(
      `pool_tvl_${this.chainId}_chunk`,
      (selectedIndex + 1).toString()
    );
  }

  async getTokenLockList(total: number, contract: any, key?: string) {
    const storedChunkNum = await SettingService.getNumberValue(
      key || `token_lock_list_${this.chainId}_chunk`
    );
    // step = 50
    const indexes = chunk(
      Array(total)
        .fill(1)
        .map((_, i) => i),
      50
    ).map((item) => [
      Math.min(...item),
      item[item.length - 1] >= total
        ? item[item.length - 1]
        : Math.max(...item),
    ]);
    const selectedIndex = storedChunkNum
      ? storedChunkNum >= indexes.length - 1
        ? indexes.length - 1
        : storedChunkNum
      : 0;
    const [start, end] = indexes[selectedIndex];
    this.log(`getTokenLockList: ${start} - ${end}`);
    await this.tokenLockRecordsTVL(start, end, contract, typeof key !== 'undefined' ? 2 : 1);
    await SettingService.updateIfAlreadyExists(
      key || `token_lock_list_${this.chainId}_chunk`,
      (selectedIndex + 1).toString()
    );
    // await Promise.all([this.tokenLockRecordsTVL(0, 50)]);
  }

  async getLiquidityLockList(total: number, contract: any, key?: string) {
    const storedChunkNum = await SettingService.getNumberValue(
      key || `liquidity_lock_list_${this.chainId}_chunk`
    );
    // step = 50
    const indexes = chunk(
      Array(total)
        .fill(1)
        .map((_, i) => i),
      50
    ).map((item) => [
      Math.min(...item),
      item[item.length - 1] >= total
        ? item[item.length - 1]
        : Math.max(...item),
    ]);
    const selectedIndex = storedChunkNum
      ? storedChunkNum >= indexes.length - 1
        ? indexes.length - 1
        : storedChunkNum
      : 0;
    const [start, end] = indexes[selectedIndex];
    console.log('Get liquidity tvl for ', start, end);
    await this.liquidityLockRecordsTVL(start, end, contract, typeof key !== 'undefined');
    await SettingService.updateIfAlreadyExists(
      key || `liquidity_lock_list_${this.chainId}_chunk`,
      (selectedIndex + 1).toString()
    );
    // await Promise.all([this.tokenLockRecordsTVL(0, 50)]);
  }
}
