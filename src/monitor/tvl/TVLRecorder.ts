import chunk from 'lodash/chunk';
import range from 'lodash/range';

import { BaseMonitor } from '..';
import SettingService from '../../services/SettingService';
import TVLService from '../../services/TVLService';
import { sleep } from '../../utils';
import { Chain, chainToChainConfig } from '../../utils/Chain';
import RpcLoadBalancer from '../../utils/RpcLoadBalancer';

const PinklockV1Abi = require('../../../abi/PinkLock.json');
const Erc20Abi = require('../../../abi/ERC20.json');
const PinklockV2Abi = require('../../../abi/PinklockV2.json');

type TContructorParams = {
  chain: Chain;
};

const cacheDecimals: { [key: string]: number } = {};

class TVLRecorder extends BaseMonitor {
  rpcLoadBalancer: RpcLoadBalancer;
  pinklockAddress: string;
  pinklockV2Address: string;

  constructor({ chain }: TContructorParams) {
    const chainConfig = chainToChainConfig[chain];
    super(chainConfig.chainId);
    this.pinklockAddress = chainConfig.pinkLock;
    this.pinklockV2Address = chainConfig.pinkLockV2;
    this.rpcLoadBalancer = new RpcLoadBalancer(chainConfig);
  }

  getTokenContract(address: string) {
    return this.rpcLoadBalancer.createContract(Erc20Abi, address);
  }

  async getTokenDecimals(address: string) {
    try {
      const cached = cacheDecimals[address];
      if (cached) {
        return cached;
      }
      const contract = this.getTokenContract(address);
      const decimals = await contract.methods.decimals().call();
      cacheDecimals[address] = +decimals;
      return +decimals;
    } catch (e) {
      this.logError(e);
      return null;
    }
  }

  async startMonitoring() {
    this.log('TVL Recorder is starting...');
    const pinklockV1Contract = this.rpcLoadBalancer.createContract(
      PinklockV1Abi,
      this.pinklockAddress
    );
    // TODO: update v2 later
    // const pinklockV2Contract = this.rpcLoadBalancer.createContract(
    //   PinklockV2Abi,
    //   this.pinklockV2Address
    // );
    await Promise.all([
      this.calcV1TVLRecord(pinklockV1Contract),
      this.calcV1TVLLpRecord(pinklockV1Contract),
      // this.calcV2TVLRecord(pinklockV2Contract),
      // this.calcV2TVLLpRecord(pinklockV2Contract),
    ]);
    await sleep(5 * 60 * 1000);
    this.startMonitoring();
  }

  async calcV1TVLLpRecord(contract: any) {
    try {
      const count = +(await contract.methods.allLpTokenLockedCount().call());
      // this.log(`Total v1 lp token locked: ${count}`);
      /**
       * Get 100 record at the same time
       */
      const indexes = chunk(range(count), 100).map((item) => [
        Math.min(...item),
        Math.max(...item),
      ]);
      let i = await SettingService.getNumberValue(
        `tvl_records_${this.chainId}_lptoken`
      );

      while (i < indexes.length) {
        await this.getV1Locks(
          contract,
          indexes[i][0],
          indexes[i][1],
          count,
          'getCumulativeLpTokenLockInfo'
        );
        await SettingService.updateIfAlreadyExists(
          `tvl_records_${this.chainId}_lptoken`,
          i.toString()
        );
        sleep(10000);
        i++;
      }
    } catch (e) {
      this.logError(e);
    }
  }

  async calcV2TVLLpRecord(contract: any) {
    try {
      const count = +(await contract.methods.allLpTokenLockedCount().call());
      // this.log(`Total v1 lp token locked: ${count}`);
      /**
       * Get 100 record at the same time
       */
      const indexes = chunk(range(count), 100).map((item) => [
        Math.min(...item),
        Math.max(...item),
      ]);
      let i = await SettingService.getNumberValue(
        `tvl_records_v2_${this.chainId}_lptoken`
      );

      while (i < indexes.length) {
        await this.getV2Locks(
          contract,
          indexes[i][0],
          indexes[i][1],
          count,
          'getCumulativeLpTokenLockInfo'
        );
        await SettingService.updateIfAlreadyExists(
          `tvl_records_v2_${this.chainId}_lptoken`,
          i.toString()
        );
        sleep(1000);
        i++;
      }
    } catch (e) {
      this.logError(e);
    }
  }

  async calcV1TVLRecord(contract: any) {
    try {
      const count = +(await contract.methods
        .allNormalTokenLockedCount()
        .call());
      // this.log(`Total v1 token locked: ${count}`);
      /**
       * Get 100 record at the same time
       */
      const indexes = chunk(range(count), 100).map((item) => [
        Math.min(...item),
        Math.max(...item),
      ]);
      let i = await SettingService.getNumberValue(
        `tvl_records_${this.chainId}_token`
      );

      while (i < indexes.length) {
        await this.getV1Locks(contract, indexes[i][0], indexes[i][1], count);
        await SettingService.updateIfAlreadyExists(
          `tvl_records_${this.chainId}_token`,
          i.toString()
        );
        sleep(10000);
        i++;
      }
    } catch (e) {
      this.logError(e);
    }
  }

  async calcV2TVLRecord(contract: any) {
    try {
      const count = +(await contract.methods
        .allNormalTokenLockedCount()
        .call());
      // this.log(`Total v1 token locked: ${count}`);
      /**
       * Get 100 record at the same time
       */
      const indexes = chunk(range(count), 100).map((item) => [
        Math.min(...item),
        Math.max(...item),
      ]);
      let i = await SettingService.getNumberValue(
        `tvl_records_v2_${this.chainId}_token`
      );

      while (i < indexes.length) {
        await this.getV2Locks(contract, indexes[i][0], indexes[i][1], count);
        await SettingService.updateIfAlreadyExists(
          `tvl_records_v2_${this.chainId}_token`,
          i.toString()
        );
        sleep(10000);
        i++;
      }
    } catch (e) {
      this.logError(e);
    }
  }

  async getV1Locks(
    contract: any,
    start: number,
    end: number,
    total: number,
    method:
      | 'getCumulativeNormalTokenLockInfo'
      | 'getCumulativeLpTokenLockInfo' = 'getCumulativeNormalTokenLockInfo'
  ): Promise<void> {
    try {
      this.log(
        `Get ${
          method === 'getCumulativeLpTokenLockInfo' ? 'LPlock' : 'lock'
        } records ${start}-${end}/${total}`
      );
      const lock = await contract.methods[method](start, end).call();
      let records: any = [];
      let i = 0;
      while (i < lock.length) {
        const r = await this.getV1Records(contract, lock[i].token);
        if (r) {
          const newRecord = r.map((item) => ({
            ...item,
            factory: lock[i].factory,
            chain_id: this.chainId,
            isLiquidity: method === 'getCumulativeLpTokenLockInfo',
          }));
          records = records.concat(newRecord);
        }
        await sleep(method === 'getCumulativeLpTokenLockInfo' ? 3000 : 2000);
        i++;
      }
      const promises = records.map((item: any) =>
        TVLService.createTVLRecord(item)
      );
      await Promise.all(promises);
    } catch (e) {
      this.logError(e);
    }
  }

  async getV2Locks(
    contract: any,
    start: number,
    end: number,
    total: number,
    method:
      | 'getCumulativeNormalTokenLockInfo'
      | 'getCumulativeLpTokenLockInfo' = 'getCumulativeNormalTokenLockInfo'
  ): Promise<void> {
    try {
      this.log(
        `Get ${
          method === 'getCumulativeLpTokenLockInfo' ? 'LPlock' : 'lock'
        } records ${start}-${end}/${total}`
      );
      const lock = await contract.methods[method](start, end).call();
      let records: any = [];
      let i = 0;
      while (i < lock.length) {
        const r = await this.getV2Records(contract, lock[i].token);
        if (r) {
          const newRecord = r.map((item) => ({
            ...item,
            factory: lock[i].factory,
            chain_id: this.chainId,
            isLiquidity: method === 'getCumulativeLpTokenLockInfo',
          }));
          records = records.concat(newRecord);
        }
        // await sleep(method === 'getCumulativeLpTokenLockInfo' ? 3000 : 2000);
        i++;
      }
      const promises = records.map((item: any) =>
        TVLService.createTVLRecord(item)
      );
      await Promise.all(promises);
    } catch (e) {
      this.logError(e);
    }
  }

  async getV1Records(
    contract: any,
    token: string
  ): Promise<null | Array<{ token: string; factory: string; amount: string }>> {
    try {
      if (!token) return null;
      const count = +(await contract.methods
        .totalLockCountForToken(token)
        .call());
      const decimals = await this.getTokenDecimals(token);
      const indexes = chunk(range(count), 100).map((item) => [
        Math.min(...item),
        Math.max(...item),
      ]);
      const promises = indexes.map(([start, end]) =>
        contract.methods.getLocksForToken(token, start, end).call()
      );
      const records = await Promise.all(promises);
      const result = records.reduce((acc, current) => {
        acc = [...acc, ...current];
        return acc;
      }, []);
      return result.map((item: any) => ({
        id: item.id,
        token: item.token,
        tokenAddress: item.token,
        owner: item.owner,
        amount: item.amount,
        unlockedAmount: '0',
        lockDate: item.lockDate,
        unlockDate: item.unlockDate,
        version: 1,
        tokenDecimals: decimals,
      }));
    } catch (e) {
      this.logError(e);
      return null;
    }
  }

  async getV2Records(
    contract: any,
    token: string
  ): Promise<null | Array<{ token: string; factory: string; amount: string }>> {
    try {
      if (!token) return null;
      const count = +(await contract.methods
        .totalLockCountForToken(token)
        .call());
      const decimals = await this.getTokenDecimals(token);
      const indexes = chunk(range(count), 100).map((item) => [
        Math.min(...item),
        Math.max(...item),
      ]);
      const promises = indexes.map(([start, end]) =>
        contract.methods.getLocksForToken(token, start, end).call()
      );
      const records = await Promise.all(promises);
      const result = records.reduce((acc, current) => {
        acc = [...acc, ...current];
        return acc;
      }, []);
      return result.map((item: any) => ({
        id: item.id,
        token: item.token,
        tokenAddress: item.token,
        owner: item.owner,
        amount: item.amount,
        unlockedAmount: item.unlockedAmount,
        lockDate: item.lockDate,
        unlockDate: item.tgeDate,
        version: 2,
        tokenDecimals: decimals,
      }));
    } catch (e) {
      this.logError(e);
      return null;
    }
  }
}

export default TVLRecorder;
