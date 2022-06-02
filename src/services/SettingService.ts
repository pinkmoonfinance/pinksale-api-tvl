import Setting from "../models/Setting";
import { chainToChainConfig, supportedChains } from "../utils/Chain";

const SettingService = {
  async updateIfAlreadyExists(key: string, value: string) {
    const exists = await Setting.findOne({
      key: {
        $eq: key,
      },
    });
    if (!exists) {
      const setting = new Setting();
      setting.key = key;
      setting.value = value;
      await setting.save();
      return setting;
    }
    await Setting.updateOne(
      {
        key,
      },
      {
        $set: {
          key,
          value,
        },
      }
    );
    return exists;
  },
  async getNumberValue(key: string) {
    try {
      const exists = await Setting.findOne({
        key: {
          $eq: key,
        },
      });
      return exists ? Number(exists.value) || 0 : 0;
    } catch (e) {
      return 0;
    }
  },
  async cleanupTVL() {
    try {
      for (const chain of supportedChains()) {
        const chainData = chainToChainConfig[chain];
        await Promise.all([
          Setting.deleteOne({
            key: `liquidity_lock_list_${chainData.chainId}_chunk`,
          }),
          Setting.deleteOne({
            key: `liquidity_lock_list_${chainData.chainId}_chunk_v2`,
          }),
          Setting.deleteOne({
            key: `pool_tvl_${chainData.chainId}_chunk`,
          }),
          Setting.deleteOne({
            key: `token_lock_list_${chainData.chainId}_chunk`,
          }),
          Setting.deleteOne({
            key: `token_lock_list_${chainData.chainId}_chunk_v2`,
          }),
          Setting.deleteOne({
            key: `tvl_records_${chainData.chainId}_lptoken`,
          }),
          Setting.deleteOne({
            key: `tvl_records_${chainData.chainId}_token`,
          }),
          Setting.deleteOne({
            key: `tvl_records_${chainData.chainId}_token`,
          }),
        ]);
      }
    } catch (e) {
      console.log(e);
    }
  }
};

export default SettingService;
