import { Message } from './lib/mq';
import { Application, IBoot } from 'egg';
import { lowerFirst, isFunction } from 'lodash';
import path from 'path';

export default class FooBoot implements IBoot {

  private readonly app: Application;

  constructor(app: Application) {
    this.app = app;
    const dir = path.join(this.app.config.baseDir, 'app/mq');
    this.app.loader.loadToContext(dir, 'mq', {
      call: true,
      caseStyle: 'camel',
      fieldClass: 'MQ',
    });
  }


  async didLoad() {
    this.app.mq.init();

    this.app.messenger.on('mq-consume', async ({ consumer, message }: { consumer: string, message: Message }) => {
      const ctx = this.app.createAnonymousContext();
      const cla = ctx.mq[consumer.replace(/^GID(_|-)/i, '').split('-')[0]];
      if (!cla) {
        this.app.getLogger('mqFailedLogger').warn('[mq-consume] MQ执行类不存在: %s', consumer);
        return;
      }

      message.consumer = consumer;

      // 首字母小写处理
      const tag = lowerFirst(message.MessageTag.split('-')[0]);

      if (!isFunction(cla[tag])) {
        this.app.getLogger('mqFailedLogger').warn('[mq-consume] MQ执行类没有对应处理tag方法: %s, %s', consumer, tag);
        return;
      }

      Promise.resolve(cla[tag](message));
    });

  }

  async serverDidReady() {
    this.app.messenger.sendToAgent('mq-ready', { pid: process.pid });
  }
}
