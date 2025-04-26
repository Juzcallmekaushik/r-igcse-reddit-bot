import { RedditService } from './services/redditService.mjs';
import { DiscordService } from './services/discordService.mjs';
import { insertData, deleteData, updateData, fetchData } from './services/mongoService.mjs';
import dotenv from 'dotenv';
import { GuildChannelManager, time } from 'discord.js';

dotenv.config();

const redditService = new RedditService();
const discordService = new DiscordService(process.env.DISCORD_TOKEN);
const mongoService = { insertData, deleteData, updateData, fetchData };

redditService.initialize();

const sendLoginEmbed = async () => {
    const me = await redditService.r.getMe();
    await new Promise(resolve => discordService.client.once('ready', resolve));
    const discordBotName = discordService.client.user?.tag || 'Unknown Bot';

    const embed = {
        author: {
            name: discordBotName,
            icon_url: discordService.client.user.displayAvatarURL(),
        },
        title: `Bot Restarted Successfully!`,
        description: `Logged in as Reddit user: [${me?.name}](https://www.reddit.com/u/${me?.name})\nLogged in as ${discordBotName}`,
        color: 0x00ff00,
        footer: { timestamp: new Date() },
    };

    const targetChannelIds = ['1365518941450932224', '1365561748341395577'];
    const targetChannels = [];

    discordService.client.guilds.cache.forEach(guild => {
        targetChannelIds.forEach(channelId => {
            const channel = guild.channels.cache.get(channelId);
            if (channel && channel.isTextBased()) {
                targetChannels.push(channel);
            }
        });
    });

    if (targetChannels.length === 0) {
        console.error('No valid text channels found.');
        return;
    }

    for (const channel of targetChannels) {
        try {
            await channel.send({ embeds: [embed] });
        } catch (err) {
            console.error(`⚠️ Failed to send embed to channel ${channel.id}:`, err.message);
        }
    }
};


sendLoginEmbed().catch(console.error);