import TVL from "../models/TVL";
import TVL2 from "../models/TVL2";
import TVLRecord from "../models/TVLRecord";
import ITVLRecord from "../types/ITVLRecord";

const TVLService = {
  async findByAddress(address: string, chain_id: number) {
    try {
      const result = await TVL.findOne({ address, chain_id });
      return result;
    } catch (e) {
      return null;
    }
  },
  async findByAddressV2(address: string, chain_id: number) {
    try {
      const result = await TVL2.findOne({ address, chain_id });
      return result;
    } catch (e) {
      return null;
    }
  },
  async findTVLRecordByAddress(tokenAddress: string, chain_id: number) {
    try {
      const result = await TVLRecord.findOne({ tokenAddress, chain_id });
      return result;
    } catch (e) {
      return null;
    }
  },
  async findTVLRecordById(id: string, chain_id: number) {
    try {
      const result = await TVLRecord.findOne({ id, chain_id });
      return result;
    } catch (e) {
      return null;
    }
  },
  async find(chainId: number) {
    try {
      const result = await TVL.findOne({
        chain_id: chainId,
      })
        .sort({ field: "asc", _id: -1 })
        .limit(1);
      return result;
    } catch (e) {
      return null;
    }
  },
  async tvl(chainId: number, isStableCoin = false) {
    try {
      const result = await TVL.aggregate([
        {
          $match: {
            chain_id: chainId,
            isStableCoin,
          },
        },
        { $group: { _id: null, total: { $sum: "$tvl" } } },
      ])
      const total = result[0]?.total || 0;
      return total;
    } catch (e) {
      return null;
    }
  },
  async tvlV2(chainId: number, isStableCoin = false) {
    try {
      const result = await TVL2.aggregate([
        {
          $match: {
            chain_id: chainId,
            isStableCoin,
          },
        },
        { $group: { _id: null, total: { $sum: "$tvl" } } },
      ])
      const total = result[0]?.total || 0;
      return total;
    } catch (e) {
      return null;
    }
  },
  async create(address: string, tvl: number, chainId: number, isLiquidity = false, isStableCoin = false, pool = '') {
    try {
      const dbTvl = await this.findByAddress(address, chainId);
      if (dbTvl) {
        await this.update(address, {
          tvl,
          chain_id: chainId,
          isLiquidity,
          isStableCoin,
          pool,
        });
        return;
      }
      const instance = new TVL();
      instance.chain_id = chainId;
      instance.tvl = tvl;
      instance.address = address;
      instance.isLiquidity = isLiquidity;
      instance.isStableCoin = isStableCoin;
      instance.pool = pool;
      return await instance.save();
    } catch (e) {
      return false;
    }
  },
  async createV2(address: string, tvl: number, chainId: number, isLiquidity = false, isStableCoin = false, pool = '') {
    try {
      const dbTvl = await this.findByAddressV2(address, chainId);
      if (dbTvl) {
        await this.updateV2(address, {
          tvl,
          chain_id: chainId,
          isLiquidity,
          isStableCoin,
          pool,
        });
        return;
      }
      const instance = new TVL2();
      instance.chain_id = chainId;
      instance.tvl = tvl;
      instance.address = address;
      instance.isLiquidity = isLiquidity;
      instance.isStableCoin = isStableCoin;
      instance.pool = pool;
      return await instance.save();
    } catch (e) {
      return false;
    }
  },
  async update(address: string, data: any) {
    try {
      await TVL.findOneAndUpdate(
        {
          address,
        },
        {
          $set: data,
        }
      );
    } catch (e) {
      console.log(e);
    }
  },
  async updateV2(address: string, data: any) {
    try {
      await TVL2.findOneAndUpdate(
        {
          address,
        },
        {
          $set: data,
        }
      );
    } catch (e) {
      console.log(e);
    }
  },
  async updateByChain(address: string, chainId: number, data: any) {
    try {
      await TVL.findOneAndUpdate(
        {
          address,
          chain_id: chainId,
        },
        {
          $set: data,
        }
      );
    } catch (e) {
      console.log(e);
    }
  },
  async updateV2ByChain(address: string, chainId: number, data: any) {
    try {
      await TVL2.findOneAndUpdate(
        {
          address,
          chain_id: chainId,
        },
        {
          $set: data,
        }
      );
    } catch (e) {
      console.log(e);
    }
  },
  async updateTVLRecord(id: string, chain_id: number, data: any) {
    try {
      await TVLRecord.findOneAndUpdate(
        {
          id,
          chain_id,
        },
        {
          $set: data,
        }
      );
    } catch (e) {
      console.log(e);
    }
  },
  async deleteTVLRecord(id: string, chain_id: number) {
    try {
      await TVLRecord.findOneAndDelete(
        {
          id,
          chain_id,
        },
      );
    } catch (e) {
      console.log(e);
    }
  },
  async createTVLRecord(data: Partial<ITVLRecord> & {tokenAddress: string}) {
    try {
      const dbTvl = await this.findTVLRecordByAddress(data.tokenAddress, data.chain_id!);
      if (dbTvl) {
        await this.updateTVLRecord(data.id!, data.chain_id!, data);
        return;
      }
      const instance = new TVLRecord();
      instance.chain_id = data.chain_id;
      instance.amount = data.amount;
      instance.unlockedAmount = data.unlockedAmount;
      instance.unlockDate = data.unlockDate;
      instance.isLiquidity = data.isLiquidity;
      instance.tokenAddress = data.tokenAddress;
      instance.factory = data.factory;
      instance.owner = data.owner;
      instance.version = data.version;
      instance.lockDate = data.lockDate;
      instance.id = data.id;
      instance.tokenDecimals = data.tokenDecimals;
      return await instance.save();
    } catch (e) {
      return false;
    }
  },
  async dextools(chainId: number, page = 1) {
    // @ts-ignore
    const pagination = await TVLRecord.paginate({
      chain_id: chainId,
    }, {
      page,
      limit: 100,
    });
    pagination.docs = pagination.docs.map((item: ITVLRecord) => ({
      chain_id: item.chain_id,
      amount: item.amount,
      expired: item.unlockDate,
      address: item.tokenAddress,
      lock_id: item.id,
      owner: item.owner,
      lock_date: item.lockDate,
      token_decimals: item.tokenDecimals || null,
    }))
    return pagination;
  }
};

export default TVLService;
