import mongoose from 'mongoose';
import ISetting from '../types/ISetting';

const SettingSchema = new mongoose.Schema<ISetting>({
  key: String,
  value: String
});

const Setting = mongoose.model('settings', SettingSchema);

export default Setting;
