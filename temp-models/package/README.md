# one.models

## Getting started

### In general

-   Download and install
    -   [node.js](https://nodejs.org/en/download/current/)
    -   [git](https://git-scm.com/downloads)
-   A Github account authenticated with a ssh key pair
-   Access to
    -   github.com/refinio/one.core

```bash
git clone https://github.com/refinio/one.models
cd one.models
npm install
```

## About the project

Main models used in one built in one package

## Project structure in general

-   Source files go into the **/src** folder.
-   Test files into **/test** folder.
-   They will both be process by **build.js** and the .ts files will be transpiled into the **/lib** folder
-   ONE plan modules into **/src/plan_modules** they are compiled with **/build_plan_modules.js**

## Style

As said we use TypeScript above JavaScript ES6 meaning we use **import**,**export** statements
instead of require. And have the newest javascript features available

Additional we use **prettier.js** for automatic code styling. Here you should also copy an existing
**.prettierc** form an existing project.

Most modern IDEs support to file watchers which then can execute scripts on changes.
Setup **prettier.js** and **build.js** te be run on file changes.

## TypeScript

The file **@OneCoreTypes.d.ts** defines the types this project uses as well as exports

## One.js (one.models Facade)

### Simple usage example:

```typescript
import One from '@refinio/one.models/lib/api/One.js';

async function startOne() {
    const oneConfig = {commServerUrl: 'wss://comm10.dev.refinio.one'};
    const one = new One(oneConfig);
    await one.init();
    // can start using one now
    const myInfo = await one.getLeuteApi().getMyInfo();
    console.log(myInfo);
}

startOne().catch(console.error);
```

### Supply external models usage example:

```typescript
import One from '@refinio/one.models/lib/api/One.js';

async function startOne() {
    // external to ONE.js models
    const commServerUrl = 'wss://comm10.dev.refinio.one';
    const leuteModel = new LeuteModel(commServerUrl, true);
    const channelManager = new ChannelManager(leuteModel);
    const questionnaireModel = new QuestionnaireModel(channelManager);
    const documentModel = new DocumentModel(channelManager);
    const iom = new IomManager(leuteModel, commServerUrl);
    const topicModel = new TopicModel(channelManager, leuteModel);

    // ONE.js with external models
    const oneConfig = {commServerUrl, useExternalModels: true};
    const one = new One(oneConfig);
    await one.init({
        initedModels: {
            leuteModel: leuteModel,
            channelManager: channelManager,
            questionnaireModel: questionnaireModel,
            documentModel: documentModel,
            iomManager: iom,
            topicModel: topicModel
        }
    });
}

## Tools

To build the `CommServer`, `PasswordRecoveryServer` and `GenerateIdentity` tools run

```bash
npm run bundle
```
