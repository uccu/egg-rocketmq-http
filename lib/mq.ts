import { Application, Context, EggAppConfig, EggApplication } from 'egg';
import { MQClient, MQProducer, MQConsumer } from '@aliyunmq/mq-http-sdk';
import { ConsumerConfig } from '@c/config.default';


class EMQConsumer {
  private _c: MQConsumer;
  private acks: Set<string>;
  private timeout?: NodeJS.Timeout;
  config: ConsumerConfig;
  app: EggApplication;

  constructor(app:EggApplication, consumer:MQConsumer, config:ConsumerConfig) {
    this._c = consumer;
    this.acks = new Set();
    this.config = config;
    this.app = app;
  }

  consumeMessage() {
    return this._c.consumeMessage(
      this.config.numOfMessages || 16, // 一次最多消费3条（最多可设置为16条）。
      this.config.waitSeconds || 30, // 长轮询时间3秒（最多可设置为30秒）。
    );
  }

  ackMessage(receiptHandles: string[]) {
    receiptHandles.forEach(r => {
      this.acks.delete(r);
    });
    if (this.acks.size === 0) {
      this.resume();
    }
    return this._c.ackMessage(receiptHandles);
  }


  resume() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }
    this.app.mq._watch(this);
  }


  setAckTimeout() {
    if (this.acks.size === 0) {
      this.resume();
      return;
    }
    this.timeout = setTimeout(() => {
      this.timeout = undefined;
      this.app.getLogger('mqFailedLogger').error('[mq-ack] ack timeout: %s', JSON.stringify(this.acks));
      this.acks.clear();
      this.resume();
    }, this.config.consumeWait || 30000);
    this.timeout.unref();
  }

}


export class Consumer {
  protected readonly ctx: Context;
  protected readonly app: Application;
  constructor(ctx: Context) {
    this.ctx = ctx;
    this.app = ctx.app;
  }
}
export interface Message {
  // 消息ID
  MessageId: string,
  // 消息体MD5
  MessageBodyMD5: string,
  // 发送消息的时间戳，毫秒
  PublishTime: number,
  // 下次重试消费的时间，前提是这次不调用{ackMessage} 确认消费消费成功，毫秒
  NextConsumeTime: number,
  // 第一次消费的时间，毫秒，顺序消费无意义
  FirstConsumeTime: number,
  // 消费的次数
  ConsumedTimes: number,
  // 消息句柄，调用 {ackMessage} 需要将消息句柄传入，用于确认该条消息消费成功
  ReceiptHandle: string,
  // 消息内容
  MessageBody: string,
  // 消息标签
  MessageTag: string,

  Properties:Record<string, string>,

  MessageKey?:string,
}

export interface ResponseData {
  code: number,
  requestId: string,
  body: Message[]
}

interface AckResponseData {
  code: number,
  requestId: string,
  body: {
    // 消息句柄，调用 {ackMessage} 需要将消息句柄传入，用于确认该条消息消费成功
    ReceiptHandle: string,
    ErrorCode: string,
    ErrorMessage: string,
  }[]
}

export class MQ {

  ctx: Context;
  app: Application;
  config: EggAppConfig['mq'];

  client: MQClient;

  producers: Record<string, MQProducer> = {};
  consumers: Record<string, EMQConsumer> = {};

  constructor(ctx) {
    this.ctx = ctx;
    this.app = ctx.app;
    this.config = this.app.config.mq;
    this.client = new MQClient(this.config.endpoint, this.config.accessKeyId, this.config.accessKeySecret, this.config.securityToken);
  }

  getProducer(topic?: string) {

    if (!topic) {
      topic = this.config.topic;
    }

    if (!this.producers[topic]) {
      this.producers[topic] = this.client.getProducer(this.config.instanceId, topic);
    }
    return this.producers[topic];
  }

  getConsumer(consumer: string) {
    if (!this.consumers[consumer]) {
      const config = this.config.consumers.find(c => c.consumer === consumer) || { consumer, tags: [] };
      const bconsumer = this.client.getConsumer(this.config.instanceId, this.config.topic, consumer, config.tags?.join('||') || '');
      this.consumers[consumer] = new EMQConsumer(this.app, bconsumer, config);
    }
    return this.consumers[consumer];
  }


  init() {
    for (const c of this.config.consumers) {
      if (!c.send) {
        c.send = 'random';
      }
      this.getConsumer(c.consumer);
    }
  }

  watch() {
    for (const consumer in this.consumers) {
      this._watch(this.consumers[consumer]);
    }
  }


  async ack(consumer: string, receiptHandles: string[]) {

    if (this.app.options.type !== 'agent') {
      this.app.messenger.sendToAgent('mq-ack', { consumer, receiptHandles });
      return;
    }

    const ackRes: AckResponseData = await this.getConsumer(consumer).ackMessage(receiptHandles);
    if (ackRes.code !== 204) {
      // 某些消息的句柄可能超时，会导致消息消费状态确认不成功。
      let errorMsg = '[mq-ack] Ack Message Fail, consumer: %s';
      const errorPar: any[] = [ consumer ];
      ackRes.body.forEach(error => {
        errorMsg += '\tErrorHandle: %s, Code:%s, Reason: %s\n';
        errorPar.push(error.ReceiptHandle, error.ErrorCode, error.ErrorMessage);
      });
      this.app.getLogger('mqFailedLogger').error(errorMsg, ...errorPar);
    }

    if (this.app.config.mq.log) {
      const erhs = ackRes.body?.map(m => m.ReceiptHandle) || [];
      receiptHandles.forEach(r => {
        if (!erhs.includes(r)) {
          this.app.getLogger('mqLogger').info('[mq-ack] consumer: %s, receiptHandle: %s', consumer, r);
        }
      });
    }

    return ackRes;
  }

  async _watch(consumer: EMQConsumer) {


    const consumerName = consumer.config.consumer;

    const logger = this.app.logger;
    try {
      // 长轮询消费消息。
      // 长轮询表示如果Topic没有消息，则客户端请求会在服务端挂起3s，3s内如果有消息可以消费则立即返回响应。
      const res: ResponseData = await consumer.consumeMessage();

      if (res.code === 200) {
        // 消息消费处理逻辑。
        logger.debug('Consume Messages, requestId:%s', res.requestId);

        const handles: string[] = [];

        for (const message of res.body) {
          if (consumer.config.send === 'random') {
            this.app.messenger.sendRandom('mq-consume', { consumer: consumerName, message });
            if (consumer.config.sure) {
              handles.push(message.ReceiptHandle);
            }
          } else {
            this.app.messenger.sendToApp('mq-consume', { consumer: consumerName, message });
            handles.push(message.ReceiptHandle);
          }

          if (this.app.config.mq.log) {
            this.app.getLogger('mqLogger').info(
              '[mq-consume] requestId: %s, msg: %s', res.requestId, JSON.stringify(message),
            );
          }
        }

        if (handles.length > 0) {
          await this.ack(consumerName, handles);
        }


        consumer.setAckTimeout();

      }
    } catch (e: any) {
      if (e.Code && e.Code.indexOf('MessageNotExist') > -1) {
        // 没有消息，则继续长轮询服务器。
        logger.debug('Consume Message: no new message, RequestId:%s, Code:%s', e.RequestId, e.Code);
      } else if (e.message && e.message.includes('Cannot read property \'Message\' of undefined')) {
        logger.error('读到空消息: ' + e.message);
      } else if (e.message && e.message.includes('getaddrinfo ENOTFOUND')) {
        logger.error('网络连接失败: ' + e.message);
        // 发送报错邮件
        reportError(this.app, e);
      } else {
        logger.error(e);
        // 发送报错邮件
        reportError(this.app, e);
      }
    }
  }


  publish(body: any, tag = '', key = null) {
    this.app.messenger.sendToAgent('mq-publish', { body, tag, key });
  }

}


function reportError(app: Application, err: Error) {
  const errorText = `错误信息: ${err.name}: ${err.message}\n` +
    `错误栈: ${err.stack}`;

  if (app.mifenErrorReporter) {
    app.mifenErrorReporter.reportDirect(app, errorText);
  }
}
