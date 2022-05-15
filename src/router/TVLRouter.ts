import express from 'express';
import TVLController from '../controllers/TVLController';

const router = express.Router();

router.get('/pinklock', TVLController.pinklock);
router.get('/dextools', TVLController.dextools);

const TVLRouter = router;

export default TVLRouter;
