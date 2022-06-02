import mongoose from 'mongoose';
import ITVL from '../types/ITVL';

const TVLSchema = new mongoose.Schema<ITVL>(
  {
    chain_id: Number,
    address: {
      type: String,
      index: true,
    },
    tvl: Number,
    isLiquidity: {
      type: Boolean,
      default: false,
    },
    isStableCoin: {
      type: Boolean,
      default: false,
    },
    pool: {
      type: String,
      default: '',
    }
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
    versionKey: false,
  }
);

const TVL2 = mongoose.model('v2_tvls', TVLSchema);

export default TVL2;
