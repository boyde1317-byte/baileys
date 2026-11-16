import { DEFAULT_CONNECTION_CONFIG } from '../Defaults/index.js';
import { createReportingInfoStore } from '../Store/reporting-info-store.js';
import { makeUsernameSocket } from './username.js';
// export the last socket layer
const makeWASocket = (config) => {
    const newConfig = {
        ...DEFAULT_CONNECTION_CONFIG,
        ...config
    };
    if (!newConfig.reportingInfoStore) {
        newConfig.reportingInfoStore = createReportingInfoStore();
    }
    return makeUsernameSocket(newConfig);
};
export default makeWASocket;
