import { MQ } from '../../lib/mq';

const AGENT_MQ = Symbol('AGENT#MQ');

export default {
  get mq() {
    if (!this[AGENT_MQ]) {
      const CTX_NAME = 'createAnonymousContext';
      this[AGENT_MQ] = new MQ(this[CTX_NAME]());
    }
    return this[AGENT_MQ];
  },
};
