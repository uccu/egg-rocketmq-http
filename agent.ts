import { Agent, IBoot } from 'egg';
import { MessageProperties } from '@aliyunmq/mq-http-sdk';
export default class FooBoot implements IBoot {

  app: Agent;

  constructor(app: Agent) {
    this.app = app;
  }

  async didLoad() {
    this.app.mq.init();
    this.app.messenger.on('mq-publish', async ({ body, tag, key, topic, deliverTime }) => {
      const producer = this.app.mq.getProducer(topic || this.app.config.mq.topic);

      const msgProps = new MessageProperties();
      if (key) {
        key.messageKey(key);
      }

      if (deliverTime) {
        msgProps.startDeliverTime(deliverTime);
      }

      const ret = await producer.publishMessage(body, tag, msgProps);
      if (ret.code !== 201) {
        this.app.getLogger('mqFailedLogger').warn(
          '[mq-publish] tag: %s, props: %s, body: %s, ret: %s',
          tag, JSON.stringify(key), body, JSON.stringify(ret),
        );
      }
      if (this.app.config.mq.log) {
        this.app.getLogger('mqLogger').info(
          '[mq-publish] tag: %s, props: %s, body: %s, ret: %s',
          tag, JSON.stringify(key), body, JSON.stringify(ret),
        );
      }
    });

    this.app.messenger.on('mq-ack', async ({ consumer, receiptHandles }) => {
      this.app.mq.ack(consumer, receiptHandles);
    });

    this.app.messenger.once('mq-ready', ({ pid }) => {
      this.app.logger.info('[mq-init] service ready, pid: %d', pid);
      this.app.mq.watch();
    });
  }


}
