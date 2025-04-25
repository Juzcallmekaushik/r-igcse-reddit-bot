import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { scheduleCommands, handleScheduleCommand } from '../commands/scheduleCommands.mjs';

dotenv.config();

export class DiscordService {
    constructor(token) {
        this.client = new Client({
            intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
        });

        this.client.once('ready', async () => {
            console.log(`Logged in as ${this.client.user.tag}`);

            const rest = new REST({ version: '10' }).setToken(token);

            try {
                console.log('Started refreshing application (/) commands.');

                await rest.put(
                    Routes.applicationCommands(this.client.user.id),
                    { body: scheduleCommands },
                );

                this.client.user.setActivity('Scheduling posts', { type: 'WATCHING' });

                console.log('Successfully reloaded application (/) commands.');
            } catch (error) {
                console.error(error);
            }
        });

        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isCommand()) return;

            if (interaction.commandName.startsWith('schedule')) {
                await handleScheduleCommand(interaction);
            }
        });

        this.client.login(token);
    }
}