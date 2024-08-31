import * as localDeployments from './env/local';
import * as stagingDeployments from './env/staging';
import * as productionDeployments from './env/production';
exports.local = localDeployments;
exports.staging = stagingDeployments;
exports.production = productionDeployments;
