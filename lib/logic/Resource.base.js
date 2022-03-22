const _ = require('lodash');

class ResourceBase {
    constructor(sdk) {
        this.sdk = sdk;
    }

    getApis() {
        const proto = Object.getPrototypeOf(this);
        return Object.getOwnPropertyNames(proto)
            .filter((p) => p !== 'constructor')
            .reduce((acc, prop) => {
                const method = this[prop];
                if (_.isFunction(method)) {
                    acc[prop] = method.bind(this);
                }
                return acc;
            }, {});
    }

    toString() {
        const proto = Object.getPrototypeOf(this);
        const props = Object.getOwnPropertyNames(proto)
            .filter((p) => p !== 'constructor')
            .map((p) => `${p}()`);
        return `${proto.constructor.name}: [ ${props.join(', ')} ]`;
    }
}

module.exports = ResourceBase;
