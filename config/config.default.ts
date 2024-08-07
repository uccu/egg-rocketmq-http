import { EggAppInfo } from 'egg';
import path from 'path';

type ConsumerSendType = 'random' | 'all';


export type ConsumerConfig = {
  consumer: string
  tags: string[]
  numOfMessages?: number
  waitSeconds?: number
  send?: ConsumerSendType
  sure?: boolean
  consumeWait?: number
  topic?: string
};

export default function(appInfo: EggAppInfo) {

  const mq = {
    log: false,
    endpoint: '',
    accessKeyId: '',
    accessKeySecret: '',
    securityToken: null,
    instanceId: '',
    topic: '',
    consumers: [
      {
        topic: '',
        consumer: '',
        tags: [ 'test', 'test2' ],
      },
    ] as ConsumerConfig[],
  };

  const customLogger = {
    mqFailedLogger: {
      file: path.join(appInfo.baseDir, 'logs/mq-failed.log'),
    },
    mqLogger: {
      file: path.join(appInfo.baseDir, 'logs/mq.log'),
    },
  };

  return {
    keys: 'mq', mq, customLogger,
  };
}
