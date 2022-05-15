interface ITVLRecord {
  chain_id: number;
  id: string;
  amount: string;
  unlockedAmount: string;
  unlockDate: String;
  tokenAddress: string;
  factory: string;
  isLiquidity: boolean;
  owner: string;
  version: number;
  lockDate: string;
  tokenDecimals: number | null;
}

export default ITVLRecord;
