import Web3 from 'web3';
import log4js from 'log4js';
import { Chain, ChainConfig, chainToChainConfig } from './Chain';

const logger = log4js.getLogger();
logger.level = 'debug';

export default class RpcLoadBalancer {
  chainId: number;
  web3s: Web3[];
  index = -1;

  constructor(chainConfig: ChainConfig) {
    this.chainId = chainConfig.chainId;
    this.web3s = this.createWeb3Instances(chainConfig.rpcs);
  }

  private createWeb3Instances(rpcs: string[]): Web3[] {
    const web3s = [];
    for (const rpc of rpcs) {
      web3s.push(new Web3(rpc));
    }
    if (web3s.length == 0) {
      web3s.push(new Web3(''));
    }
    return web3s;
  }

  current(): Web3 {
    if (this.index < 0) this.index = 0;
    return this.web3s[this.index];
  }

  next(): Web3 {
    if (this.index < this.web3s.length - 1) {
      this.index++;
    } else {
      this.index = 0;
    }
    return this.web3s[this.index];
  }

  private log(str: string) {
    // logger.debug(`[${this.chainId}] ${str}`);
  }

  createContract(abi: any, address: string, shuffle = true) {
    let instance;
    if (shuffle) {
      instance = this.next();
      const provider: any = instance.currentProvider;
      this.log(`Shuffle RPC to: ${provider.host}`);
    } else {
      instance = this.current();
      const provider: any = instance.currentProvider;
      this.log(`Reuse current RPC: ${provider.host}`);
    }
    return new instance.eth.Contract(abi, address);
  }

  async getCurrentBlock(): Promise<number> {
    let retries = 0;
    while (true) {
      try {
        const instance = this.next();
        const block = await instance.eth.getBlockNumber();
        return block;
      } catch (e) {
        retries++;
        if (retries == 3) {
          throw e;
        }
      }
    }
  }

  getWeb3Instance(shuffle = true) {
    if (shuffle) {
      return this.next();
    } else {
      return this.current();
    }
  }
}
