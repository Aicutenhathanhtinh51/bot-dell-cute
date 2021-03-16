module.exports = function({ api, __GLOBAL, client, utils }) {
	const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const logger = require("../../utils/log.js");
	const stringSimilarity = require('string-similarity');
	return async function({ event }) {
		var timeStart = Date.now();
		let { body: contentMessage, senderID, threadID, messageID } = event;
		senderID = parseInt(senderID);
		threadID = parseInt(threadID);
		var prefixRegex = new RegExp(`^(<@!?${senderID}>|${escapeRegex(__GLOBAL.settings.PREFIX )})\\s*`);
		if (!prefixRegex.test(contentMessage)) return;

		//=========Get command user use=========//

		var [matchedPrefix] = contentMessage.match(prefixRegex);
		var args = contentMessage.slice(matchedPrefix.length).trim().split(/ +/);
		var commandName = args.shift().toLowerCase();
		var command = client.commands.get(commandName);
		if (!command) {
			var allCommandName = [];
			var commandValues = client.commands.values();
			for (const cmd of commandValues) allCommandName.push(cmd.config.name);
			var checker = stringSimilarity.findBestMatch(commandName, allCommandName);
			if (checker.bestMatch.rating >= 0.5) command = client.commands.get(checker.bestMatch.target);
			else return api.setMessageReaction('❌', event.messageID, (err) => (err) ? logger('Đã có lỗi xảy ra khi thực thi setMessageReaction', 2) : '', true);
		}

		//========= Check permssion =========//
		
		var permssion;
		if (command.config.hasPermssion == 2 && !__GLOBAL.settings.ADMINBOT.includes(senderID)) return api.sendMessage(`❌ Bạn không đủ quyền hạn người điều hành bot đề sử dụng lệnh ${command.config.name}`, threadID, messageID);
		else permssion = 2;

		//=========Check cooldown=========//

		if (!client.cooldowns.has(command.config.name)) client.cooldowns.set(command.config.name, new Map());
		const now = Date.now();
		const timestamps = client.cooldowns.get(command.config.name);
		const cooldownAmount = (command.config.cooldowns || 1) * 1000;
		if (timestamps.has(senderID)) {
			const expirationTime = timestamps.get(senderID) + cooldownAmount;
			if (now < expirationTime) return api.setMessageReaction('⏱', event.messageID, (err) => (err) ? logger('Đã có lỗi xảy ra khi thực thi setMessageReaction', 2) : '', true);
		}
		timestamps.set(senderID, now);
		setTimeout(() => timestamps.delete(senderID), cooldownAmount)

		//========= Run command =========//
		try {
			command.run({ api, __GLOBAL, client, event, args, utils, permssion });
		}
		catch (error) {
			logger(error + " tại lệnh: " + command.config.name, "error");
			api.sendMessage("Đã có lỗi xảy ra khi thực khi lệnh đó. Lỗi: " + error, threadID);
		}
		if (__GLOBAL.settings.DeveloperMode == true) {
			const moment = require("moment");
			var time = moment.tz("Asia/Ho_Chi_minh").format("HH:MM:ss L");
			logger(`[ ${time} ] Command Executed: ${commandName} | User: ${senderID} | Arguments: ${args.join(" ")} | Group: ${threadID} | Process Time: ${(Date.now()) - timeStart}ms`, "[ DEV MODE ]");
		}
	}
}