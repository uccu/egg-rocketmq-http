import { MQ } from '../../lib/mq';

const APP_MQ = Symbol('APP#MQ');

export default {
  get mq() {
    if (!this[APP_MQ]) {
      const CTX_NAME = 'createAnonymousContext';
      this[APP_MQ] = new MQ(this[CTX_NAME]());
    }
    return this[APP_MQ];
  },
};
