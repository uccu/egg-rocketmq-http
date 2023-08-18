import { MQ, Message, Consumer } from './lib/mq';
import de from './config/config.default';

declare module 'egg' {
  interface EggApplication {
    mq: MQ
  }

  interface EggAppConfig {
    mq: ReturnType<typeof de>['mq']
  }
}


export {
  Message, MQ, Consumer,
};
