
// import '@aliyunmq/mq-http-sdk/lib/client';

declare module '@aliyunmq/mq-http-sdk' {

  class MQClient {
    constructor(endpoint: string, accessKeyId: string, accessKeySecret: string, securityToken: string | null);
    getProducer(instanceId: string, topic: string): MQProducer;
    getConsumer(instanceId: string, topic: string, consumer: string, messageTag: string): MQConsumer;
  }

  class MessageProperties {
    messageKey(key:string): void;
    getProperties(): object;
    startDeliverTime(number): void;
  }

  interface MQProducer {
    publishMessage(body: unknown, tag: string, msgProps?: MessageProperties): Promise<{
      code: number;
      requestId: string;
      body: {
        MessageId: string;
        MessageBodyMD5: string;
      }
    }>;
  }

  interface MQConsumer {
    consumer:string;
    messageTag:string;
    consumeMessage(numOfMessages: number, waitSeconds: number): Promise<never>;
    ackMessage(receiptHandles: unknown[]):Promise<never>;
  }
}
