import { RedditService } from './services/redditService.mjs';
import { DiscordService } from './services/discordService.mjs';
import { insertData, deleteData, updateData, fetchData } from './services/mongoService.mjs';
import dotenv from 'dotenv';
import { time } from 'discord.js';

dotenv.config();

const redditService = new RedditService();
const discordService = new DiscordService(process.env.DISCORD_TOKEN);
const mongoService = { insertData, deleteData, updateData, fetchData };

redditService.initialize();

const sendLoginEmbed = async () => {
    const redditBotName = redditService.getBotName();
    const discordBotName = discordService.getBotName();

    const embed = {
        author: {
            name: discordBotName,
            icon_url: discordService.getAvatarUrl(),
        },
        title: `Bot Restarted Successfully!`,
        description: `Logged into ${redditBotName}\nLogged into ${discordBotName}`,
        color: 0x00ff00,
        footer: {timestamp: new Date()},
    };

    await discordService.sendEmbed(embed);
};

sendLoginEmbed().catch(console.error);