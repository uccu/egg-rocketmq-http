# egg-rocketmq-http

provides egg bindings for the ali rocketMQ.

[![npm download](https://img.shields.io/github/actions/workflow/status/uccu/egg-rocketmq-http/publish.yml)](https://github.com/uccu/egg-rocketmq-http/actions/workflows/publish.yml)
[![NPM version][npm-image]][npm-url]
[![GitHub issues](https://img.shields.io/github/issues/uccu/egg-rocketmq-http)](https://github.com/uccu/egg-rocketmq-http/issues)
![GitHub](https://img.shields.io/github/license/uccu/egg-rocketmq-http)

[npm-image]: https://img.shields.io/npm/v/egg-rocketmq-http.svg?style=flat-square
[npm-url]: https://npmjs.org/package/egg-rocketmq-http
[download-image]: https://img.shields.io/npm/dm/egg-rocketmq-http.svg?style=flat-square
[download-url]: https://npmjs.org/package/egg-rocketmq-http

## Install

```bash
$ npm i egg-rocketmq-http --save
```

## Usage

```typescript
// {app_root}/config/plugin.ts
export const rocketMQ = {
  enable: true,
  package: 'egg-rocketmq-http',
}

// {app_root}/config/config.default.ts
export const rocketMQ = {
    ...
    consumers: [
      {
        consumer: 'cons',
        tags: string[ 'tagA' ]
      },
    ] ,
};

// Producer
this.app.mq.publish(body, 'tagA');

// Consumer
// {app_root}/app/mq/cons.ts
import { Consumer, Message } from 'egg-rocketmq-http';
export default class Cons extends Consumer {
  private name = 'cons';
  async tagA(message: Message) {
    console.log('cons\'s tagA action: %s', message.MessageBody);
    this.app.mq.ack(this.name, [ message.ReceiptHandle ]);
  }
}


```

see [lib/discovery/controller.ts](lib/discovery/controller.ts) for more detail.

## Configuration

```js
// {app_root}/config/config.default.ts
exports.rocketMQ = {
    log: true, // it will log in the path /logs/mq.log
    endpoint: '',
    accessKeyId: '',
    accessKeySecret: '',
    securityToken: null,
    instanceId: '',
    topic: '',
    consumers: {
      xxxxx: {
        tags: string[ 'test' ], // tags the app watched
        numOfMessages?: 3,
        waitSeconds?: 30,
        send?: 'random', // default, send to a random app, or you can set to 'all'
        sure?: false, // must be success, it will send ack automatically
        consumeWait?: 30000 // maximum waiting time for consumption, default: 30000(ms)
      },
    } ,
};
```

see [config/config.default.ts](config/config.default.ts) for more detail.

## Questions & Suggestions

Please open an issue [here](https://github.com/uccu/egg-rocketmq-http/issues).

## License

[MIT](LICENSE)
