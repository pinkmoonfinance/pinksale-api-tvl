import log4js from 'log4js';
const logger = log4js.getLogger();
logger.level = 'debug';

export abstract class BaseMonitor {
  chainId: number;

  constructor(chainId: number) {
    this.chainId = chainId;
  }

  protected log(str: any, ...args: any[]) {
    if (args && args.length > 0) {
      logger.debug(`[${this.chainId}] ${str}`, args);
    } else {
      logger.debug(`[${this.chainId}] ${str}`);
    }
  }

  protected logError(str: any, ...args: any[]) {
    logger.error(`[${this.chainId}] ${str}`, args);
  }
}
