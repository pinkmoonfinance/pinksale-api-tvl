import { Application } from 'express';
import TVLRouter from './TVLRouter';

const AppRouter = (app: Application) => {
  app.use('/api/v1/tvl', TVLRouter);
};

export default AppRouter;
