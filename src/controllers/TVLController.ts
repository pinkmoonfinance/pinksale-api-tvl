import { Request, Response } from 'express';
import TVLService from '../services/TVLService';

const pinklock = async (req: Request, res: Response) => {
  try {
    const chainId = req.query.chain_id;
    if (!chainId) {
      return res.sendStatus(404);
    }
    const [native, stable] = await Promise.all([
      TVLService.tvl(Number(chainId)), // return tvl in native token. Ex: ETH, BNB...
      TVLService.tvl(Number(chainId), true), // return tvl in stablecoin. Ex: USDT, USDC...
    ]);
    return res.send({
      tvl: native,
      stableCoinTvl: stable,
    });
  } catch (e) {
    console.log(e);
    return res.sendStatus(404);
  }
};

const dextools = async (req: Request, res: Response) => {
  try {
    const chainId = req.query.chain_id;
    const page = req.query.page || 1;
    if (!chainId || isNaN(+chainId) || isNaN(+page)) {
      return res.sendStatus(404);
    }
    const results = await TVLService.dextools(+chainId, +page)
    return res.send(results);
  } catch (e) {
    return res.sendStatus(404);
  }
};

const TVLController = {
  pinklock,
  dextools,
};

export default TVLController;
