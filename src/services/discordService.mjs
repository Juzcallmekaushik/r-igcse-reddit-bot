import dotenv from 'dotenv';
import { Client, GatewayIntentBits, REST, Routes, PresenceUpdateStatus, ActivityType } from 'discord.js';
import { schedulePosts, handleSchedulePosts } from '../commands/scheduling/schedulePosts.mjs';

dotenv.config();

export class DiscordService {
    constructor(token) {
        this.client = new Client({
            intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
        });

        this.client.once('ready', async () => {
            console.log(`Logged in as ${this.client.user.tag}`);
            await this.client.application.fetch();
            const rest = new REST({ version: '10' }).setToken(token);
            this.client.user.setActivity('r/IGCSE Subreddit', { type: ActivityType.Watching });
            try {
                console.log('Started refreshing application (/) commands.');

                await rest.put(
                    Routes.applicationCommands(this.client.application.id),
                    { body: schedulePosts},
                );


                console.log('Successfully reloaded application (/) commands.');
            } catch (error) {
                console.error(error);
            }
        });

        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isCommand()) return;

            if (interaction.commandName.startsWith('schedule')) {
                await handleSchedulePosts(interaction);
            }
        });

        this.client.login(token);
    }
}
