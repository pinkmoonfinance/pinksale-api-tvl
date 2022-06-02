import { Request, Response } from 'express';
import TVLService from '../services/TVLService';

const pinklock = async (req: Request, res: Response) => {
  try {
    const chainId = req.query.chain_id;
    if (!chainId) {
      return res.sendStatus(404);
    }
    // tvl by native token and stable coin
    const [native, stable, nativeV2, stableV2] = await Promise.all([
      TVLService.tvl(Number(chainId)),
      TVLService.tvl(Number(chainId), true),
      TVLService.tvlV2(Number(chainId)),
      TVLService.tvlV2(Number(chainId), true),
    ]);
    return res.send({
      tvl: Number(native || 0) + Number(nativeV2 || 0),
      stableCoinTvl: Number(stable || 0) + Number(stableV2 || 0),
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
