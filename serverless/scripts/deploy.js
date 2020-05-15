const { TwilioServerlessApiClient } = require('@twilio-labs/serverless-api');
const { getListOfFunctionsAndAssets } = require('@twilio-labs/serverless-api/dist/utils/fs');
const path = require('path');
const cli = require('cli-ux').default;
const constants = require('../constants')

require('dotenv').config();

const client = require('twilio')(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);
const serverlessClient = new TwilioServerlessApiClient({
  accountSid: process.env.ACCOUNT_SID,
  authToken: process.env.AUTH_TOKEN,
});

async function deployFunctions() {
  cli.action.start('Creating Api Key');
  const api_key = await client.newKeys.create({ friendlyName: constants.API_KEY_NAME });
  cli.action.start('Deploying functions');
  const { functions } = await getListOfFunctionsAndAssets(path.join(__dirname, '..'));
  return serverlessClient.deployProject({
    env: {
      TWIML_APP_SID: 'foo',
      API_KEY: api_key.sid,
      API_SECRET: api_key.secret,
    },
    pkgJson: {},
    functionsEnv: 'dev',
    assets: [],
    functions,
    serviceName: constants.SERVICE_NAME,
  });
}

function createTwiMLApp(domain) {
  cli.action.start('Creating TwiML App');
  return client.applications.create({
    voiceMethod: 'GET',
    voiceUrl: `https://${domain}/twiml/record`,
    friendlyName: constants.TWIML_APP_NAME,
  });
}

async function updateVariable(app, TwiMLApp) {
  cli.action.start('Updating configuration');
  const appInstance = await client.serverless.services(app.serviceSid);
  const environment = await appInstance.environments(app.environmentSid);
  const variables = await environment.variables.list();
  const TwimlAppSidVariable = variables.find((variable) => variable.key === 'TWIML_APP_SID');
  return await environment.variables(TwimlAppSidVariable.sid).update({ value: TwiMLApp.sid });
}

async function deploy() {
  const app = await deployFunctions();
  const TwiMLApp = await createTwiMLApp(app.domain);
  await updateVariable(app, TwiMLApp);

  cli.action.stop();
  console.log('Deployed to: https://' + app.domain);
}

if (require.main === module) {
  deploy();
} else {
  module.exports = deploy;
}
