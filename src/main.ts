import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import useragent from 'express-useragent';

import ErrorHandler from './middleware/ErrorHandler';
import NotFoundHandler from './middleware/NotFoundHandler';
import AppRouter from './router';
import TVLMonitor from './monitor/tvl';
import { Chain, supportedChains } from './utils/Chain';
import TVLRecorder from './monitor/tvl/TVLRecorder';
import SettingService from './services/SettingService';
import TVLListener from './monitor/tvl/TVLListener';

if (!process.env.PORT) {
  process.exit(1);
}

const PORT: number = parseInt(process.env.PORT as string, 10);
const app = express();
const keyGenerator = function (req: any) {
  try {
    return req.headers['x-forwarded-for'] || req.body?.publicIp;
  } catch (e) {
    return undefined;
  }
};

const corsOptions = {
  origin: 'https://www.pinksale.finance',
};

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minutes
  max: 50, // limit each IP to 1000 requests per windowMs
  keyGenerator: keyGenerator,
});

app.use(useragent.express());
app.use(apiLimiter);
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
AppRouter(app);

app.use(ErrorHandler);
app.use(NotFoundHandler);

const server = app.listen(PORT, async () => {
  await mongoose.connect(
    `mongodb://${process.env.DB_HOST}:27017/${process.env.DB_NAME}`,
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
      useCreateIndex: true,
    }
  );
  console.log('Database connected!');
  console.log(`Listening on port ${PORT}`);
  monitorTVL();
  listenTVL();
  recordTVL();
  scheduleCleanupTVL();
});

const listenTVL = () => {
  for (const chain of supportedChains()) {
    if (chain == Chain.BSC_TEST) continue;
    const monitor = new TVLListener({
      chain: chain,
    });
    monitor.startMonitoring();
  }
};

const recordTVL = () => {
  for (const chain of supportedChains()) {
    if (chain == Chain.BSC_TEST) continue;
    const monitor = new TVLRecorder({
      chain: chain,
    });
    monitor.startMonitoring();
  }
};

const monitorTVL = () => {
  for (const chain of supportedChains()) {
    if (chain == Chain.BSC_TEST) continue;
    const monitor = new TVLMonitor({
      chain: chain,
    });
    monitor.startMonitoring();
  }
};

const scheduleCleanupTVL = async () => {
  // run at 0:00 to update tvl record everyday
  cron.schedule('0 0 * * *', async () => {
    console.log('Cleanup tvl...');
    SettingService.cleanupTVL();
  });
};

/**
 * Webpack HMR Activation
 */

type ModuleId = string | number;

interface WebpackHotModule {
  hot?: {
    data: any;
    accept(
      dependencies: string[],
      callback?: (updatedDependencies: ModuleId[]) => void
    ): void;
    accept(dependency: string, callback?: () => void): void;
    accept(errHandler?: (err: Error) => void): void;
    dispose(callback: (data: any) => void): void;
  };
}

declare const module: WebpackHotModule;

if (module.hot) {
  module.hot.accept();
  module.hot.dispose(() => server.close());
}
