import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

import ITVLRecord from '../types/ITVLRecord';

const TVLRecordSchema = new mongoose.Schema<ITVLRecord>(
  {
    chain_id: Number,
    tokenAddress: {
      type: String,
      index: true,
    },
    factory: String,
    amount: String,
    unlockedAmount: String,
    isLiquidity: {
      type: Boolean,
      default: false,
    },
    unlockDate: String,
    lockDate: String,
    owner: String,
    version: Number,
    id: String,
    tokenDecimals: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: true,
    },
    versionKey: false,
  }
);

// @ts-ignore
TVLRecordSchema.plugin(mongoosePaginate);

const TVLRecord = mongoose.model('tvl_records', TVLRecordSchema);

export default TVLRecord;
