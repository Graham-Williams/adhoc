import puppeteer, { Browser, Page } from 'puppeteer';

const chatGptTitle = "ChatGPT";
const chatGptUrl = "https://chatgpt.com/";

// run `/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --no-first-run --no-default-browser-check --user-data-dir=$(mktemp -d -t 'chrome-remote_data_dir`
const browserGuid: string = "d00dec97-a925-43a8-87b3-3ca726561865"; // change based on output of above command
const port: number = 9222;
const wsChromeEndpointUrl: string = `ws://localhost:${port}/devtools/browser/${browserGuid}`;


(async () => {
    try {
        // connect to already open browser
        console.log("connectine to local browser on port 9222");
        const browser: Browser = await puppeteer.connect({
            browserWSEndpoint: wsChromeEndpointUrl,
        });

        // find the chatGPT home page
        // TODO: confirm logged in
        const pages: Page[] = await browser.pages();
        let chatGptPage: Page | null = null;
        for (const page of pages) {
            const title = await page.title();
            const url = page.url();
            console.log(`Title: ${title}, url: ${url}`);
            if (title == chatGptTitle && url == chatGptUrl) {
                if (chatGptPage != null) {
                    throw new Error("Found multiple chatGptPages. Should only be one open.");
                } else {
                    chatGptPage = page;
                    console.log(`Found ChatGPT page`);
                }
            }
        }
        if (chatGptPage == null) {
            throw new Error("Didn't find a ChatGPT page");
        }

        // get all all conversations
        const convoItems = await chatGptPage.$$(`li.relative`);
        console.log(`# of convos: ${convoItems.length}`);

        // for each convo: open menu, select delete, confirm delete in popup
        // TODO: confirm each element is actually found, and if not, throw specific error
        for (const convoItem of convoItems) {
            const convoTitle = await convoItem.evaluate(el => el.textContent?.trim());
            console.log(`
---------------------------------------------------
deleting convo titled: ${convoTitle}
---------------------------------------------------`);

            console.log(`hovering over convo to reveal menu button...`);
            await convoItem.hover();
            const convoMenuButton = await convoItem.$('button[id^="radix-"][aria-haspopup="menu"].flex.items-center[aria-expanded="false"]');

            console.log(`clicking menu button ${convoMenuButton} to activate menu...`);
            await convoMenuButton?.click();
            await chatGptPage.waitForSelector(`div[role="menuitem"]`, { visible: true });
            const menuItems = await chatGptPage.$$(`div[role="menuitem"]`);

            console.log(`searching menu items ${menuItems} for delete option...`)
            // TODO: is it possible to just get this delete button directly without all the charades above?
            for (const menuItem of menuItems) {
                const text = await menuItem.evaluate(el => el.textContent?.trim());
                if (text === "Delete") {
                    console.log(`found delete button ${menuItem}, clicking to activate confirmation modal...`);
                    await menuItem.click();
                    await chatGptPage.waitForSelector('div[role="dialog"][id^="radix-"]:not([data-state="closed"])', { visible: true });
                    break;
                }
            }

            const confirmationPopup = await chatGptPage.$('div[role="dialog"][id^="radix-"]:not([data-state="closed"]');
            console.log(`found confirmation modal: ${confirmationPopup}`);
            const deleteButton = await confirmationPopup?.$('.btn.relative.btn-danger');
            console.log(`found delete button ${deleteButton} within confirmation modal. clicking...`);
            deleteButton?.click();

            console.log(`deleted convo titled: ${convoTitle}. Waiting for it to be removed from the DOM...`);
            await chatGptPage.waitForFunction(
                (convo) => !document.body.contains(convo),
                {},
                convoItem
            );
        }

    } catch (error) {
        console.error("An error occurred: ", error);
    }
})();
