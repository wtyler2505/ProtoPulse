const fs = require('fs');
const puppeteer = require('puppeteer'); // v23.0.0 or later

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const timeout = 5000;
    page.setDefaultTimeout(timeout);

    const lhApi = await import('lighthouse'); // v10.0.0 or later
    const flags = {
        screenEmulation: {
            disabled: true
        }
    }
    const config = lhApi.desktopConfig;
    const lhFlow = await lhApi.startFlow(page, {name: 'Recording 3/6/2026 at 9:51:01 PM', config, flags});
    {
        const targetPage = page;
        await targetPage.setViewport({
            width: 1920,
            height: 546
        })
    }
    await lhFlow.startNavigation();
    {
        const targetPage = page;
        await targetPage.goto('http://localhost:5000/');
    }
    await lhFlow.endNavigation();
    await lhFlow.startNavigation();
    {
        const targetPage = page;
        await targetPage.goto('about:blank');
    }
    await lhFlow.endNavigation();
    await lhFlow.startNavigation();
    {
        const targetPage = page;
        await targetPage.goto('http://localhost:5000/');
    }
    await lhFlow.endNavigation();
    await lhFlow.startTimespan();
    {
        const targetPage = page;
        await targetPage.emulateNetworkConditions({
          offline: false,
          downloadThroughput: -1,
          uploadThroughput: -1,
          latency: 0,
        });
    }
    await lhFlow.endTimespan();
    await lhFlow.startNavigation();
    {
        const targetPage = page;
        await targetPage.goto('http://localhost:5000/');
    }
    await lhFlow.endNavigation();
    await lhFlow.startTimespan();
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(Dashboard)'),
            targetPage.locator("[data-testid='tab-dashboard']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"tab-dashboard\\"])'),
            targetPage.locator(":scope >>> [data-testid='tab-dashboard']")
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 65.75,
                y: 18.25,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator("[data-testid='dashboard-view']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"dashboard-view\\"])'),
            targetPage.locator(":scope >>> [data-testid='dashboard-view']")
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 29.75,
                y: 158.5,
              },
            });
    }
    await lhFlow.endTimespan();
    await lhFlow.startNavigation();
    {
        const targetPage = page;
        const promises = [];
        const startWaitingForEvents = () => {
            promises.push(targetPage.waitForNavigation());
        }
        await puppeteer.Locator.race([
            targetPage.locator("[data-testid='dashboard-view']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"dashboard-view\\"])'),
            targetPage.locator(":scope >>> [data-testid='dashboard-view']")
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 18.75,
                y: 46.5,
              },
            });
        await Promise.all(promises);
    }
    await lhFlow.endNavigation();
    await lhFlow.startTimespan();
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(3D View)'),
            targetPage.locator("[data-testid='tab-viewer_3d']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"tab-viewer_3d\\"])'),
            targetPage.locator(":scope >>> [data-testid='tab-viewer_3d']"),
            targetPage.locator('::-p-text(3D View)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 43.375,
                y: 19.25,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(Learn)'),
            targetPage.locator("[data-testid='tab-knowledge']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"tab-knowledge\\"])'),
            targetPage.locator(":scope >>> [data-testid='tab-knowledge']"),
            targetPage.locator('::-p-text(Learn)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 29.28125,
                y: 11.25,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(Project Settings)'),
            targetPage.locator("[data-testid='button-project-settings']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"button-project-settings\\"])'),
            targetPage.locator(":scope >>> [data-testid='button-project-settings']")
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 164.25,
                y: 13.53125,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator("[data-testid='button-project-settings'] > span"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"button-project-settings\\"]/span)'),
            targetPage.locator(":scope >>> [data-testid='button-project-settings'] > span"),
            targetPage.locator('::-p-text(Project Settings)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 55.75,
                y: 5.6875,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(Search articles...)'),
            targetPage.locator("[data-testid='knowledge-search']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"knowledge-search\\"])'),
            targetPage.locator(":scope >>> [data-testid='knowledge-search']")
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 541.75,
                y: 15.75,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('body > div:nth-of-type(4) > div'),
            targetPage.locator('::-p-xpath(/html/body/div[4]/div)'),
            targetPage.locator(':scope >>> body > div:nth-of-type(4) > div')
        ])
            .setTimeout(timeout)
            .click({
              delay: 1151,
              offset: {
                x: 65,
                y: 9,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(Dashboard)'),
            targetPage.locator("[data-testid='tab-dashboard']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"tab-dashboard\\"])'),
            targetPage.locator(":scope >>> [data-testid='tab-dashboard']")
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 45.75,
                y: 11.25,
              },
            });
    }
    await lhFlow.endTimespan();
    await lhFlow.startNavigation();
    {
        const targetPage = page;
        const promises = [];
        const startWaitingForEvents = () => {
            promises.push(targetPage.waitForNavigation());
        }
        await puppeteer.Locator.race([
            targetPage.locator("[data-testid='dashboard-view']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"dashboard-view\\"])'),
            targetPage.locator(":scope >>> [data-testid='dashboard-view']")
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              offset: {
                x: 78.75,
                y: 171.5,
              },
            });
        await Promise.all(promises);
    }
    await lhFlow.endNavigation();
    await lhFlow.startTimespan();
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(Component Editor)'),
            targetPage.locator("[data-testid='tab-component_editor']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"tab-component_editor\\"])'),
            targetPage.locator(":scope >>> [data-testid='tab-component_editor']")
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 47.234375,
                y: 11.25,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(Library) >>>> ::-p-aria([role=\\"generic\\"])'),
            targetPage.locator("[data-testid='button-library'] > span"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"button-library\\"]/span)'),
            targetPage.locator(":scope >>> [data-testid='button-library'] > span"),
            targetPage.locator('::-p-text(Library)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 7.6875,
                y: 9.375,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(Next)'),
            targetPage.locator("[data-testid='button-next-page']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"button-next-page\\"])'),
            targetPage.locator(":scope >>> [data-testid='button-next-page']"),
            targetPage.locator('::-p-text(Next)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 14.078125,
                y: 14.453125,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator("[data-testid='dialog-library-browser'] > button > svg"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"dialog-library-browser\\"]/button/svg)'),
            targetPage.locator(":scope >>> [data-testid='dialog-library-browser'] > button > svg")
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 2,
                y: 6.046875,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(PCB[role=\\"button\\"])'),
            targetPage.locator("#main-panel [data-testid='tab-pcb']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"tab-pcb\\"])'),
            targetPage.locator(":scope >>> #main-panel [data-testid='tab-pcb']")
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 28.46875,
                y: 11.875,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(PCB[role=\\"tab\\"])'),
            targetPage.locator("header [data-testid='tab-pcb']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"tab-pcb\\"])'),
            targetPage.locator(":scope >>> header [data-testid='tab-pcb']")
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 33.203125,
                y: 8.25,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator("[data-testid='settings-button'] > svg"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"settings-button\\"]/svg)'),
            targetPage.locator(":scope >>> [data-testid='settings-button'] > svg")
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 16.625,
                y: 12.75,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(Test Connection)'),
            targetPage.locator("[data-testid='test-connection-btn']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"test-connection-btn\\"])'),
            targetPage.locator(":scope >>> [data-testid='test-connection-btn']"),
            targetPage.locator('::-p-text(Test Connection)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 38,
                y: 7,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(API KEY)'),
            targetPage.locator("[data-testid='api-key-input']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"api-key-input\\"])'),
            targetPage.locator(":scope >>> [data-testid='api-key-input']")
        ])
            .setTimeout(timeout)
            .click({
              count: 2,
              offset: {
                x: 237,
                y: 16.375,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(API KEY)'),
            targetPage.locator("[data-testid='api-key-input']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"api-key-input\\"])'),
            targetPage.locator(":scope >>> [data-testid='api-key-input']")
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 237,
                y: 16.375,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(API KEY)'),
            targetPage.locator("[data-testid='api-key-input']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"api-key-input\\"])'),
            targetPage.locator(":scope >>> [data-testid='api-key-input']")
        ])
            .setTimeout(timeout)
            .fill('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');
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(Test Connection)'),
            targetPage.locator("[data-testid='test-connection-btn']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"test-connection-btn\\"])'),
            targetPage.locator(":scope >>> [data-testid='test-connection-btn']"),
            targetPage.locator('::-p-text(Test Connection)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 21,
                y: 12,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('div.absolute div:nth-of-type(5)'),
            targetPage.locator('::-p-xpath(//*[@id=\\"chat-panel\\"]/div/div/div[4]/div[2]/div/div[5])'),
            targetPage.locator(':scope >>> div.absolute div:nth-of-type(5)')
        ])
            .setTimeout(timeout)
            .click({
              delay: 2278,
              offset: {
                x: 23,
                y: 92.375,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(Gemini)'),
            targetPage.locator("[data-testid='provider-gemini']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"provider-gemini\\"])'),
            targetPage.locator(":scope >>> [data-testid='provider-gemini']"),
            targetPage.locator('::-p-text(Gemini)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 93.25,
                y: 23.75,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('div.absolute div:nth-of-type(5) circle'),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"toggle-api-key-visibility\\"]/svg/circle)'),
            targetPage.locator(':scope >>> div.absolute div:nth-of-type(5) circle')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 1.625,
                y: 2.75,
              },
            });
    }
    await lhFlow.endTimespan();
    await lhFlow.startNavigation();
    {
        const targetPage = page;
        await targetPage.goto('chrome://new-tab-page/');
    }
    await lhFlow.endNavigation();
    await lhFlow.startNavigation();
    {
        const targetPage = page;
        await targetPage.goto('https://aistudio.google.com/');
    }
    await lhFlow.endNavigation();
    await lhFlow.startTimespan();
    {
        const target = await browser.waitForTarget(t => t.url() === 'https://aistudio.google.com/', { timeout });
        const targetPage = await target.page();
        targetPage.setDefaultTimeout(timeout);
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(...3OaU)'),
            targetPage.locator('tr:nth-of-type(1) > td.cdk-column-Key button'),
            targetPage.locator('::-p-xpath(/html/body/app-root/ms-app/div/div/div[2]/div/span/ms-api-keys/div/div/ms-api-key-table/div/table/tbody/tr[1]/td[1]/div[1]/ms-api-key-key-string/button)'),
            targetPage.locator(':scope >>> tr:nth-of-type(1) > td.cdk-column-Key button'),
            targetPage.locator('::-p-text(...3OaU)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 35,
                y: 13.33203125,
              },
            });
    }
    {
        const target = await browser.waitForTarget(t => t.url() === 'https://aistudio.google.com/', { timeout });
        const targetPage = await target.page();
        targetPage.setDefaultTimeout(timeout);
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(Copy key to clipboard) >>>> ::-p-aria([role=\\"generic\\"])'),
            targetPage.locator('mat-dialog-content > div:nth-of-type(1) span'),
            targetPage.locator('::-p-xpath(//*[@id=\\"mat-mdc-dialog-0\\"]/div/div/ms-apikey-details-dialog/mat-dialog-content/div[1]/div[2]/button/span)'),
            targetPage.locator(':scope >>> mat-dialog-content > div:nth-of-type(1) span')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 7.24609375,
                y: 9.328125,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(API KEY)'),
            targetPage.locator("[data-testid='api-key-input']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"api-key-input\\"])'),
            targetPage.locator(":scope >>> [data-testid='api-key-input']")
        ])
            .setTimeout(timeout)
            .click({
              count: 2,
              offset: {
                x: 154,
                y: 16.375,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(API KEY)'),
            targetPage.locator("[data-testid='api-key-input']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"api-key-input\\"])'),
            targetPage.locator(":scope >>> [data-testid='api-key-input']")
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 154,
                y: 16.375,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(API KEY)'),
            targetPage.locator("[data-testid='api-key-input']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"api-key-input\\"])'),
            targetPage.locator(":scope >>> [data-testid='api-key-input']")
        ])
            .setTimeout(timeout)
            .fill('AIzaSyC5-KF8AiNC63-9YwnXFShxaz6JCQh3OaU');
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(Test Connection)'),
            targetPage.locator("[data-testid='test-connection-btn']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"test-connection-btn\\"])'),
            targetPage.locator(":scope >>> [data-testid='test-connection-btn']"),
            targetPage.locator('::-p-text(Test Connection)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 20,
                y: 2,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('div.absolute div:nth-of-type(5)'),
            targetPage.locator('::-p-xpath(//*[@id=\\"chat-panel\\"]/div/div/div[4]/div[2]/div/div[5])'),
            targetPage.locator(':scope >>> div.absolute div:nth-of-type(5)')
        ])
            .setTimeout(timeout)
            .click({
              delay: 1084,
              offset: {
                x: 78,
                y: 127.375,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('div.absolute div:nth-of-type(5)'),
            targetPage.locator('::-p-xpath(//*[@id=\\"chat-panel\\"]/div/div/div[4]/div[2]/div/div[5])'),
            targetPage.locator(':scope >>> div.absolute div:nth-of-type(5)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 264,
                y: 164.375,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator("[data-testid='settings-key-error']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"settings-key-error\\"])'),
            targetPage.locator(":scope >>> [data-testid='settings-key-error']")
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 206,
                y: 54.25,
              },
            });
    }
    await lhFlow.endTimespan();
    await lhFlow.startNavigation();
    {
        const targetPage = page;
        const promises = [];
        const startWaitingForEvents = () => {
            promises.push(targetPage.waitForNavigation());
        }
        await puppeteer.Locator.race([
            targetPage.locator('div.absolute div:nth-of-type(5)'),
            targetPage.locator('::-p-xpath(//*[@id=\\"chat-panel\\"]/div/div/div[4]/div[2]/div/div[5])'),
            targetPage.locator(':scope >>> div.absolute div:nth-of-type(5)')
        ])
            .setTimeout(timeout)
            .on('action', () => startWaitingForEvents())
            .click({
              delay: 2233,
              offset: {
                x: 7,
                y: 82.375,
              },
            });
        await Promise.all(promises);
    }
    await lhFlow.endNavigation();
    await lhFlow.startTimespan();
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(Chat settings)'),
            targetPage.locator("[data-testid='settings-button']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"settings-button\\"])'),
            targetPage.locator(":scope >>> [data-testid='settings-button']")
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 10.25,
                y: 25.375,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('div.absolute div:nth-of-type(5) > div svg'),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"toggle-api-key-visibility\\"]/svg)'),
            targetPage.locator(':scope >>> div.absolute div:nth-of-type(5) > div svg')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 5.5,
                y: 3.625,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(Gemini)'),
            targetPage.locator("[data-testid='provider-gemini']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"provider-gemini\\"])'),
            targetPage.locator(":scope >>> [data-testid='provider-gemini']"),
            targetPage.locator('::-p-text(Gemini)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 68.25,
                y: 9.75,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(Test Connection)'),
            targetPage.locator("[data-testid='test-connection-btn']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"test-connection-btn\\"])'),
            targetPage.locator(":scope >>> [data-testid='test-connection-btn']"),
            targetPage.locator('::-p-text(Test Connection)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 11,
                y: 8,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(MODEL)'),
            targetPage.locator("[data-testid='model-select']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"model-select\\"])'),
            targetPage.locator(":scope >>> [data-testid='model-select']"),
            targetPage.locator('::-p-text(gemini-2.5-flash)')
        ])
            .setTimeout(timeout)
            .click({
              delay: 1741,
              offset: {
                x: 61,
                y: 17.75,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(Anthropic)'),
            targetPage.locator("[data-testid='provider-anthropic']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"provider-anthropic\\"])'),
            targetPage.locator(":scope >>> [data-testid='provider-anthropic']"),
            targetPage.locator('::-p-text(Anthropic)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 87,
                y: 18.75,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(API KEY)'),
            targetPage.locator("[data-testid='api-key-input']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"api-key-input\\"])'),
            targetPage.locator(":scope >>> [data-testid='api-key-input']"),
            targetPage.locator('::-p-text(AIzaSyC5-KF8AiNC63-9YwnXFShxaz6JCQh3OaU)')
        ])
            .setTimeout(timeout)
            .click({
              count: 2,
              offset: {
                x: 202,
                y: 23.375,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(API KEY)'),
            targetPage.locator("[data-testid='api-key-input']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"api-key-input\\"])'),
            targetPage.locator(":scope >>> [data-testid='api-key-input']"),
            targetPage.locator('::-p-text(AIzaSyC5-KF8AiNC63-9YwnXFShxaz6JCQh3OaU)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 202,
                y: 23.375,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(API KEY)'),
            targetPage.locator("[data-testid='api-key-input']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"api-key-input\\"])'),
            targetPage.locator(":scope >>> [data-testid='api-key-input']"),
            targetPage.locator('::-p-text(AIzaSyC5-KF8AiNC63-9YwnXFShxaz6JCQh3OaU)')
        ])
            .setTimeout(timeout)
            .fill('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');
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(Test Connection)'),
            targetPage.locator("[data-testid='test-connection-btn']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"test-connection-btn\\"])'),
            targetPage.locator(":scope >>> [data-testid='test-connection-btn']"),
            targetPage.locator('::-p-text(Test Connection)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 83,
                y: 7,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator("[data-testid='button-theme-picker'] > svg"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"button-theme-picker\\"]/svg)'),
            targetPage.locator(":scope >>> [data-testid='button-theme-picker'] > svg")
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 12.875,
                y: 1.25,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator("[data-testid='theme-swatch-midnight-purple'] > div.gap-1 > div:nth-of-type(2)"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"theme-swatch-midnight-purple\\"]/div[1]/div[2])'),
            targetPage.locator(":scope >>> [data-testid='theme-swatch-midnight-purple'] > div.gap-1 > div:nth-of-type(2)")
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 12.375,
                y: 15,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator("[data-testid='theme-swatch-amber'] > div.text-\\[10px\\]"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"theme-swatch-amber\\"]/div[3])'),
            targetPage.locator(":scope >>> [data-testid='theme-swatch-amber'] > div.text-\\[10px\\]")
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 29,
                y: 0.25,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(Open color theme picker)'),
            targetPage.locator("[data-testid='button-theme-picker']"),
            targetPage.locator('::-p-xpath(//*[@data-testid=\\"button-theme-picker\\"])'),
            targetPage.locator(":scope >>> [data-testid='button-theme-picker']")
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 18.75,
                y: 16.125,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(Toggle dark mode)'),
            targetPage.locator('#main-content button.inline-flex'),
            targetPage.locator('::-p-xpath(//*[@id=\\"main-content\\"]/header/div[5]/button[3])'),
            targetPage.locator(':scope >>> #main-content button.inline-flex')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 16.75,
                y: 16.875,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('::-p-aria(Toggle dark mode)'),
            targetPage.locator('#main-content button.inline-flex'),
            targetPage.locator('::-p-xpath(//*[@id=\\"main-content\\"]/header/div[5]/button[3])'),
            targetPage.locator(':scope >>> #main-content button.inline-flex')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 14.75,
                y: 18.875,
              },
            });
    }
    await lhFlow.endTimespan();
    const lhFlowReport = await lhFlow.generateReport();
    fs.writeFileSync(__dirname + '/flow.report.html', lhFlowReport)

    await browser.close();

})().catch(err => {
    console.error(err);
    process.exit(1);
});
