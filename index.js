const path = require('path');
const fs = require('fs');

const SettingsInterface = require('tera-mod-ui').Settings;
const settingsStructure = require('./Additional-Data/Module-Settings/settings_structure.js');

module.exports = function ItemDataHelper(mod) {

    if (mod.proxyAuthor !== 'caali' || !mod.clientInterface) {
        mod.warn('Pinkie Pie made a big mistake at the 25th April 2020 therefore I decided to drop every kind of support.');
        mod.warn('You can now either use this module on Tera Toolbox or delete it.');
        mod.warn('The latest version of Tera Toolbox can be downloaded from http://tiny.cc/tera-toolbox-installer.');
        return;
    }

    let userInterface = null;

    let itemData1 = {},
        content1 = null;

    let itemData2 = {},
        content2 = null;

    let saveTimer = null;

    mod.command.add('idh', (arg1, arg2) => {
        if (arg1 === 'message') {
            mod.settings.message = !mod.settings.message;
            const enabled = 'Showing of the retrieved item data in your ingame chat is now enabled.';
            const disabled = 'Showing of the retrieved item data in your ingame chat is now disabled.';
            mod.settings.message ? sendMessage('00ff04', enabled) : sendMessage('ff1d00', disabled);
        } else if (arg1 === 'logger') {
            mod.settings.logger = !mod.settings.logger;
            mod.settings.logger ? createStream('Item-Data.json') : writeStream(content1);
            const enabled = 'Saving of the retrieved item data into a save file is now enabled.';
            const disabled = 'Saving of the retrieved item data into a save file is now completed.';
            mod.settings.logger ? sendMessage('00ff04', enabled) : sendMessage('ffff00', disabled);
        } else if (arg1 === 'all') {
            createStream('All-Item-Data.json');
            writeStream(content2);
            sendMessage('ffff00', 'Saving of all item data from the game into a save file is now completed.');
        } else if (arg1 === 'auto') {
            mod.settings.autoSave = !mod.settings.autoSave;
            const enabled = 'Auto saving of the retrieved item data into a save file is now enabled.';
            const disabled = 'Auto saving of the retrieved item data into a save file is now disabled.';
            mod.settings.autoSave ? sendMessage('00ff04', enabled) : sendMessage('ff1d00', disabled);
        } else if (arg1 === 'delay') {
            mod.settings.saveDelay = Number(arg2);
            checkConfigFile();
            sendMessage('009dff', `Auto save delay has been set to ${mod.settings.saveDelay / 1000} seconds.`);
        } else if (arg1 === 'ui') {
            handleUserInterface('show');
        }
        handleUserInterface('update');
    });

    mod.queryData('/StrSheet_Item/String/', [], true).then(results => {
        results.forEach(result => {
            if (!result.attributes.string || !result.attributes.toolTip) return;
            const item = result.attributes;
            Object.assign(itemData2, {
                [item.id]: { 'Name': item.string, 'Tooltip': item.toolTip }
            });
        });
    });

    mod.game.on('enter_game', checkConfigFile);

    mod.hook('S_SHOW_ITEM_TOOLTIP', 14, handleItemData);

    mod.hook('S_REPLY_NONDB_ITEM_INFO', 1, handleItemData);

    mod.game.on('leave_game', leaveGameCleanup);

    function checkConfigFile() {
        if (mod.settings.getAll) {
            mod.settings.getAll = false;
            mod.warn('Invalid getAll settings detected. Default settings has been applied.');
        }
        if (mod.settings.saveDelay < 15000 || mod.settings.saveDelay > 60000) {
            mod.settings.saveDelay = 15000;
            mod.warn('Invalid saveDelay settings detected. Default settings has been applied.');
        }
    }

    function handleItemData(event) {
        const item = mod.game.data.items.get(event.id ? event.id : event.item);
        if (mod.settings.message) {
            sendMessage('ffff00', `${item.name} with the item id ${item.id} retrieved.`);
        }
        if (mod.settings.logger && !Object.keys(itemData1).includes(item.id)) {
            Object.assign(itemData1, {
                [item.id]: { 'Name': item.name, 'Tooltip': item.tooltip }
            });
            handleAutoSave('refresh');
        }
    }

    function handleAutoSave(decision) {
        if (mod.settings.logger && mod.settings.autoSave && decision === 'refresh') {
            mod.clearTimeout(saveTimer);
            saveTimer = mod.setTimeout(handleAutoSave, mod.settings.saveDelay, 'execute');
        } else if (mod.settings.logger && mod.settings.autoSave && decision === 'execute') {
            mod.command.exec('idh logger');
        } else {
            mod.clearTimeout(saveTimer);
        }
    }

    function createStream(fileName) {
        const filePath = path.join(getFolderPath(), `${getTimeStamp()} ${fileName}`);
        if (fileName === 'Item-Data.json') {
            content1 = fs.createWriteStream(filePath, { flags: 'a' });
        } else {
            content2 = fs.createWriteStream(filePath, { flags: 'a' });
        }
    }

    function getFolderPath() {
        const folderPath = path.join(__dirname, 'Additional-Data/Save-Files');
        fs.existsSync(folderPath) || fs.mkdirSync(folderPath);
        return folderPath;
    }

    function getTimeStamp() {
        const options = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
        return `[${new Date().toLocaleTimeString(['ban', 'id'], options)}]`;
    }

    function writeStream(target) {
        if (!content1 && !content2) return;
        if (target === content1) {
            content1.write(JSON.stringify(itemData1, null, 4));
            content1.end();
            content1 = null;
            itemData1 = {};
        } else {
            content2.write(JSON.stringify(itemData2, null, 4));
            content2.end();
            content2 = null;
        }
    }

    function leaveGameCleanup() {
        if (mod.settings.message) {
            mod.settings.message = false;
        }
        if (mod.settings.logger) {
            mod.settings.logger = false;
        }
        writeStream(content1);
        handleUserInterface('close');
    }

    function sendMessage(color, text) {
        const silentMode = mod.manager.get('command').settings.silent_mode;
        if (silentMode) {
            mod.command.message(`${text}`);
        } else {
            mod.command.message(`<font color='#${color}'>${text}</font>`);
        }
    }

    if (global.TeraProxy.GUIMode) {
        userInterface = new SettingsInterface(mod, settingsStructure, mod.settings, {
            alwaysOnTop: true,
            width: 700,
            height: 232
        });
        userInterface.on('update', (settings) => {
            mod.settings = settings;
            handleUserInterfaceOnUpdate();
        });
    }

    function handleUserInterface(decision) {
        if (!userInterface) return;
        if (decision === 'show') {
            userInterface.show();
        } else if (decision === 'update') {
            userInterface.update(mod.settings);
        } else if (decision === 'close') {
            userInterface.close();
        } else if (decision === 'clear') {
            userInterface.close();
            userInterface = null;
        }
    }

    function handleUserInterfaceOnUpdate() {
        if (mod.settings.logger && !content1) {
            createStream('Item-Data.json');
        } else if (!mod.settings.logger && content1) {
            writeStream(content1);
        } else if (mod.settings.getAll) {
            mod.settings.getAll = false;
            createStream('All-Item-Data.json');
            writeStream(content2);
        }
        checkConfigFile();
        handleUserInterface('update');
    }

    this.saveState = () => {
        return {
            itemData1: itemData1,
            content1: content1,
            content2: content2,
            saveTimer: saveTimer
        };
    };

    this.loadState = (state) => {
        itemData1 = state.itemData1;
        content1 = state.content1;
        content2 = state.content2;
        saveTimer = state.saveTimer;
    };

    this.destructor = () => {
        handleUserInterface('clear');
        mod.game.removeListener('enter_game', checkConfigFile);
        mod.game.removeListener('leave_game', leaveGameCleanup);
        mod.command.remove('idh');
    };
};